import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Check } from "lucide-react";
import { useShell } from "../components/Shell";
import { Avatar, EmptyState, ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { displayName, initials, timeAgo, whenLocal } from "../lib/format";
import { cn } from "../lib/cn";
import type { Conversation } from "../lib/types";

export default function OverviewPage() {
  const { me } = useAuth();
  const { overview } = useShell();
  const needs = useApi<{ conversations: Conversation[] }>("/conversations?status=NEEDS_HUMAN", { poll: 15000, live: true });
  const o = overview.data;

  const steps = o && [
    { done: o.setup.whatsappConnected, title: "Connect your WhatsApp number", to: "/settings" },
    { done: o.setup.profile, title: "Describe your business and opening hours", to: "/knowledge" },
    { done: o.setup.services, title: "Add your services and prices", to: "/knowledge?tab=services" },
    { done: o.setup.knowledge, title: "Add FAQs or upload documents", to: "/knowledge?tab=faqs" },
    { done: o.setup.availability, title: "Set the times customers can book", to: "/bookings?tab=times" },
    { done: o.setup.aiActive, title: "Test the AI, then switch it on", to: "/ai" },
  ];
  const doneCount = steps?.filter((s) => s.done).length ?? 0;

  return (
    <>
      <PageHeader title={`Hello, ${me?.user.name.split(" ")[0]}`} subtitle={`${me?.business.name} · last 7 days`} />
      {overview.error && <ErrorNote>{overview.error}</ErrorNote>}
      {o?.whatsappAttention && (
        <Link to="/settings" className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-s px-5 py-4 font-medium hover:brightness-95">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-amber font-bold text-ink">!</span>
          <span className="flex-1">Your WhatsApp connection needs attention. Customers may not be getting replies.</span>
          <span className="font-semibold text-violet">Fix it</span>
        </Link>
      )}

      {o?.aiLimitReached && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-s px-5 py-4 font-medium">
          Your daily AI limit has been reached, so new customer messages are being passed to your team until tomorrow (UTC). Contact us if you need a higher limit.
        </div>
      )}

      {!!o?.openGaps && (
        <Link to="/knowledge?tab=gaps" className="mb-6 flex items-center gap-3 rounded-2xl bg-violet-s px-5 py-4 font-medium hover:brightness-95">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-violet font-bold text-white">{o.openGaps}</span>
          <span className="flex-1">{o.openGaps === 1 ? "A question" : "Questions"} the AI couldn't answer. Add the answers so it handles them next time.</span>
          <span className="font-semibold text-violet">Answer</span>
        </Link>
      )}

      {steps && doneCount < steps.length && (
        <section className="mb-8 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Get your AI live</h2>
            <span className="text-sm text-muted">{doneCount} of {steps.length} done</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-violet transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <ul className="mt-2 divide-y divide-line">
            {steps.map((s) => (
              <li key={s.title}>
                <Link to={s.to} className="flex items-center gap-3 py-3 hover:text-violet">
                  <span className={cn("grid size-6 flex-none place-items-center rounded-full border", s.done ? "border-green bg-green text-white" : "border-line")}>{s.done && <Check size={14} strokeWidth={3} />}</span>
                  <span className={cn("font-medium", s.done && "text-muted line-through")}>{s.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-8 grid grid-cols-2 border-y border-line lg:grid-cols-4">
        {[
          { v: o?.conversations, k: "Conversations" },
          { v: o?.leads7d, k: "New leads" },
          { v: o?.customers, k: "Customers in total" },
          { v: o ? (o.aiShare === null ? "–" : `${Math.round(o.aiShare * 100)}%`) : undefined, k: "Replies sent by AI" },
        ].map((s, i) => (
          <div key={s.k} className={cn("py-5 pr-4", i % 2 === 1 && "border-l border-line pl-5", i === 2 && "border-l-0 pl-0 lg:border-l lg:pl-5", i >= 2 && "border-t border-line lg:border-t-0")}>
            {s.v === undefined ? <Skeleton className="h-10 w-16" /> : <div className="font-display text-4xl font-extrabold tracking-tight">{s.v}</div>}
            <div className="text-sm text-muted">{s.k}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-bold">Messages per day</h2>
          {!o ? <Skeleton className="h-56 w-full" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={o.daily.map((d) => ({ ...d, day: new Date(d.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }) }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6E6A85" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E7E3F2", fontSize: 13 }} />
                  <Area type="monotone" dataKey="customer" name="Customers" stackId="1" stroke="#9A93B8" fill="#E7E3F2" />
                  <Area type="monotone" dataKey="ai" name="AI" stackId="1" stroke="#5B3FD1" fill="#CFC4F4" />
                  <Area type="monotone" dataKey="staff" name="Your team" stackId="1" stroke="#E9A82F" fill="#FBE2AE" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold">Needs a person</h2>
          {needs.loading ? <Skeleton className="mt-3 h-16 w-full" /> : needs.data && needs.data.conversations.length === 0 ? (
            <p className="py-4 text-muted">Nothing waiting. The AI is handling it.</p>
          ) : (
            needs.data?.conversations.map((c) => (
              <Link key={c.id} to={`/inbox/${c.id}`} className="flex items-center gap-3 border-b border-line py-3 hover:text-violet">
                <Avatar text={initials(displayName(c.customer))} tone="amber" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{displayName(c.customer)}</span>
                  <span className="block truncate text-sm text-muted">{c.messages?.[0]?.body}</span>
                </span>
                <span className="text-sm text-muted">{timeAgo(c.lastMessageAt)}</span>
              </Link>
            ))
          )}
        </section>
      </div>
      {!!o?.upcoming.length && (
        <section className="mt-10">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-bold">Next appointments</h2><Link to="/bookings" className="text-sm font-semibold text-violet hover:underline">See all</Link></div>
          {o.upcoming.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-line py-3">
              <span className="w-36 flex-none font-semibold">{whenLocal(a.startsAt, me?.business.timezone ?? "UTC")}</span>
              <span className="min-w-0 flex-1 truncate">{displayName(a.customer)}{a.service && <span className="text-muted"> · {a.service.name}</span>}</span>
            </div>
          ))}
        </section>
      )}
      {o && o.customers === 0 && !o.setup.whatsappConnected && (
        <EmptyState title="No conversations yet">Connect your WhatsApp number and message it from your phone. The conversation will appear here.</EmptyState>
      )}
    </>
  );
}
