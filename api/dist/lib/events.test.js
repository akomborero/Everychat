"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const events_1 = require("./events");
const sink = () => { const got = []; return { got, write: (c) => { got.push(c); } }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(0, node_test_1.default)("events are formatted for the browser's EventSource", () => strict_1.default.equal((0, events_1.formatEvent)("changed", {}), "event: changed\ndata: {}\n\n"));
(0, node_test_1.default)("a change reaches every connection of that business only", async () => {
    const a = sink(), b = sink(), other = sink();
    const ua = (0, events_1.subscribe)("biz1", a), ub = (0, events_1.subscribe)("biz1", b), uo = (0, events_1.subscribe)("biz2", other);
    (0, events_1.publishChange)("biz1");
    await wait(250);
    strict_1.default.equal(a.got.length, 1);
    strict_1.default.equal(b.got.length, 1);
    strict_1.default.equal(other.got.length, 0);
    ua();
    ub();
    uo();
});
(0, node_test_1.default)("a burst of changes becomes one event", async () => {
    const a = sink();
    const u = (0, events_1.subscribe)("biz3", a);
    for (let i = 0; i < 20; i++)
        (0, events_1.publishChange)("biz3");
    await wait(250);
    strict_1.default.equal(a.got.length, 1);
    u();
});
(0, node_test_1.default)("after unsubscribing, nothing is sent and the business entry is cleaned up", async () => {
    const a = sink();
    const u = (0, events_1.subscribe)("biz4", a);
    strict_1.default.equal((0, events_1.connectionCount)("biz4"), 1);
    u();
    strict_1.default.equal((0, events_1.connectionCount)("biz4"), 0);
    (0, events_1.publishChange)("biz4");
    await wait(250);
    strict_1.default.equal(a.got.length, 0);
});
(0, node_test_1.default)("a business cannot hold unlimited connections", () => {
    const unsubs = [];
    for (let i = 0; i < events_1.MAX_CONNECTIONS_PER_BUSINESS; i++)
        unsubs.push((0, events_1.subscribe)("biz5", sink()));
    strict_1.default.equal((0, events_1.subscribe)("biz5", sink()), null);
    unsubs.forEach((u) => u());
    strict_1.default.equal((0, events_1.connectionCount)("biz5"), 0);
});
(0, node_test_1.default)("a connection that throws on write does not stop the others", async () => {
    const bad = { write: () => { throw new Error("socket closed"); } };
    const good = sink();
    const u1 = (0, events_1.subscribe)("biz6", bad), u2 = (0, events_1.subscribe)("biz6", good);
    (0, events_1.publishChange)("biz6");
    await wait(250);
    strict_1.default.equal(good.got.length, 1);
    u1();
    u2();
});
(0, node_test_1.default)("publishing with nobody connected does nothing", () => { (0, events_1.publishChange)("nobody"); });
