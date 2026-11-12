import crypto from "crypto";

/** Checks Meta's X-Hub-Signature-256 header against the exact raw bytes of the request body. */
export function validSignature(raw: Buffer, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith("sha256=") || !secret) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(raw).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
