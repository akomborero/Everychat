"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRoutes = exports.availabilityRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.availabilityRoutes = (0, express_1.Router)();
exports.appointmentRoutes = (0, express_1.Router)();
exports.availabilityRoutes.use(auth_1.requireAuth);
exports.appointmentRoutes.use(auth_1.requireAuth);
const ruleSchema = zod_1.z.object({
    dayOfWeek: zod_1.z.number().int().min(0).max(6),
    startTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, for example 08:00"),
    durationMin: zod_1.z.number().int().min(10).max(480),
    capacity: zod_1.z.number().int().min(1).max(50),
});
exports.availabilityRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const rules = await (0, prisma_1.tenantDb)(req.auth.businessId).availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    res.json({ rules });
}));
// Replaces the whole weekly schedule in one step, so the editor always saves exactly what it shows.
exports.availabilityRoutes.put("/", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, errors_1.ah)(async (req, res) => {
    const { businessId } = req.auth;
    const { rules } = zod_1.z.object({ rules: zod_1.z.array(ruleSchema).max(200) }).parse(req.body);
    const unique = new Map(rules.map((r) => [`${r.dayOfWeek}-${r.startTime}`, r]));
    // Explicit businessId on every row; this batch uses the unscoped client.
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.availabilityRule.deleteMany({ where: { businessId } }),
        prisma_1.prisma.availabilityRule.createMany({ data: [...unique.values()].map((r) => ({ businessId, ...r })) }),
    ]);
    const saved = await (0, prisma_1.tenantDb)(businessId).availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    res.json({ rules: saved });
}));
exports.appointmentRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const range = zod_1.z.enum(["upcoming", "past"]).default("upcoming").parse(req.query.range ?? "upcoming");
    const now = new Date();
    const appointments = await (0, prisma_1.tenantDb)(req.auth.businessId).appointment.findMany({
        where: { startsAt: range === "upcoming" ? { gte: now } : { lt: now } },
        orderBy: { startsAt: range === "upcoming" ? "asc" : "desc" },
        take: 200,
        include: { customer: true, service: { select: { name: true } } },
    });
    res.json({ appointments });
}));
exports.appointmentRoutes.patch("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN", "STAFF"), (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const d = zod_1.z
        .object({ status: zod_1.z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]), notes: zod_1.z.string().trim().max(1000).nullable() })
        .partial()
        .parse(req.body);
    if (!(await db.appointment.findFirst({ where: { id: req.params.id }, select: { id: true } })))
        throw new errors_1.AppError(404, "Appointment not found");
    const appointment = await db.appointment.update({
        where: { id: req.params.id },
        data: d,
        include: { customer: true, service: { select: { name: true } } },
    });
    res.json({ appointment });
}));
