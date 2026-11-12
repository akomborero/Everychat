export const SESSION_COOKIE = "session";

export interface CookieOptions { secure: boolean; sameSite: "lax" | "strict" | "none"; domain?: string; maxAgeSec: number }

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name) continue;
    try { out[name] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore a malformed cookie */ }
  }
  return out;
}

function attrs(o: CookieOptions, maxAge: number) {
  // SameSite=None is only accepted by browsers together with Secure.
  const secure = o.secure || o.sameSite === "none";
  return [`Max-Age=${maxAge}`, "Path=/", "HttpOnly", `SameSite=${o.sameSite[0].toUpperCase()}${o.sameSite.slice(1)}`, secure ? "Secure" : "", o.domain ? `Domain=${o.domain}` : ""].filter(Boolean).join("; ");
}

/** The sign-in cookie: not readable by page scripts (HttpOnly), so injected code cannot steal the session. */
export const serializeSession = (token: string, o: CookieOptions) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${attrs(o, o.maxAgeSec)}`;
export const serializeClear = (o: CookieOptions) => `${SESSION_COOKIE}=; ${attrs(o, 0)}`;
