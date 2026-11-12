import type { Response } from "express";
import { env } from "../config/env";
import { serializeClear, serializeSession, type CookieOptions } from "./cookies";

export const cookieOptions = (): CookieOptions => ({
  secure: env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN || undefined,
  maxAgeSec: 7 * 24 * 3600,
});
export const startSession = (res: Response, token: string) => { res.append("Set-Cookie", serializeSession(token, cookieOptions())); };
export const endSession = (res: Response) => { res.append("Set-Cookie", serializeClear(cookieOptions())); };
