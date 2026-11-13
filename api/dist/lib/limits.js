"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOfUtcDay = void 0;
exports.evaluateLimits = evaluateLimits;
/** Decides whether the AI may answer. A spammer or a loop must not be able to run up the bill. */
function evaluateLimits(i) {
    if (i.tokenLimit > 0 && i.tokensToday >= i.tokenLimit)
        return { ok: false, reason: "daily_tokens" };
    if (i.replyCap > 0 && i.repliesLastHour >= i.replyCap)
        return { ok: false, reason: "conversation_rate" };
    return { ok: true };
}
const startOfUtcDay = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
exports.startOfUtcDay = startOfUtcDay;
