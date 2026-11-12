import crypto from "crypto";
import type { AuthTokenType } from "@prisma/client";
import { prisma } from "./prisma";

export const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/** Creates a one-time token and returns the raw value to put in a link. Only its hash is stored. */
export async function issueToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Uses a token exactly once. Returns the owner, or null if it is unknown, expired, used or the wrong kind. */
export async function consumeToken(raw: string, type: AuthTokenType): Promise<{ userId: string } | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  // The conditional update makes "use once" safe even if two requests race.
  const { count } = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? { userId: row.userId } : null;
}
