import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logError, logInfo } from "./lib/logger";
import { captureError, flushMonitoring, initMonitoring } from "./lib/monitoring";
import { startRecovery } from "./modules/ai/recovery";
import { authRoutes } from "./modules/auth/auth.routes";
import { accountRoutes } from "./modules/whatsapp/accounts.routes";
import { webhookRoutes } from "./modules/whatsapp/webhook.routes";
import { conversationRoutes } from "./modules/conversations/conversations.routes";
import { businessRoutes } from "./modules/business/business.routes";
import { knowledgeRoutes } from "./modules/knowledge/knowledge.routes";
import { agentRoutes } from "./modules/ai/agent.routes";
import { overviewRoutes } from "./modules/overview/overview.routes";
import { leadRoutes } from "./modules/leads/leads.routes";
import { appointmentRoutes, availabilityRoutes } from "./modules/booking/booking.routes";
import { customerRoutes } from "./modules/customers/customers.routes";
import { teamRoutes } from "./modules/team/team.routes";
import { usageRoutes } from "./modules/usage/usage.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { accountRoutes as dataAccountRoutes } from "./modules/account/account.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import { eventsRoutes } from "./modules/events/events.routes";
import { publishChange } from "./lib/events";
import { errorHandler, notFound } from "./middleware/error";

const app = express();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()), credentials: true }));

// Must come BEFORE express.json(): signature verification needs the exact raw bytes.
app.use("/webhooks/whatsapp", express.raw({ type: "application/json", limit: "2mb" }), webhookRoutes);

// A generous per-address ceiling for everything else. The webhook (above) is exempt: Meta's calls are authenticated by signature.
app.use(rateLimit({
  windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.path.startsWith("/health"),
  message: { error: "Too many requests. Please slow down and try again shortly." },
}));

app.use(express.json({ limit: "1mb" }));

// Anything a signed-in person changes through the API tells that business's open browsers to refresh.
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.on("finish", () => { if (req.auth && res.statusCode < 400) publishChange(req.auth.businessId); });
  }
  next();
});

// /health says the process is up (cheap, used by the host). /health/ready also checks the database, for uptime monitors.
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/ready", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch (e) { logError("Readiness check failed", e); res.status(503).json({ ok: false }); }
});
app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use("/whatsapp/accounts", accountRoutes);
app.use("/conversations", conversationRoutes);
app.use("/business", businessRoutes);
app.use("/knowledge", knowledgeRoutes);
app.use("/agent", agentRoutes);
app.use("/overview", overviewRoutes);
app.use("/leads", leadRoutes);
app.use("/availability", availabilityRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/customers", customerRoutes);
app.use("/team", teamRoutes);
app.use("/usage", usageRoutes);
app.use("/admin", adminRoutes);
app.use("/account", dataAccountRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/audit", auditRoutes);
app.use("/events", eventsRoutes);

app.use(notFound);
app.use(errorHandler);

void initMonitoring();
const server = app.listen(env.PORT, () => logInfo("API listening", { port: env.PORT }));
const stopRecovery = startRecovery();

// A crash we did not expect leaves the process in an unknown state, so log it, report it, and exit so the host restarts us.
// Replies that were interrupted are picked up again by the recovery sweep.
process.on("unhandledRejection", (reason) => { logError("Unhandled rejection", reason); captureError(reason); });
process.on("uncaughtException", async (err) => {
  logError("Uncaught exception", err);
  captureError(err);
  await flushMonitoring();
  process.exit(1);
});

// Deploys send SIGTERM: stop taking new requests, then exit.
process.on("SIGTERM", () => {
  logInfo("Shutting down");
  stopRecovery();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
});
