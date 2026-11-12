import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { availableSlots, bookSlot, cancelAppointment, getTimezone } from "../booking/booking.service";
import { formatLocal } from "../booking/time";
import type { ToolRunner } from "./engine";
import { flagForHuman } from "./handoff";

const leadArgs = z.object({
  name: z.string().trim().max(100).optional(),
  interest: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional(),
});
const humanArgs = z.object({
  reason: z.string().trim().max(300).default("Customer needs help"),
  kind: z.enum(["person_requested", "complaint", "payment", "no_answer", "other"]).default("other"),
  question: z.string().trim().max(300).optional(),
});
const slotsArgs = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(1).max(14).optional(),
});
const bookArgs = z.object({
  starts_at: z.string().min(10).max(40),
  service: z.string().trim().max(120).optional(),
  name: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});
const cancelArgs = z.object({ appointment_id: z.string().min(1).max(60) });

/** Read-only, so it is safe to run for real even in the test chat. */
async function slotsResult(businessId: string, raw: unknown) {
  const a = slotsArgs.parse(raw);
  const slots = (await availableSlots(businessId, { fromDate: a.from_date, days: a.days })).slice(0, 40);
  if (!slots.length) return { days: [], note: "No open times in this period. Try a later date or hand over to the team." };
  const byDate = new Map<string, { date: string; weekday: string; times: { time: string; starts_at: string }[] }>();
  for (const s of slots) {
    if (!byDate.has(s.date)) byDate.set(s.date, { date: s.date, weekday: s.weekday, times: [] });
    byDate.get(s.date)!.times.push({ time: s.time, starts_at: s.startsAt });
  }
  return { days: [...byDate.values()] };
}

/** The only actions the AI can take. Each one is validated and tenant scoped by our backend, not by the model. */
export function liveTools(businessId: string, conversationId: string, customerId: string): ToolRunner {
  const db = tenantDb(businessId);
  return async (name, rawArgs) => {
    if (name === "capture_lead") {
      const a = leadArgs.parse(rawArgs);
      if (a.name) {
        const c = await db.customer.findFirst({ where: { id: customerId }, select: { name: true } });
        if (c && !c.name) await db.customer.update({ where: { id: customerId }, data: { name: a.name } });
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
      await flagForHuman(businessId, conversationId, "requested");
      await db.auditLog.create({ data: { businessId, action: "ai.handoff", metadata: { conversationId, reason: a.reason, kind: a.kind } } });
      if (a.kind === "no_answer") {
        // Remember what we could not answer, so the owner can add it to the knowledge base.
        const question = a.question || (await db.message.findFirst({ where: { conversationId, sender: "CUSTOMER" }, orderBy: { createdAt: "desc" }, select: { body: true } }))?.body.slice(0, 300);
        if (question) await db.knowledgeGap.create({ data: { businessId, conversationId, question } });
      }
      return { ok: true };
    }

    if (name === "get_available_slots") return slotsResult(businessId, rawArgs);

    if (name === "book_appointment") {
      const a = bookArgs.parse(rawArgs);
      const service = a.service
        ? await db.service.findFirst({ where: { name: { equals: a.service, mode: "insensitive" }, active: true }, select: { id: true, name: true } })
        : null;
      try {
        const appt = await bookSlot({ businessId, customerId, startsAt: a.starts_at, serviceId: service?.id, notes: a.notes, source: "ai" });
        if (a.name) {
          const c = await db.customer.findFirst({ where: { id: customerId }, select: { name: true } });
          if (c && !c.name) await db.customer.update({ where: { id: customerId }, data: { name: a.name } });
        }
        // A booking means real interest: make sure staff see this person as a lead.
        const open = await db.lead.findFirst({ where: { customerId, status: { notIn: ["WON", "LOST"] } }, select: { id: true } });
        if (!open) await db.lead.create({ data: { businessId, customerId, status: "QUALIFIED", interest: service?.name ?? "Appointment" } });
        const tz = await getTimezone(businessId);
        return { ok: true, appointment_id: appt.id, when: formatLocal(appt.startsAt, tz), service: service?.name ?? null };
      } catch (e) {
        if (e instanceof AppError) return { ok: false, error: e.message };
        throw e;
      }
    }

    if (name === "cancel_appointment") {
      const a = cancelArgs.parse(rawArgs);
      try {
        await cancelAppointment(businessId, a.appointment_id, customerId);
        return { ok: true };
      } catch (e) {
        if (e instanceof AppError) return { ok: false, error: e.message };
        throw e;
      }
    }

    return { error: `Unknown action ${name}` };
  };
}

/** Test chat: reads real availability, but never writes. Writes are only reported. */
export function dryRunTools(businessId: string): ToolRunner {
  return async (name, args) => {
    if (name === "get_available_slots") return slotsResult(businessId, args);
    return { ok: true, simulated: true, action: name };
  };
}
