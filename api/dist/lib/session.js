"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endSession = exports.startSession = exports.cookieOptions = void 0;
const env_1 = require("../config/env");
const cookies_1 = require("./cookies");
const cookieOptions = () => ({
    secure: env_1.env.NODE_ENV === "production",
    sameSite: env_1.env.COOKIE_SAMESITE,
    domain: env_1.env.COOKIE_DOMAIN || undefined,
    maxAgeSec: 7 * 24 * 3600,
});
exports.cookieOptions = cookieOptions;
const startSession = (res, token) => { res.append("Set-Cookie", (0, cookies_1.serializeSession)(token, (0, exports.cookieOptions)())); };
exports.startSession = startSession;
const endSession = (res) => { res.append("Set-Cookie", (0, cookies_1.serializeClear)((0, exports.cookieOptions)())); };
exports.endSession = endSession;
