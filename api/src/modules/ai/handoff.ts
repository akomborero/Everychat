import { appUrl, needsHumanEmail, sendEmail } from "../../lib/email";
import { logError } from "../../lib/logger";
import { publishChange } from "../../lib/events";
import { prisma, tenantDb } from "../../lib/prisma";

export type HandoffReason = "requested" | "limit" | "failed" | "unanswered";

const WHY: Record<HandoffReason, string> = {
  requested: "The AI passed this conversation to your team.",
  limit: "The AI reached its usage limit, so a person needs to answer.",
  failed: "The AI couldn't reply to the latest message.",
  unanswered: "The latest message waited too long for the AI to answer.",
};

// One email per person per couple of minutes, so a burst of handovers doesn't flood an inbox. The dashboard still shows all of them.
const lastEmailed = new Map<string, number>();
const MIN_GAP_MS = 2 * 60_000;

/**
 * Moves an open conversation to "Needs a person", stops the AI, and emails the right people once.
 * Returns false if it was already waiting for a person or is closed, so the same event never sends two emails.
 */
export async function flagForHuman(businessId: string, conversationId: string, reason: HandoffReason): Promise<boolean> {
  const db = tenantDb(businessId);
  const { count } = await db.conversation.updateMany({ where: { id: conversationId, status: "OPEN" }, data: { status: "NEEDS_HUMAN", aiEnabled: false } });
  if (count !== 1) return false;
  publishChange(businessId);
  void notifyTeam(businessId, conversationId, reason).catch((e) => logError("Needs-a-person email failed", e, { businessId, conversationId }));
  return true;
}

async function notifyTeam(businessId: string, conversationId: string, reason: HandoffReason) {
  const db = tenantDb(businessId);
  const convo = await db.conversation.findFirst({
    where: { id: conversationId },
    include: { customer: true, assignedTo: { select: { id: true, email: true, notifyNeedsHuman: true } } },
  });
  if (!convo) return;
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true } });

  // If someone owns the conversation, tell them. Otherwise tell the owner and admins.
  let recipients: { id: string; email: string }[];
  if (convo.assignedTo) {
    recipients = convo.assignedTo.notifyNeedsHuman ? [convo.assignedTo] : [];
  } else {
    const members = await db.teamMember.findMany({
      where: { role: { in: ["OWNER", "ADMIN"] } },
      include: { user: { select: { id: true, email: true, notifyNeedsHuman: true } } },
    });
    recipients = members.map((m) => m.user).filter((u) => u.notifyNeedsHuman);
  }

  const mail = needsHumanEmail({ business: business.name, who: convo.customer.name || convo.customer.phone, why: WHY[reason], link: `${appUrl()}/inbox/${conversationId}` });
  for (const r of recipients) {
    if (Date.now() - (lastEmailed.get(r.id) ?? 0) < MIN_GAP_MS) continue;
    lastEmailed.set(r.id, Date.now());
    await sendEmail({ to: r.email, ...mail });
  }
}
