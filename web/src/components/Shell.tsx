import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { BarChart3, BookOpen, Bot, CalendarDays, Contact, LayoutDashboard, LogOut, MessageSquare, MoreHorizontal, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Button, useToast } from "./ui";
import { api, errorMessage } from "../lib/api";
import { BRAND_NAME } from "../config";
import { useAuth } from "../lib/auth";
import { useApi, type ApiState } from "../lib/hooks";
import { cn } from "../lib/cn";
import { startLive, stopLive } from "../lib/live";
import type { Overview } from "../lib/types";

export interface ShellContext { overview: ApiState<Overview> }
export const useShell = () => useOutletContext<ShellContext>();

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: boolean; primary?: boolean }
const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, primary: true },
  { to: "/inbox", label: "Inbox", icon: MessageSquare, badge: true, primary: true },
  { to: "/leads", label: "Leads", icon: Users, primary: true },
  { to: "/customers", label: "Customers", icon: Contact, primary: true },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/ai", label: "AI", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight", dark && "text-white")}>
      <span className="grid size-8 place-items-center rounded-[10px_10px_10px_4px] bg-violet text-white">
        <MessageSquare size={16} strokeWidth={2.4} />
      </span>
      {BRAND_NAME}
    </div>
  );
}

export function Shell() {
  const { me, logout } = useAuth();
  const nav: NavItem[] = me?.platformAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;
  const overview = useApi<Overview>("/overview", { poll: 15000, live: true });
  const needs = overview.data?.needsHuman ?? 0;
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => { startLive(); return stopLive; }, []);
  useEffect(() => setMore(false), [pathname]);

  const primary = nav.filter((n) => n.primary);
  const secondary = nav.filter((n) => !n.primary);
  const moreActive = secondary.some((n) => pathname.startsWith(n.to));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 bg-ink p-4 text-[#EDEAF7] lg:flex">
        <div className="px-2 pb-5 pt-1"><Logo dark /></div>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn("flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-[#BDB8D6] transition-colors hover:bg-white/10 hover:text-white", isActive && "bg-violet text-white hover:bg-violet")
            }
          >
            <n.icon size={18} />
            {n.label}
            {n.badge && needs > 0 && <span className="ml-auto rounded-full bg-amber px-2 text-xs font-bold text-ink">{needs}</span>}
          </NavLink>
        ))}
        <div className="mt-auto rounded-xl bg-white/10 p-3 text-sm">
          <div className="truncate font-semibold text-white">{me?.business.name}</div>
          <div className="truncate text-[#BDB8D6]">{me?.user.name} · {me?.role.toLowerCase()}</div>
          <button onClick={logout} className="mt-2 inline-flex items-center gap-1.5 text-[#BDB8D6] hover:text-white">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:pb-10">
        <div className="mx-auto max-w-6xl">
          {me && !me.emailVerified && <VerifyBanner email={me.user.email} />}
          <Outlet context={{ overview } satisfies ShellContext} />
        </div>
      </main>

      {more && (
        <>
          <button className="fixed inset-0 z-20 bg-ink/40 lg:hidden" aria-label="Close menu" onClick={() => setMore(false)} />
          <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-2xl bg-ink p-2 text-[#EDEAF7] shadow-xl lg:hidden">
            {secondary.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 font-medium", isActive && "bg-violet text-white")}>
                <n.icon size={18} /> {n.label}
              </NavLink>
            ))}
            <div className="mx-3 my-1 border-t border-white/10" />
            <div className="px-3 py-2 text-sm text-[#BDB8D6]">{me?.user.name} · {me?.business.name}</div>
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-medium"><LogOut size={18} /> Sign out</button>
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around bg-ink px-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5 lg:hidden" aria-label="Main">
        {primary.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cn("relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#BDB8D6]", isActive && "bg-violet text-white")}
          >
            <n.icon size={20} />
            {n.label}
            {n.badge && needs > 0 && <span className="absolute right-1 top-0.5 grid size-4 place-items-center rounded-full bg-amber text-[10px] font-bold text-ink">{needs}</span>}
          </NavLink>
        ))}
        <button onClick={() => setMore(!more)} className={cn("flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#BDB8D6]", (more || moreActive) && "bg-violet text-white")}>
          <MoreHorizontal size={20} /> More
        </button>
      </nav>
    </div>
  );
}

function VerifyBanner({ email }: { email: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function resend() {
    setBusy(true);
    try { await api("/auth/send-verification", { method: "POST" }); setSent(true); toast("Verification email sent"); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(false); }
  }
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-violet-s px-5 py-3 text-sm">
      <span className="flex-1">Confirm your email <b>{email}</b> so you can recover your account if you forget your password.</span>
      <Button size="sm" variant="ghost" loading={busy} disabled={sent} onClick={resend}>{sent ? "Email sent" : "Resend email"}</Button>
    </div>
  );
}
