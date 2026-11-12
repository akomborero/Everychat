import crypto from "crypto";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma, tenantDb } from "../../lib/prisma";
import { enqueueInbound } from "../ai/pipeline";
import { nextDeliveryStatus } from "../../lib/delivery";
import { publishChange } from "../../lib/events";
import { validSignature } from "../../lib/signature";
import type { InboundRef } from "../ai/types";

export const webhookRoutes = Router();

interface WaMessage { id: string; from: string; type: string; timestamp?: string; text?: { body: string } }
interface WaStatus {
  id: string;
  status: string;
  errors?: { title?: string; message?: string; error_data?: { details?: string } }[];
}
interface WaValue {
  statuses?: WaStatus[];
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
}

// Meta calls this once when you save the webhook in the developer dashboard.
webhookRoutes.get("/", (req, res) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN) return res.status(200).send(String(challenge));
  res.sendStatus(403);
});

/**
 * Stores each inbound message exactly once and returns references to the new ones.
 * Routing: phone_number_id -> WhatsappAccount -> businessId. Everything after that is tenant scoped.
 */
export async function persistInbound(value: WaValue): Promise<InboundRef[]> {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId || !value.messages?.length) return [];

  const account = await prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
  if (!account || account.status !== "ACTIVE") {
    console.warn(`Webhook for unknown or inactive phone_number_id ${phoneNumberId}`);
    return [];
  }
  const { businessId } = account;
  const db = tenantDb(businessId);
  const refs: InboundRef[] = [];

  for (const m of value.messages) {
    if (await db.message.findFirst({ where: { waMessageId: m.id }, select: { id: true } })) continue;

    const phone = `+${m.from}`;
    const name = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
    const body = m.type === "text" ? m.text?.body ?? "" : `[${m.type} message]`;

    const customer = await db.customer.upsert({
      where: { businessId_phone: { businessId, phone } },
      create: { businessId, phone, name },
      update: {},
    });

    // One conversation per customer per number. Older conversations created before numbers were tracked are adopted.
    let conversation =
      (await db.conversation.findFirst({
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
    } catch (e) {
      // Concurrent duplicate delivery: the unique index caught it. Safe to ignore.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return refs;
}

/** Updates sent / delivered / read / failed on messages we sent. Never moves a status backwards. */
export async function applyStatuses(value: WaValue) {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!value.statuses?.length || !phoneNumberId) return;
  const account = await prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
  if (!account) return;
  const db = tenantDb(account.businessId);

  for (const s of value.statuses) {
    const msg = await db.message.findFirst({ where: { waMessageId: s.id }, select: { id: true, deliveryStatus: true } });
    if (!msg) continue;
    const next = nextDeliveryStatus(msg.deliveryStatus, s.status);
    if (!next) continue;
    const e = s.errors?.[0];
    const reason = e?.error_data?.details ?? e?.message ?? e?.title ?? "WhatsApp could not deliver this message";
    await db.message.update({ where: { id: msg.id }, data: { deliveryStatus: next, deliveryError: next === "failed" ? reason.slice(0, 300) : null } });
    publishChange(account.businessId);
  }
}

// The body arrives raw (see server.ts) because the signature is computed over the exact bytes.
webhookRoutes.post("/", async (req, res) => {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !validSignature(raw, req.header("x-hub-signature-256"), env.META_APP_SECRET)) {
    return res.sendStatus(401);
  }

  let payload: any;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }

  try {
    const refs: InboundRef[] = [];
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
    for (const ref of refs) enqueueInbound(ref);
    for (const id of new Set(refs.map((r) => r.businessId))) publishChange(id);
  } catch (e) {
    console.error("Webhook processing failed:", e);
    // 500 makes Meta retry; idempotency means retries cannot duplicate messages.
    if (!res.headersSent) res.sendStatus(500);
  }
});
