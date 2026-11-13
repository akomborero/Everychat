"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const analytics_1 = require("../../lib/analytics");
const booking_service_1 = require("../booking/booking.service");
const time_1 = require("../booking/time");
exports.analyticsRoutes = (0, express_1.Router)();
exports.analyticsRoutes.use(auth_1.requireAuth);
const HANDOFF_ACTIONS = ["ai.handoff", "ai.failed", "ai.unanswered_flagged", "ai.daily_limit_reached", "ai.conversation_rate_limited"];
exports.analyticsRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const days = zod_1.z.coerce.number().int().refine((v) => [7, 30, 90].includes(v), "days must be 7, 30 or 90").parse(req.query.days ?? 30);
    const { businessId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const tz = await (0, booking_service_1.getTimezone)(businessId);
    // Days are the business's own calendar days, so "today" matches what the owner sees on their wall.
    const today = (0, time_1.localDateOf)(new Date(), tz);
    const labels = Array.from({ length: days }, (_, i) => (0, time_1.addDays)(today, -(days - 1 - i)));
    const since = (0, time_1.localToUtc)(labels[0], "00:00", tz);
    const toDay = (d) => (0, time_1.localDateOf)(d, tz);
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
    const by = (sender) => messages.filter((m) => m.sender === sender);
    const customerMsgs = by("CUSTOMER"), aiMsgs = by("AI"), staffMsgs = by("STAFF");
    const convByDay = (0, analytics_1.bucketByDay)(conversations.map((c) => c.createdAt), labels, toDay);
    const custByDay = (0, analytics_1.bucketByDay)(customerMsgs.map((m) => m.createdAt), labels, toDay);
    const aiByDay = (0, analytics_1.bucketByDay)(aiMsgs.map((m) => m.createdAt), labels, toDay);
    const staffByDay = (0, analytics_1.bucketByDay)(staffMsgs.map((m) => m.createdAt), labels, toDay);
    const leadsWon = leads.filter((l) => l.status === "WON").length;
    const responseTimes = timing.map((c) => (0, analytics_1.firstResponseMs)(c.messages)).filter((x) => x !== null);
    const med = (0, analytics_1.median)(responseTimes);
    const count = (action) => audit.filter((a) => a.action === action).length;
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
            aiResolvedShare: (0, analytics_1.ratio)(resolvedByAi, conversations.length),
            handedToPeopleShare: (0, analytics_1.ratio)(handedToPeople, conversations.length),
            leadsPerConversation: (0, analytics_1.ratio)(leads.length, conversations.length),
            winRate: (0, analytics_1.ratio)(leadsWon, leads.length),
        },
        firstResponse: { medianSeconds: med === null ? null : Math.round(med / 1000), sample: responseTimes.length },
        handoffs: {
            requested: count("ai.handoff"),
            failed: count("ai.failed"),
            unanswered: count("ai.unanswered_flagged"),
            limitReached: count("ai.daily_limit_reached") + count("ai.conversation_rate_limited"),
        },
        feedback: { up: aiMsgs.filter((m) => m.feedback === "up").length, down: aiMsgs.filter((m) => m.feedback === "down").length },
        topInterests: (0, analytics_1.topCounts)(leads.map((l) => l.interest), 5),
        daily: labels.map((date, i) => ({ date, conversations: convByDay[i], customer: custByDay[i], ai: aiByDay[i], staff: staffByDay[i] })),
    });
}));
// AI replies a teammate rated down, with the question that led to them, so the owner can fix the knowledge behind them.
exports.analyticsRoutes.get("/feedback", (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const rated = await db.message.findMany({
        where: { sender: "AI", feedback: "down" },
        orderBy: { feedbackAt: "desc" },
        take: 20,
        select: { id: true, conversationId: true, body: true, createdAt: true, feedbackNote: true, feedbackAt: true },
    });
    const items = await Promise.all(rated.map(async (m) => {
        const q = await db.message.findFirst({ where: { conversationId: m.conversationId, sender: "CUSTOMER", createdAt: { lt: m.createdAt } }, orderBy: { createdAt: "desc" }, select: { body: true } });
        return { messageId: m.id, conversationId: m.conversationId, customerMessage: q?.body ?? null, aiReply: m.body, note: m.feedbackNote, ratedAt: m.feedbackAt };
    }));
    res.json({ items });
}));
