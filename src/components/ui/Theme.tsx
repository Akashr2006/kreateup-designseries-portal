"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { Icon } from "./Icon";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "kup-theme";

const ThemeContext = createContext<{
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode): "light" | "dark" {
  const resolved = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
    setModeState(stored);
    setResolved(applyTheme(stored));

    // Track OS changes while the user is on "system".
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as ThemeMode | null) === "dark") return;
      if ((localStorage.getItem(STORAGE_KEY) as ThemeMode | null) === "light") return;
      setResolved(applyTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    setResolved(applyTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

/**
 * Blocking script injected into <head>: applies the stored theme before the
 * first paint so there is no white flash on a dark-mode reload.
 */
export const themeBootScript = `(function(){try{var m=localStorage.getItem("${STORAGE_KEY}")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolved, setMode } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => setMode(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={
        compact
          ? "grid h-9 w-9 place-items-center rounded-[10px] transition-colors hover:bg-[var(--surface-inset)]"
          : "flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-semibold transition-colors hover:bg-[var(--surface-inset)]"
      }
      style={{ color: "var(--text-muted)" }}
    >
      <Icon name={resolved === "dark" ? "sun" : "moon"} className="h-[17px] w-[17px]" />
      {compact ? null : <span className="capitalize">{next} mode</span>}
    </button>
  );
}
