import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { generate } from "./engine";
import { dryRunTools } from "./tools";
import { MINUTE, perBusiness } from "../../lib/rateLimits";

export const agentRoutes = Router();
agentRoutes.use(requireAuth);

const agentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  tone: z.enum(["professional", "friendly", "casual", "direct"]),
  instructions: z.string().trim().max(4000),
  rules: z.array(z.string().trim().min(1).max(300)).max(20),
  active: z.boolean(),
}).partial();

agentRoutes.get(
  "/",
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const agent = (await db.aiAgent.findFirst({})) ?? (await db.aiAgent.create({ data: { businessId: req.auth!.businessId } }));
    res.json({ agent });
  }),
);

agentRoutes.put(
  "/",
  requireRole("OWNER", "ADMIN"),
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const d = agentSchema.parse(req.body);

    if (d.active) {
      const connected = await db.whatsappAccount.count({ where: { status: "ACTIVE" } });
      if (!connected) throw new AppError(409, "Connect a WhatsApp number before activating the AI");
    }
    const current = (await db.aiAgent.findFirst({})) ?? (await db.aiAgent.create({ data: { businessId: req.auth!.businessId } }));
    const agent = await db.aiAgent.update({ where: { id: current.id }, data: d });
    await db.auditLog.create({ data: { businessId: req.auth!.businessId, userId: req.auth!.userId, action: "agent.updated", metadata: { active: agent.active } } });
    res.json({ agent });
  }),
);

// Test before launch: the real prompt, knowledge and model, but actions are only reported, never executed.
agentRoutes.post(
  "/test",
  perBusiness(30, MINUTE),
  ah(async (req, res) => {
    const { businessId } = req.auth!;
    const { messages } = z
      .object({
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
          .min(1)
          .max(20),
      })
      .parse(req.body);
    if (messages[messages.length - 1].role !== "user") throw new AppError(400, "The last message must be from the customer");

    const out = await generate({ businessId, history: messages, runTool: dryRunTools(businessId) });

    const db = tenantDb(businessId);
    if (out.usage.input) await db.usageRecord.create({ data: { businessId, type: "AI_INPUT_TOKENS", quantity: out.usage.input } });
    if (out.usage.output) await db.usageRecord.create({ data: { businessId, type: "AI_OUTPUT_TOKENS", quantity: out.usage.output } });

    res.json({ reply: out.reply, handoff: out.handoff, actions: out.actions });
  }),
);
