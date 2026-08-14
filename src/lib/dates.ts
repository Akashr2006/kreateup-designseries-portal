/**
 * Date helpers.
 *
 * Every date the portal stores is an ISO calendar day string (`YYYY-MM-DD`)
 * derived from the *local* clock. Storing Date objects would make "did this
 * student check in today?" depend on the server's timezone, which is exactly
 * the class of bug the legacy sheet-based portal suffered from.
 */

export function toDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

export function isWeekend(key: string): boolean {
  const day = fromDayKey(key).getDay();
  return day === 0 || day === 6;
}

/** Monday-anchored week start for the given day. */
export function startOfWeek(key: string): string {
  const date = fromDayKey(key);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return toDayKey(date);
}

export function endOfWeek(key: string): string {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return toDayKey(new Date(y, m, 0));
}

/** Inclusive list of day keys between two days. */
export function rangeOfDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 1000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

/** Last `n` days ending today, oldest first. */
export function lastNDays(n: number, endKey: string = toDayKey()): string[] {
  return rangeOfDays(addDays(endKey, -(n - 1)), endKey);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDay(key: string, style: "short" | "long" | "medium" = "medium"): string {
  if (!key) return "—";
  const date = fromDayKey(key);
  const month = MONTHS[date.getMonth()] ?? "";
  if (style === "short") return `${date.getDate()} ${month.slice(0, 3)}`;
  if (style === "long") {
    return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${month} ${date.getFullYear()}`;
  }
  return `${date.getDate()} ${month.slice(0, 3)} ${date.getFullYear()}`;
}

export function monthLabel(key: string): string {
  const date = fromDayKey(key);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function weekdayShort(key: string): string {
  return (WEEKDAYS[fromDayKey(key).getDay()] ?? "").slice(0, 3);
}

export function minutesSinceMidnight(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function relativeTime(value: Date | string): string {
  const then = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - then.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDay(toDayKey(then), "medium");
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
