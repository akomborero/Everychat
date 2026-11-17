"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRoutes = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const crypto_2 = require("../../lib/crypto");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const whatsapp_client_1 = require("./whatsapp.client");
exports.accountRoutes = (0, express_1.Router)();
exports.accountRoutes.use(auth_1.requireAuth);
const admin = (0, auth_1.requireRole)("OWNER", "ADMIN");
const newPin = () => String(crypto_1.default.randomInt(100000, 1000000));
// Everything the client may see. Never the access token or the PIN.
const SAFE = {
    id: true, displayPhone: true, verifiedName: true, phoneNumberId: true, businessAccountId: true, status: true,
    registered: true, webhookSubscribed: true, tokenExpiresAt: true, setupError: true, createdAt: true,
};
exports.accountRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const accounts = await (0, prisma_1.tenantDb)(req.auth.businessId).whatsappAccount.findMany({ select: SAFE, orderBy: { createdAt: "asc" } });
    res.json({ accounts });
}));
// Public values the browser needs to open Meta's popup. None of these are secret.
exports.accountRoutes.get("/signup-config", (_req, res) => {
    res.json({
        enabled: Boolean(env_1.env.META_APP_ID && env_1.env.META_EMBEDDED_SIGNUP_CONFIG_ID),
        appId: env_1.env.META_APP_ID ?? null,
        configId: env_1.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? null,
        graphVersion: env_1.env.GRAPH_API_VERSION,
    });
});
/**
 * One-click connect (Meta Embedded Signup). The browser sends the one-time code and the ids Meta
 * reported when the customer finished the popup. We then do everything else:
 * exchange the code, verify the number, subscribe to webhooks, register the number.
 */
const signupSchema = zod_1.z.object({
    code: zod_1.z.string().min(10).max(4000),
    // Meta sometimes omits this in the v4 session message. We look it up from the WABA below.
    phoneNumberId: zod_1.z.string().regex(/^\d{5,30}$/).nullish(),
    wabaId: zod_1.z.string().regex(/^\d{5,30}$/),
    // Coexistence onboarding: the number is already registered, so skip registration.
    coexistence: zod_1.z.boolean().optional().default(false),
});
exports.accountRoutes.post("/signup", (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), admin, (0, errors_1.ah)(async (req, res) => {
    if (!env_1.env.META_APP_ID)
        throw new errors_1.AppError(501, "One-click connect is not set up on this server yet");
    const { businessId, userId } = req.auth;
    const d = signupSchema.parse(req.body);
    // The code lives 30 seconds, so exchange it before anything slow.
    const { token, expiresAt } = await (0, whatsapp_client_1.exchangeCode)(d.code);
    // Meta can finish the popup without a phone_number_id. Discover it with the new token.
    let phoneNumberId = d.phoneNumberId ?? null;
    if (!phoneNumberId) {
        const numbers = await (0, whatsapp_client_1.discoverPhoneNumber)(d.wabaId, token);
        phoneNumberId = numbers[0]?.phoneNumberId ?? null;
        if (!phoneNumberId)
            throw new errors_1.AppError(400, "Meta connected your WhatsApp account but didn't include a phone number. Go back to the Facebook window, add a number, and try again.");
    }
    // Unscoped on purpose: we must see whether ANOTHER business already owns this number.
    const existing = await prisma_1.prisma.whatsappAccount.findUnique({ where: { phoneNumberId } });
    if (existing && existing.businessId !== businessId)
        throw new errors_1.AppError(409, "This WhatsApp number is already connected to another business");
    const info = await (0, whatsapp_client_1.verifyPhoneNumber)(phoneNumberId, token); // proves this token really controls this number
    const pin = existing?.pinEnc ? (0, crypto_2.decrypt)(existing.pinEnc) : newPin();
    const subscribed = await (0, whatsapp_client_1.subscribeApp)(d.wabaId, token);
    // Coexistence numbers are already registered with WhatsApp, so skip that step.
    const reg = d.coexistence ? { ok: true } : await (0, whatsapp_client_1.registerPhone)(phoneNumberId, token, pin);
    const data = {
        displayPhone: info.displayPhone,
        verifiedName: info.verifiedName ?? null,
        businessAccountId: d.wabaId,
        accessTokenEnc: (0, crypto_2.encrypt)(token),
        tokenExpiresAt: expiresAt,
        pinEnc: d.coexistence ? null : (0, crypto_2.encrypt)(pin),
        status: "ACTIVE",
        registered: reg.ok,
        webhookSubscribed: subscribed,
        setupError: reg.ok ? null : reg.error,
    };
    const db = (0, prisma_1.tenantDb)(businessId);
    const account = await db.whatsappAccount.upsert({
        where: { phoneNumberId },
        create: { businessId, phoneNumberId, ...data },
        update: data,
        select: SAFE,
    });
    await db.auditLog.create({ data: { businessId, userId, action: "whatsapp.embedded_signup", metadata: { phoneNumberId, registered: reg.ok, subscribed } } });
    res.status(201).json({ account });
}));
// Re-runs the setup steps that can fail after the popup: webhook subscription and number registration.
exports.accountRoutes.post("/:id/retry-setup", admin, (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const acct = await db.whatsappAccount.findFirst({ where: { id: req.params.id } });
    if (!acct)
        throw new errors_1.AppError(404, "WhatsApp number not found");
    if (acct.status !== "ACTIVE")
        throw new errors_1.AppError(409, "This number is disconnected. Connect it again first.");
    const token = (0, crypto_2.decrypt)(acct.accessTokenEnc);
    const subscribed = await (0, whatsapp_client_1.subscribeApp)(acct.businessAccountId, token);
    // Manually connected numbers have no PIN and are already live, so we never re-register those.
    const embedded = Boolean(acct.pinEnc);
    const reg = embedded ? await (0, whatsapp_client_1.registerPhone)(acct.phoneNumberId, token, (0, crypto_2.decrypt)(acct.pinEnc)) : { ok: true };
    const account = await db.whatsappAccount.update({
        where: { id: acct.id },
        data: { webhookSubscribed: subscribed, registered: reg.ok, setupError: reg.ok ? null : reg.error },
        select: SAFE,
    });
    res.json({ account });
}));
exports.accountRoutes.post("/:id/disconnect", admin, (0, errors_1.ah)(async (req, res) => {
    const { businessId, userId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const acct = await db.whatsappAccount.findFirst({ where: { id: req.params.id } });
    if (!acct)
        throw new errors_1.AppError(404, "WhatsApp number not found");
    // Stop webhooks for that WhatsApp account, unless another active number here shares it.
    const shared = await db.whatsappAccount.count({ where: { businessAccountId: acct.businessAccountId, status: "ACTIVE", id: { not: acct.id } } });
    if (!shared)
        await (0, whatsapp_client_1.unsubscribeApp)(acct.businessAccountId, (0, crypto_2.decrypt)(acct.accessTokenEnc)).catch(() => false);
    const account = await db.whatsappAccount.update({ where: { id: acct.id }, data: { status: "DISCONNECTED", webhookSubscribed: false }, select: SAFE });
    await db.auditLog.create({ data: { businessId, userId, action: "whatsapp.disconnected", metadata: { phoneNumberId: acct.phoneNumberId } } });
    res.json({ account });
}));
// Manual connect with a token, for Meta test numbers and developer setups.
const connectSchema = zod_1.z.object({
    phoneNumberId: zod_1.z.string().trim().min(5),
    businessAccountId: zod_1.z.string().trim().min(5),
    accessToken: zod_1.z.string().trim().min(20),
});
exports.accountRoutes.post("/", admin, (0, errors_1.ah)(async (req, res) => {
    const { businessId, userId } = req.auth;
    const d = connectSchema.parse(req.body);
    const existing = await prisma_1.prisma.whatsappAccount.findUnique({ where: { phoneNumberId: d.phoneNumberId } });
    if (existing && existing.businessId !== businessId)
        throw new errors_1.AppError(409, "This WhatsApp number is already connected to another business");
    const info = await (0, whatsapp_client_1.verifyPhoneNumber)(d.phoneNumberId, d.accessToken);
    const subscribed = await (0, whatsapp_client_1.subscribeApp)(d.businessAccountId, d.accessToken);
    const db = (0, prisma_1.tenantDb)(businessId);
    const data = {
        displayPhone: info.displayPhone,
        verifiedName: info.verifiedName ?? null,
        businessAccountId: d.businessAccountId,
        accessTokenEnc: (0, crypto_2.encrypt)(d.accessToken),
        tokenExpiresAt: null,
        status: "ACTIVE",
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
}));
