import test from "node:test";
import assert from "node:assert/strict";
import { parseCookies, serializeClear, serializeSession } from "./cookies";

const o = { secure: false, sameSite: "lax" as const, maxAgeSec: 604800 };

test("parses several cookies", () => assert.deepEqual(parseCookies("a=1; session=abc.def; b=x%20y"), { a: "1", session: "abc.def", b: "x y" }));
test("handles a missing or malformed header", () => { assert.deepEqual(parseCookies(undefined), {}); assert.deepEqual(parseCookies("junk; =x; ok=1; bad=%E0%A4%A"), { ok: "1" }); });
test("the session cookie is HttpOnly and scoped to the whole site", () => {
  const c = serializeSession("tok", o);
  assert.match(c, /^session=tok;/); assert.match(c, /HttpOnly/); assert.match(c, /Path=\//); assert.match(c, /SameSite=Lax/); assert.match(c, /Max-Age=604800/); assert.doesNotMatch(c, /Secure/);
});
test("Secure is added in production", () => assert.match(serializeSession("tok", { ...o, secure: true }), /Secure/));
test("SameSite=None is always Secure, because browsers reject it otherwise", () => { const c = serializeSession("tok", { ...o, sameSite: "none" }); assert.match(c, /SameSite=None/); assert.match(c, /Secure/); });
test("a cookie domain is included when set", () => assert.match(serializeSession("tok", { ...o, domain: ".example.com" }), /Domain=\.example\.com/));
test("clearing expires the cookie immediately", () => { const c = serializeClear(o); assert.match(c, /^session=;/); assert.match(c, /Max-Age=0/); });
test("a token round-trips", () => { const t = "eyJhbGciOiJIUzI1NiJ9.eyJiaWQiOiJ4In0.sig-_"; assert.equal(parseCookies(serializeSession(t, o).split(";")[0])["session"], t); });
