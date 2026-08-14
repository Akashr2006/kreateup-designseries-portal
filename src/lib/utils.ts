/** Tiny className joiner — avoids pulling in clsx for what is a one-liner. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "PRAVEEN KUMAR K A" -> "PK" */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Title-cases the SHOUTED names and departments coming from the roster. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .trim();
}

/** Shortens "2024-2028 - III[Byts-B]" to "III · Byts-B". */
export function shortYear(year: string): string {
  const match = year.match(/-\s*([IVX]+)\s*\[?([^\]]*)\]?/);
  if (!match) return year.trim();
  const [, roman, batch] = match;
  return batch ? `${roman} · ${batch}` : roman;
}

/** Deterministic 0-3 bucket used to pick one of the four brand accents. */
export function accentIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 4;
}

export const ACCENT_KEYS = ["blue", "red", "amber", "green"] as const;
export type AccentKey = (typeof ACCENT_KEYS)[number];

export function accentFor(seed: string): AccentKey {
  return ACCENT_KEYS[accentIndex(seed)];
}

export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Serialises rows to CSV with proper quoting. Used by every export button. */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (cell: string | number | null | undefined) => {
    const text = cell === null || cell === undefined ? "" : String(cell);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\r\n");
}

/** Human-readable pass code, e.g. "KUP-7F3A-2K9L". */
export function generatePassCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `KUP-${block()}-${block()}`;
}

export function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
