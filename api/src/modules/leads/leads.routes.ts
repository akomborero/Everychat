import { Router } from "express";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";

export const leadRoutes = Router();
leadRoutes.use(requireAuth);

const STATUS = z.enum(["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "WON", "LOST"]);

leadRoutes.get(
  "/",
  ah(async (req, res) => {
    const status = STATUS.optional().parse(req.query.status);
    const leads = await tenantDb(req.auth!.businessId).lead.findMany({
      where: status ? { status } : {},
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { customer: true },
    });
    res.json({ leads });
  }),
);

leadRoutes.patch(
  "/:id",
  requireRole("OWNER", "ADMIN", "STAFF"),
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const d = z
      .object({ status: STATUS, interest: z.string().trim().max(200).nullable(), notes: z.string().trim().max(2000).nullable() })
      .partial()
      .parse(req.body);
    if (!(await db.lead.findFirst({ where: { id: req.params.id }, select: { id: true } }))) throw new AppError(404, "Lead not found");
    const lead = await db.lead.update({ where: { id: req.params.id }, data: d, include: { customer: true } });
    res.json({ lead });
  }),
);
