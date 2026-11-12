import { env } from "../config/env";
import { logError } from "./logger";

// Sentry is loaded only when SENTRY_DSN is set, so it is optional. We send error details and ids,
// never message text: customers' conversations must not end up in a third-party error tool.
let sentry: typeof import("@sentry/node") | null = null;

export async function initMonitoring() {
  if (!env.SENTRY_DSN) return;
  try {
    sentry = await import("@sentry/node");
    sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0, sendDefaultPii: false });
  } catch (e) {
    sentry = null;
    logError("Could not start error monitoring", e);
  }
}

export function captureError(err: unknown, context: Record<string, unknown> = {}) {
  sentry?.captureException(err, { extra: context });
}

export async function flushMonitoring() {
  try { await sentry?.flush(2000); } catch { /* shutting down anyway */ }
}
