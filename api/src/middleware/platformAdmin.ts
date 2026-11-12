import type { RequestHandler } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

export const isPlatformAdmin = (email: string) =>
  env.PLATFORM_ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());

/** Operators of the platform only. Answers 404 to everyone else so the panel's existence is not revealed. */
export const requirePlatformAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { email: true } });
    if (!u || !isPlatformAdmin(u.email)) throw new AppError(404, "Not found");
    next();
  } catch (e) {
    next(e);
  }
};
