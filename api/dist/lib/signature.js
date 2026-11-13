"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validSignature = validSignature;
const crypto_1 = __importDefault(require("crypto"));
/** Checks Meta's X-Hub-Signature-256 header against the exact raw bytes of the request body. */
function validSignature(raw, header, secret) {
    if (!header?.startsWith("sha256=") || !secret)
        return false;
    const expected = Buffer.from(crypto_1.default.createHmac("sha256", secret).update(raw).digest("hex"));
    const given = Buffer.from(header.slice(7));
    return expected.length === given.length && crypto_1.default.timingSafeEqual(expected, given);
}
