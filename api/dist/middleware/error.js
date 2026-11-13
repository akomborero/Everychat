"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = void 0;
const zod_1 = require("zod");
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const monitoring_1 = require("../lib/monitoring");
const notFound = (_req, res) => {
    res.status(404).json({ error: "Not found" });
};
exports.notFound = notFound;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: err.flatten().fieldErrors });
    }
    if (err instanceof errors_1.AppError) {
        return res.status(err.status).json({ error: err.message });
    }
    if (err?.name === "MulterError") {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (10 MB maximum)" : "Upload failed";
        return res.status(400).json({ error: msg });
    }
    (0, logger_1.logError)("Unhandled request error", err);
    (0, monitoring_1.captureError)(err);
    res.status(500).json({ error: "Something went wrong on our side" });
};
exports.errorHandler = errorHandler;
