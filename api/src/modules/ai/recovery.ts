import { env } from "../../config/env";
import { logError, logInfo } from "../../lib/logger";
import { captureError } from "../../lib/monitoring";
import { prisma } from "../../lib/prisma";
import { decideRecovery } from "../../lib/recovery-rules";
import { flagForHuman } from "./handoff";
import { AI_LEASE_MS, enqueueInbound } from "./pipeline";

const MIN_AGE_MS = 60_000;

/**
 * A customer message is saved before the AI answers it. If the server restarts in between, nothing
 * would ever reply. This sweep finds those conversations and either retries them or, if they have waited
 * too long, hands them to a person. It deliberately reads across businesses: it is a platform job.
 */
export async function recoverUnanswered() {
  const now = Date.now();
  const maxAgeMs = env.RECOVERY_MAX_AGE_MINUTES * 60_000;

  const candidates = await prisma.conversation.findMany({
    where: {
      status: "OPEN",
      aiEnabled: true,
      lastMessageAt: { gte: new Date(now - 24 * 3600_000), lte: new Date(now - MIN_AGE_MS) },
      business: { agent: { is: { active: true } } },
    },
    select: { id: true, businessId: true, aiLockedAt: true },
    orderBy: { lastMessageAt: "asc" },
    take: 100,
  });

  let retried = 0, flagged = 0;
  for (const c of candidates) {
    const last = await prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" }, select: { id: true, sender: true, createdAt: true } });
    if (!last) continue;
    const action = decideRecovery({
      lastSender: last.sender,
      messageAgeMs: now - last.createdAt.getTime(),
      minAgeMs: MIN_AGE_MS,
      maxAgeMs,
      locked: Boolean(c.aiLockedAt && now - c.aiLockedAt.getTime() < AI_LEASE_MS),
    });
    if (action === "retry") {
      enqueueInbound({ businessId: c.businessId, conversationId: c.id, messageId: last.id });
      retried++;
    } else if (action === "flag") {
      // Only flags a conversation that is still waiting on the AI, and emails the team once.
      if (await flagForHuman(c.businessId, c.id, "unanswered")) {
        await prisma.auditLog.create({ data: { businessId: c.businessId, action: "ai.unanswered_flagged", metadata: { conversationId: c.id } } });
        flagged++;
      }
    }
  }
  if (retried || flagged) logInfo("Recovery sweep", { retried, flagged });
}

export function startRecovery(): () => void {
  if (env.RECOVERY_ENABLED !== "true") return () => undefined;
  const run = () => recoverUnanswered().catch((e) => { logError("Recovery sweep failed", e); captureError(e); });
  const first = setTimeout(run, 15_000);
  const timer = setInterval(run, 60_000);
  return () => { clearTimeout(first); clearInterval(timer); };
}
