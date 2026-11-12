import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLimits, startOfUtcDay } from "./limits";

const base = { repliesLastHour: 0, tokensToday: 0, replyCap: 20, tokenLimit: 1000 };

test("allows normal use", () => assert.deepEqual(evaluateLimits(base), { ok: true }));
test("blocks when the daily token limit is reached", () => assert.deepEqual(evaluateLimits({ ...base, tokensToday: 1000 }), { ok: false, reason: "daily_tokens" }));
test("allows just under the token limit", () => assert.deepEqual(evaluateLimits({ ...base, tokensToday: 999 }), { ok: true }));
test("blocks a conversation that hit the hourly reply cap", () => assert.deepEqual(evaluateLimits({ ...base, repliesLastHour: 20 }), { ok: false, reason: "conversation_rate" }));
test("allows just under the reply cap", () => assert.deepEqual(evaluateLimits({ ...base, repliesLastHour: 19 }), { ok: true }));
test("a limit of 0 means no limit", () => assert.deepEqual(evaluateLimits({ repliesLastHour: 999, tokensToday: 9e9, replyCap: 0, tokenLimit: 0 }), { ok: true }));
test("the daily limit is reported before the conversation cap", () => assert.deepEqual(evaluateLimits({ repliesLastHour: 50, tokensToday: 5000, replyCap: 20, tokenLimit: 1000 }), { ok: false, reason: "daily_tokens" }));
test("start of the UTC day", () => assert.equal(startOfUtcDay(new Date("2026-10-09T23:59:59Z")).toISOString(), "2026-10-09T00:00:00.000Z"));
test("start of the UTC day just after midnight", () => assert.equal(startOfUtcDay(new Date("2026-10-10T00:00:01Z")).toISOString(), "2026-10-10T00:00:00.000Z"));
