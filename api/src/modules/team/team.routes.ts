import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";

export const teamRoutes = Router();
teamRoutes.use(requireAuth);

const ASSIGNABLE = z.enum(["ADMIN", "STAFF", "VIEWER"]);

// Only the owner may create, change or remove admins. Admins manage staff and viewers.
function assertCanManage(actorRole: string, targetRole: string) {
  if (targetRole === "OWNER") throw new AppError(403, "The owner cannot be changed or removed");
  if ((targetRole === "ADMIN") && actorRole !== "OWNER") throw new AppError(403, "Only the owner can manage admins");
}

teamRoutes.get(
  "/",
  ah(async (req, res) => {
    const members = await tenantDb(req.auth!.businessId).teamMember.findMany({
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ members, currentUserId: req.auth!.userId });
  }),
);

// No email service yet, so the owner or admin sets a first password and shares it. The person can change it in Settings.
teamRoutes.post(
  "/",
  requireRole("OWNER", "ADMIN"),
  ah(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth!;
    const d = z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().toLowerCase().email(),
        role: ASSIGNABLE,
        password: z.string().min(8).max(100),
      })
      .parse(req.body);
    assertCanManage(actorRole, d.role);

    try {
      const passwordHash = await bcrypt.hash(d.password, 12);
      const member = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name: d.name, email: d.email, passwordHash } });
        return tx.teamMember.create({ data: { businessId, userId: user.id, role: d.role }, include: { user: { select: { id: true, name: true, email: true } } } });
      });
      await tenantDb(businessId).auditLog.create({ data: { businessId, userId, action: "team.added", metadata: { email: d.email, role: d.role } } });
      res.status(201).json({ member });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "That email already has an account. Each person can belong to one business for now.");
      }
      throw e;
    }
  }),
);

teamRoutes.patch(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  ah(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth!;
    const { role } = z.object({ role: ASSIGNABLE }).parse(req.body);
    const db = tenantDb(businessId);
    const target = await db.teamMember.findFirst({ where: { id: req.params.id } });
    if (!target) throw new AppError(404, "Team member not found");
    if (target.userId === userId) throw new AppError(400, "You can't change your own role");
    assertCanManage(actorRole, target.role);
    assertCanManage(actorRole, role);

    const member = await db.teamMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await db.auditLog.create({ data: { businessId, userId, action: "team.role_changed", metadata: { memberId: target.id, role } } });
    res.json({ member });
  }),
);

teamRoutes.delete(
  "/:id",
  requireRole("OWNER", "ADMIN"),
  ah(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth!;
    const db = tenantDb(businessId);
    const target = await db.teamMember.findFirst({ where: { id: req.params.id } });
    if (!target) throw new AppError(404, "Team member not found");
    if (target.userId === userId) throw new AppError(400, "You can't remove yourself");
    assertCanManage(actorRole, target.role);

    await db.teamMember.deleteMany({ where: { id: target.id } });
    await db.auditLog.create({ data: { businessId, userId, action: "team.removed", metadata: { memberId: target.id } } });
    res.status(204).end();
  }),
);
