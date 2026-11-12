import rateLimit from "express-rate-limit";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Limits per business (after sign-in), so one busy or abusive account cannot slow everyone else down. */
export const perBusiness = (limit: number, windowMs: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.businessId ?? req.ip ?? "unknown",
    message: { error: "Too many requests. Please slow down and try again shortly." },
  });
