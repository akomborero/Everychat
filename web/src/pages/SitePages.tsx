import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Check, Info, Lock } from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { Reveal } from "../components/Reveal";
import { Visual } from "../components/mocks";
import { CONTACT_EMAIL } from "../config";
import { usePageTitle } from "../lib/hooks";
import { FAQ, PLANS, PRODUCTS } from "../site/content";

const primaryBtn = "inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-violet/25 transition hover:-translate-y-0.5 hover:bg-violet-d";

function CtaBand({ title }: { title: string }) {
  return (
    <section className="bg-violet">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-14">
        <h2 className="max-w-xl text-3xl font-extrabold text-white sm:text-4xl">{title}</h2>
        <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-lg font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-violet-s">Start free <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}

/* ---------------- /product/:slug ---------------- */
export function ProductPage() {
  const { slug } = useParams();
  const product = PRODUCTS.find((p) => p.slug === slug);
  usePageTitle(product?.name ?? "Product");
  if (!product) return <Navigate to="/welcome" replace />;
  const others = PRODUCTS.filter((p) => p.slug !== product.slug);

  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-s px-3.5 py-1.5 text-sm font-semibold text-violet-d"><product.icon size={16} />{product.name}</span>
          <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.04]">{product.headline}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{product.intro}</p>
          <Link to="/register" className={`${primaryBtn} mt-7`}>Start free <ArrowRight size={18} /></Link>
        </div>
        <div className="animate-[swap-in_0.5s_ease-out_both]">
          <Visual kind={product.visual} />
          <p className="mt-2 text-center text-xs text-muted">Example screen for illustration.</p>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {product.points.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 2) * 100}>
                <div className="flex gap-4">
                  <span className="mt-1 grid size-7 flex-none place-items-center rounded-full bg-violet-s text-violet"><Check size={16} strokeWidth={3} /></span>
                  <div><h3 className="text-xl font-bold">{t}</h3><p className="mt-1.5 text-muted">{d}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
          {product.note && (
            <Reveal className="mt-12">
              <div className="rounded-2xl bg-amber-s p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold"><Info size={18} />{product.note.title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-6">{product.note.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold">The rest of the platform</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <Link key={p.slug} to={`/product/${p.slug}`} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-1 hover:border-violet">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-s text-violet"><p.icon size={20} /></span>
              <div className="mt-3 font-display text-lg font-bold">{p.name}</div>
              <div className="text-sm text-muted">{p.tagline}</div>
            </Link>
          ))}
        </div>
      </section>
      <CtaBand title="See it working on your own WhatsApp number." />
    </PublicLayout>
  );
}

/* ---------------- /pricing ---------------- */
export function PricingPage() {
  usePageTitle("Pricing");
  return (
    <PublicLayout>
      <section className="mx-auto max-w-4xl px-5 pb-10 pt-14 text-center">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.04]">Simple, honest pricing.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">Here is what goes into the cost of running an AI assistant on WhatsApp, so nothing surprises you.</p>
      </section>

      {PLANS.length > 0 ? (
        <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-3xl border p-7 ${p.highlight ? "border-violet bg-white shadow-xl" : "border-line bg-white"}`}>
              <h2 className="text-2xl font-bold">{p.name}</h2><div className="mt-2 font-display text-4xl font-extrabold">{p.price}</div><p className="mt-2 text-muted">{p.blurb}</p>
              <ul className="mt-5 space-y-2">{p.features.map((f) => <li key={f} className="flex gap-2"><Check size={18} className="mt-0.5 flex-none text-green" />{f}</li>)}</ul>
              <Link to="/register" className={`${primaryBtn} mt-6 w-full justify-center`}>Start free</Link>
            </div>
          ))}
        </section>
      ) : (
        <section className="mx-auto max-w-3xl px-5 pb-12">
          <div className="rounded-3xl border border-line bg-white p-7 sm:p-10">
            <h2 className="text-2xl font-bold">Plans are being finalised</h2>
            <p className="mt-2 text-muted">You can create an account and set everything up now. {CONTACT_EMAIL ? <>Questions about pricing? Email <a className="font-semibold text-violet hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : "Get in touch if you'd like to talk about pricing."}</p>
            <Link to="/register" className={`${primaryBtn} mt-6`}>Start free <ArrowRight size={18} /></Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold">What the cost is made of</h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {[
              ["Our subscription", "The platform itself: the AI assistant, inbox, customer records and bookings."],
              ["WhatsApp message fees", "WhatsApp charges for some business messages under Meta's own pricing. These are billed by Meta to your WhatsApp Business account, not by us."],
              ["AI usage", "Each AI reply uses processing power. We measure it for every business, so usage is visible and predictable."],
            ].map(([t, d]) => <li key={t} className="py-5"><h3 className="text-xl font-bold">{t}</h3><p className="mt-1 text-muted">{d}</p></li>)}
          </ul>
        </Reveal>
        <h2 className="mt-14 text-3xl font-extrabold">Common questions</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {FAQ.slice(4, 6).map(([q, a]) => <details key={q} className="group py-4"><summary className="cursor-pointer list-none text-lg font-semibold marker:hidden">{q}<span className="float-right text-muted transition-transform group-open:rotate-45" aria-hidden>+</span></summary><p className="mt-2 text-muted">{a}</p></details>)}
        </div>
      </section>
      <CtaBand title="Start with a free account and set it up at your own pace." />
    </PublicLayout>
  );
}

/* ---------------- /security ---------------- */
const SECURITY: [string, string][] = [
  ["Your data stays yours, and separate", "Every business's information is kept apart from every other business's. One business can never read, search or be answered from another's data."],
  ["Official WhatsApp connection", "We connect through the official WhatsApp Business Platform. We never ask for or see your WhatsApp password."],
  ["Secrets are encrypted", "Access tokens that Meta issues for your WhatsApp number are stored encrypted. They are never sent to your browser."],
  ["Passwords are never stored as text", "Passwords are stored only as one-way hashes. Reset and confirmation links work once and expire."],
  ["Sessions end when they should", "Changing or resetting your password signs you out of every other device."],
  ["The right access for each person", "Owner, admin, staff and view-only roles decide who can reply, change settings or manage the team. Removing someone ends their access immediately."],
  ["The AI can only do what we allow", "The assistant can take a short list of actions, such as saving a lead or booking a time. Our system validates every action before anything is saved."],
  ["We keep less", "Images, audio and files that customers send are not downloaded or stored. We don't sell personal data and we don't run advertising trackers."],
  ["Support access is limited", "Our operator tools show counts and settings, not your customers' messages."],
];

export function SecurityPage() {
  usePageTitle("Security");
  return (
    <PublicLayout>
      <section className="mx-auto max-w-4xl px-5 pb-8 pt-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-s px-3.5 py-1.5 text-sm font-semibold text-violet-d"><Lock size={16} />Security</span>
        <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.04]">Your customers trust you. We take that seriously.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Here is how we protect your business and customer data, in plain language.</p>
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-12">
        <div className="divide-y divide-line border-y border-line">
          {SECURITY.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 60}>
              <div className="grid gap-2 py-6 md:grid-cols-[1fr_1.5fr] md:gap-10"><h2 className="text-xl font-bold">{t}</h2><p className="text-muted">{d}</p></div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-muted">No system is perfectly secure, so we also encourage a strong, unique password. Read the details in our <Link to="/privacy" className="font-semibold text-violet hover:underline">Privacy Policy</Link>.</p>
      </section>
      <CtaBand title="Ready to try it with your own number?" />
    </PublicLayout>
  );
}

/* ---------------- /contact ---------------- */
export function ContactPage() {
  usePageTitle("Contact");
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.04]">Talk to us.</h1>
        <p className="mt-4 text-lg text-muted">Questions about setting up, pricing or how it handles your data? Send us a message and a person will reply.</p>
        <div className="mt-8 rounded-3xl border border-line bg-white p-7">
          <div className="text-sm font-semibold text-muted">Email</div>
          {CONTACT_EMAIL
            ? <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 block font-display text-2xl font-bold text-violet hover:underline">{CONTACT_EMAIL}</a>
            : <div className="mt-1 rounded bg-red-s px-2 py-1 font-semibold text-red">Set VITE_CONTACT_EMAIL to show your contact address here.</div>}
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-violet">
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link><Link to="/terms" className="hover:underline">Terms of Service</Link><Link to="/data-deletion" className="hover:underline">Delete your data</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
