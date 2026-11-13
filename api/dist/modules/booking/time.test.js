"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const time_1 = require("./time");
(0, node_test_1.default)("local time becomes the right UTC instant", () => strict_1.default.equal((0, time_1.localToUtc)("2026-10-10", "10:00", "Africa/Johannesburg").toISOString(), "2026-10-10T08:00:00.000Z"));
(0, node_test_1.default)("winter and summer offsets differ", () => {
    strict_1.default.equal((0, time_1.localToUtc)("2026-01-15", "09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
    strict_1.default.equal((0, time_1.localToUtc)("2026-07-15", "09:00", "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z");
});
(0, node_test_1.default)("a daylight saving change day", () => strict_1.default.equal((0, time_1.localToUtc)("2026-03-08", "03:30", "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z"));
(0, node_test_1.default)("day of week", () => { strict_1.default.equal((0, time_1.dayOfWeekOf)("2026-10-10"), 6); strict_1.default.equal((0, time_1.dayOfWeekOf)("2026-10-11"), 0); });
(0, node_test_1.default)("adding days crosses month and year ends", () => { strict_1.default.equal((0, time_1.addDays)("2026-10-30", 3), "2026-11-02"); strict_1.default.equal((0, time_1.addDays)("2026-12-31", 1), "2027-01-01"); });
(0, node_test_1.default)("the local date can differ from the UTC date", () => strict_1.default.equal((0, time_1.localDateOf)(new Date("2026-10-09T23:30:00Z"), "Africa/Johannesburg"), "2026-10-10"));
