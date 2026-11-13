"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsRoutes = void 0;
const express_1 = require("express");
const events_1 = require("../../lib/events");
const auth_1 = require("../../middleware/auth");
exports.eventsRoutes = (0, express_1.Router)();
// A long-lived stream. The browser opens it once and reloads what it is showing whenever it hears "changed".
exports.eventsRoutes.get("/", auth_1.requireAuth, (req, res) => {
    const unsubscribe = (0, events_1.subscribe)(req.auth.businessId, res);
    if (!unsubscribe) {
        res.status(429).json({ error: "Too many open connections" });
        return;
    }
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // tell proxies not to hold the stream back
    });
    res.write("retry: 5000\n\n: connected\n\n");
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000); // keeps proxies from closing an idle stream
    req.on("close", () => { clearInterval(ping); unsubscribe(); });
});
