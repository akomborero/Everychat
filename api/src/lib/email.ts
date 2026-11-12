import { env } from "../config/env";

export const appUrl = () => (env.APP_URL ?? env.CORS_ORIGIN.split(",")[0]).trim().replace(/\/$/, "");

/** Sends through Resend. Returns false (never throws) so a mail problem can't break sign-up or login. */
export async function sendEmail(p: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    // Printing the message would put one-time links in production logs, so only do it while developing.
    if (env.NODE_ENV !== "production") console.log(`[email not configured] To: ${p.to}\nSubject: ${p.subject}\n${p.text}\n`);
    else console.warn("Email not sent: RESEND_API_KEY is not set");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [p.to], subject: p.subject, html: p.html, text: p.text }),
    });
    if (!res.ok) { console.error("Email send failed:", res.status, await res.text().catch(() => "")); return false; }
    return true;
  } catch (e) {
    console.error("Email send error:", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function layout(title: string, intro: string, button: string, link: string, outro: string) {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1B1633">
<h2 style="margin:0 0 12px">${esc(title)}</h2><p style="line-height:1.5">${esc(intro)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#5B3FD1;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(button)}</a></p>
<p style="color:#6E6A85;font-size:14px;line-height:1.5">${esc(outro)}<br>Or paste this link into your browser:<br>${esc(link)}</p></div>`;
  return { html, text: `${title}\n\n${intro}\n\n${link}\n\n${outro}` };
}

export const resetEmail = (link: string) => ({
  subject: `Reset your ${env.APP_NAME} password`,
  ...layout("Reset your password", "We received a request to reset your password. This link works for one hour.", "Choose a new password", link,
    "If you didn't ask for this, you can ignore this email. Your password won't change."),
});
export const verifyEmail = (link: string) => ({
  subject: `Confirm your email for ${env.APP_NAME}`,
  ...layout("Confirm your email", "Confirm this email address so you can recover your account if you ever forget your password.", "Confirm my email", link,
    "This link works for 24 hours. If you didn't create an account, you can ignore this email."),
});

export const needsHumanEmail = (p: { business: string; who: string; why: string; link: string }) => ({
  subject: `A customer needs a person at ${p.business}`,
  ...layout("A customer needs a person", `${p.who} is waiting. ${p.why}`, "Open the conversation", p.link,
    "You're receiving this because you're on the team for this business. You can turn these emails off in Settings, under Your account."),
});
