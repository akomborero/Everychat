import { Router } from "express";
import { z } from "zod";
import { prisma, tenantDb } from "../../lib/prisma";
import { ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";

export const auditRoutes = Router();
auditRoutes.use(requireAuth, requireRole("OWNER", "ADMIN"));

const PAGE = 50;

// The business's own activity log. Newest first; pass `before` (the previous page's nextBefore) to load older entries.
auditRoutes.get(
  "/",
  ah(async (req, res) => {
    const q = z.object({ before: z.string().datetime().optional(), action: z.string().trim().max(60).optional() }).parse(req.query);
    const rows = await tenantDb(req.auth!.businessId).auditLog.findMany({
      where: { ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}), ...(q.action ? { action: { startsWith: q.action } } : {}) },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    });
    const page = rows.slice(0, PAGE);

    const ids = [...new Set(page.map((r) => r.userId).filter((x): x is string => Boolean(x)))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
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
  }),
);
