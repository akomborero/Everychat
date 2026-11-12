import { Router } from "express";
import { z } from "zod";
import { prisma, tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";

export const availabilityRoutes = Router();
export const appointmentRoutes = Router();
availabilityRoutes.use(requireAuth);
appointmentRoutes.use(requireAuth);

const ruleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, for example 08:00"),
  durationMin: z.number().int().min(10).max(480),
  capacity: z.number().int().min(1).max(50),
});

availabilityRoutes.get(
  "/",
  ah(async (req, res) => {
    const rules = await tenantDb(req.auth!.businessId).availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    res.json({ rules });
  }),
);

// Replaces the whole weekly schedule in one step, so the editor always saves exactly what it shows.
availabilityRoutes.put(
  "/",
  requireRole("OWNER", "ADMIN"),
  ah(async (req, res) => {
    const { businessId } = req.auth!;
    const { rules } = z.object({ rules: z.array(ruleSchema).max(200) }).parse(req.body);

    const unique = new Map(rules.map((r) => [`${r.dayOfWeek}-${r.startTime}`, r]));
    // Explicit businessId on every row; this batch uses the unscoped client.
    await prisma.$transaction([
      prisma.availabilityRule.deleteMany({ where: { businessId } }),
      prisma.availabilityRule.createMany({ data: [...unique.values()].map((r) => ({ businessId, ...r })) }),
    ]);
    const saved = await tenantDb(businessId).availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    res.json({ rules: saved });
  }),
);

appointmentRoutes.get(
  "/",
  ah(async (req, res) => {
    const range = z.enum(["upcoming", "past"]).default("upcoming").parse(req.query.range ?? "upcoming");
    const now = new Date();
    const appointments = await tenantDb(req.auth!.businessId).appointment.findMany({
      where: { startsAt: range === "upcoming" ? { gte: now } : { lt: now } },
      orderBy: { startsAt: range === "upcoming" ? "asc" : "desc" },
      take: 200,
      include: { customer: true, service: { select: { name: true } } },
    });
    res.json({ appointments });
  }),
);

appointmentRoutes.patch(
  "/:id",
  requireRole("OWNER", "ADMIN", "STAFF"),
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const d = z
      .object({ status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]), notes: z.string().trim().max(1000).nullable() })
      .partial()
      .parse(req.body);
    if (!(await db.appointment.findFirst({ where: { id: req.params.id }, select: { id: true } }))) throw new AppError(404, "Appointment not found");
    const appointment = await db.appointment.update({
      where: { id: req.params.id },
      data: d,
      include: { customer: true, service: { select: { name: true } } },
    });
    res.json({ appointment });
  }),
);
