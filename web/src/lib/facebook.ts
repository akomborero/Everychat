// Meta WhatsApp Embedded Signup (v4) in the browser.
// The popup reports results two ways, in either order: FB.login's callback gives a one-time
// `code`, and a postMessage "FINISH" event gives the phone number and WhatsApp account ids.
// We need both, then hand them straight to our server (the code expires after 30 seconds).

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { FB?: any; fbAsyncInit?: () => void }
}

let sdk: Promise<void> | null = null;

export function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (sdk) return sdk;
  sdk = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version });
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => { sdk = null; reject(new Error("Couldn't load Facebook. Check your connection, or turn off any ad blocker for this site.")); };
    document.body.appendChild(s);
  });
  return sdk;
}

export type SignupIds = {
  /** null when Meta only returns the WABA; the server then looks the number up. */
  phoneNumberId: string | null;
  wabaId: string;
  /** Coexistence onboarding - the number is already registered with WhatsApp. */
  coexistence: boolean;
};

export type SignupOutcome =
  | ({ kind: "done"; code: string } & SignupIds)
  | { kind: "cancelled"; step?: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported"; message: string };

/** The two channels can race. Once one of them lands, give the other a few seconds. */
const GRACE_MS = 8000;
const CANCEL_MS = 3000;

function isFacebookOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "facebook.com" || host === "web.facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

export type LaunchOptions = {
  timeoutMs?: number;
  /** Existing WhatsApp Business app number (Meta "coexistence onboarding"). */
  existingNumber?: boolean;
};

/** Must be called directly from a click handler, or the browser will block the popup. */
export function launchEmbeddedSignup(configId: string, options: LaunchOptions = {}): Promise<SignupOutcome> {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const existingNumber = options.existingNumber === true;
  return new Promise<SignupOutcome>((resolve) => {
    let code: string | null = null;
    let ids: SignupIds | null = null;
    let fbCallbackDone = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;

    const clearGrace = () => { if (grace) { clearTimeout(grace); grace = undefined; } };

    const finish = (outcome: SignupOutcome) => {
      if (settled) return;
      settled = true;
      clearGrace();
      window.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
      resolve(outcome);
    };

    // Never leave the user on a spinner forever, and never label a successful login
    // "cancelled" just because the message hasn't arrived yet.
    const evaluate = () => {
      clearGrace();
      if (code && ids) { finish({ kind: "done", code, ...ids }); return; }
      if (!code && !ids) {
        // The login callback fired without a code: the popup was closed. Still allow a
        // brief moment for a late FINISH message before calling it a cancellation.
        if (fbCallbackDone) grace = setTimeout(() => finish({ kind: "cancelled" }), CANCEL_MS);
        return;
      }
      grace = setTimeout(() => {
        if (code) finish({ kind: "error", message: "Meta finished the sign-in but didn't send your WhatsApp account details. Please try again." });
        else finish({ kind: "error", message: "Meta finished the sign-in but didn't send the authorization code. Please try again." });
      }, GRACE_MS);
    };

    function onMessage(ev: MessageEvent) {
      if (typeof ev.origin !== "string" || !isFacebookOrigin(ev.origin)) return;
      let msg: any;
      try { msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;

      // v4 nests the ids under `data`; older payloads put them at the top level.
      const d = msg.data && typeof msg.data === "object" ? msg.data : msg;
      const wabaId = d.waba_id ?? d.wabaId;
      const phone = d.phone_number_id ?? d.phoneNumberId;

      if (msg.event === "FINISH" || msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        if (!wabaId) {
          finish({ kind: "error", message: "Meta finished setup but didn't return your WhatsApp account. Please try again." });
          return;
        }
        ids = {
          phoneNumberId: phone ? String(phone) : null,
          wabaId: String(wabaId),
          coexistence: existingNumber || msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        };
        evaluate();
      } else if (msg.event === "FINISH_ONLY_WABA") {
        finish({ kind: "unsupported", message: "Your WhatsApp account was created, but no phone number was added. Start again and add a number when asked." });
      } else if (msg.event === "ERROR") {
        finish({ kind: "error", message: String(d.error_message ?? "Meta couldn't complete the setup. Please try again.") });
      } else if (msg.event === "CANCEL") {
        const message = d.error_message ? `${d.error_message}${d.error_id ? ` (reference ${d.error_id})` : ""}` : null;
        finish(message ? { kind: "error", message } : { kind: "cancelled", step: d.current_step });
      } else if (typeof msg.event === "string" && msg.event.startsWith("FINISH_")) {
        finish({ kind: "unsupported", message: "That type of setup isn't supported yet. Please try the standard Connect WhatsApp option." });
      }
    }

    window.addEventListener("message", onMessage);
    timer = setTimeout(() => finish({ kind: "error", message: "The connection window timed out. Please try again." }), timeoutMs);

    try {
      window.FB.login(
        (response: any) => {
          fbCallbackDone = true;
          const auth = response?.authResponse;
          if (auth?.code) code = String(auth.code);
          // Some SDK versions put the ids in the login response instead of / before the message.
          if (!ids && (auth?.waba_id || auth?.wabaId)) {
            const fallbackPhone = auth.phone_number_id ?? auth.phoneNumberId;
            ids = {
              phoneNumberId: fallbackPhone ? String(fallbackPhone) : null,
              wabaId: String(auth.waba_id ?? auth.wabaId),
              coexistence: false,
            };
          }
          evaluate();
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          // v4 is required for Meta to send the asset ids in the session-info message.
          // featureType opens the coexistence flow for numbers already in the WhatsApp Business app.
          extras: {
            version: 4,
            sessionInfoVersion: 4,
            ...(existingNumber ? { featureType: "whatsapp_business_app_onboarding" } : {}),
            setup: {},
          },
        },
      );
    } catch {
      finish({ kind: "error", message: "Couldn't open the Facebook window. Allow pop-ups for this site and try again." });
    }
  });
}
