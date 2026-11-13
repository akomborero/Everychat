"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = void 0;
exports.issueToken = issueToken;
exports.consumeToken = consumeToken;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("./prisma");
const hashToken = (raw) => crypto_1.default.createHash("sha256").update(raw).digest("hex");
exports.hashToken = hashToken;
/** Creates a one-time token and returns the raw value to put in a link. Only its hash is stored. */
async function issueToken(userId, type, ttlMs) {
    const raw = crypto_1.default.randomBytes(32).toString("hex");
    await prisma_1.prisma.authToken.create({ data: { userId, type, tokenHash: (0, exports.hashToken)(raw), expiresAt: new Date(Date.now() + ttlMs) } });
    return raw;
}
/** Uses a token exactly once. Returns the owner, or null if it is unknown, expired, used or the wrong kind. */
async function consumeToken(raw, type) {
    const row = await prisma_1.prisma.authToken.findUnique({ where: { tokenHash: (0, exports.hashToken)(raw) } });
    if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date())
        return null;
    // The conditional update makes "use once" safe even if two requests race.
    const { count } = await prisma_1.prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    return count === 1 ? { userId: row.userId } : null;
}
