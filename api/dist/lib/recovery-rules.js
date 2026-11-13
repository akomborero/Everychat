"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideRecovery = decideRecovery;
/**
 * What to do with a conversation whose newest message may have been missed.
 * - retry: the customer wrote last, nobody is working on it, and the message is recent enough to still answer.
 * - flag: it has waited too long for the AI to answer now, so a person must look at it.
 */
function decideRecovery(i) {
    if (i.lastSender !== "CUSTOMER")
        return "skip"; // already answered by the AI or staff
    if (i.locked)
        return "skip"; // a worker is on it right now
    if (i.messageAgeMs < i.minAgeMs)
        return "skip"; // normal processing is probably still under way
    return i.messageAgeMs <= i.maxAgeMs ? "retry" : "flag";
}
