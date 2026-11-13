"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const authTokens_1 = require("../../lib/authTokens");
const email_1 = require("../../lib/email");
const auth_1 = require("../../middleware/auth");
const platformAdmin_1 = require("../../middleware/platformAdmin");
const time_1 = require("../booking/time");
const session_1 = require("../../lib/session");
exports.authRoutes = (0, express_1.Router)();
const HOUR = 3600 * 1000;
const strict = (limit, windowMs = 60 * 60 * 1000) => (0, express_rate_limit_1.default)({ windowMs, limit, standardHeaders: true, legacyHeaders: false });
const password = zod_1.z.string().min(8).max(100);
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100),
    businessName: zod_1.z.string().trim().min(1).max(120),
    email: zod_1.z.string().trim().toLowerCase().email(),
    phone: zod_1.z.string().trim().min(5).max(30).optional(),
    industry: zod_1.z.string().trim().max(60).optional(),
    timezone: zod_1.z.string().trim().max(60).refine(time_1.isValidTimeZone, "Unknown time zone").optional(),
    password,
});
const loginSchema = zod_1.z.object({ email: zod_1.z.string().trim().toLowerCase().email(), password: zod_1.z.string().min(1).max(100) });
// "tv" is the user's token version: changing the password bumps it and ends every older session.
const sign = (userId, businessId, tv) => jsonwebtoken_1.default.sign({ bid: businessId, tv }, env_1.env.JWT_SECRET, { subject: userId, expiresIn: "7d" });
async function sendVerification(user) {
    const raw = await (0, authTokens_1.issueToken)(user.id, "EMAIL_VERIFY", 24 * HOUR);
    const mail = (0, email_1.verifyEmail)(`${(0, email_1.appUrl)()}/verify-email?token=${raw}`);
    return (0, email_1.sendEmail)({ to: user.email, ...mail });
}
exports.authRoutes.post("/register", (0, errors_1.ah)(async (req, res) => {
    const d = registerSchema.parse(req.body);
    const passwordHash = await bcryptjs_1.default.hash(d.password, 12);
    try {
        const { user, business } = await prisma_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({ data: { name: d.name, email: d.email, passwordHash } });
            const business = await tx.business.create({
                data: { name: d.businessName, email: d.email, phone: d.phone, industry: d.industry, ...(d.timezone ? { timezone: d.timezone } : {}) },
            });
            await tx.teamMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
            await tx.aiAgent.create({ data: { businessId: business.id } });
            return { user, business };
        });
        void sendVerification(user); // best effort: a mail problem must never block sign-up
        (0, session_1.startSession)(res, sign(user.id, business.id, user.tokenVersion));
        res.status(201).json({ ok: true });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            throw new errors_1.AppError(409, "An account with this email already exists");
        }
        throw e;
    }
}));
exports.authRoutes.post("/login", (0, errors_1.ah)(async (req, res) => {
    const d = loginSchema.parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { email: d.email } });
    const ok = user ? await bcryptjs_1.default.compare(d.password, user.passwordHash) : false;
    if (!user || !ok)
        throw new errors_1.AppError(401, "Incorrect email or password");
    // A user can belong to several businesses later; for now sign into the oldest membership.
    const member = await prisma_1.prisma.teamMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (!member)
        throw new errors_1.AppError(403, "This account is not attached to any business");
    (0, session_1.startSession)(res, sign(user.id, member.businessId, user.tokenVersion));
    res.json({ ok: true });
}));
exports.authRoutes.get("/me", auth_1.requireAuth, (0, errors_1.ah)(async (req, res) => {
    const { userId, businessId, role } = req.auth;
    const [user, business] = await Promise.all([
        prisma_1.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerifiedAt: true, notifyNeedsHuman: true } }),
        prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { id: true, name: true, industry: true, timezone: true } }),
    ]);
    res.json({
        user: { id: user.id, name: user.name, email: user.email },
        business,
        role,
        emailVerified: Boolean(user.emailVerifiedAt),
        notifyNeedsHuman: user.notifyNeedsHuman,
        platformAdmin: (0, platformAdmin_1.isPlatformAdmin)(user.email),
    });
}));
// Always answers the same way, so nobody can use this form to find out which emails have accounts.
exports.authRoutes.post("/forgot-password", strict(5), (0, errors_1.ah)(async (req, res) => {
    const { email } = zod_1.z.object({ email: zod_1.z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (user) {
        const raw = await (0, authTokens_1.issueToken)(user.id, "PASSWORD_RESET", HOUR);
        void (0, email_1.sendEmail)({ to: user.email, ...(0, email_1.resetEmail)(`${(0, email_1.appUrl)()}/reset-password?token=${raw}`) });
    }
    res.status(204).end();
}));
exports.authRoutes.post("/reset-password", strict(10), (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ token: zod_1.z.string().min(20).max(200), password }).parse(req.body);
    const owner = await (0, authTokens_1.consumeToken)(d.token, "PASSWORD_RESET");
    if (!owner)
        throw new errors_1.AppError(400, "This link has expired or was already used. Ask for a new one.");
    await prisma_1.prisma.user.update({
        where: { id: owner.userId },
        data: { passwordHash: await bcryptjs_1.default.hash(d.password, 12), tokenVersion: { increment: 1 } }, // signs out every device
    });
    // Any other reset links still outstanding are now useless.
    await prisma_1.prisma.authToken.updateMany({ where: { userId: owner.userId, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
    res.status(204).end();
}));
exports.authRoutes.post("/send-verification", auth_1.requireAuth, strict(5), (0, errors_1.ah)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
    if (!user.emailVerifiedAt)
        await sendVerification(user);
    res.status(204).end();
}));
exports.authRoutes.post("/verify-email", strict(20), (0, errors_1.ah)(async (req, res) => {
    const { token } = zod_1.z.object({ token: zod_1.z.string().min(20).max(200) }).parse(req.body);
    const owner = await (0, authTokens_1.consumeToken)(token, "EMAIL_VERIFY");
    if (!owner)
        throw new errors_1.AppError(400, "This link has expired or was already used.");
    await prisma_1.prisma.user.update({ where: { id: owner.userId }, data: { emailVerifiedAt: new Date() } });
    res.status(204).end();
}));
// Changing the password ends all other sessions, so this returns a fresh token for the current one.
exports.authRoutes.post("/change-password", auth_1.requireAuth, strict(10), (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ currentPassword: zod_1.z.string().min(1).max(100), newPassword: password }).parse(req.body);
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
    if (!(await bcryptjs_1.default.compare(d.currentPassword, user.passwordHash)))
        throw new errors_1.AppError(400, "Your current password is incorrect");
    const updated = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcryptjs_1.default.hash(d.newPassword, 12), tokenVersion: { increment: 1 } },
    });
    (0, session_1.startSession)(res, sign(updated.id, req.auth.businessId, updated.tokenVersion));
    res.status(204).end();
}));
exports.authRoutes.post("/logout", (_req, res) => { (0, session_1.endSession)(res); res.status(204).end(); });
exports.authRoutes.patch("/preferences", auth_1.requireAuth, (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ notifyNeedsHuman: zod_1.z.boolean() }).parse(req.body);
    await prisma_1.prisma.user.update({ where: { id: req.auth.userId }, data: d });
    res.status(204).end();
}));
