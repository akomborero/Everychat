import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validSignature } from "./signature";

const secret = "app-secret";
const body = Buffer.from('{"entry":[{"changes":[]}]}');
const sign = (b: Buffer, s = secret) => "sha256=" + crypto.createHmac("sha256", s).update(b).digest("hex");

test("accepts a correct signature", () => assert.equal(validSignature(body, sign(body), secret), true));
test("rejects a changed body", () => assert.equal(validSignature(Buffer.from('{"entry":[]}'), sign(body), secret), false));
test("rejects the wrong secret", () => assert.equal(validSignature(body, sign(body, "other"), secret), false));
test("rejects a missing header", () => assert.equal(validSignature(body, undefined, secret), false));
test("rejects a header without the sha256= prefix", () => assert.equal(validSignature(body, sign(body).slice(7), secret), false));
test("rejects a signature of the wrong length", () => assert.equal(validSignature(body, "sha256=abcd", secret), false));
test("rejects everything when the secret is empty", () => assert.equal(validSignature(body, sign(body, ""), ""), false));
test("whitespace changes in the body invalidate it (raw bytes matter)", () => assert.equal(validSignature(Buffer.from(body.toString() + " "), sign(body), secret), false));
