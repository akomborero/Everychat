"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const engine_1 = require("./engine");
const tools_1 = require("./tools");
const rateLimits_1 = require("../../lib/rateLimits");
exports.agentRoutes = (0, express_1.Router)();
exports.agentRoutes.use(auth_1.requireAuth);
const agentSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(60),
    tone: zod_1.z.enum(["professional", "friendly", "casual", "direct"]),
    instructions: zod_1.z.string().trim().max(4000),
    rules: zod_1.z.array(zod_1.z.string().trim().min(1).max(300)).max(20),
    active: zod_1.z.boolean(),
}).partial();
exports.agentRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const agent = (await db.aiAgent.findFirst({})) ?? (await db.aiAgent.create({ data: { businessId: req.auth.businessId } }));
    res.json({ agent });
}));
exports.agentRoutes.put("/", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const d = agentSchema.parse(req.body);
    if (d.active) {
        const connected = await db.whatsappAccount.count({ where: { status: "ACTIVE" } });
        if (!connected)
            throw new errors_1.AppError(409, "Connect a WhatsApp number before activating the AI");
    }
    const current = (await db.aiAgent.findFirst({})) ?? (await db.aiAgent.create({ data: { businessId: req.auth.businessId } }));
    const agent = await db.aiAgent.update({ where: { id: current.id }, data: d });
    await db.auditLog.create({ data: { businessId: req.auth.businessId, userId: req.auth.userId, action: "agent.updated", metadata: { active: agent.active } } });
    res.json({ agent });
}));
// Test before launch: the real prompt, knowledge and model, but actions are only reported, never executed.
exports.agentRoutes.post("/test", (0, rateLimits_1.perBusiness)(30, rateLimits_1.MINUTE), (0, errors_1.ah)(async (req, res) => {
    const { businessId } = req.auth;
    const { messages } = zod_1.z
        .object({
        messages: zod_1.z
            .array(zod_1.z.object({ role: zod_1.z.enum(["user", "assistant"]), content: zod_1.z.string().trim().min(1).max(2000) }))
            .min(1)
            .max(20),
    })
        .parse(req.body);
    if (messages[messages.length - 1].role !== "user")
        throw new errors_1.AppError(400, "The last message must be from the customer");
    const out = await (0, engine_1.generate)({ businessId, history: messages, runTool: (0, tools_1.dryRunTools)(businessId) });
    const db = (0, prisma_1.tenantDb)(businessId);
    if (out.usage.input)
        await db.usageRecord.create({ data: { businessId, type: "AI_INPUT_TOKENS", quantity: out.usage.input } });
    if (out.usage.output)
        await db.usageRecord.create({ data: { businessId, type: "AI_OUTPUT_TOKENS", quantity: out.usage.output } });
    res.json({ reply: out.reply, handoff: out.handoff, actions: out.actions });
}));
