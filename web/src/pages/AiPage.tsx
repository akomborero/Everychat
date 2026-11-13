import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Send, X } from "lucide-react";
import { Button, ErrorNote, Field, PageHeader, Pill, Skeleton, Spinner, Textarea, useToast } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { useShell } from "../components/Shell";
import { cn } from "../lib/cn";
import type { Agent, Tone } from "../lib/types";

const TONES: { key: Tone; label: string; hint: string }[] = [
  { key: "friendly", label: "Friendly", hint: "Warm and approachable" },
  { key: "professional", label: "Professional", hint: "Polite and formal" },
  { key: "casual", label: "Casual", hint: "Relaxed, like texting" },
  { key: "direct", label: "Short and direct", hint: "Answers first, no filler" },
];

export default function AiPage() {
  const { me } = useAuth();
  const canEdit = me?.role === "OWNER" || me?.role === "ADMIN";
  const a = useApi<{ agent: Agent }>("/agent");
  const { overview } = useShell();
  const toast = useToast();

  const [tone, setTone] = useState<Tone>("friendly");
  const [rules, setRules] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [newRule, setNewRule] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const synced = useRef(false);

  // Fill the form once from the server. Later reloads must not wipe unsaved edits.
  useEffect(() => {
    if (a.data && !synced.current) {
      synced.current = true;
      setTone(a.data.agent.tone); setRules(a.data.agent.rules); setInstructions(a.data.agent.instructions);
    }
  }, [a.data]);

  if (a.loading) return <Skeleton className="h-96" />;
  if (!a.data) return <ErrorNote>{a.error}</ErrorNote>;
  const agent = a.data.agent;

  async function save() {
    setSaving(true);
    try { await api("/agent", { method: "PUT", body: { tone, rules, instructions } }); toast("Saved. The test chat now uses these settings."); await a.reload(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setSaving(false); }
  }
  async function toggle() {
    setToggling(true);
    try { await api("/agent", { method: "PUT", body: { active: !agent.active } }); await a.reload(); await overview.reload(); toast(agent.active ? "AI switched off" : "AI is live on WhatsApp"); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setToggling(false); }
  }
  const addRule = () => { const r = newRule.trim(); if (r) { setRules([...rules, r]); setNewRule(""); } };

  const o = overview.data;
  return (
    <>
      <PageHeader
        title="AI assistant"
        subtitle="Choose how your assistant talks, test it, then turn it on for your WhatsApp number."
        actions={canEdit && (
          <Button variant={agent.active ? "ghost" : "primary"} loading={toggling} onClick={toggle}>
            {agent.active ? "Turn AI off" : "Turn AI on"}
          </Button>
        )}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className={cn("size-2.5 rounded-full", agent.active ? "bg-green" : "bg-muted")} />
        <span className="font-medium">{agent.active ? "On: the AI can reply to customers on WhatsApp" : "Off: customers will not get automatic replies yet"}</span>
      </div>

      {o && !o.setup.whatsappConnected && (
        <div className="mb-6 rounded-xl bg-amber-s px-4 py-3 text-sm">
          <b>Connect WhatsApp first.</b> You can set up and test the AI now, but it can only reply to real customers after you <Link to="/settings" className="font-semibold text-violet underline">connect your WhatsApp Business number</Link>.
        </div>
      )}

      <div className="mb-8 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-3">
        {[
          { n: 1, t: "Set how it should respond", d: "Choose a tone, add rules, and save." },
          { n: 2, t: "Test it", d: "Ask questions in the test chat on the right." },
          { n: 3, t: "Turn it on", d: "When you're happy, turn the AI on." },
        ].map((s) => (
          <div key={s.n} className="rounded-xl bg-paper p-3">
            <div className="mb-1 grid size-6 place-items-center rounded-full bg-violet-s text-xs font-bold text-violet-d">{s.n}</div>
            <div className="font-semibold">{s.t}</div>
            <div className="text-sm text-muted">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-lg font-bold">How should the AI talk?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {TONES.map((t) => (
                <button key={t.key} disabled={!canEdit} onClick={() => setTone(t.key)} className={cn("rounded-xl border p-3 text-left transition-colors", tone === t.key ? "border-violet bg-violet-s" : "border-line bg-white hover:bg-paper")}>
                  <div className="font-semibold">{t.label}</div><div className="text-sm text-muted">{t.hint}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold">Rules the AI must follow</h2>
            <p className="mb-3 text-sm text-muted">Add things the AI should always do or never do. Examples: "Never give discounts", "Always ask for the customer's name", "If someone asks about delivery, explain our delivery policy".</p>
            <ul className="mb-3 space-y-2">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <span className="flex-1">{r}</span>
                  {canEdit && <button onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label={`Remove rule: ${r}`} className="text-muted hover:text-red"><X size={16} /></button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex gap-2">
                <input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRule()} placeholder="Type a rule and press Add" aria-label="New rule"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
                <Button variant="ghost" onClick={addRule} aria-label="Add rule"><Plus size={16} /></Button>
              </div>
            )}
          </section>

          <Field label="Anything else the AI should know" hint="Optional. Add extra guidance in your own words, like how you want it to greet people or what to do in special situations.">
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={!canEdit} maxLength={4000} placeholder="e.g. Greet customers warmly. If they ask for something we don't offer, politely explain and suggest what we do offer." />
          </Field>
          {canEdit && <div className="flex flex-wrap gap-2"><Button onClick={save} loading={saving}>Save settings</Button><span className="self-center text-sm text-muted">Save before testing so the test chat uses your latest changes.</span></div>}
        </div>

        <TestChat />
      </div>
    </>
  );
}

/* ---------------- Test chat: real model, real knowledge, actions only reported ---------------- */
interface TestMsg { role: "user" | "assistant"; content: string; actions?: { name: string; args: unknown }[] }

function describe(a: { name: string; args: unknown }) {
  const args = (a.args ?? {}) as Record<string, string>;
  if (a.name === "capture_lead") return `Would save a lead: ${args.interest ?? ""}`;
  if (a.name === "request_human") return `Would hand off to your team: ${args.reason ?? ""}`;
  if (a.name === "book_appointment") return `Would book: ${args.starts_at ?? ""} for ${args.name ?? "customer"}`;
  if (a.name === "cancel_appointment") return "Would cancel an appointment";
  return `Would run ${a.name}`;
}

function TestChat() {
  const toast = useToast();
  const [msgs, setMsgs] = useState<TestMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: TestMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next); setDraft(""); setBusy(true);
    try {
      const r = await api<{ reply: string; actions: { name: string; args: unknown }[] }>("/agent/test", {
        method: "POST",
        body: { messages: next.slice(-20).map(({ role, content }) => ({ role, content })) },
      });
      setMsgs([...next, { role: "assistant", content: r.reply, actions: r.actions }]);
    } catch (e) { toast(errorMessage(e), "error"); setMsgs(msgs); setDraft(text); }
    finally { setBusy(false); }
  }

  return (
    <section className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Bot size={18} className="text-violet" />
        <h2 className="font-display text-lg font-bold">Test chat</h2>
        <Pill tone="neutral" className="ml-auto">Private. Nothing is sent to customers.</Pill>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F4F1FA] p-4">
        {msgs.length === 0 && <p className="mx-auto max-w-xs py-10 text-center text-muted">Type a question the way a customer would. The AI answers using your real prices, hours and documents.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-start" : "items-end")}>
            <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2", m.role === "user" ? "rounded-tl-sm bg-white" : "rounded-tr-sm bg-bubble")}>{m.content}</div>
            {m.actions?.map((a, j) => <span key={j} className="rounded-full border border-dashed border-[#B9AEE8] bg-white px-2.5 py-0.5 text-xs text-violet-d">{describe(a)}</span>)}
          </div>
        ))}
        {busy && <div className="flex justify-end"><div className="rounded-2xl bg-bubble px-4 py-2.5"><Spinner className="text-muted" /></div></div>}
        <div ref={end} />
      </div>
      <div className="flex gap-2 border-t border-line p-3">
        <button onClick={() => { setMsgs([]); setDraft(""); }} className="rounded-xl border border-line px-3 text-sm text-muted hover:bg-violet-s">Reset</button>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder="Message as a customer" aria-label="Test message"
          className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2.5 outline-none focus:border-violet focus:ring-2 focus:ring-violet/20" />
        <Button onClick={send} disabled={busy || !draft.trim()} aria-label="Send test message"><Send size={16} /></Button>
      </div>
    </section>
  );
}
