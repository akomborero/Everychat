import { Router } from "express";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { ah } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { bucketByDay, firstResponseMs, median, ratio, topCounts } from "../../lib/analytics";
import { getTimezone } from "../booking/booking.service";
import { addDays, localDateOf, localToUtc } from "../booking/time";

export const analyticsRoutes = Router();
analyticsRoutes.use(requireAuth);

const HANDOFF_ACTIONS = ["ai.handoff", "ai.failed", "ai.unanswered_flagged", "ai.daily_limit_reached", "ai.conversation_rate_limited"];

analyticsRoutes.get(
  "/",
  ah(async (req, res) => {
    const days = z.coerce.number().int().refine((v) => [7, 30, 90].includes(v), "days must be 7, 30 or 90").parse(req.query.days ?? 30);
    const { businessId } = req.auth!;
    const db = tenantDb(businessId);
    const tz = await getTimezone(businessId);

    // Days are the business's own calendar days, so "today" matches what the owner sees on their wall.
    const today = localDateOf(new Date(), tz);
    const labels = Array.from({ length: days }, (_, i) => addDays(today, -(days - 1 - i)));
    const since = localToUtc(labels[0], "00:00", tz);
    const toDay = (d: Date) => localDateOf(d, tz);
    const inPeriod = { createdAt: { gte: since } };

    const [conversations, newCustomers, leads, appointments, audit, messages, timing, resolvedByAi, handedToPeople] = await Promise.all([
      db.conversation.findMany({ where: inPeriod, select: { createdAt: true }, take: 20_000 }),
      db.customer.count({ where: inPeriod }),
      db.lead.findMany({ where: inPeriod, select: { status: true, interest: true }, take: 5000 }),
      db.appointment.findMany({ where: inPeriod, select: { status: true, source: true }, take: 5000 }),
      db.auditLog.findMany({ where: { ...inPeriod, action: { in: HANDOFF_ACTIONS } }, select: { action: true }, take: 5000 }),
      db.message.findMany({ where: inPeriod, select: { createdAt: true, sender: true, feedback: true }, take: 50_000 }),
      db.conversation.findMany({ where: inPeriod, orderBy: { createdAt: "desc" }, take: 300, select: { messages: { orderBy: { createdAt: "asc" }, take: 15, select: { sender: true, createdAt: true } } } }),
      db.conversation.count({ where: { ...inPeriod, status: { not: "NEEDS_HUMAN" }, messages: { some: { sender: "AI" }, none: { sender: "STAFF" } } } }),
      db.conversation.count({ where: { ...inPeriod, OR: [{ messages: { some: { sender: "STAFF" } } }, { status: "NEEDS_HUMAN" }] } }),
    ]);

    const by = (sender: string) => messages.filter((m) => m.sender === sender);
    const customerMsgs = by("CUSTOMER"), aiMsgs = by("AI"), staffMsgs = by("STAFF");
    const convByDay = bucketByDay(conversations.map((c) => c.createdAt), labels, toDay);
    const custByDay = bucketByDay(customerMsgs.map((m) => m.createdAt), labels, toDay);
    const aiByDay = bucketByDay(aiMsgs.map((m) => m.createdAt), labels, toDay);
    const staffByDay = bucketByDay(staffMsgs.map((m) => m.createdAt), labels, toDay);

    const leadsWon = leads.filter((l) => l.status === "WON").length;
    const responseTimes = timing.map((c) => firstResponseMs(c.messages)).filter((x): x is number => x !== null);
    const med = median(responseTimes);
    const count = (action: string) => audit.filter((a) => a.action === action).length;

    res.json({
      days,
      timezone: tz,
      totals: {
        conversations: conversations.length,
        newCustomers,
        customerMessages: customerMsgs.length,
        aiReplies: aiMsgs.length,
        staffReplies: staffMsgs.length,
        leads: leads.length,
        leadsWon,
        appointments: appointments.length,
        appointmentsByAi: appointments.filter((a) => a.source === "ai").length,
        appointmentsCompleted: appointments.filter((a) => a.status === "COMPLETED").length,
        appointmentsNoShow: appointments.filter((a) => a.status === "NO_SHOW").length,
        appointmentsCancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      },
      rates: {
        aiResolvedShare: ratio(resolvedByAi, conversations.length),
        handedToPeopleShare: ratio(handedToPeople, conversations.length),
        leadsPerConversation: ratio(leads.length, conversations.length),
        winRate: ratio(leadsWon, leads.length),
      },
      firstResponse: { medianSeconds: med === null ? null : Math.round(med / 1000), sample: responseTimes.length },
      handoffs: {
        requested: count("ai.handoff"),
        failed: count("ai.failed"),
        unanswered: count("ai.unanswered_flagged"),
        limitReached: count("ai.daily_limit_reached") + count("ai.conversation_rate_limited"),
      },
      feedback: { up: aiMsgs.filter((m) => m.feedback === "up").length, down: aiMsgs.filter((m) => m.feedback === "down").length },
      topInterests: topCounts(leads.map((l) => l.interest), 5),
      daily: labels.map((date, i) => ({ date, conversations: convByDay[i], customer: custByDay[i], ai: aiByDay[i], staff: staffByDay[i] })),
    });
  }),
);

// AI replies a teammate rated down, with the question that led to them, so the owner can fix the knowledge behind them.
analyticsRoutes.get(
  "/feedback",
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const rated = await db.message.findMany({
      where: { sender: "AI", feedback: "down" },
      orderBy: { feedbackAt: "desc" },
      take: 20,
      select: { id: true, conversationId: true, body: true, createdAt: true, feedbackNote: true, feedbackAt: true },
    });
    const items = await Promise.all(
      rated.map(async (m) => {
        const q = await db.message.findFirst({ where: { conversationId: m.conversationId, sender: "CUSTOMER", createdAt: { lt: m.createdAt } }, orderBy: { createdAt: "desc" }, select: { body: true } });
        return { messageId: m.id, conversationId: m.conversationId, customerMessage: q?.body ?? null, aiReply: m.body, note: m.feedbackNote, ratedAt: m.feedbackAt };
      }),
    );
    res.json({ items });
  }),
);
