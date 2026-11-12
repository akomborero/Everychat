import { useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { useApi } from "../lib/hooks";
import { cn } from "../lib/cn";
import type { Analytics, FeedbackItem } from "../lib/types";

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);
const dur = (s: number | null) => (s === null ? "–" : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
const label = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

function Tiles({ items }: { items: { k: string; v: string | number | undefined; hint?: string }[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 border-y border-line lg:grid-cols-4">
      {items.map((s, i) => (
        <div key={s.k} className={cn("py-5 pr-4", i % 2 === 1 && "border-l border-line pl-5", i % 4 !== 0 && "lg:border-l lg:pl-5", i % 4 === 0 && "lg:border-l-0 lg:pl-0", i >= 2 && "border-t border-line", i >= 4 && "lg:border-t")}>
          {s.v === undefined ? <Skeleton className="h-9 w-16" /> : <div className="font-display text-4xl font-extrabold tracking-tight">{s.v}</div>}
          <div className="text-sm text-muted">{s.k}</div>
          {s.hint && <div className="text-xs text-muted">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const a = useApi<Analytics>(`/analytics?days=${days}`, { poll: 60000, live: true });
  const fb = useApi<{ items: FeedbackItem[] }>("/analytics/feedback", { poll: 60000, live: true });
  const d = a.data;
  const t = d?.totals;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={d ? `Last ${d.days} days, in your time zone (${d.timezone})` : "How your WhatsApp is performing"}
        actions={
          <div className="flex gap-2">
            {[7, 30, 90].map((n) => (
              <button key={n} onClick={() => setDays(n)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", days === n ? "border-violet bg-violet text-white" : "border-line bg-white hover:bg-violet-s")}>{n} days</button>
            ))}
          </div>
        }
      />
      {a.error && <ErrorNote>{a.error}</ErrorNote>}

      <Tiles items={[
        { k: "Conversations started", v: t?.conversations },
        { k: "New customers", v: t?.newCustomers },
        { k: "Leads captured", v: t?.leads },
        { k: "Appointments booked", v: t?.appointments, hint: t ? `${t.appointmentsByAi} by the AI` : undefined },
      ]} />
      <Tiles items={[
        { k: "Handled by the AI alone", v: d && pct(d.rates.aiResolvedShare), hint: "No staff reply needed" },
        { k: "Needed a person", v: d && pct(d.rates.handedToPeopleShare) },
        { k: "Median first reply", v: d && dur(d.firstResponse.medianSeconds), hint: d ? `from ${d.firstResponse.sample} recent chats` : undefined },
        { k: "Leads won", v: d && pct(d.rates.winRate), hint: t ? `${t.leadsWon} of ${t.leads}` : undefined },
      ]} />

      {d && d.totals.conversations === 0 && <EmptyState title="No conversations in this period yet">Numbers appear here as customers start messaging you.</EmptyState>}

      {d && (
        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-bold">Messages per day</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.daily.map((x) => ({ ...x, day: label(x.date) }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6E6A85" }} interval="preserveStartEnd" minTickGap={28} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E3F2", fontSize: 13 }} />
                  <Area type="monotone" dataKey="customer" name="Customers" stackId="1" stroke="#9A93B8" fill="#E7E3F2" />
                  <Area type="monotone" dataKey="ai" name="AI" stackId="1" stroke="#5B3FD1" fill="#CFC4F4" />
                  <Area type="monotone" dataKey="staff" name="Your team" stackId="1" stroke="#E9A82F" fill="#FBE2AE" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">New conversations per day</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.daily.map((x) => ({ ...x, day: label(x.date) }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6E6A85" }} interval="preserveStartEnd" minTickGap={28} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E3F2", fontSize: 13 }} cursor={{ fill: "#EFEBFC" }} />
                  <Bar dataKey="conversations" name="Conversations" fill="#5B3FD1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">Why conversations went to your team</h2>
            {(() => {
              const rows: [string, number][] = [["The AI asked for a person", d.handoffs.requested], ["The AI couldn't reply", d.handoffs.failed], ["A message waited too long", d.handoffs.unanswered], ["A usage limit was reached", d.handoffs.limitReached]];
              return rows.every(([, n]) => n === 0)
                ? <p className="text-muted">Nothing handed over in this period.</p>
                : <ul className="divide-y divide-line border-y border-line">{rows.map(([k, n]) => <li key={k} className="flex justify-between py-3"><span>{k}</span><b>{n}</b></li>)}</ul>;
            })()}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">What people ask about most</h2>
            {d.topInterests.length === 0 ? <p className="text-muted">Interests appear here once leads are captured.</p> : (
              <ul className="divide-y divide-line border-y border-line">{d.topInterests.map((x) => <li key={x.value} className="flex justify-between gap-3 py-3"><span className="min-w-0 truncate">{x.value}</span><b>{x.count}</b></li>)}</ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">Appointments</h2>
            <ul className="divide-y divide-line border-y border-line">
              {([["Booked", d.totals.appointments], ["Booked by the AI", d.totals.appointmentsByAi], ["Completed", d.totals.appointmentsCompleted], ["No-shows", d.totals.appointmentsNoShow], ["Cancelled", d.totals.appointmentsCancelled]] as [string, number][]).map(([k, n]) => <li key={k} className="flex justify-between py-3"><span>{k}</span><b>{n}</b></li>)}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">AI reply quality</h2>
            <p className="mb-2 flex items-center gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><ThumbsUp size={15} className="text-green" /> {d.feedback.up} good</span>
              <span className="inline-flex items-center gap-1.5"><ThumbsDown size={15} className="text-red" /> {d.feedback.down} not good</span>
              <span>Rate replies with the thumbs in the inbox.</span>
            </p>
          </section>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-bold">Replies to improve</h2>
        <p className="mb-3 text-muted">AI replies your team rated down, with the question that led to them. Add the missing information under Knowledge so it answers better next time.</p>
        {fb.loading && <Skeleton className="h-24" />}
        {fb.data?.items.length === 0 && <p className="text-muted">No replies rated down yet.</p>}
        <div className="space-y-3">
          {fb.data?.items.map((i) => (
            <div key={i.messageId} className="rounded-2xl border border-line bg-white p-4">
              {i.customerMessage && <p className="text-sm"><span className="font-semibold">Customer:</span> {i.customerMessage}</p>}
              <p className="mt-1 text-sm"><span className="font-semibold">AI replied:</span> {i.aiReply}</p>
              {i.note && <p className="mt-1 text-sm text-red"><span className="font-semibold">What was wrong:</span> {i.note}</p>}
              <Link to={`/inbox/${i.conversationId}`} className="mt-2 inline-block text-sm font-semibold text-violet hover:underline">Open the conversation</Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
