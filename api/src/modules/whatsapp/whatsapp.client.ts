import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { decrypt } from "../../lib/crypto";
import { AppError } from "../../lib/errors";

const base = () => `https://graph.facebook.com/${env.GRAPH_API_VERSION}`;

async function graph(path: string, token: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${base()}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** Confirms the token can see this phone number, so bad credentials fail at connect time, not on the first customer. */
export async function verifyPhoneNumber(phoneNumberId: string, token: string) {
  const r = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name`, token);
  if (!r.ok) throw new AppError(400, r.json?.error?.message ?? "Meta rejected these credentials");
  return { displayPhone: r.json.display_phone_number as string, verifiedName: r.json.verified_name as string };
}

/** A WhatsApp Business Account must be subscribed to our app or Meta will not send its webhooks. */
export async function subscribeApp(wabaId: string, token: string) {
  const r = await graph(`/${wabaId}/subscribed_apps`, token, { method: "POST" });
  return r.ok;
}

export async function unsubscribeApp(wabaId: string, token: string) {
  const r = await graph(`/${wabaId}/subscribed_apps`, token, { method: "DELETE" });
  return r.ok;
}

/** Cloud API numbers must be registered with a two-step verification PIN before they can send or receive. */
export async function registerPhone(phoneNumberId: string, token: string, pin: string) {
  const r = await graph(`/${phoneNumberId}/register`, token, { method: "POST", body: { messaging_product: "whatsapp", pin } });
  return r.ok ? ({ ok: true } as const) : ({ ok: false, error: (r.json?.error?.message as string | undefined) ?? "Meta could not register this number" } as const);
}

/**
 * Embedded Signup returns a one-time code that expires after 30 seconds. Exchange it for the
 * customer's business token immediately. The app secret is sent server to server only.
 */
export async function exchangeCode(code: string) {
  const url = new URL(`${base()}/oauth/access_token`);
  url.search = new URLSearchParams({ client_id: env.META_APP_ID ?? "", client_secret: env.META_APP_SECRET, code }).toString();
  const res = await fetch(url);
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* some responses are a bare token */ }
  if (!res.ok) throw new AppError(400, json?.error?.message ?? "Meta rejected the authorization. The code only lasts 30 seconds, so please try again.");

  const token: string | undefined = json.access_token ?? (text && !text.trim().startsWith("{") ? text.trim() : undefined);
  if (!token) throw new AppError(502, "Meta did not return an access token");
  const expiresAt = typeof json.expires_in === "number" && json.expires_in > 0 ? new Date(Date.now() + json.expires_in * 1000) : null;
  return { token, expiresAt };
}

/** Sends from the number the conversation belongs to. Older conversations without one use the first active number. */
export async function sendText(businessId: string, to: string, body: string, accountId?: string | null) {
  const account = await prisma.whatsappAccount.findFirst({ where: { businessId, status: "ACTIVE", ...(accountId ? { id: accountId } : {}) } });
  if (!account) {
    throw new AppError(409, accountId ? "The WhatsApp number this chat uses is disconnected. Reconnect it to reply." : "Connect a WhatsApp number first");
  }

  const r = await graph(`/${account.phoneNumberId}/messages`, decrypt(account.accessTokenEnc), {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { body, preview_url: false },
    },
  });
  if (!r.ok) throw new AppError(502, r.json?.error?.message ?? "WhatsApp rejected the message");
  return { waMessageId: r.json?.messages?.[0]?.id as string | undefined };
}
