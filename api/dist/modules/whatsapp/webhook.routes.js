"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoutes = void 0;
exports.persistInbound = persistInbound;
exports.applyStatuses = applyStatuses;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const pipeline_1 = require("../ai/pipeline");
const delivery_1 = require("../../lib/delivery");
const events_1 = require("../../lib/events");
const signature_1 = require("../../lib/signature");
exports.webhookRoutes = (0, express_1.Router)();
// Meta calls this once when you save the webhook in the developer dashboard.
exports.webhookRoutes.get("/", (req, res) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && token === env_1.env.META_VERIFY_TOKEN)
        return res.status(200).send(String(challenge));
    res.sendStatus(403);
});
/**
 * Stores each inbound message exactly once and returns references to the new ones.
 * Routing: phone_number_id -> WhatsappAccount -> businessId. Everything after that is tenant scoped.
 */
async function persistInbound(value) {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId || !value.messages?.length)
        return [];
    const account = await prisma_1.prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
    if (!account || account.status !== "ACTIVE") {
        console.warn(`Webhook for unknown or inactive phone_number_id ${phoneNumberId}`);
        return [];
    }
    const { businessId } = account;
    const db = (0, prisma_1.tenantDb)(businessId);
    const refs = [];
    for (const m of value.messages) {
        if (await db.message.findFirst({ where: { waMessageId: m.id }, select: { id: true } }))
            continue;
        const phone = `+${m.from}`;
        const name = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
        const body = m.type === "text" ? m.text?.body ?? "" : `[${m.type} message]`;
        const customer = await db.customer.upsert({
            where: { businessId_phone: { businessId, phone } },
            create: { businessId, phone, name },
            update: {},
        });
        // One conversation per customer per number. Older conversations created before numbers were tracked are adopted.
        let conversation = (await db.conversation.findFirst({
            where: { customerId: customer.id, status: { not: "CLOSED" }, OR: [{ whatsappAccountId: account.id }, { whatsappAccountId: null }] },
            orderBy: { createdAt: "desc" },
        })) ?? (await db.conversation.create({ data: { businessId, customerId: customer.id, whatsappAccountId: account.id } }));
        if (!conversation.whatsappAccountId) {
            conversation = await db.conversation.update({ where: { id: conversation.id }, data: { whatsappAccountId: account.id } });
        }
        try {
            const message = await db.message.create({
                data: { businessId, conversationId: conversation.id, sender: "CUSTOMER", body, messageType: m.type, waMessageId: m.id },
            });
            await db.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
            await db.usageRecord.create({ data: { businessId, type: "WHATSAPP_INBOUND", quantity: 1 } });
            refs.push({ businessId, conversationId: conversation.id, messageId: message.id });
        }
        catch (e) {
            // Concurrent duplicate delivery: the unique index caught it. Safe to ignore.
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002")
                continue;
            throw e;
        }
    }
    return refs;
}
/** Updates sent / delivered / read / failed on messages we sent. Never moves a status backwards. */
async function applyStatuses(value) {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!value.statuses?.length || !phoneNumberId)
        return;
    const account = await prisma_1.prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
    if (!account)
        return;
    const db = (0, prisma_1.tenantDb)(account.businessId);
    for (const s of value.statuses) {
        const msg = await db.message.findFirst({ where: { waMessageId: s.id }, select: { id: true, deliveryStatus: true } });
        if (!msg)
            continue;
        const next = (0, delivery_1.nextDeliveryStatus)(msg.deliveryStatus, s.status);
        if (!next)
            continue;
        const e = s.errors?.[0];
        const reason = e?.error_data?.details ?? e?.message ?? e?.title ?? "WhatsApp could not deliver this message";
        await db.message.update({ where: { id: msg.id }, data: { deliveryStatus: next, deliveryError: next === "failed" ? reason.slice(0, 300) : null } });
        (0, events_1.publishChange)(account.businessId);
    }
}
// The body arrives raw (see server.ts) because the signature is computed over the exact bytes.
exports.webhookRoutes.post("/", async (req, res) => {
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !(0, signature_1.validSignature)(raw, req.header("x-hub-signature-256"), env_1.env.META_APP_SECRET)) {
        return res.sendStatus(401);
    }
    let payload;
    try {
        payload = JSON.parse(raw.toString("utf8"));
    }
    catch {
        return res.sendStatus(400);
    }
    try {
        const refs = [];
        for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
                if (change.field === "messages") {
                    refs.push(...(await persistInbound(change.value)));
                    await applyStatuses(change.value);
                }
            }
        }
        // Messages are safely stored, so acknowledge now. Meta retries on anything but 200.
        res.sendStatus(200);
        // Each conversation is answered in order, in the background, after Meta has its 200.
        for (const ref of refs)
            (0, pipeline_1.enqueueInbound)(ref);
        for (const id of new Set(refs.map((r) => r.businessId)))
            (0, events_1.publishChange)(id);
    }
    catch (e) {
        console.error("Webhook processing failed:", e);
        // 500 makes Meta retry; idempotency means retries cannot duplicate messages.
        if (!res.headersSent)
            res.sendStatus(500);
    }
});
