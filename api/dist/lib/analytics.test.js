"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const analytics_1 = require("./analytics");
const t = (s) => new Date(`2026-10-10T${s}Z`);
(0, node_test_1.default)("first response is customer's first message to the first reply after it", () => {
    strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "CUSTOMER", createdAt: t("10:00:00") }, { sender: "AI", createdAt: t("10:00:07") }, { sender: "CUSTOMER", createdAt: t("10:01:00") }]), 7000);
});
(0, node_test_1.default)("it ignores message order in the input", () => {
    strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "AI", createdAt: t("10:00:30") }, { sender: "CUSTOMER", createdAt: t("10:00:00") }]), 30000);
});
(0, node_test_1.default)("staff replies count too", () => strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "CUSTOMER", createdAt: t("09:00:00") }, { sender: "STAFF", createdAt: t("09:10:00") }]), 600000));
(0, node_test_1.default)("no reply yet, or no customer message, gives null", () => {
    strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "CUSTOMER", createdAt: t("10:00:00") }]), null);
    strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "AI", createdAt: t("10:00:00") }]), null);
    strict_1.default.equal((0, analytics_1.firstResponseMs)([]), null);
});
(0, node_test_1.default)("a reply before the customer wrote is not a response", () => {
    strict_1.default.equal((0, analytics_1.firstResponseMs)([{ sender: "STAFF", createdAt: t("08:00:00") }, { sender: "CUSTOMER", createdAt: t("09:00:00") }]), null);
});
(0, node_test_1.default)("median of odd, even, single and empty lists", () => {
    strict_1.default.equal((0, analytics_1.median)([5, 1, 3]), 3);
    strict_1.default.equal((0, analytics_1.median)([4, 1, 3, 2]), 2.5);
    strict_1.default.equal((0, analytics_1.median)([7]), 7);
    strict_1.default.equal((0, analytics_1.median)([]), null);
});
(0, node_test_1.default)("a ratio with nothing to divide by is null, not 0 or NaN", () => { strict_1.default.equal((0, analytics_1.ratio)(1, 4), 0.25); strict_1.default.equal((0, analytics_1.ratio)(0, 5), 0); strict_1.default.equal((0, analytics_1.ratio)(3, 0), null); });
(0, node_test_1.default)("top counts group spelling and spacing and keep the most common first", () => {
    const out = (0, analytics_1.topCounts)(["Standard package", "standard  package", " Premium ", "Standard Package", null, "", "Consultation", "premium"], 2);
    strict_1.default.deepEqual(out.map((x) => x.count), [3, 2]);
    strict_1.default.equal(out[0].value, "Standard package");
});
(0, node_test_1.default)("ties are ordered alphabetically so results are stable", () => strict_1.default.deepEqual((0, analytics_1.topCounts)(["b", "a"], 5).map((x) => x.value), ["a", "b"]));
(0, node_test_1.default)("buckets dates into day labels and ignores dates outside the range", () => {
    const days = ["2026-10-08", "2026-10-09", "2026-10-10"];
    const toDay = (d) => d.toISOString().slice(0, 10);
    strict_1.default.deepEqual((0, analytics_1.bucketByDay)([new Date("2026-10-08T01:00:00Z"), new Date("2026-10-10T05:00:00Z"), new Date("2026-10-10T23:00:00Z"), new Date("2026-09-01T00:00:00Z")], days, toDay), [1, 0, 2]);
});
(0, node_test_1.default)("buckets can use a local-day function", () => {
    const toDay = (d) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10); // UTC+2
    strict_1.default.deepEqual((0, analytics_1.bucketByDay)([new Date("2026-10-09T23:30:00Z")], ["2026-10-09", "2026-10-10"], toDay), [0, 1]);
});
(0, node_test_1.default)("repeated questions are grouped and the most asked comes first", () => {
    const g = (0, analytics_1.groupQuestions)([
        { id: "1", question: "Do you deliver?", createdAt: new Date("2026-10-01") },
        { id: "2", question: "What are your hours", createdAt: new Date("2026-10-02") },
        { id: "3", question: "do you  deliver?", createdAt: new Date("2026-10-05") },
        { id: "4", question: "   ", createdAt: new Date("2026-10-06") },
    ]);
    strict_1.default.equal(g.length, 2);
    strict_1.default.deepEqual(g[0].ids, ["1", "3"]);
    strict_1.default.equal(g[0].count, 2);
    strict_1.default.equal(g[0].lastAt.toISOString().slice(0, 10), "2026-10-05");
    strict_1.default.equal(g[1].question, "What are your hours");
});
