"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/**
 * One component, two shapes: a centred dialog from `sm` up, a bottom sheet on
 * phones. Both share the same focus trap, Escape handling and scroll lock, so
 * every flow in the portal behaves identically on either form factor.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + focus trap.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Focus the first meaningful control once the panel is mounted.
    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button[data-autofocus]'
      );
      target?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      window.clearTimeout(focusTimer);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
    xl: "sm:max-w-5xl",
  }[size];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="animate-fade absolute inset-0"
        style={{ background: "var(--surface-overlay)", backdropFilter: "blur(3px)" }}
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "animate-sheet relative flex max-h-[92vh] w-full flex-col overflow-hidden",
          "rounded-t-[20px] sm:animate-scale-in sm:rounded-[16px]",
          widths
        )}
        style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-pop)" }}
      >
        <span aria-hidden className="brand-thread-bar block h-[3px] w-full shrink-0" />

        {/* Drag affordance — phones only. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full" style={{ background: "var(--line-strong)" }} />
        </div>

        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-[16px] font-semibold leading-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--surface-inset)]"
              style={{ color: "var(--text-muted)" }}
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer ? (
          <footer
            className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+14px)] sm:pb-3.5"
            style={{ borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/** Destructive-action confirmation, so no flow reaches for window.confirm(). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="h-10 rounded-[10px] border px-4 text-[13.5px] font-semibold disabled:opacity-50"
            style={{ borderColor: "var(--line-default)", color: "var(--text-strong)" }}
          >
            Cancel
          </button>
          <button
            data-autofocus
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
            style={{
              background: destructive ? "var(--color-brand-red)" : "var(--color-brand-blue)",
            }}
          >
            {loading ? <Icon name="spinner" className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-default)" }}>
        {message}
      </p>
    </Modal>
  );
}
