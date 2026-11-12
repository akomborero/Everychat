import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dayOfWeekOf, localDateOf, localToUtc } from "./time";

test("local time becomes the right UTC instant", () => assert.equal(localToUtc("2026-10-10", "10:00", "Africa/Johannesburg").toISOString(), "2026-10-10T08:00:00.000Z"));
test("winter and summer offsets differ", () => {
  assert.equal(localToUtc("2026-01-15", "09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
  assert.equal(localToUtc("2026-07-15", "09:00", "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z");
});
test("a daylight saving change day", () => assert.equal(localToUtc("2026-03-08", "03:30", "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z"));
test("day of week", () => { assert.equal(dayOfWeekOf("2026-10-10"), 6); assert.equal(dayOfWeekOf("2026-10-11"), 0); });
test("adding days crosses month and year ends", () => { assert.equal(addDays("2026-10-30", 3), "2026-11-02"); assert.equal(addDays("2026-12-31", 1), "2027-01-01"); });
test("the local date can differ from the UTC date", () => assert.equal(localDateOf(new Date("2026-10-09T23:30:00Z"), "Africa/Johannesburg"), "2026-10-10"));
