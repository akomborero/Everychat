"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.perBusiness = exports.HOUR = exports.MINUTE = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.MINUTE = 60_000;
exports.HOUR = 60 * exports.MINUTE;
/** Limits per business (after sign-in), so one busy or abusive account cannot slow everyone else down. */
const perBusiness = (limit, windowMs) => (0, express_rate_limit_1.default)({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.businessId ?? req.ip ?? "unknown",
    message: { error: "Too many requests. Please slow down and try again shortly." },
});
exports.perBusiness = perBusiness;
