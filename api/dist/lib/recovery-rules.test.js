"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const recovery_rules_1 = require("./recovery-rules");
const MIN = 60_000, MAX = 120 * 60_000;
const base = { lastSender: "CUSTOMER", messageAgeMs: 5 * 60_000, minAgeMs: MIN, maxAgeMs: MAX, locked: false };
(0, node_test_1.default)("retries a customer message that was never answered", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)(base), "retry"));
(0, node_test_1.default)("skips when the AI already answered", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, lastSender: "AI" }), "skip"));
(0, node_test_1.default)("skips when staff already answered", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, lastSender: "STAFF" }), "skip"));
(0, node_test_1.default)("skips while a worker holds the lease", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, locked: true }), "skip"));
(0, node_test_1.default)("skips a message that is too new (still being processed normally)", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, messageAgeMs: 10_000 }), "skip"));
(0, node_test_1.default)("retries right at the maximum age", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, messageAgeMs: MAX }), "retry"));
(0, node_test_1.default)("flags for a person once it is too old to answer automatically", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, messageAgeMs: MAX + 1 }), "flag"));
(0, node_test_1.default)("an old message that was answered is never flagged", () => strict_1.default.equal((0, recovery_rules_1.decideRecovery)({ ...base, lastSender: "AI", messageAgeMs: MAX * 5 }), "skip"));
