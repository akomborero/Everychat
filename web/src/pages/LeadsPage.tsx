import { useState } from "react";
import { EmptyState, ErrorNote, PageHeader, Pill, Select, Skeleton, useToast, type Tone } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { displayName, timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import type { Lead, LeadStatus } from "../lib/types";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "WON", "LOST"];
const TONE: Record<LeadStatus, Tone> = { NEW: "violet", CONTACTED: "neutral", QUALIFIED: "violet", INTERESTED: "amber", WON: "green", LOST: "red" };
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default function LeadsPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<LeadStatus | "ALL">("ALL");
  const leads = useApi<{ leads: Lead[] }>(filter === "ALL" ? "/leads" : `/leads?status=${filter}`, { poll: 20000, live: true });
  const canEdit = me?.role !== "VIEWER";

  async function setStatus(l: Lead, status: LeadStatus) {
    try { await api(`/leads/${l.id}`, { method: "PATCH", body: { status } }); await leads.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
  }

  return (
    <>
      <PageHeader title="Leads" subtitle="People who showed interest. The AI adds them automatically; you move them along." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", filter === s ? "border-violet bg-violet text-white" : "border-line bg-white hover:bg-violet-s")}>
            {s === "ALL" ? "All" : label(s)}
          </button>
        ))}
      </div>

      {leads.error && <ErrorNote>{leads.error}</ErrorNote>}
      {leads.loading && <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {leads.data?.leads.length === 0 && <EmptyState title="No leads here yet">When a customer asks about a service or shares their name, the AI saves them as a lead.</EmptyState>}

      {!!leads.data?.leads.length && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr><th className="p-4 font-semibold">Customer</th><th className="p-4 font-semibold">Interested in</th><th className="p-4 font-semibold">Notes</th><th className="p-4 font-semibold">Status</th><th className="p-4 font-semibold">Updated</th></tr>
            </thead>
            <tbody>
              {leads.data.leads.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 align-top">
                  <td className="p-4"><div className="font-semibold">{displayName(l.customer)}</div>{l.customer.name && <div className="text-sm text-muted">{l.customer.phone}</div>}</td>
                  <td className="p-4">{l.interest ?? "–"}</td>
                  <td className="max-w-xs p-4 text-sm text-muted">{l.notes ?? "–"}</td>
                  <td className="p-4">
                    {canEdit
                      ? <Select value={l.status} onChange={(e) => setStatus(l, e.target.value as LeadStatus)} aria-label={`Status for ${displayName(l.customer)}`} className="py-1.5">{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
                      : <Pill tone={TONE[l.status]}>{label(l.status)}</Pill>}
                  </td>
                  <td className="p-4 text-sm text-muted">{timeAgo(l.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
