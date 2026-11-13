"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const limits_1 = require("./limits");
const base = { repliesLastHour: 0, tokensToday: 0, replyCap: 20, tokenLimit: 1000 };
(0, node_test_1.default)("allows normal use", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)(base), { ok: true }));
(0, node_test_1.default)("blocks when the daily token limit is reached", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ ...base, tokensToday: 1000 }), { ok: false, reason: "daily_tokens" }));
(0, node_test_1.default)("allows just under the token limit", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ ...base, tokensToday: 999 }), { ok: true }));
(0, node_test_1.default)("blocks a conversation that hit the hourly reply cap", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ ...base, repliesLastHour: 20 }), { ok: false, reason: "conversation_rate" }));
(0, node_test_1.default)("allows just under the reply cap", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ ...base, repliesLastHour: 19 }), { ok: true }));
(0, node_test_1.default)("a limit of 0 means no limit", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ repliesLastHour: 999, tokensToday: 9e9, replyCap: 0, tokenLimit: 0 }), { ok: true }));
(0, node_test_1.default)("the daily limit is reported before the conversation cap", () => strict_1.default.deepEqual((0, limits_1.evaluateLimits)({ repliesLastHour: 50, tokensToday: 5000, replyCap: 20, tokenLimit: 1000 }), { ok: false, reason: "daily_tokens" }));
(0, node_test_1.default)("start of the UTC day", () => strict_1.default.equal((0, limits_1.startOfUtcDay)(new Date("2026-10-09T23:59:59Z")).toISOString(), "2026-10-09T00:00:00.000Z"));
(0, node_test_1.default)("start of the UTC day just after midnight", () => strict_1.default.equal((0, limits_1.startOfUtcDay)(new Date("2026-10-10T00:00:01Z")).toISOString(), "2026-10-10T00:00:00.000Z"));
