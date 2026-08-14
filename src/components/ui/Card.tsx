import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

export function Card({
  children,
  className,
  padded = true,
  thread = false,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Caps the card with the four-colour brand rule. Reserve for hero surfaces. */
  thread?: boolean;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag className={cn("surface overflow-hidden", className)}>
      {thread ? <span aria-hidden className="brand-thread-bar block h-[3px] w-full" /> : null}
      <div className={cn(padded && "p-4 sm:p-5")}>{children}</div>
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
            style={{ background: "var(--surface-inset)", color: "var(--text-muted)" }}
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Section divider used inside long forms and detail panels. */
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) {
    return <hr className={cn("my-4 border-0 border-t", className)} style={{ borderColor: "var(--line-soft)" }} />;
  }
  return (
    <div className={cn("my-5 flex items-center gap-3", className)}>
      <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} />
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: "var(--line-soft)" }} />
    </div>
  );
}

/** Label/value row used across profile and detail views. */
export function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4"
      style={{ borderColor: "var(--line-soft)" }}
    >
      <dt
        className="shrink-0 text-[11.5px] font-medium uppercase tracking-[0.06em] sm:w-44"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </dt>
      <dd
        className={cn("min-w-0 break-words text-[13.5px]", mono && "font-mono text-[12.5px]")}
        style={{ color: "var(--text-strong)" }}
      >
        {value || <span style={{ color: "var(--text-faint)" }}>Not provided</span>}
      </dd>
    </div>
  );
}
