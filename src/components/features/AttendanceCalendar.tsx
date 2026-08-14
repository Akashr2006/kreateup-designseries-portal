"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { daysInMonth, formatDay, fromDayKey, monthLabel, startOfMonth, toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type CalendarDay = {
  date: string;
  hours: number[];
  reason: string;
  status: string;
};

/**
 * Month calendar with a per-day fill.
 *
 * The fill is proportional, not binary: a day where five of seven hours were
 * logged reads differently from a full day, which is the distinction that
 * actually matters when a student is chasing a percentage.
 */
export function AttendanceCalendar({
  days,
  monthKey,
  onChangeMonth,
}: {
  days: CalendarDay[];
  monthKey: string;
  onChangeMonth: (next: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const first = startOfMonth(monthKey);
  const leadingBlanks = (fromDayKey(first).getDay() + 6) % 7; // Monday-first grid
  const total = daysInMonth(monthKey);
  const today = toDayKey();

  const shift = (delta: number) => {
    const [y, m] = monthKey.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    onChangeMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`);
    setSelected(null);
  };

  const detail = selected ? byDate.get(selected) : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-[9px] transition-colors hover:bg-[var(--surface-inset)]"
          style={{ color: "var(--text-muted)" }}
        >
          <Icon name="chevron-left" className="h-4 w-4" />
        </button>
        <p className="text-[13.5px] font-semibold">{monthLabel(monthKey)}</p>
        <button
          onClick={() => shift(1)}
          disabled={monthKey.slice(0, 7) >= today.slice(0, 7)}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-[9px] transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-30"
          style={{ color: "var(--text-muted)" }}
        >
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--text-faint)" }}
          >
            {label.slice(0, 1)}
            <span className="hidden sm:inline">{label.slice(1)}</span>
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: total }, (_, i) => {
          const day = `${monthKey.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
          const entry = byDate.get(day);
          const count = entry?.hours.length ?? 0;
          const ratio = count / ATTENDANCE_HOURS.length;
          const isFuture = day > today;
          const isToday = day === today;
          const isSunday = fromDayKey(day).getDay() === 0;

          const tone = count === 0 ? "slate" : ratio >= 1 ? "green" : ratio >= 0.5 ? "amber" : "red";

          return (
            <button
              key={day}
              data-accent={tone}
              onClick={() => setSelected(selected === day ? null : day)}
              disabled={isFuture}
              aria-label={`${formatDay(day, "medium")}: ${count} of ${ATTENDANCE_HOURS.length} hours`}
              className={cn(
                "relative aspect-square rounded-[9px] border text-[12px] font-semibold tabular-nums transition-transform",
                !isFuture && "hover:-translate-y-0.5",
                isFuture && "cursor-default opacity-35"
              )}
              style={{
                borderColor: selected === day ? "var(--tone)" : isToday ? "var(--accent)" : "var(--line-soft)",
                borderWidth: selected === day || isToday ? 2 : 1,
                background:
                  count > 0
                    ? `color-mix(in srgb, var(--tone) ${18 + ratio * 26}%, var(--surface-raised))`
                    : isSunday
                      ? "var(--surface-sunken)"
                      : "var(--surface-raised)",
                color: count > 0 ? "var(--tone)" : "var(--text-faint)",
              }}
            >
              {i + 1}
              {count > 0 ? (
                <span
                  className="absolute inset-x-1.5 bottom-1 h-[2.5px] rounded-full"
                  style={{ background: "var(--tone)", opacity: 0.35 + ratio * 0.65 }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10.5px]" style={{ color: "var(--text-faint)" }}>
        <LegendDot tone="green" label="Full day" />
        <LegendDot tone="amber" label="Partial" />
        <LegendDot tone="red" label="Under half" />
        <LegendDot tone="slate" label="No record" />
      </div>

      {/* Selected-day detail */}
      {detail ? (
        <div className="animate-scale-in mt-4 inset-panel p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                {formatDay(detail.date, "long")}
              </p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {detail.hours.length} of {ATTENDANCE_HOURS.length} hours logged
              </p>
            </div>
            <Badge tone={detail.hours.length >= ATTENDANCE_HOURS.length ? "green" : detail.hours.length > 0 ? "amber" : "slate"}>
              {detail.hours.length >= ATTENDANCE_HOURS.length
                ? "Full day"
                : detail.hours.length > 0
                  ? "Partial"
                  : "Absent"}
            </Badge>
          </div>

          {detail.hours.length > 0 ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ATTENDANCE_HOURS.map((hour) => {
                  const present = detail.hours.includes(hour);
                  return (
                    <span
                      key={hour}
                      data-accent={present ? "green" : "slate"}
                      title={HOUR_WINDOW[hour]}
                      className="rounded-[7px] px-2 py-1 text-[10.5px] font-bold tabular-nums"
                      style={{
                        background: present ? "var(--tone-soft)" : "var(--surface-sunken)",
                        color: present ? "var(--tone)" : "var(--text-faint)",
                      }}
                    >
                      H{hour}
                    </span>
                  );
                })}
              </div>
              {detail.reason ? (
                <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--text-default)" }}>
                  “{detail.reason}”
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Nothing was logged on this day.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({ tone, label }: { tone: "green" | "amber" | "red" | "slate"; label: string }) {
  return (
    <span data-accent={tone} className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--tone)" }} />
      {label}
    </span>
  );
}
