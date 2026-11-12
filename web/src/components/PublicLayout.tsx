import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { BRAND_NAME, COMPANY_NAME } from "../config";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";
import { PRODUCTS } from "../site/content";
import { Logo } from "./Shell";

const btn = "inline-flex items-center rounded-xl px-4 py-2 font-semibold transition-colors";
const navLink = ({ isActive }: { isActive: boolean }) => cn("rounded-lg px-3 py-2 font-medium hover:bg-violet-s", isActive && "text-violet");

export function PublicLayout({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState<"product" | "mobile" | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMenu(null), [pathname]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("keydown", onKey); window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onScroll); };
  }, []);

  const cta = me ? (
    <Link to="/" className={`${btn} bg-violet text-white hover:bg-violet-d`}>Open dashboard</Link>
  ) : (
    <>
      <Link to="/login" className={`${btn} hover:bg-violet-s`}>Sign in</Link>
      <Link to="/register" className={`${btn} bg-violet text-white hover:bg-violet-d`}>Start free</Link>
    </>
  );

  return (
    <div className="min-h-dvh bg-paper">
      <header className={cn("sticky top-0 z-40 border-b transition-colors", scrolled ? "border-line bg-paper/85 backdrop-blur-lg" : "border-transparent bg-paper")}>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-3">
          <Link to="/welcome" aria-label={`${BRAND_NAME} home`} className="mr-4"><Logo /></Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            <div className="relative">
              <button onClick={() => setMenu(menu === "product" ? null : "product")} aria-expanded={menu === "product"} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-medium hover:bg-violet-s">
                Product <ChevronDown size={16} className={cn("transition-transform", menu === "product" && "rotate-180")} />
              </button>
              {menu === "product" && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenu(null)} />
                  <div className="absolute left-0 top-full z-20 mt-2 w-[460px] animate-[pop_0.18s_ease-out] rounded-2xl border border-line bg-white p-2 shadow-xl">
                    {PRODUCTS.map((p) => (
                      <Link key={p.slug} to={`/product/${p.slug}`} className="flex items-start gap-3 rounded-xl p-3 hover:bg-violet-s">
                        <span className="grid size-9 flex-none place-items-center rounded-lg bg-violet-s text-violet"><p.icon size={18} /></span>
                        <span><span className="block font-semibold">{p.name}</span><span className="block text-sm text-muted">{p.tagline}</span></span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
            <NavLink to="/pricing" className={navLink}>Pricing</NavLink>
            <NavLink to="/security" className={navLink}>Security</NavLink>
            <NavLink to="/contact" className={navLink}>Contact</NavLink>
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">{cta}</div>
          <button className="ml-auto rounded-lg p-2 lg:hidden" aria-label={menu === "mobile" ? "Close menu" : "Open menu"} aria-expanded={menu === "mobile"} onClick={() => setMenu(menu === "mobile" ? null : "mobile")}>
            {menu === "mobile" ? <X /> : <Menu />}
          </button>
        </div>

        {menu === "mobile" && (
          <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-paper px-5 pb-6 pt-3 lg:hidden">
            <div className="mb-1 text-sm font-semibold text-muted">Product</div>
            {PRODUCTS.map((p) => (
              <Link key={p.slug} to={`/product/${p.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5"><p.icon size={18} className="text-violet" />{p.name}</Link>
            ))}
            <div className="my-2 border-t border-line" />
            {[["/pricing", "Pricing"], ["/security", "Security"], ["/contact", "Contact"]].map(([to, l]) => <Link key={to} to={to} className="block rounded-xl px-2 py-2.5">{l}</Link>)}
            <div className="mt-4 flex gap-2">{cta}</div>
          </div>
        )}
      </header>

      {children}

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">Turn your WhatsApp number into an AI-powered team that answers, saves leads and books appointments.</p>
          </div>
          <FooterCol title="Product" links={PRODUCTS.map((p) => [`/product/${p.slug}`, p.name])} />
          <FooterCol title="Company" links={[["/pricing", "Pricing"], ["/security", "Security"], ["/contact", "Contact"], ["/login", "Sign in"]]} />
          <FooterCol title="Legal" links={[["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"], ["/data-deletion", "Delete your data"]]} />
        </div>
        <div className="border-t border-line"><div className="mx-auto max-w-6xl px-5 py-5 text-sm text-muted">© {new Date().getFullYear()} {COMPANY_NAME}</div></div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[][] }) {
  return (
    <nav aria-label={title}>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <ul className="space-y-2 text-sm text-muted">{links.map(([to, l]) => <li key={to}><Link to={to} className="hover:text-ink">{l}</Link></li>)}</ul>
    </nav>
  );
}
