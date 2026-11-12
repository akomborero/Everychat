export interface LimitInput {
  repliesLastHour: number; // AI replies already sent in this conversation in the last hour
  tokensToday: number;     // AI tokens this business has used today (UTC)
  replyCap: number;        // max AI replies per conversation per hour, 0 = no limit
  tokenLimit: number;      // max AI tokens per business per day, 0 = no limit
}
export type LimitVerdict = { ok: true } | { ok: false; reason: "daily_tokens" | "conversation_rate" };

/** Decides whether the AI may answer. A spammer or a loop must not be able to run up the bill. */
export function evaluateLimits(i: LimitInput): LimitVerdict {
  if (i.tokenLimit > 0 && i.tokensToday >= i.tokenLimit) return { ok: false, reason: "daily_tokens" };
  if (i.replyCap > 0 && i.repliesLastHour >= i.replyCap) return { ok: false, reason: "conversation_rate" };
  return { ok: true };
}

export const startOfUtcDay = (now: Date = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
