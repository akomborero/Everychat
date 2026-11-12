import {
  createContext, forwardRef, useCallback, useContext, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-label="Loading" />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};
const variants: Record<"primary" | "ghost" | "danger", string> = {
  primary: "bg-violet text-white hover:bg-violet-d",
  ghost: "border border-line bg-white hover:bg-violet-s",
  danger: "text-red hover:bg-red-s",
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

const fieldBase =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/20 disabled:bg-paper";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(fieldBase, className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 resize-y", className)} {...p} />;
});
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "pr-8", className)} {...p} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red">{error}</span> : hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

const tones = {
  neutral: "bg-[#EEECF4] text-muted",
  violet: "bg-violet-s text-violet-d",
  amber: "bg-amber-s text-[#8A5A00]",
  green: "bg-green-s text-[#146B43]",
  red: "bg-red-s text-red",
};
export type Tone = keyof typeof tones;
export function Pill({ tone = "violet", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Avatar({ text, tone = "violet", className }: { text: string; tone?: "violet" | "amber"; className?: string }) {
  return (
    <span className={cn("grid size-10 flex-none place-items-center rounded-full text-sm font-bold", tone === "amber" ? "bg-amber-s text-[#8A5A00]" : "bg-violet-s text-violet-d", className)}>
      {text}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-12 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1.5 text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-xl bg-red-s px-4 py-3 text-sm text-red">{children}</div>;
}

/* ---------- toasts ---------- */
interface ToastItem { id: number; text: string; tone: "ok" | "error" }
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg", t.tone === "error" ? "bg-red text-white" : "bg-ink text-white")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
