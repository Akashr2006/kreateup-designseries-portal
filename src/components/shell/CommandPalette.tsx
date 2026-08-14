"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

type PersonHit = {
  id: string;
  name: string;
  rollNo: string;
  domain: string;
  role: string;
};

/**
 * ⌘K / Ctrl-K palette. Searches navigation locally and people over the API
 * (debounced, and only for users whose role can look people up).
 */
export function CommandPalette({
  open,
  onClose,
  navItems,
  canSearchPeople,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  canSearchPeople: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const navHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems.slice(0, 7);
    return navItems
      .filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, navItems]);

  const results = useMemo(
    () => [
      ...navHits.map((item) => ({ kind: "nav" as const, item })),
      ...people.map((person) => ({ kind: "person" as const, person })),
    ],
    [navHits, people]
  );

  // Reset each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPeople([]);
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Debounced people lookup.
  useEffect(() => {
    if (!open || !canSearchPeople) return;
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const payload = await response.json();
        if (!cancelled && payload.ok) setPeople(payload.data.people ?? []);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, canSearchPeople]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  const go = (index: number) => {
    const hit = results[index];
    if (!hit) return;
    onClose();
    router.push(hit.kind === "nav" ? hit.item.href : `/console/people/${hit.person.id}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(cursor);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="animate-fade absolute inset-0"
        style={{ background: "var(--surface-overlay)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-scale-in relative w-full max-w-xl overflow-hidden rounded-[16px]"
        style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-pop)" }}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden className="brand-thread-bar block h-[3px] w-full" />

        <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
          <Icon name="search" className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--text-faint)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canSearchPeople ? "Jump to a page or find a student…" : "Jump to a page…"}
            className="w-full bg-transparent text-[14.5px] outline-none"
            style={{ color: "var(--text-strong)" }}
            aria-label="Search"
          />
          {loading ? <Icon name="spinner" className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--text-faint)" }} /> : null}
          <kbd
            className="hidden shrink-0 rounded-[6px] border px-1.5 py-0.5 text-[10.5px] font-semibold sm:block"
            style={{ borderColor: "var(--line-default)", color: "var(--text-faint)" }}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
              Nothing matches “{query}”.
            </p>
          ) : (
            <>
              {navHits.length > 0 ? <PaletteLabel>Pages</PaletteLabel> : null}
              {results.map((hit, index) => {
                const active = index === cursor;
                if (hit.kind === "nav") {
                  return (
                    <button
                      key={`nav-${hit.item.href}`}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(index)}
                      className={cn("flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left")}
                      style={{ background: active ? "var(--accent-soft)" : "transparent" }}
                    >
                      <Icon
                        name={hit.item.icon}
                        className="h-[17px] w-[17px] shrink-0"
                        style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {hit.item.label}
                        </span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {hit.item.description}
                        </span>
                      </span>
                      {active ? (
                        <Icon name="arrow-right" className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                      ) : null}
                    </button>
                  );
                }

                const isFirstPerson = results.findIndex((r) => r.kind === "person") === index;
                return (
                  <div key={`person-${hit.person.id}`}>
                    {isFirstPerson ? <PaletteLabel>People</PaletteLabel> : null}
                    <button
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(index)}
                      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left"
                      style={{ background: active ? "var(--accent-soft)" : "transparent" }}
                    >
                      <Avatar name={hit.person.name} seed={hit.person.id} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {hit.person.name}
                        </span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {hit.person.rollNo} · {hit.person.domain}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div
          className="hidden items-center gap-4 border-t px-4 py-2 text-[11px] sm:flex"
          style={{ borderColor: "var(--line-soft)", color: "var(--text-faint)" }}
        >
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}

function PaletteLabel({ children }: { children: string }) {
  return (
    <p
      className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="rounded-[5px] border px-1 py-px text-[10px] font-semibold"
      style={{ borderColor: "var(--line-default)" }}
    >
      {children}
    </kbd>
  );
}
