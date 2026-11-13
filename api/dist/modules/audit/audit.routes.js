"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.auditRoutes = (0, express_1.Router)();
exports.auditRoutes.use(auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "ADMIN"));
const PAGE = 50;
// The business's own activity log. Newest first; pass `before` (the previous page's nextBefore) to load older entries.
exports.auditRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const q = zod_1.z.object({ before: zod_1.z.string().datetime().optional(), action: zod_1.z.string().trim().max(60).optional() }).parse(req.query);
    const rows = await (0, prisma_1.tenantDb)(req.auth.businessId).auditLog.findMany({
        where: { ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}), ...(q.action ? { action: { startsWith: q.action } } : {}) },
        orderBy: { createdAt: "desc" },
        take: PAGE + 1,
    });
    const page = rows.slice(0, PAGE);
    const ids = [...new Set(page.map((r) => r.userId).filter((x) => Boolean(x)))];
    const users = ids.length ? await prisma_1.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    res.json({
        entries: page.map((r) => ({
            id: r.id,
            action: r.action,
            createdAt: r.createdAt,
            // Platform operators act through the admin panel; their names are not shown to businesses.
            actor: r.action.startsWith("admin.") ? "Platform support" : r.userId ? names.get(r.userId) ?? "Former team member" : null,
            metadata: r.metadata,
        })),
        nextBefore: rows.length > PAGE ? page[page.length - 1].createdAt.toISOString() : null,
    });
}));
