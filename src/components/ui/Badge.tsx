import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

export type Tone = "blue" | "red" | "amber" | "green" | "slate";

/**
 * Colour carries meaning across the whole portal:
 *   green = confirmed / done      amber = pending / waiting
 *   red   = needs attention       blue  = informational / in progress
 */
export const STATUS_TONE: Record<string, Tone> = {
  // Attendance
  PRESENT: "green",
  LATE: "amber",
  EXCUSED: "blue",
  ABSENT: "red",
  // Worklog
  SUBMITTED: "blue",
  REVIEWED: "green",
  FLAGGED: "red",
  // Tasks
  TODO: "slate",
  IN_PROGRESS: "blue",
  DONE: "green",
  BLOCKED: "red",
  // Passes
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
  // Priority
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
  // Account
  ACTIVE: "green",
  SUSPENDED: "red",
  // Notification categories
  GENERAL: "blue",
  URGENT: "red",
  EVENT: "green",
  DEADLINE: "amber",
  RESULT: "blue",
  // Roles
  STUDENT: "blue",
  MENTOR: "amber",
  ADMIN: "green",
  SUPER_ADMIN: "red",
};

export function toneFor(value: string): Tone {
  return STATUS_TONE[value] ?? "slate";
}

export function Badge({
  children,
  tone = "slate",
  icon,
  solid = false,
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
  solid?: boolean;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      data-accent={tone}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px]",
        "text-[11px] font-semibold leading-[1.45] tracking-[0.01em]",
        className
      )}
      style={
        solid
          ? { background: "var(--tone)", color: "#fff" }
          : {
              background: "var(--tone-soft)",
              color: "var(--tone)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--tone) 22%, transparent)",
            }
      }
    >
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: solid ? "#fff" : "var(--tone)" }} />
      ) : null}
      {icon ? <Icon name={icon} className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

/** Badge that derives its colour from a status string. */
export function StatusBadge({
  status,
  label,
  solid = false,
  className,
}: {
  status: string;
  label?: string;
  solid?: boolean;
  className?: string;
}) {
  const text = label ?? status.replace(/_/g, " ").toLowerCase();
  return (
    <Badge tone={toneFor(status)} solid={solid} dot className={cn("capitalize", className)}>
      {text}
    </Badge>
  );
}

/** Small square counter used on nav items and tabs. */
export function Counter({ value, tone = "blue" }: { value: number; tone?: Tone }) {
  if (!value) return null;
  return (
    <span
      data-accent={tone}
      className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-bold tabular-nums"
      style={{ background: "var(--tone)", color: "#fff" }}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}
