"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Icon, type IconName } from "./Icon";
import type { Tone } from "./Badge";

type ToastKind = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

const KIND_META: Record<ToastKind, { tone: Tone; icon: IconName }> = {
  success: { tone: "green", icon: "check-circle" },
  error: { tone: "red", icon: "alert" },
  warning: { tone: "amber", icon: "alert" },
  info: { tone: "blue", icon: "info" },
};

type ToastApi = {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ kind: "success", title, description }),
      error: (title, description) => push({ kind: "error", title, description }),
      info: (title, description) => push({ kind: "info", title, description }),
      warning: (title, description) => push({ kind: "warning", title, description }),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] sm:bottom-4 sm:right-4 sm:left-auto sm:items-end sm:px-0 sm:pb-0 sm:pr-4"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const meta = KIND_META[toast.kind];

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.kind === "error" ? 7000 : 4500);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.kind]);

  return (
    <div
      data-accent={meta.tone}
      role="status"
      aria-live="polite"
      className="animate-scale-in pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[12px] border p-3.5 shadow-[var(--shadow-pop)]"
      style={{ background: "var(--surface-raised)", borderColor: "var(--line-default)" }}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
      >
        <Icon name={meta.icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
          {toast.title}
        </p>
        {toast.description ? (
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--surface-inset)]"
        style={{ color: "var(--text-faint)" }}
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
