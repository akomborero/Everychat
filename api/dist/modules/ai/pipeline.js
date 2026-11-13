"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_LEASE_MS = void 0;
exports.enqueueInbound = enqueueInbound;
const prisma_1 = require("../../lib/prisma");
const limits_1 = require("../../lib/limits");
const monitoring_1 = require("../../lib/monitoring");
const events_1 = require("../../lib/events");
const whatsapp_client_1 = require("../whatsapp/whatsapp.client");
const engine_1 = require("./engine");
const handoff_1 = require("./handoff");
const limits_2 = require("./limits");
const tools_1 = require("./tools");
const NON_TEXT_REPLY = "Thanks! I can only read text messages for now. Could you type your question?";
const MAX_MESSAGE_CHARS = 2000; // a customer pasting a novel must not become a huge AI bill
/** How long one worker may hold a conversation. If it crashes, the lease simply runs out and another worker can retry. */
exports.AI_LEASE_MS = 3 * 60_000;
// Fast path inside one process: a conversation is handled one message at a time.
// The database lease below is what keeps several servers (or a restart) from answering twice.
const chains = new Map();
function enqueueInbound(ref) {
    const prev = chains.get(ref.conversationId) ?? Promise.resolve();
    const next = prev
        .then(() => respond(ref))
        .catch((e) => console.error("AI pipeline error:", e instanceof Error ? e.message : e))
        .finally(() => {
        if (chains.get(ref.conversationId) === next)
            chains.delete(ref.conversationId);
    });
    chains.set(ref.conversationId, next);
}
async function respond({ businessId, conversationId }) {
    const db = (0, prisma_1.tenantDb)(businessId);
    const convo = await db.conversation.findFirst({ where: { id: conversationId }, include: { customer: true } });
    if (!convo || !convo.aiEnabled || convo.status !== "OPEN")
        return;
    const agent = await db.aiAgent.findFirst({});
    if (!agent?.active)
        return;
    // Take the lease. If someone else holds a fresh one, they are already answering this conversation.
    const { count } = await db.conversation.updateMany({
        where: { id: conversationId, OR: [{ aiLockedAt: null }, { aiLockedAt: { lt: new Date(Date.now() - exports.AI_LEASE_MS) } }] },
        data: { aiLockedAt: new Date() },
    });
    if (count !== 1)
        return;
    try {
        const recent = (await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 12 })).reverse();
        const last = recent[recent.length - 1];
        if (!last || last.sender !== "CUSTOMER")
            return; // already answered by an earlier run
        // Spend protection: stop and hand to a person instead of letting a spammer or a loop run up costs.
        const verdict = await (0, limits_2.checkAiLimits)(businessId, conversationId);
        if (!verdict.ok) {
            await (0, handoff_1.flagForHuman)(businessId, conversationId, "limit");
            const action = verdict.reason === "daily_tokens" ? "ai.daily_limit_reached" : "ai.conversation_rate_limited";
            // The daily limit is logged once a day, not once per message.
            const already = verdict.reason === "daily_tokens" && (await db.auditLog.findFirst({ where: { action, createdAt: { gte: (0, limits_1.startOfUtcDay)() } }, select: { id: true } }));
            if (!already)
                await db.auditLog.create({ data: { businessId, action, metadata: { conversationId } } });
            return;
        }
        let reply;
        let handoff = false;
        let usage = { input: 0, output: 0 };
        if (last.messageType !== "text") {
            if (recent.slice(-3).some((m) => m.sender === "AI" && m.body === NON_TEXT_REPLY))
                return;
            reply = NON_TEXT_REPLY;
        }
        else {
            const history = recent
                .filter((m) => m.sender !== "SYSTEM")
                .map((m) => ({ role: m.sender === "CUSTOMER" ? "user" : "assistant", content: m.body.slice(0, MAX_MESSAGE_CHARS) }));
            const out = await (0, engine_1.generate)({ businessId, customerId: convo.customerId, history, runTool: (0, tools_1.liveTools)(businessId, conversationId, convo.customerId) });
            reply = out.reply;
            handoff = out.handoff;
            usage = out.usage;
        }
        const { waMessageId } = await (0, whatsapp_client_1.sendText)(businessId, convo.customer.phone, reply, convo.whatsappAccountId);
        await db.message.create({ data: { businessId, conversationId, sender: "AI", body: reply, waMessageId: waMessageId ?? null, deliveryStatus: "sent" } });
        await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
        if (handoff)
            await (0, handoff_1.flagForHuman)(businessId, conversationId, "requested"); // no-op if the tool already did it
        await db.usageRecord.create({ data: { businessId, type: "WHATSAPP_OUTBOUND", quantity: 1 } });
        if (usage.input)
            await db.usageRecord.create({ data: { businessId, type: "AI_INPUT_TOKENS", quantity: usage.input } });
        if (usage.output)
            await db.usageRecord.create({ data: { businessId, type: "AI_OUTPUT_TOKENS", quantity: usage.output } });
    }
    catch (e) {
        // If the AI cannot answer, a person must see it rather than the customer being left waiting.
        await (0, handoff_1.flagForHuman)(businessId, conversationId, "failed").catch(() => undefined);
        await db.auditLog
            .create({ data: { businessId, action: "ai.failed", metadata: { conversationId, error: (e instanceof Error ? e.message : "unknown").slice(0, 200) } } })
            .catch(() => undefined);
        (0, monitoring_1.captureError)(e, { businessId, conversationId });
        throw e;
    }
    finally {
        await db.conversation.updateMany({ where: { id: conversationId }, data: { aiLockedAt: null } }).catch(() => undefined);
        (0, events_1.publishChange)(businessId);
    }
}
