import test from "node:test";
import assert from "node:assert/strict";
import { connectionCount, formatEvent, MAX_CONNECTIONS_PER_BUSINESS, publishChange, subscribe } from "./events";

const sink = () => { const got: string[] = []; return { got, write: (c: string) => { got.push(c); } }; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("events are formatted for the browser's EventSource", () => assert.equal(formatEvent("changed", {}), "event: changed\ndata: {}\n\n"));

test("a change reaches every connection of that business only", async () => {
  const a = sink(), b = sink(), other = sink();
  const ua = subscribe("biz1", a)!, ub = subscribe("biz1", b)!, uo = subscribe("biz2", other)!;
  publishChange("biz1");
  await wait(250);
  assert.equal(a.got.length, 1); assert.equal(b.got.length, 1); assert.equal(other.got.length, 0);
  ua(); ub(); uo();
});

test("a burst of changes becomes one event", async () => {
  const a = sink(); const u = subscribe("biz3", a)!;
  for (let i = 0; i < 20; i++) publishChange("biz3");
  await wait(250);
  assert.equal(a.got.length, 1);
  u();
});

test("after unsubscribing, nothing is sent and the business entry is cleaned up", async () => {
  const a = sink(); const u = subscribe("biz4", a)!;
  assert.equal(connectionCount("biz4"), 1);
  u();
  assert.equal(connectionCount("biz4"), 0);
  publishChange("biz4");
  await wait(250);
  assert.equal(a.got.length, 0);
});

test("a business cannot hold unlimited connections", () => {
  const unsubs: (() => void)[] = [];
  for (let i = 0; i < MAX_CONNECTIONS_PER_BUSINESS; i++) unsubs.push(subscribe("biz5", sink())!);
  assert.equal(subscribe("biz5", sink()), null);
  unsubs.forEach((u) => u());
  assert.equal(connectionCount("biz5"), 0);
});

test("a connection that throws on write does not stop the others", async () => {
  const bad = { write: () => { throw new Error("socket closed"); } }; const good = sink();
  const u1 = subscribe("biz6", bad)!, u2 = subscribe("biz6", good)!;
  publishChange("biz6");
  await wait(250);
  assert.equal(good.got.length, 1);
  u1(); u2();
});

test("publishing with nobody connected does nothing", () => { publishChange("nobody"); });
