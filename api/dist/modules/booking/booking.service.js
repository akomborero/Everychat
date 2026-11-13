"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimezone = getTimezone;
exports.availableSlots = availableSlots;
exports.bookSlot = bookSlot;
exports.cancelAppointment = cancelAppointment;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const time_1 = require("./time");
const LEAD_TIME_MS = 60 * 60 * 1000; // no bookings starting within the next hour
async function getTimezone(businessId) {
    const b = await prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true } });
    return b.timezone;
}
/** Open slots for `days` days starting at `fromDate` (business-local). Past and full slots are excluded. */
async function availableSlots(businessId, opts = {}) {
    const db = (0, prisma_1.tenantDb)(businessId);
    const tz = await getTimezone(businessId);
    const rules = await db.availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
    if (!rules.length)
        return [];
    const today = (0, time_1.localDateOf)(new Date(), tz);
    const from = opts.fromDate && opts.fromDate > today ? opts.fromDate : today;
    const days = Math.min(Math.max(opts.days ?? 7, 1), 14);
    const dates = Array.from({ length: days }, (_, i) => (0, time_1.addDays)(from, i));
    const rangeStart = (0, time_1.localToUtc)(dates[0], "00:00", tz);
    const rangeEnd = (0, time_1.localToUtc)((0, time_1.addDays)(dates[days - 1], 1), "00:00", tz);
    const booked = await db.appointment.findMany({
        where: { status: "CONFIRMED", startsAt: { gte: rangeStart, lt: rangeEnd } },
        select: { startsAt: true },
    });
    const taken = new Map();
    for (const b of booked)
        taken.set(b.startsAt.toISOString(), (taken.get(b.startsAt.toISOString()) ?? 0) + 1);
    const minStart = Date.now() + LEAD_TIME_MS;
    const out = [];
    for (const date of dates) {
        const dow = (0, time_1.dayOfWeekOf)(date);
        for (const r of rules.filter((x) => x.dayOfWeek === dow)) {
            const start = (0, time_1.localToUtc)(date, r.startTime, tz);
            if (start.getTime() < minStart)
                continue;
            const remaining = r.capacity - (taken.get(start.toISOString()) ?? 0);
            if (remaining > 0) {
                out.push({ date, weekday: (0, time_1.weekdayName)(dow), time: r.startTime, startsAt: start.toISOString(), remaining, capacity: r.capacity, durationMin: r.durationMin });
            }
        }
    }
    return out;
}
/**
 * Books a slot only if it is genuinely open right now. The AI cannot invent times: anything
 * that is not in availableSlots() is rejected. The capacity check runs in a serializable
 * transaction so two simultaneous bookings cannot both take the last place.
 */
async function bookSlot(p) {
    const { businessId } = p;
    const when = new Date(p.startsAt);
    if (Number.isNaN(when.getTime()))
        throw new errors_1.AppError(400, "That is not a valid time");
    const tz = await getTimezone(businessId);
    const slots = await availableSlots(businessId, { fromDate: (0, time_1.localDateOf)(when, tz), days: 1 });
    const slot = slots.find((s) => s.startsAt === when.toISOString());
    if (!slot)
        throw new errors_1.AppError(409, "That time is not available");
    try {
        return await prisma_1.prisma.$transaction(async (tx) => {
            // Written with explicit businessId: this transaction client is not the tenant-scoped one.
            const taken = await tx.appointment.count({ where: { businessId, status: "CONFIRMED", startsAt: when } });
            if (taken >= slot.capacity)
                throw new errors_1.AppError(409, "That time was just taken");
            return tx.appointment.create({
                data: {
                    businessId,
                    customerId: p.customerId,
                    serviceId: p.serviceId ?? null,
                    startsAt: when,
                    endsAt: new Date(when.getTime() + slot.durationMin * 60000),
                    notes: p.notes ?? null,
                    source: p.source,
                },
            });
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2034")
            throw new errors_1.AppError(409, "That time was just taken");
        throw e;
    }
}
async function cancelAppointment(businessId, appointmentId, customerId) {
    const { count } = await (0, prisma_1.tenantDb)(businessId).appointment.updateMany({
        where: { id: appointmentId, status: "CONFIRMED", ...(customerId ? { customerId } : {}) },
        data: { status: "CANCELLED" },
    });
    if (!count)
        throw new errors_1.AppError(404, "No confirmed appointment found to cancel");
}
