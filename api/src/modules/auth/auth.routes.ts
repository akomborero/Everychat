import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { consumeToken, issueToken } from "../../lib/authTokens";
import { appUrl, resetEmail, sendEmail, verifyEmail } from "../../lib/email";
import { requireAuth } from "../../middleware/auth";
import { isPlatformAdmin } from "../../middleware/platformAdmin";
import { isValidTimeZone } from "../booking/time";
import { endSession, startSession } from "../../lib/session";

export const authRoutes = Router();

const HOUR = 3600 * 1000;
const strict = (limit: number, windowMs = 60 * 60 * 1000) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false });

const password = z.string().min(8).max(100);
const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  businessName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(5).max(30).optional(),
  industry: z.string().trim().max(60).optional(),
  timezone: z.string().trim().max(60).refine(isValidTimeZone, "Unknown time zone").optional(),
  password,
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });

// "tv" is the user's token version: changing the password bumps it and ends every older session.
const sign = (userId: string, businessId: string, tv: number) =>
  jwt.sign({ bid: businessId, tv }, env.JWT_SECRET, { subject: userId, expiresIn: "7d" });

async function sendVerification(user: { id: string; email: string }) {
  const raw = await issueToken(user.id, "EMAIL_VERIFY", 24 * HOUR);
  const mail = verifyEmail(`${appUrl()}/verify-email?token=${raw}`);
  return sendEmail({ to: user.email, ...mail });
}

authRoutes.post(
  "/register",
  ah(async (req, res) => {
    const d = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(d.password, 12);
    try {
      const { user, business } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name: d.name, email: d.email, passwordHash } });
        const business = await tx.business.create({
          data: { name: d.businessName, email: d.email, phone: d.phone, industry: d.industry, ...(d.timezone ? { timezone: d.timezone } : {}) },
        });
        await tx.teamMember.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
        await tx.aiAgent.create({ data: { businessId: business.id } });
        return { user, business };
      });
      void sendVerification(user); // best effort: a mail problem must never block sign-up
      startSession(res, sign(user.id, business.id, user.tokenVersion));
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "An account with this email already exists");
      }
      throw e;
    }
  }),
);

authRoutes.post(
  "/login",
  ah(async (req, res) => {
    const d = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: d.email } });
    const ok = user ? await bcrypt.compare(d.password, user.passwordHash) : false;
    if (!user || !ok) throw new AppError(401, "Incorrect email or password");

    // A user can belong to several businesses later; for now sign into the oldest membership.
    const member = await prisma.teamMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    if (!member) throw new AppError(403, "This account is not attached to any business");
    startSession(res, sign(user.id, member.businessId, user.tokenVersion));
    res.json({ ok: true });
  }),
);

authRoutes.get(
  "/me",
  requireAuth,
  ah(async (req, res) => {
    const { userId, businessId, role } = req.auth!;
    const [user, business] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerifiedAt: true, notifyNeedsHuman: true } }),
      prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { id: true, name: true, industry: true, timezone: true } }),
    ]);
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      business,
      role,
      emailVerified: Boolean(user.emailVerifiedAt),
      notifyNeedsHuman: user.notifyNeedsHuman,
      platformAdmin: isPlatformAdmin(user.email),
    });
  }),
);

// Always answers the same way, so nobody can use this form to find out which emails have accounts.
authRoutes.post(
  "/forgot-password",
  strict(5),
  ah(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = await issueToken(user.id, "PASSWORD_RESET", HOUR);
      void sendEmail({ to: user.email, ...resetEmail(`${appUrl()}/reset-password?token=${raw}`) });
    }
    res.status(204).end();
  }),
);

authRoutes.post(
  "/reset-password",
  strict(10),
  ah(async (req, res) => {
    const d = z.object({ token: z.string().min(20).max(200), password }).parse(req.body);
    const owner = await consumeToken(d.token, "PASSWORD_RESET");
    if (!owner) throw new AppError(400, "This link has expired or was already used. Ask for a new one.");
    await prisma.user.update({
      where: { id: owner.userId },
      data: { passwordHash: await bcrypt.hash(d.password, 12), tokenVersion: { increment: 1 } }, // signs out every device
    });
    // Any other reset links still outstanding are now useless.
    await prisma.authToken.updateMany({ where: { userId: owner.userId, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
    res.status(204).end();
  }),
);

authRoutes.post(
  "/send-verification",
  requireAuth,
  strict(5),
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    if (!user.emailVerifiedAt) await sendVerification(user);
    res.status(204).end();
  }),
);

authRoutes.post(
  "/verify-email",
  strict(20),
  ah(async (req, res) => {
    const { token } = z.object({ token: z.string().min(20).max(200) }).parse(req.body);
    const owner = await consumeToken(token, "EMAIL_VERIFY");
    if (!owner) throw new AppError(400, "This link has expired or was already used.");
    await prisma.user.update({ where: { id: owner.userId }, data: { emailVerifiedAt: new Date() } });
    res.status(204).end();
  }),
);

// Changing the password ends all other sessions, so this returns a fresh token for the current one.
authRoutes.post(
  "/change-password",
  requireAuth,
  strict(10),
  ah(async (req, res) => {
    const d = z.object({ currentPassword: z.string().min(1).max(100), newPassword: password }).parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    if (!(await bcrypt.compare(d.currentPassword, user.passwordHash))) throw new AppError(400, "Your current password is incorrect");
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(d.newPassword, 12), tokenVersion: { increment: 1 } },
    });
    startSession(res, sign(updated.id, req.auth!.businessId, updated.tokenVersion));
    res.status(204).end();
  }),
);

authRoutes.post("/logout", (_req, res) => { endSession(res); res.status(204).end(); });

authRoutes.patch(
  "/preferences",
  requireAuth,
  ah(async (req, res) => {
    const d = z.object({ notifyNeedsHuman: z.boolean() }).parse(req.body);
    await prisma.user.update({ where: { id: req.auth!.userId }, data: d });
    res.status(204).end();
  }),
);
