"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeClear = exports.serializeSession = exports.SESSION_COOKIE = void 0;
exports.parseCookies = parseCookies;
exports.SESSION_COOKIE = "session";
function parseCookies(header) {
    const out = {};
    for (const part of (header ?? "").split(";")) {
        const i = part.indexOf("=");
        if (i < 0)
            continue;
        const name = part.slice(0, i).trim();
        if (!name)
            continue;
        try {
            out[name] = decodeURIComponent(part.slice(i + 1).trim());
        }
        catch { /* ignore a malformed cookie */ }
    }
    return out;
}
function attrs(o, maxAge) {
    // SameSite=None is only accepted by browsers together with Secure.
    const secure = o.secure || o.sameSite === "none";
    return [`Max-Age=${maxAge}`, "Path=/", "HttpOnly", `SameSite=${o.sameSite[0].toUpperCase()}${o.sameSite.slice(1)}`, secure ? "Secure" : "", o.domain ? `Domain=${o.domain}` : ""].filter(Boolean).join("; ");
}
/** The sign-in cookie: not readable by page scripts (HttpOnly), so injected code cannot steal the session. */
const serializeSession = (token, o) => `${exports.SESSION_COOKIE}=${encodeURIComponent(token)}; ${attrs(o, o.maxAgeSec)}`;
exports.serializeSession = serializeSession;
const serializeClear = (o) => `${exports.SESSION_COOKIE}=; ${attrs(o, 0)}`;
exports.serializeClear = serializeClear;
