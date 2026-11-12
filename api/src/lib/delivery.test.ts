import test from "node:test";
import assert from "node:assert/strict";
import { nextDeliveryStatus as n } from "./delivery";

test("moves forward", () => { assert.equal(n(null, "sent"), "sent"); assert.equal(n("sent", "delivered"), "delivered"); assert.equal(n("delivered", "read"), "read"); });
test("skipped steps are fine", () => assert.equal(n(null, "read"), "read"));
test("never moves backwards", () => { assert.equal(n("read", "delivered"), null); assert.equal(n("delivered", "sent"), null); assert.equal(n("sent", "sent"), null); });
test("failure applies only before delivery", () => { assert.equal(n("sent", "failed"), "failed"); assert.equal(n(null, "failed"), "failed"); assert.equal(n("delivered", "failed"), null); assert.equal(n("read", "failed"), null); });
test("failed is final", () => assert.equal(n("failed", "delivered"), null));
test("unknown and prototype keys are ignored", () => { assert.equal(n("sent", "deleted"), null); assert.equal(n("sent", "constructor"), null); });
