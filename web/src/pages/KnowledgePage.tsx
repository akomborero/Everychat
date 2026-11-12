import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Pill, Skeleton, Textarea, useToast } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi, type ApiState } from "../lib/hooks";
import { formatPrice } from "../lib/format";
import { cn } from "../lib/cn";
import type { BusinessProfile, GapGroup, KnowledgeDoc, Service } from "../lib/types";

const TABS = [
  { key: "profile", label: "Business info" },
  { key: "services", label: "Services & prices" },
  { key: "faqs", label: "FAQs & notes" },
  { key: "documents", label: "Documents" },
  { key: "gaps", label: "Questions to answer" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function KnowledgePage() {
  const { me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "profile") as TabKey;
  const docs = useApi<{ documents: KnowledgeDoc[] }>("/knowledge/documents", { poll: 4000, live: true });
  const gaps = useApi<{ gaps: GapGroup[] }>("/knowledge/gaps", { poll: 30000, live: true });
  const gapCount = gaps.data?.gaps.length ?? 0;
  const canEdit = me?.role === "OWNER" || me?.role === "ADMIN";

  return (
    <>
      <PageHeader title="Knowledge" subtitle="Everything the AI is allowed to say. If it isn't here, the AI hands the chat to your team instead of guessing." />
      {!canEdit && <div className="mb-4"><ErrorNote>You have view-only access. Ask an owner or admin to make changes.</ErrorNote></div>}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setParams({ tab: t.key })} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 font-semibold", tab === t.key ? "border-violet text-violet" : "border-transparent text-muted hover:text-ink")}>
            {t.label}{t.key === "gaps" && gapCount > 0 && <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-xs font-bold text-ink">{gapCount}</span>}
          </button>
        ))}
      </div>
      {tab === "profile" && <ProfileTab canEdit={canEdit} />}
      {tab === "services" && <ServicesTab canEdit={canEdit} />}
      {tab === "faqs" && <FaqsTab canEdit={canEdit} docs={docs} />}
      {tab === "documents" && <DocumentsTab canEdit={canEdit} docs={docs} />}
      {tab === "gaps" && <GapsTab canEdit={canEdit} gaps={gaps} docs={docs} />}
    </>
  );
}

/* ---------------- Business info ---------------- */
function ProfileTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const p = useApi<{ business: BusinessProfile }>("/business/profile");
  const [busy, setBusy] = useState(false);
  if (p.loading) return <Skeleton className="h-64 max-w-xl" />;
  if (!p.data) return <ErrorNote>{p.error}</ErrorNote>;
  const b = p.data.business;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      await api("/business/profile", { method: "PUT", body: { name: f.name, industry: f.industry || null, description: f.description || null, address: f.address || null, openingHours: f.openingHours || null, timezone: f.timezone } });
      toast("Saved"); await p.reload();
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-4">
      <Field label="Business name"><Input name="name" defaultValue={b.name} required disabled={!canEdit} /></Field>
      <Field label="Type of business"><Input name="industry" defaultValue={b.industry ?? ""} disabled={!canEdit} /></Field>
      <Field label="About your business" hint="A few sentences the AI can use to introduce you."><Textarea name="description" defaultValue={b.description ?? ""} disabled={!canEdit} /></Field>
      <Field label="Address / location"><Input name="address" defaultValue={b.address ?? ""} disabled={!canEdit} /></Field>
      <Field label="Opening hours" hint="For example: Monday to Saturday, 08:00 to 16:00"><Input name="openingHours" defaultValue={b.openingHours ?? ""} disabled={!canEdit} /></Field>
      <Field label="Time zone" hint="Booking times use this. It was detected from your browser when you signed up."><Input name="timezone" defaultValue={b.timezone} required disabled={!canEdit} /></Field>
      {canEdit && <Button type="submit" loading={busy}>Save changes</Button>}
    </form>
  );
}

/* ---------------- Services ---------------- */
function ServicesTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const s = useApi<{ services: Service[] }>("/business/services");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setAdding(true);
    try {
      await api("/business/services", { method: "POST", body: { name: f.name, price: Number(f.price), currency: (f.currency || "USD").toUpperCase(), description: f.description || null } });
      form.reset(); await s.reload();
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setAdding(false); }
  }
  async function patch(id: string, body: object) {
    try { await api(`/business/services/${id}`, { method: "PATCH", body }); setEditing(null); await s.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this service? The AI will stop quoting it.")) return;
    try { await api(`/business/services/${id}`, { method: "DELETE" }); await s.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }

  return (
    <div className="space-y-8">
      <p className="max-w-xl text-muted">These are the only prices the AI will ever quote. Change one here and the AI uses it on the next message.</p>
      {canEdit && (
        <form onSubmit={add} className="grid max-w-3xl gap-3 sm:grid-cols-[1.4fr_1fr_90px_auto] sm:items-end">
          <Field label="Service or product"><Input name="name" required placeholder="Standard package" /></Field>
          <Field label="Price"><Input name="price" type="number" step="0.01" min="0" required /></Field>
          <Field label="Currency"><Input name="currency" defaultValue="USD" maxLength={3} /></Field>
          <Button type="submit" loading={adding}>Add</Button>
          <div className="sm:col-span-4"><Field label="Details (optional)"><Input name="description" placeholder="What's included, how long it takes" /></Field></div>
        </form>
      )}
      {s.loading && <Skeleton className="h-32 max-w-3xl" />}
      {s.data?.services.length === 0 && <EmptyState title="No services yet">Add what you sell and what it costs.</EmptyState>}
      {!!s.data?.services.length && (
        <ul className="max-w-3xl divide-y divide-line rounded-2xl border border-line bg-white">
          {s.data.services.map((v) => (
            <li key={v.id} className="p-4">
              {editing === v.id ? (
                <form className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:items-center" onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
                  void patch(v.id, { name: f.name, price: Number(f.price), description: f.description || null });
                }}>
                  <Input name="name" defaultValue={v.name} required aria-label="Name" />
                  <Input name="price" type="number" step="0.01" min="0" defaultValue={v.price} required aria-label="Price" />
                  <Button size="sm" type="submit">Save</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
                  <div className="sm:col-span-4"><Input name="description" defaultValue={v.description ?? ""} placeholder="Details" aria-label="Details" /></div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">{v.name}</span>{!v.active && <Pill tone="neutral">Hidden from AI</Pill>}</div>
                    {v.description && <div className="text-sm text-muted">{v.description}</div>}
                  </div>
                  <div className="font-display text-xl font-bold">{formatPrice(v.price, v.currency)}</div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v.id)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => patch(v.id, { active: !v.active })}>{v.active ? "Hide" : "Show"}</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(v.id)} aria-label={`Delete ${v.name}`}><Trash2 size={15} /></Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- FAQs & notes ---------------- */
function DocList({ docs, kinds, canEdit, empty }: { docs: ApiState<{ documents: KnowledgeDoc[] }>; kinds: KnowledgeDoc["kind"][]; canEdit: boolean; empty: string }) {
  const toast = useToast();
  const rows = docs.data?.documents.filter((d) => kinds.includes(d.kind)) ?? [];
  async function remove(id: string) {
    if (!confirm("Remove this from the AI's knowledge?")) return;
    try { await api(`/knowledge/documents/${id}`, { method: "DELETE" }); await docs.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
  }
  if (docs.loading) return <Skeleton className="h-24 max-w-3xl" />;
  if (!rows.length) return <p className="py-2 text-muted">{empty}</p>;
  return (
    <ul className="max-w-3xl divide-y divide-line rounded-2xl border border-line bg-white">
      {rows.map((d) => (
        <li key={d.id} className="flex items-center gap-3 p-4">
          <FileText size={18} className="flex-none text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{d.name}</div>
            {d.status === "failed" && <div className="text-sm text-red">{d.error ?? "Could not be processed"}</div>}
          </div>
          <Pill tone={d.status === "ready" ? "green" : d.status === "failed" ? "red" : "amber"}>{d.status === "ready" ? "Ready" : d.status === "failed" ? "Failed" : "Processing"}</Pill>
          {canEdit && <Button size="sm" variant="danger" onClick={() => remove(d.id)} aria-label={`Remove ${d.name}`}><Trash2 size={15} /></Button>}
        </li>
      ))}
    </ul>
  );
}

function FaqsTab({ canEdit, docs }: { canEdit: boolean; docs: ApiState<{ documents: KnowledgeDoc[] }> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"faq" | "note" | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>, kind: "faq" | "note") {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(kind);
    try {
      await api(kind === "faq" ? "/knowledge/faqs" : "/knowledge/notes", { method: "POST", body: kind === "faq" ? { question: f.question, answer: f.answer } : { title: f.title, content: f.content } });
      form.reset(); await docs.reload(); toast("Added");
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Frequently asked questions</h2>
        {canEdit && (
          <form onSubmit={(e) => submit(e, "faq")} className="max-w-3xl space-y-3">
            <Field label="Question"><Input name="question" required placeholder="Are you open on public holidays?" /></Field>
            <Field label="Answer"><Textarea name="answer" required className="min-h-20" /></Field>
            <Button type="submit" loading={busy === "faq"}>Add FAQ</Button>
          </form>
        )}
        <DocList docs={docs} kinds={["FAQ"]} canEdit={canEdit} empty="No FAQs yet." />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Policies and notes</h2>
        <p className="max-w-xl text-muted">Refund rules, what to bring, delivery terms, anything longer than a quick answer.</p>
        {canEdit && (
          <form onSubmit={(e) => submit(e, "note")} className="max-w-3xl space-y-3">
            <Field label="Title"><Input name="title" required placeholder="Cancellation policy" /></Field>
            <Field label="Details"><Textarea name="content" required /></Field>
            <Button type="submit" loading={busy === "note"}>Add note</Button>
          </form>
        )}
        <DocList docs={docs} kinds={["NOTE"]} canEdit={canEdit} empty="No notes yet." />
      </section>
    </div>
  );
}

/* ---------------- Documents ---------------- */
function DocumentsTab({ canEdit, docs }: { canEdit: boolean; docs: ApiState<{ documents: KnowledgeDoc[] }> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try { await api("/knowledge/documents/upload", { method: "POST", form }); }
      catch (err) { toast(`${file.name}: ${errorMessage(err)}`, "error"); }
    }
    setBusy(false);
    await docs.reload();
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
          className={cn("flex max-w-3xl flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-violet bg-violet-s" : "border-line bg-white")}
        >
          <Upload className="text-violet" />
          <p className="font-semibold">Drop brochures, price lists or policies here</p>
          <p className="text-sm text-muted">PDF, Word (.docx), TXT or MD, up to 10 MB each. Scanned images of text can't be read yet.</p>
          <Button variant="ghost" loading={busy} onClick={() => input.current?.click()}>Choose files</Button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      <DocList docs={docs} kinds={["UPLOAD"]} canEdit={canEdit} empty="No documents uploaded yet." />
    </div>
  );
}

/* ---------------- Questions the AI couldn't answer ---------------- */
function GapsTab({ canEdit, gaps, docs }: { canEdit: boolean; gaps: ApiState<{ gaps: GapGroup[] }>; docs: ApiState<{ documents: KnowledgeDoc[] }> }) {
  const toast = useToast();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function answer(g: GapGroup, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(g.key);
    try {
      await api("/knowledge/faqs", { method: "POST", body: { question: f.question, answer: f.answer } });
      await api("/knowledge/gaps", { method: "PATCH", body: { ids: g.ids, status: "resolved" } });
      toast("Added to your FAQs. The AI will use it from now on.");
      setOpenKey(null); await gaps.reload(); await docs.reload();
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(null); }
  }
  async function dismiss(g: GapGroup) {
    setBusy(g.key);
    try { await api("/knowledge/gaps", { method: "PATCH", body: { ids: g.ids, status: "dismissed" } }); await gaps.reload(); }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(null); }
  }

  if (gaps.loading) return <Skeleton className="h-32 max-w-3xl" />;
  if (!gaps.data) return <ErrorNote>{gaps.error}</ErrorNote>;
  if (gaps.data.gaps.length === 0) return <EmptyState title="No unanswered questions">When a customer asks something that isn't in your information, the AI passes the chat to your team and the question shows up here, so you can add the answer once and never be asked again.</EmptyState>;

  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-muted">These are questions the AI couldn't answer from your information. Add an answer and it becomes an FAQ the AI uses straight away. The most-asked questions are first.</p>
      {gaps.data.gaps.map((g) => (
        <div key={g.key} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1"><div className="font-semibold">{g.question}</div></div>
            <Pill tone={g.count > 1 ? "amber" : "neutral"}>{g.count > 1 ? `Asked ${g.count} times` : "Asked once"}</Pill>
          </div>
          {canEdit && openKey !== g.key && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setOpenKey(g.key)}>Add an answer</Button>
              <Button size="sm" variant="ghost" loading={busy === g.key} onClick={() => dismiss(g)}>Not needed</Button>
            </div>
          )}
          {openKey === g.key && (
            <form onSubmit={(e) => answer(g, e)} className="mt-3 space-y-3">
              <Field label="Question as a customer might ask it"><Input name="question" defaultValue={g.question} required minLength={3} /></Field>
              <Field label="Your answer"><Textarea name="answer" required autoFocus className="min-h-20" /></Field>
              <div className="flex gap-2"><Button type="submit" loading={busy === g.key}>Save as FAQ</Button><Button type="button" variant="ghost" onClick={() => setOpenKey(null)}>Cancel</Button></div>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
