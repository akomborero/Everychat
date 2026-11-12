import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorNote, Field, Input, Pill, Skeleton, Textarea, useToast, type Tone } from "../components/ui";
import { api, downloadFile, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { displayName, initials, timeAgo, whenLocal } from "../lib/format";
import { cn } from "../lib/cn";
import type { CustomerDetail, CustomerListItem, LeadStatus } from "../lib/types";

const LEAD_TONE: Record<LeadStatus, Tone> = { NEW: "violet", CONTACTED: "neutral", QUALIFIED: "violet", INTERESTED: "amber", WON: "green", LOST: "red" };
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

export default function CustomersPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useApi<{ customers: CustomerListItem[] }>(`/customers${search ? `?q=${encodeURIComponent(search)}` : ""}`);

  return (
    <>
      <h1 className="mb-4 text-3xl font-extrabold">Customers</h1>
      <div className="grid h-[calc(100dvh-12rem)] min-h-[440px] overflow-hidden rounded-2xl border border-line bg-white lg:h-[calc(100dvh-10rem)] lg:grid-cols-[340px_1fr]">
        <div className={cn("flex min-h-0 flex-col border-r border-line", id && "hidden lg:flex")}>
          <div className="border-b border-line p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email" aria-label="Search customers"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.loading && <div className="space-y-3 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
            {list.error && <div className="p-4"><ErrorNote>{list.error}</ErrorNote></div>}
            {list.data?.customers.length === 0 && <EmptyState title={search ? "No matches" : "No customers yet"}>{search ? undefined : "Everyone who messages your WhatsApp number is added here automatically."}</EmptyState>}
            {list.data?.customers.map((c) => (
              <button key={c.id} onClick={() => nav(`/customers/${c.id}`)} className={cn("flex w-full items-center gap-3 border-b border-line p-4 text-left hover:bg-paper", c.id === id && "bg-violet-s hover:bg-violet-s")}>
                <Avatar text={initials(displayName(c))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{displayName(c)}</span>
                  <span className="block truncate text-sm text-muted">{c.name ? c.phone : `${c._count.conversations} conversation${c._count.conversations === 1 ? "" : "s"}`}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={cn("min-h-0 min-w-0 overflow-y-auto", !id && "hidden lg:grid lg:place-items-center")}>
          {id ? <Detail key={id} id={id} onBack={() => nav("/customers")} onSaved={() => void list.reload()} /> : <EmptyState title="Choose a customer">See their conversations, leads and bookings, and keep notes.</EmptyState>}
        </div>
      </div>
    </>
  );
}

function Detail({ id, onBack, onSaved }: { id: string; onBack: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const toast = useToast();
  const d = useApi<{ customer: CustomerDetail }>(`/customers/${id}`);
  const [busy, setBusy] = useState(false);
  const canEdit = me?.role !== "VIEWER";
  const canDelete = me?.role === "OWNER" || me?.role === "ADMIN";
  const tz = me?.business.timezone ?? "UTC";

  if (d.loading) return <div className="space-y-3 p-6"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>;
  if (!d.data) return <div className="p-6"><ErrorNote>{d.error ?? "Customer not found"}</ErrorNote></div>;
  const c = d.data.customer;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      await api(`/customers/${id}`, {
        method: "PATCH",
        body: { name: f.name || null, email: f.email || null, notes: f.notes || null, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) },
      });
      toast("Saved"); await d.reload(); onSaved();
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }

  async function exportCustomer() {
    try { await downloadFile(`/customers/${id}/export`, `customer-${id}.json`); }
    catch (err) { toast(errorMessage(err), "error"); }
  }
  async function deleteCustomer() {
    if (!confirm("Permanently delete this customer and all their conversations, notes, leads and appointments? This cannot be undone.")) return;
    try { await api(`/customers/${id}`, { method: "DELETE" }); toast("Customer deleted"); onSaved(); onBack(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }

  return (
    <div className="space-y-8 p-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-line p-2 lg:hidden" aria-label="Back to customers"><ArrowLeft size={16} /></button>
        <Avatar text={initials(displayName(c))} className="size-12" />
        <div className="min-w-0"><h2 className="truncate text-2xl font-bold">{displayName(c)}</h2><div className="text-sm text-muted">{c.phone} · customer since {new Date(c.createdAt).toLocaleDateString()}</div></div>
      </div>

      <form onSubmit={save} className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Name"><Input name="name" defaultValue={c.name ?? ""} disabled={!canEdit} /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={c.email ?? ""} disabled={!canEdit} /></Field>
        <div className="sm:col-span-2"><Field label="Tags" hint="Separate with commas, for example: vip, wholesale"><Input name="tags" defaultValue={c.tags.join(", ")} disabled={!canEdit} /></Field></div>
        <div className="sm:col-span-2"><Field label="Notes" hint="Only your team sees these."><Textarea name="notes" defaultValue={c.notes ?? ""} disabled={!canEdit} /></Field></div>
        {canEdit && <div><Button type="submit" loading={busy}>Save changes</Button></div>}
      </form>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={exportCustomer}>Export this customer's data</Button>
          {canDelete && <Button size="sm" variant="danger" onClick={deleteCustomer}>Delete customer</Button>}
        </div>
      )}

      <section>
        <h3 className="mb-2 text-lg font-bold">Conversations</h3>
        {c.conversations.length === 0 ? <p className="text-muted">None yet.</p> : c.conversations.map((v) => (
          <Link key={v.id} to={`/inbox/${v.id}`} className="flex items-center justify-between border-b border-line py-3 hover:text-violet">
            <span className="font-medium">Open conversation</span>
            <span className="flex items-center gap-3"><Pill tone={v.status === "NEEDS_HUMAN" ? "amber" : "violet"}>{v.status === "NEEDS_HUMAN" ? "Needs a person" : cap(v.status)}</Pill><span className="text-sm text-muted">{timeAgo(v.lastMessageAt)}</span></span>
          </Link>
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-lg font-bold">Leads</h3>
        {c.leads.length === 0 ? <p className="text-muted">None yet.</p> : c.leads.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
            <span className="min-w-0"><span className="font-medium">{l.interest ?? "Enquiry"}</span>{l.notes && <span className="block truncate text-sm text-muted">{l.notes}</span>}</span>
            <Pill tone={LEAD_TONE[l.status]}>{cap(l.status)}</Pill>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-lg font-bold">Appointments</h3>
        {c.appointments.length === 0 ? <p className="text-muted">None yet.</p> : c.appointments.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
            <span className="min-w-0"><span className="font-medium">{whenLocal(a.startsAt, tz)}</span><span className="block truncate text-sm text-muted">{a.service?.name ?? "Appointment"}</span></span>
            <Pill tone={a.status === "CONFIRMED" ? "violet" : a.status === "COMPLETED" ? "green" : a.status === "NO_SHOW" ? "red" : "neutral"}>{cap(a.status)}</Pill>
          </div>
        ))}
      </section>
    </div>
  );
}
