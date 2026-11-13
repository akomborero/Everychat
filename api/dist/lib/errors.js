"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ah = exports.AppError = void 0;
class AppError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.AppError = AppError;
/** Express 4 does not catch rejected promises, so wrap every async handler. */
const ah = (fn) => (req, res, next) => {
    fn(req, res, next).catch(next);
};
exports.ah = ah;
