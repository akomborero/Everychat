import test from "node:test";
import assert from "node:assert/strict";
import { bucketByDay, firstResponseMs, groupQuestions, median, ratio, topCounts } from "./analytics";

const t = (s: string) => new Date(`2026-10-10T${s}Z`);

test("first response is customer's first message to the first reply after it", () => {
  assert.equal(firstResponseMs([{ sender: "CUSTOMER", createdAt: t("10:00:00") }, { sender: "AI", createdAt: t("10:00:07") }, { sender: "CUSTOMER", createdAt: t("10:01:00") }]), 7000);
});
test("it ignores message order in the input", () => {
  assert.equal(firstResponseMs([{ sender: "AI", createdAt: t("10:00:30") }, { sender: "CUSTOMER", createdAt: t("10:00:00") }]), 30000);
});
test("staff replies count too", () => assert.equal(firstResponseMs([{ sender: "CUSTOMER", createdAt: t("09:00:00") }, { sender: "STAFF", createdAt: t("09:10:00") }]), 600000));
test("no reply yet, or no customer message, gives null", () => {
  assert.equal(firstResponseMs([{ sender: "CUSTOMER", createdAt: t("10:00:00") }]), null);
  assert.equal(firstResponseMs([{ sender: "AI", createdAt: t("10:00:00") }]), null);
  assert.equal(firstResponseMs([]), null);
});
test("a reply before the customer wrote is not a response", () => {
  assert.equal(firstResponseMs([{ sender: "STAFF", createdAt: t("08:00:00") }, { sender: "CUSTOMER", createdAt: t("09:00:00") }]), null);
});

test("median of odd, even, single and empty lists", () => {
  assert.equal(median([5, 1, 3]), 3); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([7]), 7); assert.equal(median([]), null);
});
test("a ratio with nothing to divide by is null, not 0 or NaN", () => { assert.equal(ratio(1, 4), 0.25); assert.equal(ratio(0, 5), 0); assert.equal(ratio(3, 0), null); });

test("top counts group spelling and spacing and keep the most common first", () => {
  const out = topCounts(["Standard package", "standard  package", " Premium ", "Standard Package", null, "", "Consultation", "premium"], 2);
  assert.deepEqual(out.map((x) => x.count), [3, 2]);
  assert.equal(out[0].value, "Standard package");
});
test("ties are ordered alphabetically so results are stable", () => assert.deepEqual(topCounts(["b", "a"], 5).map((x) => x.value), ["a", "b"]));

test("buckets dates into day labels and ignores dates outside the range", () => {
  const days = ["2026-10-08", "2026-10-09", "2026-10-10"];
  const toDay = (d: Date) => d.toISOString().slice(0, 10);
  assert.deepEqual(bucketByDay([new Date("2026-10-08T01:00:00Z"), new Date("2026-10-10T05:00:00Z"), new Date("2026-10-10T23:00:00Z"), new Date("2026-09-01T00:00:00Z")], days, toDay), [1, 0, 2]);
});
test("buckets can use a local-day function", () => {
  const toDay = (d: Date) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10); // UTC+2
  assert.deepEqual(bucketByDay([new Date("2026-10-09T23:30:00Z")], ["2026-10-09", "2026-10-10"], toDay), [0, 1]);
});

test("repeated questions are grouped and the most asked comes first", () => {
  const g = groupQuestions([
    { id: "1", question: "Do you deliver?", createdAt: new Date("2026-10-01") },
    { id: "2", question: "What are your hours", createdAt: new Date("2026-10-02") },
    { id: "3", question: "do you  deliver?", createdAt: new Date("2026-10-05") },
    { id: "4", question: "   ", createdAt: new Date("2026-10-06") },
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].ids, ["1", "3"]); assert.equal(g[0].count, 2); assert.equal(g[0].lastAt.toISOString().slice(0, 10), "2026-10-05");
  assert.equal(g[1].question, "What are your hours");
});
