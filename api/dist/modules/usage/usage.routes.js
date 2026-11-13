"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.usageRoutes = (0, express_1.Router)();
exports.usageRoutes.use(auth_1.requireAuth);
exports.usageRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const days = zod_1.z.coerce.number().int().min(1).max(90).default(30).parse(req.query.days ?? 30);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const sum = async (type) => (await db.usageRecord.aggregate({ where: { type, createdAt: { gte: since } }, _sum: { quantity: true } }))._sum.quantity ?? 0;
    const [whatsappInbound, whatsappOutbound, aiInputTokens, aiOutputTokens] = await Promise.all([
        sum("WHATSAPP_INBOUND"), sum("WHATSAPP_OUTBOUND"), sum("AI_INPUT_TOKENS"), sum("AI_OUTPUT_TOKENS"),
    ]);
    res.json({ days, whatsappInbound, whatsappOutbound, aiInputTokens, aiOutputTokens });
}));
