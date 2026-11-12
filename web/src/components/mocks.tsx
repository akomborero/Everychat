import type { ReactNode } from "react";
import { Check, CheckCheck, FileText, Hand } from "lucide-react";
import { cn } from "../lib/cn";
import type { VisualKind } from "../site/content";

// Illustrations only: small made-up screens to show what the product looks like.
// They use invented names and numbers and are marked as examples wherever they appear.

export function MockWindow({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-[0_40px_80px_-40px_rgba(70,48,159,0.4)]", className)} role="img" aria-label={`Example screen: ${title}`}>
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-4 py-2.5">
        <i className="size-2.5 rounded-full bg-[#F4A5A5]" /><i className="size-2.5 rounded-full bg-[#F6D58A]" /><i className="size-2.5 rounded-full bg-[#9ED8B0]" />
        <span className="ml-3 text-xs font-medium text-muted">{title}</span>
      </div>
      <div aria-hidden>{children}</div>
    </div>
  );
}

const pill = (tone: "violet" | "amber" | "green" | "grey", t: string) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold",
    tone === "violet" && "bg-violet-s text-violet-d", tone === "amber" && "bg-amber-s text-[#8A5A00]", tone === "green" && "bg-green-s text-[#146B43]", tone === "grey" && "bg-[#EEECF4] text-muted")}>{t}</span>
);

function Inbox() {
  const rows: [string, string, ReactNode][] = [
    ["Sam R.", "Can I speak to someone about an invoice?", pill("amber", "Needs a person")],
    ["Alex T.", "Booked, Alex: Thursday at 10:00.", pill("violet", "AI replying")],
    ["Jo K.", "Thanks, that's all I needed!", pill("green", "Closed")],
  ];
  return (
    <div className="grid grid-cols-[42%_1fr] text-sm">
      <div className="divide-y divide-line border-r border-line">
        {rows.map(([n, m, p], i) => (
          <div key={n} className={cn("space-y-1 p-3.5", i === 0 && "bg-violet-s")}>
            <div className="font-semibold">{n}</div><div className="truncate text-xs text-muted">{m}</div>{p}
          </div>
        ))}
      </div>
      <div className="flex flex-col bg-[#F4F1FA]">
        <div className="flex items-center justify-between border-b border-line bg-white px-3.5 py-2.5">
          <span className="font-semibold">Sam R.</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-violet px-2.5 py-1 text-xs font-semibold text-white"><Hand size={12} /> Take over</span>
        </div>
        <div className="space-y-2 p-3.5">
          <div className="w-4/5 rounded-xl rounded-tl-sm bg-white px-3 py-2 text-xs">Can I speak to someone about an invoice?</div>
          <div className="ml-auto w-4/5 rounded-xl rounded-tr-sm bg-bubble px-3 py-2 text-xs">Of course. I've asked a team member to take over.<div className="mt-0.5 flex justify-end text-muted"><CheckCheck size={13} /></div></div>
          <div className="rounded-xl bg-amber-s px-3 py-1.5 text-[11px] font-medium">Note for the team: customer is waiting on a corrected invoice.</div>
        </div>
      </div>
    </div>
  );
}

function Leads() {
  const rows: [string, string, ReactNode][] = [
    ["Sam R.", "Standard package", pill("amber", "Interested")],
    ["Alex T.", "Consultation", pill("green", "Won")],
    ["Jo K.", "Premium package", pill("violet", "Qualified")],
    ["Max P.", "Standard package", pill("grey", "New")],
  ];
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line text-xs text-muted"><tr><th className="p-3 font-semibold">Customer</th><th className="p-3 font-semibold">Interested in</th><th className="p-3 font-semibold">Status</th></tr></thead>
      <tbody>{rows.map(([n, i, s]) => <tr key={n} className="border-b border-line last:border-0"><td className="p-3 font-semibold">{n}</td><td className="p-3 text-muted">{i}</td><td className="p-3">{s}</td></tr>)}</tbody>
    </table>
  );
}

function Knowledge() {
  return (
    <div className="space-y-3 p-4 text-sm">
      {[["Standard package", "$80"], ["Premium package", "$140"], ["Consultation", "$30"]].map(([n, p]) => (
        <div key={n} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5"><span className="font-semibold">{n}</span><span className="font-display text-lg font-bold">{p}</span></div>
      ))}
      <div className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5"><FileText size={16} className="text-muted" /><span className="flex-1 truncate">price-list.pdf</span>{pill("green", "Ready")}</div>
      <div className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5"><FileText size={16} className="text-muted" /><span className="flex-1 truncate">Are you open on public holidays?</span>{pill("green", "Ready")}</div>
    </div>
  );
}

function Booking() {
  const days: [string, string[]][] = [["Mon", ["09:00", "11:00", "14:00"]], ["Tue", ["09:00", "14:00"]], ["Wed", ["10:00", "13:00", "16:00"]], ["Thu", ["09:00", "11:00"]], ["Fri", ["10:00", "15:00"]]];
  return (
    <div className="space-y-2 p-4 text-sm">
      {days.map(([d, times]) => (
        <div key={d} className="flex items-center gap-3"><span className="w-10 font-semibold">{d}</span>
          <div className="flex flex-wrap gap-1.5">{times.map((t) => <span key={t} className="rounded-full bg-violet-s px-2.5 py-1 text-xs font-semibold text-violet-d">{t}</span>)}</div>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-green-s px-3 py-2 text-xs font-medium text-[#146B43]"><Check size={14} /> Sam booked Thursday 09:00</div>
    </div>
  );
}

function Connect() {
  const steps: [string, boolean][] = [["Sign in with Facebook", true], ["Choose your WhatsApp number", true], ["Confirm the code we send", true], ["Number registered", true], ["Messages flowing to your dashboard", true]];
  return (
    <div className="space-y-2.5 p-4 text-sm">
      {steps.map(([t, done]) => (
        <div key={t} className="flex items-center gap-3"><span className={cn("grid size-5 place-items-center rounded-full text-white", done ? "bg-green" : "bg-line")}><Check size={12} strokeWidth={3} /></span>{t}</div>
      ))}
      <div className="mt-3 rounded-xl bg-green-s px-3.5 py-2.5 font-semibold text-[#146B43]">Your number is connected</div>
    </div>
  );
}

const TITLES: Record<VisualKind, string> = { inbox: "Inbox", leads: "Leads", knowledge: "Knowledge", booking: "Bookings", connect: "Connect WhatsApp" };

export function Visual({ kind, className }: { kind: VisualKind; className?: string }) {
  return (
    <MockWindow title={TITLES[kind]} className={className}>
      {kind === "inbox" && <Inbox />}{kind === "leads" && <Leads />}{kind === "knowledge" && <Knowledge />}{kind === "booking" && <Booking />}{kind === "connect" && <Connect />}
    </MockWindow>
  );
}
