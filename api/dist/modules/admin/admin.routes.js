"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const platformAdmin_1 = require("../../middleware/platformAdmin");
/**
 * Platform operator panel. This is the ONE place that deliberately reads across businesses,
 * so it is locked behind PLATFORM_ADMIN_EMAILS. It exposes counts and settings only, never
 * message text or customer details.
 */
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.use(auth_1.requireAuth, platformAdmin_1.requirePlatformAdmin);
const DAY = 24 * 3600 * 1000;
exports.adminRoutes.get("/overview", (0, errors_1.ah)(async (_req, res) => {
    const since30 = new Date(Date.now() - 30 * DAY);
    const since14 = new Date(Date.now() - 14 * DAY);
    const [businesses, users, conversations, messages30d, numbers, aiLive, tokens, signups, aiFailures] = await Promise.all([
        prisma_1.prisma.business.count(),
        prisma_1.prisma.user.count(),
        prisma_1.prisma.conversation.count(),
        prisma_1.prisma.message.count({ where: { createdAt: { gte: since30 } } }),
        prisma_1.prisma.whatsappAccount.count({ where: { status: "ACTIVE" } }),
        prisma_1.prisma.aiAgent.count({ where: { active: true } }),
        prisma_1.prisma.usageRecord.aggregate({ where: { type: { in: ["AI_INPUT_TOKENS", "AI_OUTPUT_TOKENS"] }, createdAt: { gte: since30 } }, _sum: { quantity: true } }),
        prisma_1.prisma.business.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
        prisma_1.prisma.auditLog.count({ where: { action: "ai.failed", createdAt: { gte: new Date(Date.now() - DAY) } } }),
    ]);
    const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10));
    const signupsByDay = days.map((date) => ({ date, count: signups.filter((s) => s.createdAt.toISOString().slice(0, 10) === date).length }));
    res.json({ businesses, users, conversations, messages30d, whatsappNumbers: numbers, aiLive, aiTokens30d: tokens._sum.quantity ?? 0, aiFailures24h: aiFailures, signupsByDay });
}));
exports.adminRoutes.get("/businesses", (0, errors_1.ah)(async (req, res) => {
    const q = zod_1.z.string().trim().max(100).optional().parse(req.query.q);
    const since = new Date(Date.now() - 30 * DAY);
    const businesses = await prisma_1.prisma.business.findMany({
        where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            _count: { select: { members: true, customers: true, conversations: true } },
            agent: { select: { active: true } },
            whatsapp: { where: { status: "ACTIVE" }, select: { id: true } },
            members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { name: true, email: true } } } },
        },
    });
    const usage = await prisma_1.prisma.usageRecord.groupBy({
        by: ["businessId", "type"],
        where: { businessId: { in: businesses.map((b) => b.id) }, createdAt: { gte: since } },
        _sum: { quantity: true },
        orderBy: { businessId: "asc" },
    });
    const sum = (id, types) => usage.filter((u) => u.businessId === id && types.includes(u.type)).reduce((n, u) => n + (u._sum.quantity ?? 0), 0);
    res.json({
        businesses: businesses.map((b) => ({
            id: b.id,
            name: b.name,
            industry: b.industry,
            createdAt: b.createdAt,
            owner: b.members[0]?.user ?? null,
            members: b._count.members,
            customers: b._count.customers,
            conversations: b._count.conversations,
            whatsappConnected: b.whatsapp.length > 0,
            aiActive: Boolean(b.agent?.active),
            dailyAiTokenLimit: b.dailyAiTokenLimit,
            messages30d: sum(b.id, ["WHATSAPP_INBOUND", "WHATSAPP_OUTBOUND"]),
            aiTokens30d: sum(b.id, ["AI_INPUT_TOKENS", "AI_OUTPUT_TOKENS"]),
        })),
    });
}));
// Support kill switch: stop (or restart) the AI for one business, for example if it misbehaves or the account is abused.
exports.adminRoutes.post("/businesses/:id/ai", (0, errors_1.ah)(async (req, res) => {
    const { active } = zod_1.z.object({ active: zod_1.z.boolean() }).parse(req.body);
    const business = await prisma_1.prisma.business.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!business)
        throw new errors_1.AppError(404, "Business not found");
    await prisma_1.prisma.aiAgent.upsert({ where: { businessId: business.id }, create: { businessId: business.id, active }, update: { active } });
    await prisma_1.prisma.auditLog.create({ data: { businessId: business.id, userId: req.auth.userId, action: active ? "admin.ai_enabled" : "admin.ai_disabled" } });
    res.json({ ok: true, active });
}));
// Per-business daily AI token limit. null = use the server default, 0 = no limit.
exports.adminRoutes.patch("/businesses/:id/limits", (0, errors_1.ah)(async (req, res) => {
    const { dailyAiTokenLimit } = zod_1.z.object({ dailyAiTokenLimit: zod_1.z.number().int().min(0).max(1_000_000_000).nullable() }).parse(req.body);
    const business = await prisma_1.prisma.business.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!business)
        throw new errors_1.AppError(404, "Business not found");
    await prisma_1.prisma.business.update({ where: { id: business.id }, data: { dailyAiTokenLimit } });
    await prisma_1.prisma.auditLog.create({ data: { businessId: business.id, userId: req.auth.userId, action: "admin.limit_changed", metadata: { dailyAiTokenLimit } } });
    res.json({ ok: true, dailyAiTokenLimit });
}));
