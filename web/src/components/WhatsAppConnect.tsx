import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ExternalLink, MessageCircle, RefreshCw, Unplug } from "lucide-react";
import { Button, ErrorNote, Field, Input, Pill, Skeleton, Spinner, useToast } from "./ui";
import { useShell } from "./Shell";
import { api, errorMessage } from "../lib/api";
import { useApi } from "../lib/hooks";
import { launchEmbeddedSignup, loadFacebookSdk } from "../lib/facebook";
import { cn } from "../lib/cn";
import type { Conversation, WhatsappAccount } from "../lib/types";

interface SignupConfig { enabled: boolean; appId: string | null; configId: string | null; graphVersion: string }
type Phase =
  | { kind: "idle" }
  | { kind: "authorizing" }
  | { kind: "finishing" }
  | { kind: "done"; account: WhatsappAccount; openedAt: number }
  | { kind: "problem"; message: string };

const WA_MANAGER = "https://business.facebook.com/wa/manage/home/";
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

export function WhatsAppTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const { overview } = useShell();
  const accounts = useApi<{ accounts: WhatsappAccount[] }>("/whatsapp/accounts");
  const cfg = useApi<SignupConfig>("/whatsapp/accounts/signup-config");
  const [sdk, setSdk] = useState<"loading" | "ready" | "failed">("loading");
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Load Facebook's script up front: the popup must open straight from the click or browsers block it.
  useEffect(() => {
    const c = cfg.data;
    if (!c?.enabled || !c.appId) return;
    loadFacebookSdk(c.appId, c.graphVersion).then(() => setSdk("ready")).catch((e) => { setSdk("failed"); setSdkError(errorMessage(e)); });
  }, [cfg.data]);

  const connect = async () => {
    if (!cfg.data?.configId) return;
    setPhase({ kind: "authorizing" });
    const outcome = await launchEmbeddedSignup(cfg.data.configId);
    if (outcome.kind === "cancelled") { setPhase({ kind: "idle" }); toast("Connection cancelled. Nothing was changed."); return; }
    if (outcome.kind !== "done") { setPhase({ kind: "problem", message: outcome.message }); return; }

    setPhase({ kind: "finishing" });
    try {
      const r = await api<{ account: WhatsappAccount }>("/whatsapp/accounts/signup", {
        method: "POST",
        body: { code: outcome.code, phoneNumberId: outcome.phoneNumberId, wabaId: outcome.wabaId },
      });
      setPhase({ kind: "done", account: r.account, openedAt: Date.now() });
      await accounts.reload(); await overview.reload();
    } catch (e) { setPhase({ kind: "problem", message: errorMessage(e) }); }
  };

  const busy = phase.kind === "authorizing" || phase.kind === "finishing";
  const hasActive = accounts.data?.accounts.some((a) => a.status === "ACTIVE");

  return (
    <div className="max-w-2xl space-y-10">
      {phase.kind === "done" && <SetupResult account={phase.account} openedAt={phase.openedAt} onChanged={async () => { await accounts.reload(); await overview.reload(); }} />}

      {phase.kind !== "done" && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-2xl font-extrabold">{hasActive ? "Connect another WhatsApp number" : "Connect your WhatsApp Business number"}</h2>
          <p className="mt-1.5 text-muted">This is the number your customers message you on. Once connected, Everychat can reply for you and your team can take over anytime. It usually takes a couple of minutes.</p>

          {cfg.loading && <Skeleton className="mt-5 h-12" />}

          {cfg.data?.enabled && canEdit && (
            <>
              <div className="mt-5 rounded-xl bg-violet-s p-4 text-sm">
                <p className="font-semibold text-violet-d">Before you start</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
                  <li>Use a phone number that is <b>not</b> currently being used in the WhatsApp or WhatsApp Business app.</li>
                  <li>Have access to that number so you can receive a text or phone call to confirm it.</li>
                  <li>After connecting, you will need to add a payment method in WhatsApp Manager (we'll remind you).</li>
                </ul>
              </div>
              <ol className="mt-5 space-y-3">
                {["Click Connect WhatsApp and sign in with Facebook in the window that opens.", "Choose or create your WhatsApp Business account and select the number.", "Confirm the number with the code sent to you by text or call.", "Come back here. We'll finish setup and show you what to do next."].map((t, i) => (
                  <li key={t} className="flex items-start gap-3"><span className="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-violet-s text-sm font-bold text-violet-d">{i + 1}</span><span>{t}</span></li>
                ))}
              </ol>
              <Button className="mt-6 w-full sm:w-auto" onClick={connect} disabled={busy || sdk !== "ready"}>
                {busy ? <Spinner /> : <MessageCircle size={18} />}
                {phase.kind === "authorizing" ? "Finish in the Facebook window…" : phase.kind === "finishing" ? "Setting up your number…" : sdk === "loading" ? "Getting ready…" : "Connect WhatsApp"}
              </Button>
              {sdk === "failed" && <div className="mt-3"><ErrorNote>{sdkError ?? "We couldn't load the Facebook connection window. Check your internet connection, allow pop-ups for this site, and try again."}</ErrorNote></div>}
              {phase.kind === "problem" && (
                <div className="mt-4"><ErrorNote>{phase.message}</ErrorNote><p className="mt-2 text-sm text-muted">Nothing was saved. You can try again. If it keeps happening, contact support or the person who set up Everychat for your business.</p></div>
              )}
              <p className="mt-5 text-sm text-muted">We never see your WhatsApp password. This uses Meta's official secure connection.</p>
            </>
          )}

          {cfg.data && !cfg.data.enabled && (
            <div className="mt-5 space-y-3 rounded-xl bg-amber-s p-4 text-sm">
              <p className="font-semibold">One-click WhatsApp connection isn't ready yet</p>
              <p>Before a business owner can connect a number here, Everychat must be connected to Meta's WhatsApp service and approved by Meta. If you set up Everychat yourself, complete the WhatsApp setup steps in your deployment guide and add your Meta app details to the server. If someone else manages it for you, please ask them to finish the WhatsApp connection setup.</p>
              <p className="text-muted">Once that's done, this page will show a "Connect WhatsApp" button and you won't need any technical steps.</p>
            </div>
          )}
          {!canEdit && <p className="mt-4 text-muted">Only owners and admins can connect WhatsApp numbers. Please ask them to do this step.</p>}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Connected numbers</h2>
        {accounts.loading && <Skeleton className="h-20" />}
        {accounts.error && <ErrorNote>{accounts.error}</ErrorNote>}
        {accounts.data?.accounts.length === 0 && <p className="text-muted">No WhatsApp number connected yet. Once you connect one, it will appear here.</p>}
        <div className="space-y-3">
          {accounts.data?.accounts.map((a) => (
            <AccountCard key={a.id} account={a} canEdit={canEdit} onReconnect={connect} reconnectReady={sdk === "ready" && !!cfg.data?.enabled && !busy}
              onChanged={async () => { await accounts.reload(); await overview.reload(); }} />
          ))}
        </div>
      </section>

      {canEdit && <ManualConnect onDone={async () => { await accounts.reload(); await overview.reload(); }} />}
    </div>
  );
}

/* ---------- shown right after a successful connection ---------- */
function SetupResult({ account, openedAt, onChanged }: { account: WhatsappAccount; openedAt: number; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [current, setCurrent] = useState(account);
  const [retrying, setRetrying] = useState(false);
  const convos = useApi<{ conversations: Conversation[] }>("/conversations", { poll: 3000 });
  const first = convos.data?.conversations.find((c) => new Date(c.lastMessageAt).getTime() > openedAt);
  const ok = current.registered && current.webhookSubscribed;
  const digits = current.displayPhone.replace(/\D/g, "");

  async function retry() {
    setRetrying(true);
    try { const r = await api<{ account: WhatsappAccount }>(`/whatsapp/accounts/${current.id}/retry-setup`, { method: "POST" }); setCurrent(r.account); await onChanged(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setRetrying(false); }
  }

  const rows = [
    { done: true, label: "Facebook account authorised" },
    { done: current.registered, label: "Number registered with WhatsApp", problem: current.setupError },
    { done: current.webhookSubscribed, label: "Messages are flowing to your dashboard", problem: current.webhookSubscribed ? null : "Meta hasn't started sending messages to us yet." },
  ];

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 place-items-center rounded-full text-white", ok ? "bg-green" : "bg-amber")}>{ok ? <Check /> : <AlertTriangle size={20} />}</span>
        <div>
          <h2 className="text-2xl font-extrabold">{ok ? "Your number is connected" : "Almost there"}</h2>
          <p className="text-muted">{current.verifiedName ? `${current.verifiedName} · ` : ""}{current.displayPhone}</p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 py-3">
            <span className={cn("mt-0.5 grid size-5 flex-none place-items-center rounded-full text-white", r.done ? "bg-green" : "bg-red")}>{r.done ? <Check size={13} strokeWidth={3} /> : <span className="text-xs font-bold">!</span>}</span>
            <div><div className="font-medium">{r.label}</div>{!r.done && r.problem && <div className="text-sm text-red">{r.problem}</div>}</div>
          </li>
        ))}
      </ul>
      {!ok && <Button className="mt-3" variant="ghost" loading={retrying} onClick={retry}><RefreshCw size={16} /> Try the failed steps again</Button>}

      <div className="mt-6 rounded-xl bg-violet-s p-4">
        <h3 className="font-display text-lg font-bold">One more thing: add a payment method</h3>
        <p className="mt-1 text-sm">WhatsApp needs a payment method on your WhatsApp Business account before you can send business messages beyond the free allowance. Add it in WhatsApp Manager under Payment methods.</p>
        <a href={WA_MANAGER} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline">Open WhatsApp Manager <ExternalLink size={14} /></a>
      </div>

      <div className="mt-4 rounded-xl border border-line p-4">
        <h3 className="font-display text-lg font-bold">Try it now</h3>
        {first ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-green text-white"><Check size={16} /></span>
            <div><div className="font-semibold">First message received.</div><Link to={`/inbox/${first.id}`} className="text-sm font-semibold text-violet hover:underline">See it in your inbox</Link></div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Message your new number from your own phone. This screen will notice when it arrives. To have the AI reply, add your prices and switch it on in the AI tab.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={`https://wa.me/${digits}?text=${encodeURIComponent("Hi!")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-green px-4 py-2.5 font-semibold text-white hover:brightness-95"><MessageCircle size={18} /> Open WhatsApp</a>
              <span className="inline-flex items-center gap-2 text-sm text-muted"><Spinner /> Waiting for your first message</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-4 flex gap-4 text-sm font-semibold text-violet"><Link to="/knowledge" className="hover:underline">Add your prices and info</Link><Link to="/ai" className="hover:underline">Set up the AI</Link></div>
    </section>
  );
}

/* ---------- one connected number ---------- */
function AccountCard({ account: a, canEdit, onReconnect, reconnectReady, onChanged }: {
  account: WhatsappAccount; canEdit: boolean; onReconnect: () => void; reconnectReady: boolean; onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<"retry" | "disconnect" | null>(null);
  const active = a.status === "ACTIVE";
  const left = a.tokenExpiresAt ? daysUntil(a.tokenExpiresAt) : null;
  const expiring = active && left !== null && left <= 14;
  const needsFix = active && (!a.registered || !a.webhookSubscribed);

  async function call(kind: "retry" | "disconnect") {
    if (kind === "disconnect" && !confirm(`Disconnect ${a.displayPhone}? The AI will stop replying on this number.`)) return;
    setBusy(kind);
    try { await api(`/whatsapp/accounts/${a.id}/${kind === "retry" ? "retry-setup" : "disconnect"}`, { method: "POST" }); await onChanged(); toast(kind === "retry" ? "Checked again" : "Number disconnected"); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{a.displayPhone}</div>
          <div className="truncate text-sm text-muted">{a.verifiedName ?? "WhatsApp number"}</div>
        </div>
        <Pill tone={!active ? "neutral" : needsFix ? "amber" : "green"}>{!active ? "Disconnected" : needsFix ? "Needs attention" : "Connected"}</Pill>
      </div>
      {needsFix && <p className="mt-2 text-sm text-red">{a.setupError ?? "Meta isn't sending messages to us yet."}</p>}
      {expiring && <p className="mt-2 text-sm text-amber">{left! <= 0 ? "Access has expired." : `Access expires in ${left} day${left === 1 ? "" : "s"}.`} Reconnect to renew it, or customers stop getting replies.</p>}
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          {needsFix && <Button size="sm" variant="ghost" loading={busy === "retry"} onClick={() => call("retry")}><RefreshCw size={14} /> Fix it</Button>}
          {(expiring || !active) && <Button size="sm" onClick={onReconnect} disabled={!reconnectReady}>Reconnect</Button>}
          {active && <Button size="sm" variant="danger" loading={busy === "disconnect"} onClick={() => call("disconnect")}><Unplug size={14} /> Disconnect</Button>}
        </div>
      )}
    </div>
  );
}

/* ---------- developer / test-number fallback ---------- */
function ManualConnect({ onDone }: { onDone: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const r = await api<{ webhookSubscribed: boolean }>("/whatsapp/accounts", { method: "POST", body: { phoneNumberId: f.phoneNumberId, businessAccountId: f.businessAccountId, accessToken: f.accessToken } });
      form.current?.reset();
      toast(r.webhookSubscribed ? "WhatsApp number connected" : "Connected, but there was a problem receiving messages. Click “Fix it” on the number below.");
      await onDone();
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(false); }
  }

  return (
    <details className="rounded-2xl border border-line bg-white p-5">
      <summary className="cursor-pointer font-semibold">For developers and test numbers only</summary>
      <p className="mb-4 mt-2 text-sm text-muted">Most business owners should use the <b>Connect WhatsApp</b> button above. This option is only for Meta test numbers or technical setups and requires special details from Meta. If you are not sure, please don't use this.</p>
      <form ref={form} onSubmit={submit} className="space-y-4">
        <Field label="Phone number ID" hint="Found in your Meta developer dashboard."><Input name="phoneNumberId" required inputMode="numeric" /></Field>
        <Field label="WhatsApp Business Account ID" hint="Found in your Meta developer dashboard."><Input name="businessAccountId" required inputMode="numeric" /></Field>
        <Field label="Access token" hint="A long-term access token. It will be stored securely and never shown again."><Input name="accessToken" type="password" required autoComplete="off" /></Field>
        <Button type="submit" loading={busy}>Connect number</Button>
      </form>
    </details>
  );
}
