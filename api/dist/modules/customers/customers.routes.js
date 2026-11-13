"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const rateLimits_1 = require("../../lib/rateLimits");
exports.customerRoutes = (0, express_1.Router)();
exports.customerRoutes.use(auth_1.requireAuth);
exports.customerRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const q = zod_1.z.string().trim().max(100).optional().parse(req.query.q);
    const customers = await (0, prisma_1.tenantDb)(req.auth.businessId).customer.findMany({
        where: q
            ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] }
            : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { _count: { select: { leads: true, appointments: true, conversations: true } } },
    });
    res.json({ customers });
}));
exports.customerRoutes.get("/:id", (0, errors_1.ah)(async (req, res) => {
    const customer = await (0, prisma_1.tenantDb)(req.auth.businessId).customer.findFirst({
        where: { id: req.params.id },
        include: {
            leads: { orderBy: { updatedAt: "desc" } },
            appointments: { orderBy: { startsAt: "desc" }, take: 20, include: { service: { select: { name: true } } } },
            conversations: { orderBy: { lastMessageAt: "desc" }, take: 5, select: { id: true, status: true, lastMessageAt: true } },
        },
    });
    if (!customer)
        throw new errors_1.AppError(404, "Customer not found");
    res.json({ customer });
}));
exports.customerRoutes.patch("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN", "STAFF"), (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const d = zod_1.z
        .object({
        name: zod_1.z.string().trim().max(100).nullable(),
        email: zod_1.z.string().trim().toLowerCase().email().nullable(),
        tags: zod_1.z.array(zod_1.z.string().trim().min(1).max(30)).max(20),
        notes: zod_1.z.string().trim().max(2000).nullable(),
    })
        .partial()
        .parse(req.body);
    if (!(await db.customer.findFirst({ where: { id: req.params.id }, select: { id: true } })))
        throw new errors_1.AppError(404, "Customer not found");
    const customer = await db.customer.update({ where: { id: req.params.id }, data: d });
    res.json({ customer });
}));
// Everything held about one customer, as a file the business can hand over if the customer asks for their data.
exports.customerRoutes.get("/:id/export", (0, auth_1.requireRole)("OWNER", "ADMIN", "STAFF"), (0, rateLimits_1.perBusiness)(30, rateLimits_1.HOUR), (0, errors_1.ah)(async (req, res) => {
    const customer = await (0, prisma_1.tenantDb)(req.auth.businessId).customer.findFirst({
        where: { id: req.params.id },
        include: {
            leads: true,
            appointments: { include: { service: { select: { name: true } } } },
            conversations: { include: { messages: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "asc" } } } },
        },
    });
    if (!customer)
        throw new errors_1.AppError(404, "Customer not found");
    res.setHeader("Content-Disposition", `attachment; filename="customer-${customer.id}.json"`);
    res.json({ exportedAt: new Date().toISOString(), customer });
}));
// Permanently deletes the customer and, through the database, their conversations, messages, notes, leads and appointments.
exports.customerRoutes.delete("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, rateLimits_1.perBusiness)(30, rateLimits_1.HOUR), (0, errors_1.ah)(async (req, res) => {
    const { businessId, userId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const { count } = await db.customer.deleteMany({ where: { id: req.params.id } });
    if (!count)
        throw new errors_1.AppError(404, "Customer not found");
    await db.auditLog.create({ data: { businessId, userId, action: "customer.deleted", metadata: { customerId: req.params.id } } });
    res.status(204).end();
}));
