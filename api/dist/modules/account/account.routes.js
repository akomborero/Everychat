"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRoutes = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("../../lib/crypto");
const errors_1 = require("../../lib/errors");
const session_1 = require("../../lib/session");
const rateLimits_1 = require("../../lib/rateLimits");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const whatsapp_client_1 = require("../whatsapp/whatsapp.client");
exports.accountRoutes = (0, express_1.Router)();
exports.accountRoutes.use(auth_1.requireAuth, (0, auth_1.requireRole)("OWNER"));
const LIMIT = 5000;
// A complete copy of the business's data. Owner only. Secrets (passwords, WhatsApp tokens) are never included.
exports.accountRoutes.get("/export", (0, rateLimits_1.perBusiness)(5, rateLimits_1.HOUR), (0, errors_1.ah)(async (req, res) => {
    const { businessId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const [business, services, availability, agent, documents, customers, team] = await Promise.all([
        prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, industry: true, description: true, address: true, openingHours: true, timezone: true, createdAt: true } }),
        db.service.findMany({}),
        db.availabilityRule.findMany({}),
        db.aiAgent.findFirst({ select: { name: true, tone: true, instructions: true, rules: true, active: true } }),
        db.knowledgeDocument.findMany({ select: { name: true, kind: true, content: true, createdAt: true } }),
        db.customer.findMany({
            take: LIMIT,
            orderBy: { createdAt: "asc" },
            include: {
                leads: true,
                appointments: { include: { service: { select: { name: true } } } },
                conversations: { include: { messages: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "asc" } } } },
            },
        }),
        db.teamMember.findMany({ select: { role: true, createdAt: true, user: { select: { name: true, email: true } } } }),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="business-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ exportedAt: new Date().toISOString(), truncated: customers.length === LIMIT, business, team, services, availability, assistant: agent, documents, customers });
}));
// Permanently deletes the whole business and everything in it. Needs the owner's password and the business name.
exports.accountRoutes.delete("/", (0, rateLimits_1.perBusiness)(5, rateLimits_1.HOUR), (0, errors_1.ah)(async (req, res) => {
    const { businessId, userId } = req.auth;
    const d = zod_1.z.object({ password: zod_1.z.string().min(1).max(100), confirmName: zod_1.z.string().min(1).max(200) }).parse(req.body);
    const user = await prisma_1.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcryptjs_1.default.compare(d.password, user.passwordHash)))
        throw new errors_1.AppError(400, "Your password is incorrect");
    const business = await prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true } });
    if (d.confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase())
        throw new errors_1.AppError(400, "The business name doesn't match");
    // Best effort: tell Meta to stop sending this business's messages to us.
    const accounts = await prisma_1.prisma.whatsappAccount.findMany({ where: { businessId, status: "ACTIVE" } });
    for (const a of new Map(accounts.map((x) => [x.businessAccountId, x])).values()) {
        await (0, whatsapp_client_1.unsubscribeApp)(a.businessAccountId, (0, crypto_1.decrypt)(a.accessTokenEnc)).catch(() => false);
    }
    const members = await prisma_1.prisma.teamMember.findMany({ where: { businessId }, select: { userId: true } });
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.business.delete({ where: { id: businessId } }); // the database cascades to everything the business owns
        for (const m of members) {
            // People who belonged only to this business are removed too. Anyone with another membership stays.
            if ((await tx.teamMember.count({ where: { userId: m.userId } })) === 0)
                await tx.user.delete({ where: { id: m.userId } });
        }
    });
    (0, session_1.endSession)(res);
    res.status(204).end();
}));
