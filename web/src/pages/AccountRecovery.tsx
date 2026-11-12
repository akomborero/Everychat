import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Logo } from "../components/Shell";
import { Button, ErrorNote, Field, Input, Spinner } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

function Centered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md space-y-4">
        <Logo />
        <h1 className="pt-2 text-3xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setError(null);
    try { await api("/auth/forgot-password", { method: "POST", body: { email: f.email } }); setDone(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <Centered title="Forgot your password?">
      {done ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-green-s p-4">If an account exists for that email, we've sent a link to choose a new password. It works for one hour.</p>
          <Link to="/login" className="font-semibold text-violet hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-muted">Enter your email and we'll send you a link to choose a new one.</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
          <p className="text-center"><Link to="/login" className="font-semibold text-violet hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </Centered>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.password !== f.confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError(null);
    try { await api("/auth/reset-password", { method: "POST", body: { token, password: f.password } }); setDone(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  if (!token) return <Centered title="Link not valid"><p className="text-muted">This reset link is incomplete.</p><Link to="/forgot-password" className="font-semibold text-violet hover:underline">Ask for a new one</Link></Centered>;

  return (
    <Centered title="Choose a new password">
      {done ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 rounded-xl bg-green-s p-4"><Check size={18} /> Password changed. You've been signed out everywhere.</p>
          <Link to="/login" className="font-semibold text-violet hover:underline">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorNote>{error}{error.includes("expired") && <> <Link to="/forgot-password" className="font-semibold underline">Get a new link</Link></>}</ErrorNote>}
          <Field label="New password" hint="At least 8 characters"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Repeat new password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Button type="submit" loading={busy} className="w-full">Change password</Button>
        </form>
      )}
    </Centered>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { me, refresh } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "bad">(token ? "working" : "bad");
  const [message, setMessage] = useState("");
  const started = useRef(false); // the link works once, so never send it twice (React dev mode runs effects twice)

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(async () => { setState("ok"); if (me) await refresh(); })
      .catch((e) => { setState("bad"); setMessage(errorMessage(e)); });
  }, [token, me, refresh]);

  return (
    <Centered title={state === "ok" ? "Email confirmed" : state === "working" ? "Confirming your email" : "Link not valid"}>
      {state === "working" && <Spinner className="size-6 text-violet" />}
      {state === "ok" && <p className="flex items-center gap-2 rounded-xl bg-green-s p-4"><Check size={18} /> Thanks, your email address is confirmed.</p>}
      {state === "bad" && <p className="text-muted">{message || "This link is incomplete."} You can ask for a new one from inside the app.</p>}
      <Link to="/" className="font-semibold text-violet hover:underline">Continue</Link>
    </Centered>
  );
}
