import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/Shell";
import { Button, ErrorNote, Field, Input } from "../components/ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { me, login, register } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const isRegister = mode === "register";

  if (me) return <Navigate to="/" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setError(null); setFields({});
    try {
      if (isRegister) {
        await register({ name: f.name, businessName: f.businessName, industry: f.industry || undefined, email: f.email, phone: f.phone || undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, password: f.password });
      } else {
        await login(f.email, f.password);
      }
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFields(err.details ?? {}); }
      else setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  const fe = (k: string) => fields[k]?.[0];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Logo dark />
        <div>
          <h1 className="max-w-md text-5xl font-extrabold leading-[1.05]">Every WhatsApp enquiry answered, booked and followed up.</h1>
          <p className="mt-5 max-w-md text-lg text-[#BDB8D6]">Connect your business number. Your AI replies from your own prices and opening hours, and hands over to your team when a person is needed.</p>
        </div>
        <p className="text-sm text-[#BDB8D6]">Uses the official WhatsApp Business Platform. We never ask for your WhatsApp password.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="pt-2 text-3xl font-extrabold">{isRegister ? "Create your workspace" : "Welcome back"}</h2>
          {error && <ErrorNote>{error}</ErrorNote>}

          {isRegister && (
            <>
              <Field label="Your name" error={fe("name")}><Input name="name" required autoComplete="name" /></Field>
              <Field label="Business name" error={fe("businessName")}><Input name="businessName" required /></Field>
              <Field label="Type of business" hint="Optional. What your business does, in a few words." error={fe("industry")}><Input name="industry" /></Field>
            </>
          )}
          <Field label="Email" error={fe("email")}><Input name="email" type="email" required autoComplete="email" /></Field>
          {isRegister && <Field label="Phone number" hint="Optional" error={fe("phone")}><Input name="phone" type="tel" autoComplete="tel" /></Field>}
          <Field label="Password" hint={isRegister ? "At least 8 characters" : undefined} error={fe("password")}>
            <Input name="password" type="password" required minLength={isRegister ? 8 : 1} autoComplete={isRegister ? "new-password" : "current-password"} />
          </Field>

          {!isRegister && <div className="-mt-1 text-right"><Link to="/forgot-password" className="text-sm font-semibold text-violet hover:underline">Forgot your password?</Link></div>}
          <Button type="submit" loading={busy} className="w-full">{isRegister ? "Start free" : "Sign in"}</Button>
          {isRegister && <p className="text-center text-sm text-muted">By creating an account you agree to our <Link to="/terms" className="font-semibold text-violet hover:underline">Terms</Link> and <Link to="/privacy" className="font-semibold text-violet hover:underline">Privacy Policy</Link>.</p>}
          <p className="text-center text-muted">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <Link to={isRegister ? "/login" : "/register"} className="font-semibold text-violet hover:underline">{isRegister ? "Sign in" : "Create an account"}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
