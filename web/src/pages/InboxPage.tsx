import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Bot, Check, CheckCheck, Hand, NotebookPen, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorNote, Pill, Select, Skeleton, Spinner, useToast } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { clock, displayName, initials, timeAgo } from "../lib/format";
import { cn } from "../lib/cn";
import type { Conversation, ConversationStatus, Message, Note, TeamMember } from "../lib/types";

const STATUS: Record<ConversationStatus, { label: string; tone: "violet" | "amber" | "neutral" }> = {
  OPEN: { label: "Open", tone: "violet" },
  NEEDS_HUMAN: { label: "Needs a person", tone: "amber" },
  CLOSED: { label: "Closed", tone: "neutral" },
};
const FILTERS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "needs", label: "Needs a person" },
  { key: "closed", label: "Closed" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default function InboxPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("open");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useApi<{ conversations: Conversation[] }>(`/conversations?filter=${filter}${search ? `&q=${encodeURIComponent(search)}` : ""}`, { poll: 6000, live: true });

  return (
    <div className="mb-2">
      <h1 className="mb-4 text-3xl font-extrabold">Inbox</h1>
      <div className="grid h-[calc(100dvh-12rem)] min-h-[440px] overflow-hidden rounded-2xl border border-line bg-white lg:h-[calc(100dvh-10rem)] lg:grid-cols-[340px_1fr]">
        <div className={cn("flex min-h-0 flex-col border-r border-line", id && "hidden lg:flex")}>
          <div className="border-b border-line p-3 pb-0">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or message" aria-label="Search conversations"
              className="w-full rounded-xl border border-line px-3.5 py-2 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto border-b border-line p-3">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={cn("whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium", filter === f.key ? "border-violet bg-violet text-white" : "border-line hover:bg-violet-s")}>{f.label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.loading && <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
            {list.error && <div className="p-4"><ErrorNote>{list.error}</ErrorNote></div>}
            {list.data?.conversations.length === 0 && (
              <EmptyState title={search ? "No matches" : filter === "open" ? "No conversations yet" : "Nothing here"}>{search ? "Try a different name, number or word." : filter === "open" ? "When a customer messages your WhatsApp number, the chat appears here." : "No conversations match this filter."}</EmptyState>
            )}
            {list.data?.conversations.map((c) => (
              <button key={c.id} onClick={() => nav(`/inbox/${c.id}`)} className={cn("flex w-full items-start gap-3 border-b border-line p-4 text-left hover:bg-paper", c.id === id && "bg-violet-s hover:bg-violet-s")}>
                <Avatar text={initials(displayName(c.customer))} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className="truncate font-semibold">{displayName(c.customer)}</span><span className="text-sm text-muted">{timeAgo(c.lastMessageAt)}</span></span>
                  <span className="block truncate text-sm text-muted">{c.messages?.[0]?.body}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
                    {c.assignedTo && <Pill tone="green">{c.assignedTo.name.split(" ")[0]}</Pill>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={cn("min-w-0", !id && "hidden lg:grid lg:place-items-center")}>
          {id ? <Thread key={id} id={id} onChanged={() => void list.reload()} onBack={() => nav("/inbox")} /> : <EmptyState title="Choose a conversation">Read the chat, take over from the AI, reply, assign it to a teammate or leave a note.</EmptyState>}
        </div>
      </div>
    </div>
  );
}

function Ticks({ m }: { m: Message }) {
  if (m.sender === "CUSTOMER" || m.sender === "SYSTEM" || !m.deliveryStatus) return null;
  if (m.deliveryStatus === "failed") return <span className="inline-flex items-center gap-1 text-red"><AlertCircle size={12} /> Not delivered</span>;
  const Icon = m.deliveryStatus === "sent" ? Check : CheckCheck;
  return <Icon size={14} className={m.deliveryStatus === "read" ? "text-violet" : "text-muted"} aria-label={m.deliveryStatus} />;
}

function Thread({ id, onChanged, onBack }: { id: string; onChanged: () => void; onBack: () => void }) {
  const { me } = useAuth();
  const toast = useToast();
  const t = useApi<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}/messages`, { poll: 4000, live: true });
  const team = useApi<{ members: TeamMember[] }>("/team");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const canReply = me?.role !== "VIEWER";
  const count = t.data?.messages.length ?? 0;

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [count]);

  if (t.loading) return <div className="space-y-3 p-6"><Skeleton className="h-12 w-1/2" /><Skeleton className="ml-auto h-12 w-1/2" /></div>;
  if (!t.data) return <div className="p-6"><ErrorNote>{t.error ?? "Conversation not found"}</ErrorNote></div>;

  const { conversation: c, messages } = t.data;
  const lastCustomer = [...messages].reverse().find((m) => m.sender === "CUSTOMER");
  const windowClosed = !lastCustomer || Date.now() - new Date(lastCustomer.createdAt).getTime() > 24 * 3600 * 1000;
  const closed = c.status === "CLOSED";

  async function act(key: string, fn: () => Promise<unknown>, after?: string) {
    setBusy(key);
    try { await fn(); await t.reload(); onChanged(); if (after) toast(after); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(null); }
  }
  const post = (path: string, body?: unknown) => api(`/conversations/${id}/${path}`, { method: "POST", body });
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    await act("send", async () => { await post("messages", { text }); setDraft(""); });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="space-y-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg border border-line p-2 lg:hidden" aria-label="Back to conversations"><ArrowLeft size={16} /></button>
          <Avatar text={initials(displayName(c.customer))} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{displayName(c.customer)}</div>
            <div className="truncate text-sm text-muted">{c.customer.phone}{c.whatsappAccount ? ` · via ${c.whatsappAccount.displayPhone}` : ""}</div>
          </div>
          <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
        </div>
        {canReply && (
          <div className="flex flex-wrap items-center gap-2">
            {!closed && (c.aiEnabled
              ? <Button size="sm" loading={busy === "mode"} onClick={() => act("mode", () => post("takeover"))}><Hand size={15} /> Take over</Button>
              : <Button size="sm" variant="ghost" loading={busy === "mode"} onClick={() => act("mode", () => post("handback"))}><Bot size={15} /> Hand back to AI</Button>)}
            <Select aria-label="Assign to" value={c.assignedTo?.id ?? ""} className="w-auto py-1.5 text-sm"
              onChange={(e) => act("assign", () => api(`/conversations/${id}/assign`, { method: "PUT", body: { userId: e.target.value || null } }))}>
              <option value="">Unassigned</option>
              {team.data?.members.filter((m) => m.role !== "VIEWER").map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setNotesOpen((o) => !o)}><NotebookPen size={15} /> Notes</Button>
            <Button size="sm" variant="ghost" loading={busy === "close"} onClick={() => act("close", () => post(closed ? "reopen" : "close"), closed ? "Conversation reopened" : "Conversation closed")}>{closed ? "Reopen" : "Close"}</Button>
          </div>
        )}
      </div>

      {notesOpen && <NotesPanel conversationId={id} canWrite={canReply} />}
      {c.status === "NEEDS_HUMAN" && <div className="flex items-center gap-2 bg-amber-s px-4 py-2.5 text-sm font-medium"><Hand size={15} /> The AI has stopped replying and is waiting for your team.</div>}

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#F4F1FA] p-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[84%] rounded-2xl px-3.5 py-2 lg:max-w-[70%]",
            m.sender === "CUSTOMER" ? "rounded-tl-sm bg-white" : m.sender === "AI" ? "ml-auto rounded-tr-sm bg-bubble" : "ml-auto rounded-tr-sm bg-[#E4DCFB]")}>
            {m.sender !== "CUSTOMER" && <div className="text-[11px] font-semibold text-muted">{m.sender === "AI" ? "AI" : "Team"}</div>}
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-muted">{m.sender === "AI" && canReply && <Rate m={m} conversationId={id} onDone={() => void t.reload()} />}{clock(m.createdAt)}<Ticks m={m} /></div>
            {m.deliveryStatus === "failed" && m.deliveryError && <div className="mt-1 text-xs text-red">{m.deliveryError}</div>}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {canReply && !closed && (
        <div className="border-t border-line p-3">
          {windowClosed && <p className="mb-2 text-sm text-amber">It's been more than 24 hours since the customer's last message. WhatsApp may not allow a normal reply now. If sending fails, you may need to wait for the customer to message again.</p>}
          {c.aiEnabled && <p className="mb-2 text-sm text-muted">Sending a reply pauses the AI for this conversation.</p>}
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Reply as your team" aria-label="Reply"
              className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
            <Button onClick={send} disabled={busy === "send" || !draft.trim()} aria-label="Send reply">{busy === "send" ? <Spinner /> : <Send size={16} />}</Button>
          </div>
        </div>
      )}
      {closed && <div className="border-t border-line p-3 text-center text-sm text-muted">This conversation is closed. Reopen it to reply.</div>}
    </div>
  );
}

function NotesPanel({ conversationId, canWrite }: { conversationId: string; canWrite: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const notes = useApi<{ notes: Note[] }>(`/conversations/${conversationId}/notes`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try { await api(`/conversations/${conversationId}/notes`, { method: "POST", body: { body: text.trim() } }); setText(""); await notes.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(false); }
  }
  async function remove(n: Note) {
    try { await api(`/conversations/${conversationId}/notes/${n.id}`, { method: "DELETE" }); await notes.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
  }

  return (
    <div className="max-h-56 space-y-2 overflow-y-auto border-b border-line bg-amber-s/50 px-4 py-3">
      <p className="text-xs font-semibold text-[#8A5A00]">Internal notes. Only your team sees these; they are never sent to the customer.</p>
      {notes.loading && <Skeleton className="h-8" />}
      {notes.data?.notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
      {notes.data?.notes.map((n) => (
        <div key={n.id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm">
          <div className="min-w-0 flex-1"><div className="whitespace-pre-wrap break-words">{n.body}</div><div className="text-xs text-muted">{n.author?.name ?? "Former team member"} · {timeAgo(n.createdAt)}</div></div>
          {(n.author?.id === me?.user.id || isAdmin) && canWrite && <button onClick={() => remove(n)} aria-label="Delete note" className="text-muted hover:text-red"><Trash2 size={14} /></button>}
        </div>
      ))}
      {canWrite && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} placeholder="Add a note for your team" aria-label="New note"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-violet" />
          <Button size="sm" onClick={add} loading={busy} disabled={!text.trim()}>Add</Button>
        </div>
      )}
    </div>
  );
}

/** Thumbs up or down on an AI reply. A thumbs down asks what was wrong, which feeds "Replies to improve" in Analytics. */
function Rate({ m, conversationId, onDone }: { m: Message; conversationId: string; onDone: () => void }) {
  const toast = useToast();
  async function rate(rating: "up" | "down") {
    const next = m.feedback === rating ? null : rating; // pressing the same thumb again clears it
    let note: string | undefined;
    if (next === "down") {
      const answer = window.prompt("What was wrong with this reply? (optional. It helps you improve your knowledge.)");
      if (answer === null) return;
      note = answer.trim() || undefined;
    }
    try { await api(`/conversations/${conversationId}/messages/${m.id}/feedback`, { method: "PUT", body: { rating: next, note } }); onDone(); }
    catch (e) { toast(errorMessage(e), "error"); }
  }
  const btn = "rounded p-0.5 hover:bg-white";
  return (
    <span className="mr-1 inline-flex gap-0.5">
      <button onClick={() => rate("up")} aria-label="Good reply" aria-pressed={m.feedback === "up"} className={cn(btn, m.feedback === "up" ? "text-green" : "text-muted")}><ThumbsUp size={13} /></button>
      <button onClick={() => rate("down")} aria-label="Not a good reply" aria-pressed={m.feedback === "down"} className={cn(btn, m.feedback === "down" ? "text-red" : "text-muted")}><ThumbsDown size={13} /></button>
    </span>
  );
}
