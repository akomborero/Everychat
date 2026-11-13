"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initMonitoring = initMonitoring;
exports.captureError = captureError;
exports.flushMonitoring = flushMonitoring;
const env_1 = require("../config/env");
const logger_1 = require("./logger");
// Sentry is loaded only when SENTRY_DSN is set, so it is optional. We send error details and ids,
// never message text: customers' conversations must not end up in a third-party error tool.
let sentry = null;
async function initMonitoring() {
    if (!env_1.env.SENTRY_DSN)
        return;
    try {
        sentry = await Promise.resolve().then(() => __importStar(require("@sentry/node")));
        sentry.init({ dsn: env_1.env.SENTRY_DSN, environment: env_1.env.NODE_ENV, tracesSampleRate: 0, sendDefaultPii: false });
    }
    catch (e) {
        sentry = null;
        (0, logger_1.logError)("Could not start error monitoring", e);
    }
}
function captureError(err, context = {}) {
    sentry?.captureException(err, { extra: context });
}
async function flushMonitoring() {
    try {
        await sentry?.flush(2000);
    }
    catch { /* shutting down anyway */ }
}
