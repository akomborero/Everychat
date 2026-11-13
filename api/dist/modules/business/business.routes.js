"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const time_1 = require("../booking/time");
exports.businessRoutes = (0, express_1.Router)();
exports.businessRoutes.use(auth_1.requireAuth);
const canEdit = (0, auth_1.requireRole)("OWNER", "ADMIN");
// ---------- Business profile (typed form) ----------
const profileSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    industry: zod_1.z.string().trim().max(60).nullable(),
    description: zod_1.z.string().trim().max(2000).nullable(),
    address: zod_1.z.string().trim().max(300).nullable(),
    openingHours: zod_1.z.string().trim().max(300).nullable(),
    timezone: zod_1.z.string().trim().max(60).refine(time_1.isValidTimeZone, "Use a time zone name such as Europe/London"),
}).partial();
exports.businessRoutes.get("/profile", (0, errors_1.ah)(async (req, res) => {
    const business = await prisma_1.prisma.business.findUniqueOrThrow({
        where: { id: req.auth.businessId },
        select: { id: true, name: true, industry: true, description: true, address: true, openingHours: true, timezone: true },
    });
    res.json({ business });
}));
exports.businessRoutes.put("/profile", canEdit, (0, errors_1.ah)(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const business = await prisma_1.prisma.business.update({
        where: { id: req.auth.businessId },
        data,
        select: { id: true, name: true, industry: true, description: true, address: true, openingHours: true, timezone: true },
    });
    res.json({ business });
}));
// ---------- Services and prices ----------
const serviceSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(120),
    description: zod_1.z.string().trim().max(500).nullable().optional(),
    price: zod_1.z.number().min(0).max(1_000_000_000),
    currency: zod_1.z.string().trim().toUpperCase().length(3).default("USD"),
    active: zod_1.z.boolean().default(true),
});
exports.businessRoutes.get("/services", (0, errors_1.ah)(async (req, res) => {
    const services = await (0, prisma_1.tenantDb)(req.auth.businessId).service.findMany({ orderBy: { name: "asc" } });
    res.json({ services });
}));
exports.businessRoutes.post("/services", canEdit, (0, errors_1.ah)(async (req, res) => {
    const d = serviceSchema.parse(req.body);
    const { businessId } = req.auth;
    const service = await (0, prisma_1.tenantDb)(businessId).service.create({
        data: { businessId, name: d.name, description: d.description ?? null, price: d.price, currency: d.currency, active: d.active },
    });
    res.status(201).json({ service });
}));
exports.businessRoutes.patch("/services/:id", canEdit, (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const d = serviceSchema.partial().parse(req.body);
    if (!(await db.service.findFirst({ where: { id: req.params.id }, select: { id: true } })))
        throw new errors_1.AppError(404, "Service not found");
    const service = await db.service.update({ where: { id: req.params.id }, data: d });
    res.json({ service });
}));
exports.businessRoutes.delete("/services/:id", canEdit, (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const { count } = await db.service.deleteMany({ where: { id: req.params.id } });
    if (!count)
        throw new errors_1.AppError(404, "Service not found");
    res.status(204).end();
}));
