"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneNumber = verifyPhoneNumber;
exports.subscribeApp = subscribeApp;
exports.unsubscribeApp = unsubscribeApp;
exports.registerPhone = registerPhone;
exports.exchangeCode = exchangeCode;
exports.sendText = sendText;
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const crypto_1 = require("../../lib/crypto");
const errors_1 = require("../../lib/errors");
const base = () => `https://graph.facebook.com/${env_1.env.GRAPH_API_VERSION}`;
async function graph(path, token, init) {
    const res = await fetch(`${base()}${path}`, {
        method: init?.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
}
/** Confirms the token can see this phone number, so bad credentials fail at connect time, not on the first customer. */
async function verifyPhoneNumber(phoneNumberId, token) {
    const r = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name`, token);
    if (!r.ok) {
        const msg = r.json?.error?.message;
        throw new errors_1.AppError(400, msg ? `WhatsApp couldn't verify this number: ${msg}` : "We couldn't verify this WhatsApp number. Please try connecting again.");
    }
    return { displayPhone: r.json.display_phone_number, verifiedName: r.json.verified_name };
}
/** A WhatsApp Business Account must be subscribed to our app or Meta will not send its webhooks. */
async function subscribeApp(wabaId, token) {
    const r = await graph(`/${wabaId}/subscribed_apps`, token, { method: "POST" });
    return r.ok;
}
async function unsubscribeApp(wabaId, token) {
    const r = await graph(`/${wabaId}/subscribed_apps`, token, { method: "DELETE" });
    return r.ok;
}
/** Cloud API numbers must be registered with a two-step verification PIN before they can send or receive. */
async function registerPhone(phoneNumberId, token, pin) {
    const r = await graph(`/${phoneNumberId}/register`, token, { method: "POST", body: { messaging_product: "whatsapp", pin } });
    return r.ok ? { ok: true } : { ok: false, error: r.json?.error?.message ?? "Meta could not register this number" };
}
/**
 * Embedded Signup returns a one-time code that expires after 30 seconds. Exchange it for the
 * customer's business token immediately. The app secret is sent server to server only.
 */
async function exchangeCode(code) {
    const url = new URL(`${base()}/oauth/access_token`);
    url.search = new URLSearchParams({ client_id: env_1.env.META_APP_ID ?? "", client_secret: env_1.env.META_APP_SECRET, code }).toString();
    const res = await fetch(url);
    const text = await res.text();
    let json = {};
    try {
        json = JSON.parse(text);
    }
    catch { /* some responses are a bare token */ }
    if (!res.ok) {
        const msg = json?.error?.message;
        throw new errors_1.AppError(400, msg ? `We couldn't finish connecting to WhatsApp: ${msg}` : "We couldn't finish connecting to WhatsApp. The connection step timed out, so please try again.");
    }
    const token = json.access_token ?? (text && !text.trim().startsWith("{") ? text.trim() : undefined);
    if (!token)
        throw new errors_1.AppError(502, "We couldn't finish connecting to WhatsApp. Please try again.");
    const expiresAt = typeof json.expires_in === "number" && json.expires_in > 0 ? new Date(Date.now() + json.expires_in * 1000) : null;
    return { token, expiresAt };
}
/** Sends from the number the conversation belongs to. Older conversations without one use the first active number. */
async function sendText(businessId, to, body, accountId) {
    const account = await prisma_1.prisma.whatsappAccount.findFirst({ where: { businessId, status: "ACTIVE", ...(accountId ? { id: accountId } : {}) } });
    if (!account) {
        throw new errors_1.AppError(409, accountId ? "The WhatsApp number this chat uses is disconnected. Reconnect it to reply." : "Connect a WhatsApp number first");
    }
    const r = await graph(`/${account.phoneNumberId}/messages`, (0, crypto_1.decrypt)(account.accessTokenEnc), {
        method: "POST",
        body: {
            messaging_product: "whatsapp",
            to: to.replace(/^\+/, ""),
            type: "text",
            text: { body, preview_url: false },
        },
    });
    if (!r.ok) {
        const msg = r.json?.error?.message;
        throw new errors_1.AppError(502, msg ? `WhatsApp couldn't send this message: ${msg}` : "WhatsApp couldn't send this message. Please try again.");
    }
    return { waMessageId: r.json?.messages?.[0]?.id };
}
