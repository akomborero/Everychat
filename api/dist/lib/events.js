"use strict";
// Live updates over Server-Sent Events. The server tells a signed-in browser "something changed" and the
// browser reloads what it is showing. Events carry no data about customers or messages, only the fact of a change.
//
// This lives in one server's memory. With several servers an event only reaches browsers connected to the same one,
// which is why the app also keeps a slow background refresh as a safety net.
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionCount = exports.formatEvent = exports.MAX_CONNECTIONS_PER_BUSINESS = void 0;
exports.subscribe = subscribe;
exports.publishChange = publishChange;
exports.MAX_CONNECTIONS_PER_BUSINESS = 50;
const DEBOUNCE_MS = 150;
const clients = new Map();
const pending = new Map();
const formatEvent = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
exports.formatEvent = formatEvent;
/** Registers a connection. Returns a function that removes it, or null if the business has too many open connections. */
function subscribe(businessId, client) {
    const set = clients.get(businessId) ?? new Set();
    if (set.size >= exports.MAX_CONNECTIONS_PER_BUSINESS)
        return null;
    set.add(client);
    clients.set(businessId, set);
    return () => {
        set.delete(client);
        if (set.size === 0 && clients.get(businessId) === set)
            clients.delete(businessId);
    };
}
/** Announces a change. A burst of changes becomes one event, so a busy conversation doesn't flood browsers. */
function publishChange(businessId) {
    if (!clients.has(businessId) || pending.has(businessId))
        return;
    pending.set(businessId, setTimeout(() => {
        pending.delete(businessId);
        for (const c of clients.get(businessId) ?? []) {
            try {
                c.write((0, exports.formatEvent)("changed", {}));
            }
            catch { /* a dead connection removes itself when it closes */ }
        }
    }, DEBOUNCE_MS));
}
const connectionCount = (businessId) => clients.get(businessId)?.size ?? 0;
exports.connectionCount = connectionCount;
