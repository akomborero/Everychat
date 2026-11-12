import test from "node:test";
import assert from "node:assert/strict";
import { decideRecovery } from "./recovery-rules";

const MIN = 60_000, MAX = 120 * 60_000;
const base = { lastSender: "CUSTOMER", messageAgeMs: 5 * 60_000, minAgeMs: MIN, maxAgeMs: MAX, locked: false };

test("retries a customer message that was never answered", () => assert.equal(decideRecovery(base), "retry"));
test("skips when the AI already answered", () => assert.equal(decideRecovery({ ...base, lastSender: "AI" }), "skip"));
test("skips when staff already answered", () => assert.equal(decideRecovery({ ...base, lastSender: "STAFF" }), "skip"));
test("skips while a worker holds the lease", () => assert.equal(decideRecovery({ ...base, locked: true }), "skip"));
test("skips a message that is too new (still being processed normally)", () => assert.equal(decideRecovery({ ...base, messageAgeMs: 10_000 }), "skip"));
test("retries right at the maximum age", () => assert.equal(decideRecovery({ ...base, messageAgeMs: MAX }), "retry"));
test("flags for a person once it is too old to answer automatically", () => assert.equal(decideRecovery({ ...base, messageAgeMs: MAX + 1 }), "flag"));
test("an old message that was answered is never flagged", () => assert.equal(decideRecovery({ ...base, lastSender: "AI", messageAgeMs: MAX * 5 }), "skip"));
