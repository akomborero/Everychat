import crypto from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma, tenantDb } from "../../lib/prisma";
import { decrypt, encrypt } from "../../lib/crypto";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { discoverPhoneNumber, exchangeCode, registerPhone, subscribeApp, unsubscribeApp, verifyPhoneNumber } from "./whatsapp.client";

export const accountRoutes = Router();
accountRoutes.use(requireAuth);

const admin = requireRole("OWNER", "ADMIN");
const newPin = () => String(crypto.randomInt(100000, 1000000));

// Everything the client may see. Never the access token or the PIN.
const SAFE = {
  id: true, displayPhone: true, verifiedName: true, phoneNumberId: true, businessAccountId: true, status: true,
  registered: true, webhookSubscribed: true, tokenExpiresAt: true, setupError: true, createdAt: true,
} as const;

accountRoutes.get(
  "/",
  ah(async (req, res) => {
    const accounts = await tenantDb(req.auth!.businessId).whatsappAccount.findMany({ select: SAFE, orderBy: { createdAt: "asc" } });
    res.json({ accounts });
  }),
);

// Public values the browser needs to open Meta's popup. None of these are secret.
accountRoutes.get("/signup-config", (_req, res) => {
  res.json({
    enabled: Boolean(env.META_APP_ID && env.META_EMBEDDED_SIGNUP_CONFIG_ID),
    appId: env.META_APP_ID ?? null,
    configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? null,
    graphVersion: env.GRAPH_API_VERSION,
  });
});

/**
 * One-click connect (Meta Embedded Signup). The browser sends the one-time code and the ids Meta
 * reported when the customer finished the popup. We then do everything else:
 * exchange the code, verify the number, subscribe to webhooks, register the number.
 */
const signupSchema = z.object({
  code: z.string().min(10).max(4000),
  // Meta sometimes omits this in the v4 session message. We look it up from the WABA below.
  phoneNumberId: z.string().regex(/^\d{5,30}$/).nullish(),
  wabaId: z.string().regex(/^\d{5,30}$/),
  // Coexistence onboarding: the number is already registered, so skip registration.
  coexistence: z.boolean().optional().default(false),
});

accountRoutes.post(
  "/signup",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
  admin,
  ah(async (req, res) => {
    if (!env.META_APP_ID) throw new AppError(501, "One-click connect is not set up on this server yet");
    const { businessId, userId } = req.auth!;
    const d = signupSchema.parse(req.body);

    // The code lives 30 seconds, so exchange it before anything slow.
    const { token, expiresAt } = await exchangeCode(d.code);

    // Meta can finish the popup without a phone_number_id. Discover it with the new token.
    let phoneNumberId = d.phoneNumberId ?? null;
    if (!phoneNumberId) {
      const numbers = await discoverPhoneNumber(d.wabaId, token);
      phoneNumberId = numbers[0]?.phoneNumberId ?? null;
      if (!phoneNumberId) throw new AppError(400, "Meta connected your WhatsApp account but didn't include a phone number. Go back to the Facebook window, add a number, and try again.");
    }

    // Unscoped on purpose: we must see whether ANOTHER business already owns this number.
    const existing = await prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
    if (existing && existing.businessId !== businessId) throw new AppError(409, "This WhatsApp number is already connected to another business");

    const info = await verifyPhoneNumber(phoneNumberId, token); // proves this token really controls this number

    const pin = existing?.pinEnc ? decrypt(existing.pinEnc) : newPin();
    const subscribed = await subscribeApp(d.wabaId, token);
    // Coexistence numbers are already registered with WhatsApp, so skip that step.
    const reg = d.coexistence ? ({ ok: true } as const) : await registerPhone(phoneNumberId, token, pin);

    const data = {
      displayPhone: info.displayPhone,
      verifiedName: info.verifiedName ?? null,
      businessAccountId: d.wabaId,
      accessTokenEnc: encrypt(token),
      tokenExpiresAt: expiresAt,
      pinEnc: d.coexistence ? null : encrypt(pin),
      status: "ACTIVE" as const,
      registered: reg.ok,
      webhookSubscribed: subscribed,
      setupError: reg.ok ? null : reg.error,
    };
    const db = tenantDb(businessId);
    const account = await db.whatsappAccount.upsert({
      where: { phoneNumberId },
      create: { businessId, phoneNumberId, ...data },
      update: data,
      select: SAFE,
    });
    await db.auditLog.create({ data: { businessId, userId, action: "whatsapp.embedded_signup", metadata: { phoneNumberId, registered: reg.ok, subscribed } } });
    res.status(201).json({ account });
  }),
);

// Re-runs the setup steps that can fail after the popup: webhook subscription and number registration.
accountRoutes.post(
  "/:id/retry-setup",
  admin,
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const acct = await db.whatsappAccount.findFirst({ where: { id: req.params.id } });
    if (!acct) throw new AppError(404, "WhatsApp number not found");
    if (acct.status !== "ACTIVE") throw new AppError(409, "This number is disconnected. Connect it again first.");

    const token = decrypt(acct.accessTokenEnc);
    const subscribed = await subscribeApp(acct.businessAccountId, token);
    // Manually connected numbers have no PIN and are already live, so we never re-register those.
    const embedded = Boolean(acct.pinEnc);
    const reg = embedded ? await registerPhone(acct.phoneNumberId, token, decrypt(acct.pinEnc!)) : ({ ok: true } as const);

    const account = await db.whatsappAccount.update({
      where: { id: acct.id },
      data: { webhookSubscribed: subscribed, registered: reg.ok, setupError: reg.ok ? null : reg.error },
      select: SAFE,
    });
    res.json({ account });
  }),
);

accountRoutes.post(
  "/:id/disconnect",
  admin,
  ah(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const db = tenantDb(businessId);
    const acct = await db.whatsappAccount.findFirst({ where: { id: req.params.id } });
    if (!acct) throw new AppError(404, "WhatsApp number not found");

    // Stop webhooks for that WhatsApp account, unless another active number here shares it.
    const shared = await db.whatsappAccount.count({ where: { businessAccountId: acct.businessAccountId, status: "ACTIVE", id: { not: acct.id } } });
    if (!shared) await unsubscribeApp(acct.businessAccountId, decrypt(acct.accessTokenEnc)).catch(() => false);

    const account = await db.whatsappAccount.update({ where: { id: acct.id }, data: { status: "DISCONNECTED", webhookSubscribed: false }, select: SAFE });
    await db.auditLog.create({ data: { businessId, userId, action: "whatsapp.disconnected", metadata: { phoneNumberId: acct.phoneNumberId } } });
    res.json({ account });
  }),
);

// Manual connect with a token, for Meta test numbers and developer setups.
const connectSchema = z.object({
  phoneNumberId: z.string().trim().min(5),
  businessAccountId: z.string().trim().min(5),
  accessToken: z.string().trim().min(20),
});

accountRoutes.post(
  "/",
  admin,
  ah(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const d = connectSchema.parse(req.body);

    const existing = await prisma.whatsappAccount.findUnique({ where: { phoneNumberId: d.phoneNumberId } });
    if (existing && existing.businessId !== businessId) throw new AppError(409, "This WhatsApp number is already connected to another business");

    const info = await verifyPhoneNumber(d.phoneNumberId, d.accessToken);
    const subscribed = await subscribeApp(d.businessAccountId, d.accessToken);

    const db = tenantDb(businessId);
    const data = {
      displayPhone: info.displayPhone,
      verifiedName: info.verifiedName ?? null,
      businessAccountId: d.businessAccountId,
      accessTokenEnc: encrypt(d.accessToken),
      tokenExpiresAt: null,
      status: "ACTIVE" as const,
      registered: true,
      webhookSubscribed: subscribed,
      setupError: null,
    };
    const account = await db.whatsappAccount.upsert({
      where: { phoneNumberId: d.phoneNumberId },
      create: { businessId, phoneNumberId: d.phoneNumberId, ...data },
      update: data,
      select: SAFE,
    });
    await db.auditLog.create({ data: { businessId, userId, action: "whatsapp.connected", metadata: { phoneNumberId: d.phoneNumberId } } });
    res.status(201).json({ account, webhookSubscribed: subscribed });
  }),
);
