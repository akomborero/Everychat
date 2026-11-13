"use strict";
// Pure helpers for the analytics screen, kept free of database code so they can be tested.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratio = void 0;
exports.firstResponseMs = firstResponseMs;
exports.median = median;
exports.topCounts = topCounts;
exports.bucketByDay = bucketByDay;
exports.groupQuestions = groupQuestions;
/** Time from the customer's first message to the first reply (AI or staff) after it. */
function firstResponseMs(messages) {
    const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const first = sorted.find((m) => m.sender === "CUSTOMER");
    if (!first)
        return null;
    const reply = sorted.find((m) => (m.sender === "AI" || m.sender === "STAFF") && m.createdAt.getTime() > first.createdAt.getTime());
    return reply ? reply.createdAt.getTime() - first.createdAt.getTime() : null;
}
function median(nums) {
    if (!nums.length)
        return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
/** a / b, or null when there is nothing to divide by (so the screen can show a dash instead of 0%). */
const ratio = (a, b) => (b === 0 ? null : a / b);
exports.ratio = ratio;
const norm = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
/** The most common values, grouping "Standard package" and "standard  package" together. */
function topCounts(values, n) {
    const groups = new Map();
    for (const v of values) {
        if (!v || !norm(v))
            continue;
        const k = norm(v);
        const g = groups.get(k);
        if (g)
            g.count++;
        else
            groups.set(k, { value: v.trim().replace(/\s+/g, " "), count: 1 });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, n);
}
/** Counts dates into the given day labels, using `toDay` to turn an instant into a label (for example in the business's time zone). */
function bucketByDay(dates, days, toDay) {
    const index = new Map(days.map((d, i) => [d, i]));
    const out = new Array(days.length).fill(0);
    for (const d of dates) {
        const i = index.get(toDay(d));
        if (i !== undefined)
            out[i]++;
    }
    return out;
}
/** Groups repeated questions so the owner sees "asked 5 times" once instead of five rows. */
function groupQuestions(rows) {
    const groups = new Map();
    for (const r of rows) {
        const key = norm(r.question);
        if (!key)
            continue;
        const g = groups.get(key);
        if (g) {
            g.count++;
            g.ids.push(r.id);
            if (r.createdAt > g.lastAt)
                g.lastAt = r.createdAt;
        }
        else
            groups.set(key, { key, question: r.question.trim().replace(/\s+/g, " "), count: 1, ids: [r.id], lastAt: r.createdAt });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime());
}
