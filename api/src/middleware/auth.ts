import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseCookies, SESSION_COOKIE } from "../lib/cookies";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    let raw: string | undefined;
    let fromCookie = false;
    if (header?.startsWith("Bearer ")) raw = header.slice(7);
    else { raw = parseCookies(req.headers.cookie)[SESSION_COOKIE]; fromCookie = Boolean(raw); }
    if (!raw) throw new AppError(401, "Sign in required");

    // Browsers attach cookies automatically, so a cookie session must also prove the request came from our own
    // app: a custom header cannot be added by another website without our CORS policy allowing it (it does not).
    if (fromCookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && req.header("x-requested-with") !== "fetch") {
      throw new AppError(403, "Request blocked");
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(raw, env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, "Your session has expired. Please sign in again.");
    }

    // Re-check membership on every request so removed staff lose access immediately.
    const member = await prisma.teamMember.findUnique({
      where: { businessId_userId: { businessId: String(payload.bid), userId: String(payload.sub) } },
      include: { user: { select: { tokenVersion: true } } },
    });
    if (!member) throw new AppError(403, "You no longer have access to this business");
    if ((typeof payload.tv === "number" ? payload.tv : 0) !== member.user.tokenVersion) {
      throw new AppError(401, "Your session has expired. Please sign in again.");
    }

    req.auth = { userId: member.userId, businessId: member.businessId, role: member.role };
    next();
  } catch (e) {
    next(e);
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) =>
    roles.includes(req.auth!.role) ? next() : next(new AppError(403, "You don't have permission to do that"));
