import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { decrypt } from "../../lib/crypto";
import { AppError, ah } from "../../lib/errors";
import { endSession } from "../../lib/session";
import { HOUR, perBusiness } from "../../lib/rateLimits";
import { prisma, tenantDb } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { unsubscribeApp } from "../whatsapp/whatsapp.client";

export const accountRoutes = Router();
accountRoutes.use(requireAuth, requireRole("OWNER"));

const LIMIT = 5000;

// A complete copy of the business's data. Owner only. Secrets (passwords, WhatsApp tokens) are never included.
accountRoutes.get(
  "/export",
  perBusiness(5, HOUR),
  ah(async (req, res) => {
    const { businessId } = req.auth!;
    const db = tenantDb(businessId);
    const [business, services, availability, agent, documents, customers, team] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, industry: true, description: true, address: true, openingHours: true, timezone: true, createdAt: true } }),
      db.service.findMany({}),
      db.availabilityRule.findMany({}),
      db.aiAgent.findFirst({ select: { name: true, tone: true, instructions: true, rules: true, active: true } }),
      db.knowledgeDocument.findMany({ select: { name: true, kind: true, content: true, createdAt: true } }),
      db.customer.findMany({
        take: LIMIT,
        orderBy: { createdAt: "asc" },
        include: {
          leads: true,
          appointments: { include: { service: { select: { name: true } } } },
          conversations: { include: { messages: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "asc" } } } },
        },
      }),
      db.teamMember.findMany({ select: { role: true, createdAt: true, user: { select: { name: true, email: true } } } }),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="business-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ exportedAt: new Date().toISOString(), truncated: customers.length === LIMIT, business, team, services, availability, assistant: agent, documents, customers });
  }),
);

// Permanently deletes the whole business and everything in it. Needs the owner's password and the business name.
accountRoutes.delete(
  "/",
  perBusiness(5, HOUR),
  ah(async (req, res) => {
    const { businessId, userId } = req.auth!;
    const d = z.object({ password: z.string().min(1).max(100), confirmName: z.string().min(1).max(200) }).parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(d.password, user.passwordHash))) throw new AppError(400, "Your password is incorrect");
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true } });
    if (d.confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()) throw new AppError(400, "The business name doesn't match");

    // Best effort: tell Meta to stop sending this business's messages to us.
    const accounts = await prisma.whatsappAccount.findMany({ where: { businessId, status: "ACTIVE" } });
    for (const a of new Map(accounts.map((x) => [x.businessAccountId, x])).values()) {
      await unsubscribeApp(a.businessAccountId, decrypt(a.accessTokenEnc)).catch(() => false);
    }

    const members = await prisma.teamMember.findMany({ where: { businessId }, select: { userId: true } });
    await prisma.$transaction(async (tx) => {
      await tx.business.delete({ where: { id: businessId } }); // the database cascades to everything the business owns
      for (const m of members) {
        // People who belonged only to this business are removed too. Anyone with another membership stays.
        if ((await tx.teamMember.count({ where: { userId: m.userId } })) === 0) await tx.user.delete({ where: { id: m.userId } });
      }
    });
    endSession(res);
    res.status(204).end();
  }),
);
