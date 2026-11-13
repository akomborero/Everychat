"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const cookies_1 = require("../lib/cookies");
const requireAuth = async (req, _res, next) => {
    try {
        const header = req.headers.authorization;
        let raw;
        let fromCookie = false;
        if (header?.startsWith("Bearer "))
            raw = header.slice(7);
        else {
            raw = (0, cookies_1.parseCookies)(req.headers.cookie)[cookies_1.SESSION_COOKIE];
            fromCookie = Boolean(raw);
        }
        if (!raw)
            throw new errors_1.AppError(401, "Sign in required");
        // Browsers attach cookies automatically, so a cookie session must also prove the request came from our own
        // app: a custom header cannot be added by another website without our CORS policy allowing it (it does not).
        if (fromCookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && req.header("x-requested-with") !== "fetch") {
            throw new errors_1.AppError(403, "Request blocked");
        }
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(raw, env_1.env.JWT_SECRET);
        }
        catch {
            throw new errors_1.AppError(401, "Your session has expired. Please sign in again.");
        }
        // Re-check membership on every request so removed staff lose access immediately.
        const member = await prisma_1.prisma.teamMember.findUnique({
            where: { businessId_userId: { businessId: String(payload.bid), userId: String(payload.sub) } },
            include: { user: { select: { tokenVersion: true } } },
        });
        if (!member)
            throw new errors_1.AppError(403, "You no longer have access to this business");
        if ((typeof payload.tv === "number" ? payload.tv : 0) !== member.user.tokenVersion) {
            throw new errors_1.AppError(401, "Your session has expired. Please sign in again.");
        }
        req.auth = { userId: member.userId, businessId: member.businessId, role: member.role };
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.requireAuth = requireAuth;
const requireRole = (...roles) => (req, _res, next) => roles.includes(req.auth.role) ? next() : next(new errors_1.AppError(403, "You don't have permission to do that"));
exports.requireRole = requireRole;
