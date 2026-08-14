import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/**
 * Empty states use a geometric SVG figure drawn inline — deliberately not an
 * illustration asset, so it themes correctly and adds nothing to the bundle.
 */
function EmptyFigure({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 120 84" className="h-[84px] w-[120px]" aria-hidden>
      <rect x="14" y="16" width="92" height="58" rx="9" fill="var(--surface-inset)" stroke="var(--line-default)" />
      <rect x="26" y="30" width="46" height="6" rx="3" fill="var(--line-default)" />
      <rect x="26" y="42" width="68" height="5" rx="2.5" fill="var(--line-soft)" />
      <rect x="26" y="53" width="34" height="5" rx="2.5" fill="var(--line-soft)" />
      <circle cx="94" cy="22" r="12" fill="var(--surface-raised)" stroke={tone} strokeWidth="2" />
      <path d="M89.5 22h9M94 17.5v9" stroke={tone} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = "blue",
  compact = false,
  className,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
  tone?: "blue" | "red" | "amber" | "green" | "slate";
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      data-accent={tone}
      className={cn(
        "flex flex-col items-center justify-center rounded-[14px] border border-dashed text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
        className
      )}
      style={{ borderColor: "var(--line-default)", background: "var(--surface-inset)" }}
    >
      {compact ? (
        icon ? (
          <span
            className="mb-3 grid h-11 w-11 place-items-center rounded-full"
            style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
          >
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null
      ) : (
        <div className="mb-4">
          <EmptyFigure tone="var(--tone)" />
        </div>
      )}

      <h3 className="text-[14.5px] font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Inline "nothing here" row for tables. */
export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        {message}
      </td>
    </tr>
  );
}
