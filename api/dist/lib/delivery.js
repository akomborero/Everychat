"use strict";
// WhatsApp reports each message as sent, then delivered, then read, or failed.
// Events can arrive out of order, so a status may only move forward, and failure is final.
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextDeliveryStatus = nextDeliveryStatus;
const RANK = { sent: 1, delivered: 2, read: 3 };
/** The status to store, or null when the incoming event should be ignored. */
function nextDeliveryStatus(current, incoming) {
    if (current === "failed")
        return null;
    if (incoming === "failed")
        return current === "delivered" || current === "read" ? null : "failed";
    if (!Object.prototype.hasOwnProperty.call(RANK, incoming))
        return null;
    const have = current && Object.prototype.hasOwnProperty.call(RANK, current) ? RANK[current] : 0;
    return RANK[incoming] > have ? incoming : null;
}
