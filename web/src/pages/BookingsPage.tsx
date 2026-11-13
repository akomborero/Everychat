import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Pill, Select, Skeleton, useToast, type Tone } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { displayName, whenLocal } from "../lib/format";
import { cn } from "../lib/cn";
import type { Appointment, AppointmentStatus, AvailabilityRule } from "../lib/types";

const DAYS = [
  { dow: 1, name: "Monday" }, { dow: 2, name: "Tuesday" }, { dow: 3, name: "Wednesday" }, { dow: 4, name: "Thursday" },
  { dow: 5, name: "Friday" }, { dow: 6, name: "Saturday" }, { dow: 0, name: "Sunday" },
];
const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  CONFIRMED: { label: "Confirmed", tone: "violet" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  NO_SHOW: { label: "No-show", tone: "red" },
};

export default function BookingsPage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "times" ? "times" : "appointments";
  const canEdit = me?.role === "OWNER" || me?.role === "ADMIN";
  const tz = me?.business.timezone ?? "UTC";

  return (
    <>
      <PageHeader title="Bookings" subtitle="See appointments and choose the time slots customers can book with the AI." />
      <div className="mb-6 flex gap-1 border-b border-line">
        {([["appointments", "Appointments"], ["times", "Available times"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setParams(k === "times" ? { tab: "times" } : {})} className={cn("-mb-px border-b-2 px-4 py-2.5 font-semibold", tab === k ? "border-violet text-violet" : "border-transparent text-muted hover:text-ink")}>{label}</button>
        ))}
      </div>
      {tab === "appointments" ? <Appointments tz={tz} canAct={me?.role !== "VIEWER"} /> : <Times tz={tz} canEdit={canEdit} />}
    </>
  );
}

function Appointments({ tz, canAct }: { tz: string; canAct: boolean }) {
  const toast = useToast();
  const [range, setRange] = useState<"upcoming" | "past">("upcoming");
  const list = useApi<{ appointments: Appointment[] }>(`/appointments?range=${range}`, { poll: 20000, live: true });

  async function setStatus(a: Appointment, status: AppointmentStatus) {
    try { await api(`/appointments/${a.id}`, { method: "PATCH", body: { status } }); await list.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
        {(["upcoming", "past"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize", range === r ? "border-violet bg-violet text-white" : "border-line bg-white hover:bg-violet-s")}>{r}</button>
        ))}
      </div>
      {list.error && <ErrorNote>{list.error}</ErrorNote>}
      {list.loading && <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
      {list.data?.appointments.length === 0 && <EmptyState title={range === "upcoming" ? "No upcoming appointments" : "No past appointments"}>{range === "upcoming" ? "When the AI books a customer, it shows up here." : undefined}</EmptyState>}
      {!!list.data?.appointments.length && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {list.data.appointments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="w-40 flex-none font-semibold">{whenLocal(a.startsAt, tz)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{displayName(a.customer)}</div>
                <div className="truncate text-sm text-muted">{a.service?.name ?? "Appointment"} · {a.customer.phone}{a.source === "ai" ? " · booked by AI" : ""}</div>
              </div>
              <Pill tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Pill>
              {canAct && a.status === "CONFIRMED" && (
                <div className="flex gap-1">
                  {range === "past" && <Button size="sm" variant="ghost" onClick={() => setStatus(a, "COMPLETED")}>Completed</Button>}
                  {range === "past" && <Button size="sm" variant="ghost" onClick={() => setStatus(a, "NO_SHOW")}>No-show</Button>}
                  {range === "upcoming" && <Button size="sm" variant="danger" onClick={() => confirm("Cancel this appointment?") && setStatus(a, "CANCELLED")}>Cancel</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Times({ tz, canEdit }: { tz: string; canEdit: boolean }) {
  const toast = useToast();
  const rules = useApi<{ rules: AvailabilityRule[] }>("/availability");
  const [slots, setSlots] = useState<Record<number, string[]>>({});
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const synced = useRef(false);

  // Fill the editor once from the server; later reloads must not wipe unsaved edits.
  useEffect(() => {
    if (!rules.data || synced.current) return;
    synced.current = true;
    const g: Record<number, string[]> = {};
    for (const r of rules.data.rules) (g[r.dayOfWeek] ??= []).push(r.startTime);
    setSlots(g);
    if (rules.data.rules[0]) { setDuration(rules.data.rules[0].durationMin); setCapacity(rules.data.rules[0].capacity); }
  }, [rules.data]);

  if (rules.loading) return <Skeleton className="h-72 max-w-2xl" />;
  if (!rules.data) return <ErrorNote>{rules.error}</ErrorNote>;

  const add = (dow: number, time: string) => {
    if (!time || slots[dow]?.includes(time)) return;
    setSlots({ ...slots, [dow]: [...(slots[dow] ?? []), time].sort() }); setDirty(true);
  };
  const remove = (dow: number, time: string) => { setSlots({ ...slots, [dow]: slots[dow].filter((t) => t !== time) }); setDirty(true); };

  async function save() {
    setSaving(true);
    const body = { rules: DAYS.flatMap((d) => (slots[d.dow] ?? []).map((startTime) => ({ dayOfWeek: d.dow, startTime, durationMin: duration, capacity }))) };
    try { await api("/availability", { method: "PUT", body }); setDirty(false); toast("Available times saved"); await rules.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl bg-violet-s p-4 text-sm">
        <p className="font-semibold text-violet-d">How this works</p>
        <p className="mt-1">These are the specific appointment times the AI can offer to customers (for example 9:00, 10:00, 11:00). This is different from your general opening hours in <b>What your AI should know</b>. Times are shown in <b>{tz}</b>.</p>
      </div>
      <p className="text-muted">Add the start time of each slot customers can book. If you don't take appointments, you can leave this empty.</p>
      {canEdit && (
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Field label="Length of each slot (minutes)"><Input type="number" min={10} max={480} value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setDirty(true); }} /></Field>
          <Field label="Bookings per slot" hint="More than 1 if several staff can serve customers at the same time"><Input type="number" min={1} max={50} value={capacity} onChange={(e) => { setCapacity(Number(e.target.value)); setDirty(true); }} /></Field>
        </div>
      )}
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
        {DAYS.map((d) => (
          <li key={d.dow} className="flex flex-wrap items-center gap-3 p-4">
            <div className="w-28 flex-none font-semibold">{d.name}</div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {(slots[d.dow] ?? []).length === 0 && <span className="text-sm text-muted">Closed for bookings</span>}
              {(slots[d.dow] ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-s px-3 py-1 text-sm font-semibold text-violet-d">
                  {t}
                  {canEdit && <button onClick={() => remove(d.dow, t)} aria-label={`Remove ${t} on ${d.name}`} className="hover:text-red"><X size={14} /></button>}
                </span>
              ))}
            </div>
            {canEdit && <AddTime onAdd={(t) => add(d.dow, t)} label={`Add a time on ${d.name}`} />}
          </li>
        ))}
      </ul>
      {canEdit && <Button onClick={save} loading={saving} disabled={!dirty}>Save available times</Button>}
      {!canEdit && <p className="text-muted">Only owners and admins can change available times.</p>}
    </div>
  );
}

function AddTime({ onAdd, label }: { onAdd: (t: string) => void; label: string }) {
  const [t, setT] = useState("");
  return (
    <div className="flex gap-1.5">
      <input type="time" value={t} onChange={(e) => setT(e.target.value)} aria-label={label} className="rounded-xl border border-line bg-white px-2.5 py-1.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
      <Button size="sm" variant="ghost" onClick={() => { onAdd(t); setT(""); }} disabled={!t}>Add</Button>
    </div>
  );
}
