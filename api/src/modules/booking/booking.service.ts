import { Prisma } from "@prisma/client";
import { prisma, tenantDb } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { addDays, dayOfWeekOf, localDateOf, localToUtc, weekdayName } from "./time";

export interface Slot {
  date: string;
  weekday: string;
  time: string;
  startsAt: string; // UTC ISO, the value to pass back when booking
  remaining: number;
  capacity: number;
  durationMin: number;
}

const LEAD_TIME_MS = 60 * 60 * 1000; // no bookings starting within the next hour

export async function getTimezone(businessId: string) {
  const b = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true } });
  return b.timezone;
}

/** Open slots for `days` days starting at `fromDate` (business-local). Past and full slots are excluded. */
export async function availableSlots(businessId: string, opts: { fromDate?: string; days?: number } = {}): Promise<Slot[]> {
  const db = tenantDb(businessId);
  const tz = await getTimezone(businessId);
  const rules = await db.availabilityRule.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] });
  if (!rules.length) return [];

  const today = localDateOf(new Date(), tz);
  const from = opts.fromDate && opts.fromDate > today ? opts.fromDate : today;
  const days = Math.min(Math.max(opts.days ?? 7, 1), 14);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));

  const rangeStart = localToUtc(dates[0], "00:00", tz);
  const rangeEnd = localToUtc(addDays(dates[days - 1], 1), "00:00", tz);
  const booked = await db.appointment.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: rangeStart, lt: rangeEnd } },
    select: { startsAt: true },
  });
  const taken = new Map<string, number>();
  for (const b of booked) taken.set(b.startsAt.toISOString(), (taken.get(b.startsAt.toISOString()) ?? 0) + 1);

  const minStart = Date.now() + LEAD_TIME_MS;
  const out: Slot[] = [];
  for (const date of dates) {
    const dow = dayOfWeekOf(date);
    for (const r of rules.filter((x) => x.dayOfWeek === dow)) {
      const start = localToUtc(date, r.startTime, tz);
      if (start.getTime() < minStart) continue;
      const remaining = r.capacity - (taken.get(start.toISOString()) ?? 0);
      if (remaining > 0) {
        out.push({ date, weekday: weekdayName(dow), time: r.startTime, startsAt: start.toISOString(), remaining, capacity: r.capacity, durationMin: r.durationMin });
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
export async function bookSlot(p: {
  businessId: string;
  customerId: string;
  startsAt: string;
  serviceId?: string | null;
  notes?: string | null;
  source: "ai" | "staff";
}) {
  const { businessId } = p;
  const when = new Date(p.startsAt);
  if (Number.isNaN(when.getTime())) throw new AppError(400, "That is not a valid time");

  const tz = await getTimezone(businessId);
  const slots = await availableSlots(businessId, { fromDate: localDateOf(when, tz), days: 1 });
  const slot = slots.find((s) => s.startsAt === when.toISOString());
  if (!slot) throw new AppError(409, "That time is not available");

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Written with explicit businessId: this transaction client is not the tenant-scoped one.
        const taken = await tx.appointment.count({ where: { businessId, status: "CONFIRMED", startsAt: when } });
        if (taken >= slot.capacity) throw new AppError(409, "That time was just taken");
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") throw new AppError(409, "That time was just taken");
    throw e;
  }
}

export async function cancelAppointment(businessId: string, appointmentId: string, customerId?: string) {
  const { count } = await tenantDb(businessId).appointment.updateMany({
    where: { id: appointmentId, status: "CONFIRMED", ...(customerId ? { customerId } : {}) },
    data: { status: "CANCELLED" },
  });
  if (!count) throw new AppError(404, "No confirmed appointment found to cancel");
}
