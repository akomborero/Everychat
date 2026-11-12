import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Check, Hand, MessageCircle, ShieldCheck, UserPlus, Users, X, type LucideIcon } from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { Reveal } from "../components/Reveal";
import { Visual } from "../components/mocks";
import { cn } from "../lib/cn";
import { usePageTitle } from "../lib/hooks";
import { FAQ, PRODUCTS } from "../site/content";

/* ---------------- hero: an example chat that turns into records ---------------- */
interface Step { from: "c" | "a"; text: string; ev?: { icon: LucideIcon; title: string; sub: string } }

// An illustration only: a made-up conversation to show how a chat turns into records for the team.
const DEMO: Step[] = [
  { from: "c", text: "Hi, how much is the standard package?", ev: { icon: UserPlus, title: "New customer", sub: "Added to your customer list" } },
  { from: "a", text: "Hi! The standard package is $80. Would you like to book a time?" },
  { from: "c", text: "Yes, Friday afternoon please", ev: { icon: Users, title: "Lead saved", sub: "Interested in the standard package" } },
  { from: "a", text: "Friday has 14:00 and 16:00 open. Which suits you?" },
  { from: "c", text: "14:00. I'm Sam." },
  { from: "a", text: "Booked, Sam: Friday at 14:00. You're all set.", ev: { icon: CalendarCheck, title: "Appointment booked", sub: "Friday 14:00 · Sam" } },
  { from: "c", text: "Can I speak to someone about an invoice?" },
  { from: "a", text: "Of course. I've asked a team member to take over.", ev: { icon: Hand, title: "Handed to your team", sub: "The AI stops. A person takes over" } },
];

function useDemo() {
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);
  const [run, setRun] = useState(0);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) { setN(DEMO.length); return; }
    setN(0); setTyping(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 900;
    DEMO.forEach((s, i) => {
      if (s.from === "a") { timers.push(setTimeout(() => setTyping(true), at)); at += 1000; }
      timers.push(setTimeout(() => { setTyping(false); setN(i + 1); }, at));
      at += s.from === "a" ? 1300 : 1500;
    });
    timers.push(setTimeout(() => setRun((r) => r + 1), at + 5000));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]);
  return { n, typing };
}

function HeroDemo() {
  const { n, typing } = useDemo();
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [n, typing]);
  const shown = DEMO.slice(0, n);
  const events = shown.filter((s) => s.ev);
  const latest = events[events.length - 1]?.ev;

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-label="Example of a customer chat turning into records for your team">
      {/* floating "what just happened" chips */}
      {latest && (
        <div key={latest.title} className="absolute -left-3 top-16 z-10 hidden animate-[float-a_6s_ease-in-out_infinite] items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-xl sm:flex lg:-left-14">
          <latest.icon size={16} className="text-violet" /><span><b className="block text-[13px] font-semibold">{latest.title}</b><span className="text-xs text-muted">{latest.sub}</span></span>
        </div>
      )}
      <div className="absolute -right-2 bottom-24 z-10 hidden animate-[float-b_7s_ease-in-out_infinite] items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-xl sm:flex lg:-right-10">
        <span className="size-2 rounded-full bg-green" /><span className="text-[13px] font-semibold">AI is live</span>
      </div>

      <div className="rounded-[32px] border border-line bg-white p-3 shadow-[0_50px_100px_-40px_rgba(70,48,159,0.5)]">
        <div className="flex h-[460px] flex-col overflow-hidden rounded-[24px] bg-[#EFEAE2]">
          <div className="flex items-center gap-2.5 bg-violet px-4 py-3 text-sm font-semibold text-white">
            <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-bold text-violet">YB</span>Your Business
            <span className="ml-auto text-xs font-normal opacity-80">online</span>
          </div>
          <div ref={body} className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden p-3">
            {shown.map((s, i) => (
              <div key={i} className={cn("max-w-[85%] animate-[pop_0.3s_ease-out] rounded-2xl px-3 py-2 text-[13.5px] leading-snug", s.from === "a" ? "self-end rounded-tr-sm bg-bubble" : "self-start rounded-tl-sm bg-white")}>{s.text}</div>
            ))}
            {typing && <div className="flex gap-1 self-end rounded-2xl bg-bubble px-3.5 py-3" aria-hidden>{[0, 150, 300].map((d) => <i key={d} style={{ animationDelay: `${d}ms` }} className="size-1.5 animate-pulse rounded-full bg-[#7A9D87]" />)}</div>}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Example conversation for illustration.</p>
    </div>
  );
}

/* ---------------- capability strip ---------------- */
const STRIP = ["Answer questions", "Capture leads", "Book appointments", "Hand over to your team", "Track every customer", "Reply in any language", "Test before you launch", "Assign and add notes"];

function Marquee() {
  return (
    <div className="overflow-hidden border-y border-line bg-white py-4" aria-hidden>
      <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-10 whitespace-nowrap pr-10">
        {[...STRIP, ...STRIP].map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-lg font-bold text-ink/80">{t}<i className="size-1.5 rounded-full bg-violet" /></span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- feature rows ---------------- */
const ROWS = [
  { kind: "knowledge" as const, title: "It knows your business", text: "Add your prices, hours and policies, or upload your documents. The AI answers from your information and passes the chat to a person when it can't." },
  { kind: "inbox" as const, title: "Your team is one tap away", text: "Take over any chat, assign it to a teammate, and leave private notes. The AI steps back the moment you step in." },
  { kind: "leads" as const, title: "Nobody slips through", text: "Every person who messages you gets a customer record, and everyone who shows interest becomes a lead you can follow up." },
  { kind: "booking" as const, title: "Bookings happen in the chat", text: "Set your weekly times. The AI offers real open slots and confirms once the booking is saved." },
];

/* ---------------- with / without toggle ---------------- */
const WITHOUT = ["Customers wait until you're free to reply", "Details get lost in long chat histories", "The same questions answered again and again", "Appointments arranged back and forth by hand"];
const WITH = ["Replies in seconds, at any hour", "Every enquiry saved with notes for your team", "Repeat questions handled by the AI", "Open times offered and booked in the chat"];

function BeforeAfter() {
  const [on, setOn] = useState(true);
  const list = on ? WITH : WITHOUT;
  return (
    <div>
      <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label="Compare">
        {[[false, "Without it"], [true, "With it"]].map(([v, l]) => (
          <button key={String(l)} onClick={() => setOn(v as boolean)} aria-pressed={on === v} className={cn("rounded-lg px-5 py-2 font-semibold transition-colors", on === v ? "bg-violet text-white" : "text-muted hover:text-ink")}>{l as string}</button>
        ))}
      </div>
      <ul key={String(on)} className="mt-6 space-y-3">
        {list.map((t, i) => (
          <li key={t} style={{ animationDelay: `${i * 70}ms` }} className="flex animate-[swap-in_0.4s_ease-out_both] items-center gap-3 text-lg">
            <span className={cn("grid size-7 flex-none place-items-center rounded-full text-white", on ? "bg-green" : "bg-[#C9C4DA]")}>{on ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}</span>{t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function LandingPage() {
  usePageTitle("Your WhatsApp number, answered by AI");
  const [tab, setTab] = useState(0);
  const product = PRODUCTS[tab];

  return (
    <PublicLayout>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-24 size-[480px] animate-[blob_14s_ease-in-out_infinite] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, #CFC4F4, transparent 70%)" }} />
        <div className="pointer-events-none absolute -right-24 top-40 size-[420px] animate-[blob_17s_ease-in-out_infinite_reverse] rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, #DFF4E6, transparent 70%)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <h1 className="text-[clamp(2.6rem,6.4vw,4.6rem)] font-extrabold leading-[1]">Your WhatsApp, run by an AI that knows your business.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">Connect your number, teach it what you offer, and let it answer customers, save leads and book appointments. Your team is always one tap away.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="group inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet/25 transition hover:-translate-y-0.5 hover:bg-violet-d"><MessageCircle size={20} /> Start free <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>
              <a href="#tour" className="inline-flex items-center rounded-xl border border-line bg-white px-6 py-3.5 text-lg font-semibold transition hover:-translate-y-0.5 hover:bg-violet-s">See what's inside</a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><ShieldCheck size={16} className="text-green" /> Built on the official WhatsApp Business Platform. We never see your WhatsApp password.</p>
          </div>
          <HeroDemo />
        </div>
      </section>

      <Marquee />

      {/* feature rows */}
      <section className="mx-auto max-w-6xl space-y-24 px-5 py-20">
        <Reveal><h2 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">Everything a busy WhatsApp number needs.</h2></Reveal>
        {ROWS.map((r, i) => (
          <div key={r.kind} className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
            <Reveal><h3 className="text-3xl font-extrabold sm:text-4xl">{r.title}</h3><p className="mt-4 max-w-md text-lg text-muted">{r.text}</p></Reveal>
            <Reveal delay={120}><Visual kind={r.kind} /><p className="mt-2 text-center text-xs text-muted">Example screen for illustration.</p></Reveal>
          </div>
        ))}
      </section>

      {/* with / without */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <Reveal><h2 className="text-4xl font-extrabold sm:text-5xl">Your inbox, before and after.</h2><p className="mt-4 max-w-md text-lg text-muted">Less copy-pasting and chasing, more conversations that end in a booking or a sale.</p></Reveal>
          <Reveal delay={120}><BeforeAfter /></Reveal>
        </div>
      </section>

      {/* tour */}
      <section id="tour" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal><h2 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">One platform. Five things done well.</h2></Reveal>
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Product areas">
          {PRODUCTS.map((p, i) => (
            <button key={p.slug} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={cn("inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition-colors", tab === i ? "border-violet bg-violet text-white" : "border-line bg-white hover:bg-violet-s")}>
              <p.icon size={16} />{p.name}
            </button>
          ))}
        </div>
        <div key={product.slug} className="mt-8 grid animate-[swap-in_0.4s_ease-out_both] items-center gap-10 rounded-3xl border border-line bg-white p-6 sm:p-10 lg:grid-cols-2" role="tabpanel">
          <div>
            <h3 className="text-3xl font-extrabold">{product.headline}</h3>
            <p className="mt-3 text-lg text-muted">{product.intro}</p>
            <ul className="mt-5 space-y-2.5">
              {product.points.slice(0, 3).map(([t]) => <li key={t} className="flex items-center gap-2.5 font-medium"><Check size={18} className="flex-none text-green" />{t}</li>)}
            </ul>
            <Link to={`/product/${product.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-violet hover:underline">Learn more <ArrowRight size={16} /></Link>
          </div>
          <Visual kind={product.visual} />
        </div>
      </section>

      {/* how it works */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal><h2 className="text-4xl font-extrabold sm:text-5xl">Live in three steps.</h2></Reveal>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {[["Connect your number", "Sign in with Facebook and choose your WhatsApp number."], ["Tell it about your business", "Type in your services, prices and FAQs, or upload documents."], ["Test it, then switch it on", "Try real questions in a private test chat. When you're happy, turn it on."]].map(([t, d], i) => (
              <Reveal key={t} delay={i * 120}>
                <li className="list-none">
                  <span className="grid size-11 place-items-center rounded-full bg-violet font-display text-xl font-extrabold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-2xl font-bold">{t}</h3><p className="mt-2 text-muted">{d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* trust */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="grid gap-8 rounded-3xl bg-ink p-8 text-white sm:p-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div><h2 className="text-3xl font-extrabold sm:text-4xl">Built to be trusted with your customers.</h2><Link to="/security" className="mt-5 inline-flex items-center gap-2 font-semibold text-[#CFC4F4] hover:underline">How we protect your data <ArrowRight size={16} /></Link></div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {["Each business's data is kept separate", "WhatsApp access tokens stored encrypted", "Roles control who can do what", "You can test the AI and take over any chat"].map((t) => <li key={t} className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 flex-none text-[#9ED8B0]" />{t}</li>)}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* faq */}
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <Reveal><h2 className="text-4xl font-extrabold">Questions</h2></Reveal>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none text-lg font-semibold marker:hidden">{q}<span className="float-right text-muted transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="relative overflow-hidden bg-violet">
        <div className="pointer-events-none absolute -right-20 -top-20 size-[360px] animate-[blob_15s_ease-in-out_infinite] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)" }} />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-16">
          <h2 className="max-w-xl text-4xl font-extrabold text-white sm:text-5xl">Give your WhatsApp number a team that never sleeps.</h2>
          <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-lg font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-violet-s">Start free <ArrowRight size={18} /></Link>
        </div>
      </section>
    </PublicLayout>
  );
}
