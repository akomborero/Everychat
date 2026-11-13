"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const prisma_1 = require("./lib/prisma");
const logger_1 = require("./lib/logger");
const monitoring_1 = require("./lib/monitoring");
const recovery_1 = require("./modules/ai/recovery");
const auth_routes_1 = require("./modules/auth/auth.routes");
const accounts_routes_1 = require("./modules/whatsapp/accounts.routes");
const webhook_routes_1 = require("./modules/whatsapp/webhook.routes");
const conversations_routes_1 = require("./modules/conversations/conversations.routes");
const business_routes_1 = require("./modules/business/business.routes");
const knowledge_routes_1 = require("./modules/knowledge/knowledge.routes");
const agent_routes_1 = require("./modules/ai/agent.routes");
const overview_routes_1 = require("./modules/overview/overview.routes");
const leads_routes_1 = require("./modules/leads/leads.routes");
const booking_routes_1 = require("./modules/booking/booking.routes");
const customers_routes_1 = require("./modules/customers/customers.routes");
const team_routes_1 = require("./modules/team/team.routes");
const usage_routes_1 = require("./modules/usage/usage.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const account_routes_1 = require("./modules/account/account.routes");
const analytics_routes_1 = require("./modules/analytics/analytics.routes");
const audit_routes_1 = require("./modules/audit/audit.routes");
const events_routes_1 = require("./modules/events/events.routes");
const events_1 = require("./lib/events");
const error_1 = require("./middleware/error");
const app = (0, express_1.default)();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));
// Must come BEFORE express.json(): signature verification needs the exact raw bytes.
app.use("/webhooks/whatsapp", express_1.default.raw({ type: "application/json", limit: "2mb" }), webhook_routes_1.webhookRoutes);
// A generous per-address ceiling for everything else. The webhook (above) is exempt: Meta's calls are authenticated by signature.
app.use((0, express_rate_limit_1.default)({
    windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false,
    skip: (req) => req.path.startsWith("/health"),
    message: { error: "Too many requests. Please slow down and try again shortly." },
}));
app.use(express_1.default.json({ limit: "1mb" }));
// Anything a signed-in person changes through the API tells that business's open browsers to refresh.
app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        res.on("finish", () => { if (req.auth && res.statusCode < 400)
            (0, events_1.publishChange)(req.auth.businessId); });
    }
    next();
});
// /health says the process is up (cheap, used by the host). /health/ready also checks the database, for uptime monitors.
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/ready", async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true });
    }
    catch (e) {
        (0, logger_1.logError)("Readiness check failed", e);
        res.status(503).json({ ok: false });
    }
});
app.use("/auth", (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }), auth_routes_1.authRoutes);
app.use("/whatsapp/accounts", accounts_routes_1.accountRoutes);
app.use("/conversations", conversations_routes_1.conversationRoutes);
app.use("/business", business_routes_1.businessRoutes);
app.use("/knowledge", knowledge_routes_1.knowledgeRoutes);
app.use("/agent", agent_routes_1.agentRoutes);
app.use("/overview", overview_routes_1.overviewRoutes);
app.use("/leads", leads_routes_1.leadRoutes);
app.use("/availability", booking_routes_1.availabilityRoutes);
app.use("/appointments", booking_routes_1.appointmentRoutes);
app.use("/customers", customers_routes_1.customerRoutes);
app.use("/team", team_routes_1.teamRoutes);
app.use("/usage", usage_routes_1.usageRoutes);
app.use("/admin", admin_routes_1.adminRoutes);
app.use("/account", account_routes_1.accountRoutes);
app.use("/analytics", analytics_routes_1.analyticsRoutes);
app.use("/audit", audit_routes_1.auditRoutes);
app.use("/events", events_routes_1.eventsRoutes);
app.use(error_1.notFound);
app.use(error_1.errorHandler);
void (0, monitoring_1.initMonitoring)();
const server = app.listen(env_1.env.PORT, () => (0, logger_1.logInfo)("API listening", { port: env_1.env.PORT }));
const stopRecovery = (0, recovery_1.startRecovery)();
// A crash we did not expect leaves the process in an unknown state, so log it, report it, and exit so the host restarts us.
// Replies that were interrupted are picked up again by the recovery sweep.
process.on("unhandledRejection", (reason) => { (0, logger_1.logError)("Unhandled rejection", reason); (0, monitoring_1.captureError)(reason); });
process.on("uncaughtException", async (err) => {
    (0, logger_1.logError)("Uncaught exception", err);
    (0, monitoring_1.captureError)(err);
    await (0, monitoring_1.flushMonitoring)();
    process.exit(1);
});
// Deploys send SIGTERM: stop taking new requests, then exit.
process.on("SIGTERM", () => {
    (0, logger_1.logInfo)("Shutting down");
    stopRecovery();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
});
