// Time zone helpers without extra libraries. Slot times are stored as local "HH:MM" in the
// business's zone and converted to real UTC instants here.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const weekdayName = (dow: number) => WEEKDAYS[dow];

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];

export const dayOfWeekOf = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const addDays = (date: string, n: number) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** The calendar date ("YYYY-MM-DD") of an instant in the given time zone. */
export const localDateOf = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function offsetMinutes(tz: string, at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-10-10" + "10:00" in tz -> the UTC instant. */
export function localToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = parts(date);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMinutes(tz, new Date(guess));
  let utc = guess - off1 * 60000;
  const off2 = offsetMinutes(tz, new Date(utc));
  if (off2 !== off1) utc = guess - off2 * 60000; // across a daylight saving change
  return new Date(utc);
}

export const formatLocal = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

export const formatNow = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, dateStyle: "full", timeStyle: "short", hourCycle: "h23" }).format(new Date());

export const isValidTimeZone = (tz: string) => {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
};
