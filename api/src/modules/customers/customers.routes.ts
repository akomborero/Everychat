import { Router } from "express";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { HOUR, perBusiness } from "../../lib/rateLimits";

export const customerRoutes = Router();
customerRoutes.use(requireAuth);

customerRoutes.get(
  "/",
  ah(async (req, res) => {
    const q = z.string().trim().max(100).optional().parse(req.query.q);
    const customers = await tenantDb(req.auth!.businessId).customer.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] }
        : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { leads: true, appointments: true, conversations: true } } },
    });
    res.json({ customers });
  }),
);

customerRoutes.get(
  "/:id",
  ah(async (req, res) => {
    const customer = await tenantDb(req.auth!.businessId).customer.findFirst({
      where: { id: req.params.id },
      include: {
        leads: { orderBy: { updatedAt: "desc" } },
        appointments: { orderBy: { startsAt: "desc" }, take: 20, include: { service: { select: { name: true } } } },
        conversations: { orderBy: { lastMessageAt: "desc" }, take: 5, select: { id: true, status: true, lastMessageAt: true } },
      },
    });
    if (!customer) throw new AppError(404, "Customer not found");
    res.json({ customer });
  }),
);

customerRoutes.patch(
  "/:id",
  requireRole("OWNER", "ADMIN", "STAFF"),
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const d = z
      .object({
        name: z.string().trim().max(100).nullable(),
        email: z.string().trim().toLowerCase().email().nullable(),
        tags: z.array(z.string().trim().min(1).max(30)).max(20),
        notes: z.string().trim().max(2000).nullable(),
      })
      .partial()
      .parse(req.body);
    if (!(await db.customer.findFirst({ where: { id: req.params.id }, select: { id: true } }))) throw new AppError(404, "Customer not found");
    const customer = await db.customer.update({ where: { id: req.params.id }, data: d });
    res.json({ customer });
  }),
);

// Everything held about one customer, as a file the business can hand over if the customer asks for their data.
customerRoutes.get(
  "/:id/export",
  requireRole("OWNER", "ADMIN", "STAFF"),
  perBusiness(30, HOUR),
  ah(async (req, res) => {
    const customer = await tenantDb(req.auth!.businessId).customer.findFirst({
      where: { id: req.params.id },
      include: {
        leads: true,
        appointments: { include: { service: { select: { name: true } } } },
        conversations: { include: { messages: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!customer) throw new AppError(404, "Customer not found");
    res.setHeader("Content-Disposition", `attachment; filename="customer-${customer.id}.json"`);
    res.json({ exportedAt: new Date().toISOString(), customer });
  }),
);

// Permanently deletes the customer and, through the database, their conversations, messages, notes, leads and appointments.
customerRoutes.delete(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  perBusiness(30, HOUR),
  ah(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const db = tenantDb(businessId);
    const { count } = await db.customer.deleteMany({ where: { id: req.params.id } });
    if (!count) throw new AppError(404, "Customer not found");
    await db.auditLog.create({ data: { businessId, userId, action: "customer.deleted", metadata: { customerId: req.params.id } } });
    res.status(204).end();
  }),
);
