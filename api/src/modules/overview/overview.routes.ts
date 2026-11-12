import { Router } from "express";
import { prisma, tenantDb } from "../../lib/prisma";
import { ah } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { env } from "../../config/env";
import { tokensUsedToday } from "../ai/limits";

export const overviewRoutes = Router();
overviewRoutes.use(requireAuth);

overviewRoutes.get(
  "/",
  ah(async (req, res) => {
    const { businessId } = req.auth!;
    const db = tenantDb(businessId);
    const DAY = 24 * 3600 * 1000;
    const since = new Date(Date.now() - 7 * DAY);

    const [conversations, needsHuman, leads7d, leadsTotal, customers, messages, whatsapp, services, docs, agent, profile, availability, upcoming, openGaps] =
      await Promise.all([
        db.conversation.count({ where: { lastMessageAt: { gte: since } } }),
        db.conversation.count({ where: { status: "NEEDS_HUMAN" } }),
        db.lead.count({ where: { createdAt: { gte: since } } }),
        db.lead.count({}),
        db.customer.count({}),
        db.message.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, sender: true }, take: 50_000 }),
        db.whatsappAccount.count({ where: { status: "ACTIVE" } }),
        db.service.count({ where: { active: true } }),
        db.knowledgeDocument.count({ where: { status: "ready" } }),
        db.aiAgent.findFirst({ select: { active: true } }),
        prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { description: true, openingHours: true, dailyAiTokenLimit: true } }),
        db.availabilityRule.count({}),
        db.appointment.findMany({
          where: { status: "CONFIRMED", startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 5,
          include: { customer: { select: { name: true, phone: true } }, service: { select: { name: true } } },
        }),
        db.knowledgeGap.count({ where: { status: "open" } }),
      ]);

    const tokensToday = await tokensUsedToday(businessId);
    const tokenLimit = profile.dailyAiTokenLimit ?? env.DEFAULT_DAILY_AI_TOKEN_LIMIT;

    // Flag numbers that need attention: not registered, webhooks off, or the access token expiring soon.
    const soon = Date.now() + 14 * DAY;
    const numbers = await db.whatsappAccount.findMany({ where: { status: "ACTIVE" }, select: { registered: true, webhookSubscribed: true, tokenExpiresAt: true } });
    const whatsappAttention = numbers.some((n) => !n.registered || !n.webhookSubscribed || (n.tokenExpiresAt !== null && n.tokenExpiresAt.getTime() < soon));

    // Last 7 days, bucketed by UTC date (business time zones come later).
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * DAY).toISOString().slice(0, 10));
    const daily = days.map((date) => ({ date, customer: 0, ai: 0, staff: 0 }));
    for (const m of messages) {
      const bucket = daily.find((d) => d.date === m.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (m.sender === "CUSTOMER") bucket.customer++;
      else if (m.sender === "AI") bucket.ai++;
      else if (m.sender === "STAFF") bucket.staff++;
    }
    const ai = daily.reduce((n, d) => n + d.ai, 0);
    const staff = daily.reduce((n, d) => n + d.staff, 0);

    res.json({
      conversations,
      needsHuman,
      leads7d,
      leadsTotal,
      customers,
      aiShare: ai + staff > 0 ? ai / (ai + staff) : null,
      daily,
      setup: {
        whatsappConnected: whatsapp > 0,
        profile: Boolean(profile.description || profile.openingHours),
        services: services > 0,
        knowledge: docs > 0,
        aiActive: Boolean(agent?.active),
        availability: availability > 0,
      },
      upcoming,
      whatsappAttention,
      aiLimitReached: tokenLimit > 0 && tokensToday >= tokenLimit,
      openGaps,
    });
  }),
);
