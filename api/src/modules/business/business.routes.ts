import { Router } from "express";
import { z } from "zod";
import { prisma, tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { isValidTimeZone } from "../booking/time";

export const businessRoutes = Router();
businessRoutes.use(requireAuth);
const canEdit = requireRole("OWNER", "ADMIN");

// ---------- Business profile (typed form) ----------

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(60).nullable(),
  description: z.string().trim().max(2000).nullable(),
  address: z.string().trim().max(300).nullable(),
  openingHours: z.string().trim().max(300).nullable(),
  timezone: z.string().trim().max(60).refine(isValidTimeZone, "Use a time zone name such as Europe/London"),
}).partial();

businessRoutes.get(
  "/profile",
  ah(async (req, res) => {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: req.auth!.businessId },
      select: { id: true, name: true, industry: true, description: true, address: true, openingHours: true, timezone: true },
    });
    res.json({ business });
  }),
);

businessRoutes.put(
  "/profile",
  canEdit,
  ah(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const business = await prisma.business.update({
      where: { id: req.auth!.businessId },
      data,
      select: { id: true, name: true, industry: true, description: true, address: true, openingHours: true, timezone: true },
    });
    res.json({ business });
  }),
);

// ---------- Services and prices ----------

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().min(0).max(1_000_000_000),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  active: z.boolean().default(true),
});

businessRoutes.get(
  "/services",
  ah(async (req, res) => {
    const services = await tenantDb(req.auth!.businessId).service.findMany({ orderBy: { name: "asc" } });
    res.json({ services });
  }),
);

businessRoutes.post(
  "/services",
  canEdit,
  ah(async (req, res) => {
    const d = serviceSchema.parse(req.body);
    const { businessId } = req.auth!;
    const service = await tenantDb(businessId).service.create({
      data: { businessId, name: d.name, description: d.description ?? null, price: d.price, currency: d.currency, active: d.active },
    });
    res.status(201).json({ service });
  }),
);

businessRoutes.patch(
  "/services/:id",
  canEdit,
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const d = serviceSchema.partial().parse(req.body);
    if (!(await db.service.findFirst({ where: { id: req.params.id }, select: { id: true } }))) throw new AppError(404, "Service not found");
    const service = await db.service.update({ where: { id: req.params.id }, data: d });
    res.json({ service });
  }),
);

businessRoutes.delete(
  "/services/:id",
  canEdit,
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const { count } = await db.service.deleteMany({ where: { id: req.params.id } });
    if (!count) throw new AppError(404, "Service not found");
    res.status(204).end();
  }),
);
