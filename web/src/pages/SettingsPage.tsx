import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Trash2 } from "lucide-react";
import { API_URL } from "../config";
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Pill, Select, Skeleton, useToast } from "../components/ui";
import { api, downloadFile, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { WhatsAppTab } from "../components/WhatsAppConnect";
import { cn } from "../lib/cn";
import type { AuditEntry, Role, TeamMember, Usage, WhatsappAccount } from "../lib/types";

const TABS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "team", label: "Team" },
  { key: "usage", label: "Usage" },
  { key: "activity", label: "Activity" },
  { key: "account", label: "Your account" },
  { key: "data", label: "Data" },
] as const;

export default function SettingsPage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab"))?.key ?? "whatsapp";
  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.filter((t) => t.key !== "activity" || canManage).map((t) => (
          <button key={t.key} onClick={() => setParams(t.key === "whatsapp" ? {} : { tab: t.key })} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 font-semibold", tab === t.key ? "border-violet text-violet" : "border-transparent text-muted hover:text-ink")}>{t.label}</button>
        ))}
      </div>
      {tab === "whatsapp" && <WhatsAppTab canEdit={canManage} />}
      {tab === "team" && <TeamTab canManage={canManage} />}
      {tab === "usage" && <UsageTab />}
      {tab === "activity" && canManage && <ActivityTab />}
      {tab === "account" && <AccountTab />}
      {tab === "data" && <DataTab />}
    </>
  );
}

/* ---------------- Team ---------------- */
const ROLE_HELP: Record<Role, string> = {
  OWNER: "Full access",
  ADMIN: "Manages settings, knowledge and team",
  STAFF: "Replies to chats, manages leads, customers and bookings",
  VIEWER: "Can look but not change anything",
};

function TeamTab({ canManage }: { canManage: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const t = useApi<{ members: TeamMember[]; currentUserId: string }>("/team");
  const [busy, setBusy] = useState(false);
  const isOwner = me?.role === "OWNER";

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    try { await api("/team", { method: "POST", body: f }); form.reset(); toast("Team member added. Share their password with them."); await t.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }
  async function setRole(id: string, role: string) {
    try { await api(`/team/${id}`, { method: "PATCH", body: { role } }); await t.reload(); }
    catch (err) { toast(errorMessage(err), "error"); await t.reload(); }
  }
  async function remove(m: TeamMember) {
    if (!confirm(`Remove ${m.user.name}? They will lose access immediately.`)) return;
    try { await api(`/team/${m.id}`, { method: "DELETE" }); await t.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h2 className="mb-3 text-xl font-bold">People with access</h2>
        {t.loading && <Skeleton className="h-24" />}
        {t.error && <ErrorNote>{t.error}</ErrorNote>}
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {t.data?.members.map((m) => {
            const self = m.user.id === t.data!.currentUserId;
            const locked = !canManage || self || m.role === "OWNER" || (m.role === "ADMIN" && !isOwner);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{m.user.name}{self && <span className="font-normal text-muted"> (you)</span>}</div><div className="truncate text-sm text-muted">{m.user.email}</div></div>
                {locked ? <Pill tone="neutral">{m.role.toLowerCase()}</Pill> : (
                  <Select value={m.role} onChange={(e) => setRole(m.id, e.target.value)} className="w-auto py-1.5" aria-label={`Role for ${m.user.name}`}>
                    {isOwner && <option value="ADMIN">Admin</option>}
                    <option value="STAFF">Staff</option><option value="VIEWER">Viewer</option>
                  </Select>
                )}
                {!locked && <Button size="sm" variant="danger" onClick={() => remove(m)} aria-label={`Remove ${m.user.name}`}><Trash2 size={15} /></Button>}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section>
          <h2 className="mb-1 text-xl font-bold">Add a team member</h2>
          <p className="mb-4 text-muted">Set a first password and share it with them. They can change it under Your account. Each person can belong to one business for now.</p>
          <form onSubmit={add} className="space-y-4">
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="First password" hint="At least 8 characters"><Input name="password" type="text" required minLength={8} autoComplete="off" /></Field>
            <Field label="Role">
              <Select name="role" defaultValue="STAFF">
                {isOwner && <option value="ADMIN">Admin: {ROLE_HELP.ADMIN}</option>}
                <option value="STAFF">Staff: {ROLE_HELP.STAFF}</option>
                <option value="VIEWER">Viewer: {ROLE_HELP.VIEWER}</option>
              </Select>
            </Field>
            <Button type="submit" loading={busy}>Add member</Button>
          </form>
        </section>
      )}
    </div>
  );
}

/* ---------------- Usage ---------------- */
function UsageTab() {
  const [days, setDays] = useState(30);
  const u = useApi<Usage>(`/usage?days=${days}`);
  const nf = (n: number) => n.toLocaleString();
  const tiles = u.data && [
    { k: "WhatsApp messages received", v: u.data.whatsappInbound },
    { k: "WhatsApp messages sent", v: u.data.whatsappOutbound },
    { k: "AI input tokens", v: u.data.aiInputTokens },
    { k: "AI output tokens", v: u.data.aiOutputTokens },
  ];
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-muted">What your account has used. This is what WhatsApp and AI costs are based on.</p>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", days === d ? "border-violet bg-violet text-white" : "border-line bg-white hover:bg-violet-s")}>{d} days</button>
          ))}
        </div>
      </div>
      {u.error && <ErrorNote>{u.error}</ErrorNote>}
      {u.loading && <Skeleton className="h-28" />}
      {tiles && (
        <div className="grid grid-cols-2 border-y border-line">
          {tiles.map((t, i) => (
            <div key={t.k} className={cn("py-5 pr-4", i % 2 === 1 && "border-l border-line pl-5", i >= 2 && "border-t border-line")}>
              <div className="font-display text-4xl font-extrabold tracking-tight">{nf(t.v)}</div>
              <div className="text-sm text-muted">{t.k}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Account ---------------- */
function AccountTab() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function setNotify(on: boolean) {
    try { await api("/auth/preferences", { method: "PATCH", body: { notifyNeedsHuman: on } }); await refresh(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }

  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.newPassword !== f.confirm) { toast("The new passwords don't match", "error"); return; }
    setBusy(true);
    try {
      // Changing the password signs out other devices; the server refreshes this device's cookie in the same reply.
      await api("/auth/change-password", { method: "POST", body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      form.reset(); toast("Password changed. Other devices were signed out.");
    }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-md space-y-6">
      <div><div className="font-semibold">{me?.user.name}</div><div className="text-muted">{me?.user.email} · {me?.role.toLowerCase()} at {me?.business.name}</div></div>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
        <input type="checkbox" className="mt-1 size-4 accent-violet" checked={me?.notifyNeedsHuman ?? true} onChange={(e) => setNotify(e.target.checked)} />
        <span><span className="block font-semibold">Email me when a customer needs a person</span><span className="text-sm text-muted">We email you when the AI hands a conversation to your team. If it's assigned to you, only you get the email; otherwise owners and admins do.</span></span>
      </label>
      <form onSubmit={change} className="space-y-4">
        <h2 className="text-xl font-bold">Change password</h2>
        <Field label="Current password"><Input name="currentPassword" type="password" required autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters"><Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <Field label="Repeat new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <Button type="submit" loading={busy}>Change password</Button>
      </form>
    </div>
  );
}

/* ---------------- Data: export and delete ---------------- */
function DataTab() {
  const { me, logout } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = me?.role === "OWNER";

  async function exportAll() {
    setExporting(true);
    try { await downloadFile("/account/export", `business-export-${new Date().toISOString().slice(0, 10)}.json`); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setExporting(false); }
  }

  async function deleteAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!confirm("This permanently deletes your business, every conversation, customer and setting, and cannot be undone. Continue?")) return;
    setDeleting(true);
    try { await api("/account", { method: "DELETE", body: { password: f.password, confirmName: f.confirmName } }); await logout(); }
    catch (err) { toast(errorMessage(err), "error"); setDeleting(false); }
  }

  if (!isOwner) return <p className="max-w-md text-muted">Only the owner can export or delete the business's data. To export or delete a single customer, open the customer under Customers.</p>;

  return (
    <div className="max-w-xl space-y-10">
      <section>
        <h2 className="text-xl font-bold">Export your data</h2>
        <p className="mb-4 mt-1 text-muted">Download a copy of everything: your business details, team, services, knowledge, customers, conversations, leads and appointments, as one file. Passwords and WhatsApp access tokens are never included.</p>
        <Button variant="ghost" loading={exporting} onClick={exportAll}>Download my data</Button>
      </section>

      <section className="rounded-2xl border border-red/30 bg-red-s/40 p-5">
        <h2 className="text-xl font-bold text-red">Delete this business</h2>
        <p className="mb-4 mt-1">This permanently deletes the business and everything in it, removes team members who belong only to this business, and stops WhatsApp messages from reaching us. It cannot be undone. Consider downloading your data first.</p>
        <form onSubmit={deleteAccount} className="space-y-4">
          <Field label={`Type the business name (${me?.business.name}) to confirm`}><Input name="confirmName" required autoComplete="off" /></Field>
          <Field label="Your password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
          <Button type="submit" variant="danger" loading={deleting} className="border border-red">Delete everything permanently</Button>
        </form>
      </section>
    </div>
  );
}

/* ---------------- Activity log ---------------- */
function describeAudit(e: AuditEntry): string {
  const m = (e.metadata ?? {}) as Record<string, unknown>;
  const role = String(m.role ?? "").toLowerCase();
  switch (e.action) {
    case "whatsapp.embedded_signup": case "whatsapp.connected": return "Connected a WhatsApp number";
    case "whatsapp.disconnected": return "Disconnected a WhatsApp number";
    case "team.added": return `Added ${m.email ? String(m.email) : "a team member"}${role ? ` as ${role}` : ""}`;
    case "team.role_changed": return `Changed a team member's role${role ? ` to ${role}` : ""}`;
    case "team.removed": return "Removed a team member";
    case "agent.updated": return m.active === true ? "Updated the AI settings (AI is on)" : m.active === false ? "Updated the AI settings (AI is off)" : "Updated the AI settings";
    case "customer.deleted": return "Deleted a customer";
    case "ai.handoff": return "The AI handed a conversation to your team";
    case "ai.failed": return "The AI couldn't reply to a message";
    case "ai.unanswered_flagged": return "A message waited too long and was handed to your team";
    case "ai.daily_limit_reached": return "The daily AI limit was reached";
    case "ai.conversation_rate_limited": return "A conversation reached the AI reply limit";
    case "admin.ai_disabled": return "Support switched the AI off";
    case "admin.ai_enabled": return "Support switched the AI on";
    case "admin.limit_changed": return "Support changed the daily AI limit";
    default: return e.action;
  }
}

function ActivityTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(before?: string) {
    if (before) setMore(true); else setLoading(true);
    try {
      const r = await api<{ entries: AuditEntry[]; nextBefore: string | null }>(`/audit${before ? `?before=${encodeURIComponent(before)}` : ""}`);
      setEntries((prev) => (before ? [...prev, ...r.entries] : r.entries));
      setNext(r.nextBefore); setError(null);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); setMore(false); }
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-muted">Important things that happened in your account: who changed what, and when the AI handed over a conversation.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && <Skeleton className="h-40" />}
      {!loading && entries.length === 0 && !error && <EmptyState title="Nothing yet">Activity shows up here as your team uses the account.</EmptyState>}
      {entries.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4">
              <div className="min-w-0 flex-1"><div className="font-medium">{describeAudit(e)}</div>{e.actor && <div className="text-sm text-muted">By {e.actor}</div>}</div>
              <time className="text-sm text-muted" dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
            </li>
          ))}
        </ul>
      )}
      {next && <div className="mt-4"><Button variant="ghost" loading={more} onClick={() => load(next)}>Load older activity</Button></div>}
    </div>
  );
}
