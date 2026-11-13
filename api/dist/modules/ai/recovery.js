"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverUnanswered = recoverUnanswered;
exports.startRecovery = startRecovery;
const env_1 = require("../../config/env");
const logger_1 = require("../../lib/logger");
const monitoring_1 = require("../../lib/monitoring");
const prisma_1 = require("../../lib/prisma");
const recovery_rules_1 = require("../../lib/recovery-rules");
const handoff_1 = require("./handoff");
const pipeline_1 = require("./pipeline");
const MIN_AGE_MS = 60_000;
/**
 * A customer message is saved before the AI answers it. If the server restarts in between, nothing
 * would ever reply. This sweep finds those conversations and either retries them or, if they have waited
 * too long, hands them to a person. It deliberately reads across businesses: it is a platform job.
 */
async function recoverUnanswered() {
    const now = Date.now();
    const maxAgeMs = env_1.env.RECOVERY_MAX_AGE_MINUTES * 60_000;
    const candidates = await prisma_1.prisma.conversation.findMany({
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
        const last = await prisma_1.prisma.message.findFirst({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" }, select: { id: true, sender: true, createdAt: true } });
        if (!last)
            continue;
        const action = (0, recovery_rules_1.decideRecovery)({
            lastSender: last.sender,
            messageAgeMs: now - last.createdAt.getTime(),
            minAgeMs: MIN_AGE_MS,
            maxAgeMs,
            locked: Boolean(c.aiLockedAt && now - c.aiLockedAt.getTime() < pipeline_1.AI_LEASE_MS),
        });
        if (action === "retry") {
            (0, pipeline_1.enqueueInbound)({ businessId: c.businessId, conversationId: c.id, messageId: last.id });
            retried++;
        }
        else if (action === "flag") {
            // Only flags a conversation that is still waiting on the AI, and emails the team once.
            if (await (0, handoff_1.flagForHuman)(c.businessId, c.id, "unanswered")) {
                await prisma_1.prisma.auditLog.create({ data: { businessId: c.businessId, action: "ai.unanswered_flagged", metadata: { conversationId: c.id } } });
                flagged++;
            }
        }
    }
    if (retried || flagged)
        (0, logger_1.logInfo)("Recovery sweep", { retried, flagged });
}
function startRecovery() {
    if (env_1.env.RECOVERY_ENABLED !== "true")
        return () => undefined;
    const run = () => recoverUnanswered().catch((e) => { (0, logger_1.logError)("Recovery sweep failed", e); (0, monitoring_1.captureError)(e); });
    const first = setTimeout(run, 15_000);
    const timer = setInterval(run, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
}
