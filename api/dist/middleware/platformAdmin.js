"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlatformAdmin = exports.isPlatformAdmin = void 0;
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const isPlatformAdmin = (email) => env_1.env.PLATFORM_ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
exports.isPlatformAdmin = isPlatformAdmin;
/** Operators of the platform only. Answers 404 to everyone else so the panel's existence is not revealed. */
const requirePlatformAdmin = async (req, _res, next) => {
    try {
        const u = await prisma_1.prisma.user.findUnique({ where: { id: req.auth.userId }, select: { email: true } });
        if (!u || !(0, exports.isPlatformAdmin)(u.email))
            throw new errors_1.AppError(404, "Not found");
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.requirePlatformAdmin = requirePlatformAdmin;
