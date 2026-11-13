"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveTools = liveTools;
exports.dryRunTools = dryRunTools;
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const booking_service_1 = require("../booking/booking.service");
const time_1 = require("../booking/time");
const handoff_1 = require("./handoff");
const leadArgs = zod_1.z.object({
    name: zod_1.z.string().trim().max(100).optional(),
    interest: zod_1.z.string().trim().min(1).max(200),
    notes: zod_1.z.string().trim().max(1000).optional(),
});
const humanArgs = zod_1.z.object({
    reason: zod_1.z.string().trim().max(300).default("Customer needs help"),
    kind: zod_1.z.enum(["person_requested", "complaint", "payment", "no_answer", "other"]).default("other"),
    question: zod_1.z.string().trim().max(300).optional(),
});
const slotsArgs = zod_1.z.object({
    from_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    days: zod_1.z.number().int().min(1).max(14).optional(),
});
const bookArgs = zod_1.z.object({
    starts_at: zod_1.z.string().min(10).max(40),
    service: zod_1.z.string().trim().max(120).optional(),
    name: zod_1.z.string().trim().max(100).optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
const cancelArgs = zod_1.z.object({ appointment_id: zod_1.z.string().min(1).max(60) });
/** Read-only, so it is safe to run for real even in the test chat. */
async function slotsResult(businessId, raw) {
    const a = slotsArgs.parse(raw);
    const slots = (await (0, booking_service_1.availableSlots)(businessId, { fromDate: a.from_date, days: a.days })).slice(0, 40);
    if (!slots.length)
        return { days: [], note: "No open times in this period. Try a later date or hand over to the team." };
    const byDate = new Map();
    for (const s of slots) {
        if (!byDate.has(s.date))
            byDate.set(s.date, { date: s.date, weekday: s.weekday, times: [] });
        byDate.get(s.date).times.push({ time: s.time, starts_at: s.startsAt });
    }
    return { days: [...byDate.values()] };
}
/** The only actions the AI can take. Each one is validated and tenant scoped by our backend, not by the model. */
function liveTools(businessId, conversationId, customerId) {
    const db = (0, prisma_1.tenantDb)(businessId);
    return async (name, rawArgs) => {
        if (name === "capture_lead") {
            const a = leadArgs.parse(rawArgs);
            if (a.name) {
                const c = await db.customer.findFirst({ where: { id: customerId }, select: { name: true } });
                if (c && !c.name)
                    await db.customer.update({ where: { id: customerId }, data: { name: a.name } });
            }
            const open = await db.lead.findFirst({ where: { customerId, status: { notIn: ["WON", "LOST"] } } });
            if (open) {
                await db.lead.update({ where: { id: open.id }, data: { interest: a.interest, notes: a.notes ?? open.notes } });
                return { ok: true, leadId: open.id, existing: true };
            }
            const lead = await db.lead.create({ data: { businessId, customerId, interest: a.interest, notes: a.notes ?? null } });
            return { ok: true, leadId: lead.id };
        }
        if (name === "request_human") {
            const a = humanArgs.parse(rawArgs);
            await (0, handoff_1.flagForHuman)(businessId, conversationId, "requested");
            await db.auditLog.create({ data: { businessId, action: "ai.handoff", metadata: { conversationId, reason: a.reason, kind: a.kind } } });
            if (a.kind === "no_answer") {
                // Remember what we could not answer, so the owner can add it to the knowledge base.
                const question = a.question || (await db.message.findFirst({ where: { conversationId, sender: "CUSTOMER" }, orderBy: { createdAt: "desc" }, select: { body: true } }))?.body.slice(0, 300);
                if (question)
                    await db.knowledgeGap.create({ data: { businessId, conversationId, question } });
            }
            return { ok: true };
        }
        if (name === "get_available_slots")
            return slotsResult(businessId, rawArgs);
        if (name === "book_appointment") {
            const a = bookArgs.parse(rawArgs);
            const service = a.service
                ? await db.service.findFirst({ where: { name: { equals: a.service, mode: "insensitive" }, active: true }, select: { id: true, name: true } })
                : null;
            try {
                const appt = await (0, booking_service_1.bookSlot)({ businessId, customerId, startsAt: a.starts_at, serviceId: service?.id, notes: a.notes, source: "ai" });
                if (a.name) {
                    const c = await db.customer.findFirst({ where: { id: customerId }, select: { name: true } });
                    if (c && !c.name)
                        await db.customer.update({ where: { id: customerId }, data: { name: a.name } });
                }
                // A booking means real interest: make sure staff see this person as a lead.
                const open = await db.lead.findFirst({ where: { customerId, status: { notIn: ["WON", "LOST"] } }, select: { id: true } });
                if (!open)
                    await db.lead.create({ data: { businessId, customerId, status: "QUALIFIED", interest: service?.name ?? "Appointment" } });
                const tz = await (0, booking_service_1.getTimezone)(businessId);
                return { ok: true, appointment_id: appt.id, when: (0, time_1.formatLocal)(appt.startsAt, tz), service: service?.name ?? null };
            }
            catch (e) {
                if (e instanceof errors_1.AppError)
                    return { ok: false, error: e.message };
                throw e;
            }
        }
        if (name === "cancel_appointment") {
            const a = cancelArgs.parse(rawArgs);
            try {
                await (0, booking_service_1.cancelAppointment)(businessId, a.appointment_id, customerId);
                return { ok: true };
            }
            catch (e) {
                if (e instanceof errors_1.AppError)
                    return { ok: false, error: e.message };
                throw e;
            }
        }
        return { error: `Unknown action ${name}` };
    };
}
/** Test chat: reads real availability, but never writes. Writes are only reported. */
function dryRunTools(businessId) {
    return async (name, args) => {
        if (name === "get_available_slots")
            return slotsResult(businessId, args);
        return { ok: true, simulated: true, action: name };
    };
}
