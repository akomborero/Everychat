export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const whenLocal = (iso: string, tz: string) =>
  new Date(iso).toLocaleString(undefined, { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const displayName = (c: { name: string | null; phone: string }) => c.name || c.phone;

export const initials = (s: string) =>
  s.replace(/^\+/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

export function formatPrice(price: string, currency: string) {
  const n = Number(price);
  const num = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency === "USD" ? `$${num}` : `${currency} ${num}`;
}
