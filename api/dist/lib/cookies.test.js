"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const cookies_1 = require("./cookies");
const o = { secure: false, sameSite: "lax", maxAgeSec: 604800 };
(0, node_test_1.default)("parses several cookies", () => strict_1.default.deepEqual((0, cookies_1.parseCookies)("a=1; session=abc.def; b=x%20y"), { a: "1", session: "abc.def", b: "x y" }));
(0, node_test_1.default)("handles a missing or malformed header", () => { strict_1.default.deepEqual((0, cookies_1.parseCookies)(undefined), {}); strict_1.default.deepEqual((0, cookies_1.parseCookies)("junk; =x; ok=1; bad=%E0%A4%A"), { ok: "1" }); });
(0, node_test_1.default)("the session cookie is HttpOnly and scoped to the whole site", () => {
    const c = (0, cookies_1.serializeSession)("tok", o);
    strict_1.default.match(c, /^session=tok;/);
    strict_1.default.match(c, /HttpOnly/);
    strict_1.default.match(c, /Path=\//);
    strict_1.default.match(c, /SameSite=Lax/);
    strict_1.default.match(c, /Max-Age=604800/);
    strict_1.default.doesNotMatch(c, /Secure/);
});
(0, node_test_1.default)("Secure is added in production", () => strict_1.default.match((0, cookies_1.serializeSession)("tok", { ...o, secure: true }), /Secure/));
(0, node_test_1.default)("SameSite=None is always Secure, because browsers reject it otherwise", () => { const c = (0, cookies_1.serializeSession)("tok", { ...o, sameSite: "none" }); strict_1.default.match(c, /SameSite=None/); strict_1.default.match(c, /Secure/); });
(0, node_test_1.default)("a cookie domain is included when set", () => strict_1.default.match((0, cookies_1.serializeSession)("tok", { ...o, domain: ".example.com" }), /Domain=\.example\.com/));
(0, node_test_1.default)("clearing expires the cookie immediately", () => { const c = (0, cookies_1.serializeClear)(o); strict_1.default.match(c, /^session=;/); strict_1.default.match(c, /Max-Age=0/); });
(0, node_test_1.default)("a token round-trips", () => { const t = "eyJhbGciOiJIUzI1NiJ9.eyJiaWQiOiJ4In0.sig-_"; strict_1.default.equal((0, cookies_1.parseCookies)((0, cookies_1.serializeSession)(t, o).split(";")[0])["session"], t); });
