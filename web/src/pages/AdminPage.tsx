import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button, ErrorNote, PageHeader, Pill, Skeleton, useToast } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { cn } from "../lib/cn";
import type { AdminBusiness, AdminOverview } from "../lib/types";

export default function AdminPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const overview = useApi<AdminOverview>(me?.platformAdmin ? "/admin/overview" : null);
  const list = useApi<{ businesses: AdminBusiness[] }>(me?.platformAdmin ? `/admin/businesses${search ? `?q=${encodeURIComponent(search)}` : ""}` : null);

  if (!me?.platformAdmin) return <Navigate to="/" replace />;

  async function setAi(b: AdminBusiness, active: boolean) {
    if (!active && !confirm(`Switch the AI off for ${b.name}? Their customers will stop getting automatic replies.`)) return;
    try { await api(`/admin/businesses/${b.id}/ai`, { method: "POST", body: { active } }); await list.reload(); toast(active ? "AI switched on" : "AI switched off"); }
    catch (e) { toast(errorMessage(e), "error"); }
  }

  async function setLimit(b: AdminBusiness) {
    const input = prompt(`Daily AI token limit for ${b.name}.\nEnter a number, 0 for no limit, or leave empty to use the server default.`, b.dailyAiTokenLimit === null ? "" : String(b.dailyAiTokenLimit));
    if (input === null) return;
    const value = input.trim() === "" ? null : Number(input);
    if (value !== null && (!Number.isInteger(value) || value < 0)) { toast("Enter a whole number, 0 or leave it empty", "error"); return; }
    try { await api(`/admin/businesses/${b.id}/limits`, { method: "PATCH", body: { dailyAiTokenLimit: value } }); await list.reload(); toast("Limit updated"); }
    catch (e) { toast(errorMessage(e), "error"); }
  }

  const o = overview.data;
  const stats = [
    { k: "Businesses", v: o?.businesses }, { k: "Users", v: o?.users }, { k: "WhatsApp numbers live", v: o?.whatsappNumbers },
    { k: "AI switched on", v: o?.aiLive }, { k: "Messages, 30 days", v: o?.messages30d }, { k: "AI tokens, 30 days", v: o?.aiTokens30d }, { k: "AI failures, 24h", v: o?.aiFailures24h },
  ];
  const peak = Math.max(1, ...(o?.signupsByDay.map((d) => d.count) ?? [1]));

  return (
    <>
      <PageHeader title="Platform admin" subtitle="All businesses on the platform. Counts and settings only. Message contents are never shown here." />
      {overview.error && <ErrorNote>{overview.error}</ErrorNote>}

      <div className="mb-8 grid grid-cols-2 border-y border-line sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <div key={s.k} className={cn("py-4 pr-3", i > 0 && "sm:pl-4", i % 2 === 1 && "border-l border-line pl-4 sm:border-l-0")}>
            {s.v === undefined ? <Skeleton className="h-8 w-14" /> : <div className="font-display text-3xl font-extrabold tracking-tight">{s.v.toLocaleString()}</div>}
            <div className="text-xs text-muted">{s.k}</div>
          </div>
        ))}
      </div>

      {o && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-bold">New businesses, last 14 days</h2>
          <div className="flex h-20 items-end gap-1.5" role="img" aria-label="Sign-ups per day">
            {o.signupsByDay.map((d) => (
              <div key={d.date} title={`${d.date}: ${d.count}`} className="flex-1 rounded-t bg-violet/70" style={{ height: `${Math.max(4, (d.count / peak) * 100)}%` }} />
            ))}
          </div>
        </section>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search businesses" aria-label="Search businesses"
        className="mb-4 w-full max-w-sm rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
      {list.error && <ErrorNote>{list.error}</ErrorNote>}
      {list.loading && <Skeleton className="h-40" />}
      {!!list.data?.businesses.length && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr>{["Business", "Owner", "Team", "Customers", "Msgs 30d", "AI tokens 30d", "Daily AI limit", "WhatsApp", "AI", ""].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.data.businesses.map((b) => (
                <tr key={b.id} className="border-b border-line align-middle last:border-0">
                  <td className="p-3"><div className="font-semibold">{b.name}</div><div className="text-xs text-muted">{new Date(b.createdAt).toLocaleDateString()}</div></td>
                  <td className="p-3 text-sm">{b.owner?.email ?? "–"}</td>
                  <td className="p-3">{b.members}</td>
                  <td className="p-3">{b.customers}</td>
                  <td className="p-3">{b.messages30d.toLocaleString()}</td>
                  <td className="p-3">{b.aiTokens30d.toLocaleString()}</td>
                  <td className="p-3 text-sm">
                    {b.dailyAiTokenLimit === null ? "Default" : b.dailyAiTokenLimit === 0 ? "No limit" : b.dailyAiTokenLimit.toLocaleString()}
                    <button onClick={() => setLimit(b)} className="ml-2 font-semibold text-violet hover:underline">Change</button>
                  </td>
                  <td className="p-3"><Pill tone={b.whatsappConnected ? "green" : "neutral"}>{b.whatsappConnected ? "Connected" : "Not connected"}</Pill></td>
                  <td className="p-3"><Pill tone={b.aiActive ? "green" : "neutral"}>{b.aiActive ? "On" : "Off"}</Pill></td>
                  <td className="p-3"><Button size="sm" variant={b.aiActive ? "danger" : "ghost"} onClick={() => setAi(b, !b.aiActive)}>{b.aiActive ? "Switch AI off" : "Switch AI on"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
