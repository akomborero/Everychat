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

export type SignupOutcome =
  | { kind: "done"; code: string; phoneNumberId: string; wabaId: string }
  | { kind: "cancelled"; step?: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported"; message: string };

/** Must be called directly from a click handler, or the browser will block the popup. */
export function launchEmbeddedSignup(configId: string, timeoutMs = 15 * 60 * 1000): Promise<SignupOutcome> {
  return new Promise<SignupOutcome>((resolve) => {
    let code: string | null = null;
    let ids: { phoneNumberId: string; wabaId: string } | null = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (outcome: SignupOutcome) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
      resolve(outcome);
    };
    const maybeDone = () => { if (code && ids) finish({ kind: "done", code, ...ids }); };

    function onMessage(ev: MessageEvent) {
      if (typeof ev.origin !== "string" || !/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      let msg: any;
      try { msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (msg.event === "FINISH") {
        const d = msg.data ?? {};
        if (!d.phone_number_id || !d.waba_id) return finish({ kind: "error", message: "Meta finished setup but didn't return a phone number. Please try again." });
        ids = { phoneNumberId: String(d.phone_number_id), wabaId: String(d.waba_id) };
        maybeDone();
      } else if (msg.event === "FINISH_ONLY_WABA") {
        finish({ kind: "unsupported", message: "Your WhatsApp account was created, but no phone number was added. Start again and add a number when asked." });
      } else if (typeof msg.event === "string" && msg.event.startsWith("FINISH_")) {
        finish({ kind: "unsupported", message: "That type of setup isn't supported yet. Please connect a number that isn't currently used in the WhatsApp or WhatsApp Business app." });
      } else if (msg.event === "CANCEL") {
        const d = msg.data ?? {};
        if (d.error_message) finish({ kind: "error", message: `${d.error_message}${d.error_id ? ` (reference ${d.error_id})` : ""}` });
        else finish({ kind: "cancelled", step: d.current_step });
      }
    }

    window.addEventListener("message", onMessage);
    timer = setTimeout(() => finish({ kind: "error", message: "The connection window timed out. Please try again." }), timeoutMs);

    try {
      window.FB.login(
        (response: any) => {
          if (response?.authResponse?.code) { code = String(response.authResponse.code); maybeDone(); }
          // No code means the popup closed. Wait briefly in case a CANCEL or error event explains why.
          else setTimeout(() => finish({ kind: "cancelled" }), 1500);
        },
        { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {} } },
      );
    } catch {
      finish({ kind: "error", message: "Couldn't open the Facebook window. Allow pop-ups for this site and try again." });
    }
  });
}
