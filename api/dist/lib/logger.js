"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = logError;
exports.logInfo = logInfo;
/** One JSON object per line, so hosting dashboards can search and filter the logs. */
function logError(msg, err, ctx = {}) {
    const error = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 6).join("\n") } : err;
    console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), msg, error, ...ctx }));
}
function logInfo(msg, ctx = {}) {
    console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), msg, ...ctx }));
}
