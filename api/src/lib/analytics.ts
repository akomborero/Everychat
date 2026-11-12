// Pure helpers for the analytics screen, kept free of database code so they can be tested.

export interface Msg { sender: string; createdAt: Date }

/** Time from the customer's first message to the first reply (AI or staff) after it. */
export function firstResponseMs(messages: Msg[]): number | null {
  const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = sorted.find((m) => m.sender === "CUSTOMER");
  if (!first) return null;
  const reply = sorted.find((m) => (m.sender === "AI" || m.sender === "STAFF") && m.createdAt.getTime() > first.createdAt.getTime());
  return reply ? reply.createdAt.getTime() - first.createdAt.getTime() : null;
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** a / b, or null when there is nothing to divide by (so the screen can show a dash instead of 0%). */
export const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** The most common values, grouping "Standard package" and "standard  package" together. */
export function topCounts(values: (string | null | undefined)[], n: number): { value: string; count: number }[] {
  const groups = new Map<string, { value: string; count: number }>();
  for (const v of values) {
    if (!v || !norm(v)) continue;
    const k = norm(v);
    const g = groups.get(k);
    if (g) g.count++; else groups.set(k, { value: v.trim().replace(/\s+/g, " "), count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, n);
}

/** Counts dates into the given day labels, using `toDay` to turn an instant into a label (for example in the business's time zone). */
export function bucketByDay(dates: Date[], days: string[], toDay: (d: Date) => string): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = new Array<number>(days.length).fill(0);
  for (const d of dates) { const i = index.get(toDay(d)); if (i !== undefined) out[i]++; }
  return out;
}

export interface GapRow { id: string; question: string; createdAt: Date }
export interface GapGroup { key: string; question: string; count: number; ids: string[]; lastAt: Date }

/** Groups repeated questions so the owner sees "asked 5 times" once instead of five rows. */
export function groupQuestions(rows: GapRow[]): GapGroup[] {
  const groups = new Map<string, GapGroup>();
  for (const r of rows) {
    const key = norm(r.question);
    if (!key) continue;
    const g = groups.get(key);
    if (g) { g.count++; g.ids.push(r.id); if (r.createdAt > g.lastAt) g.lastAt = r.createdAt; }
    else groups.set(key, { key, question: r.question.trim().replace(/\s+/g, " "), count: 1, ids: [r.id], lastAt: r.createdAt });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime());
}
