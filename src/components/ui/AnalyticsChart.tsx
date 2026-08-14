"use client";

import { useId, useState } from "react";

import { formatDay, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Tone } from "./Badge";

export type Point = { key: string; value: number; max?: number };

/**
 * The portal's analytics bar.
 *
 * A bare row of bars tells you almost nothing — you cannot read a value, see a
 * scale, or judge a day against the norm. This adds the three things that make
 * a chart legible: a labelled Y axis with gridlines, a dashed average baseline,
 * and a hover readout. Still pure SVG, so it themes natively and adds nothing
 * to the bundle.
 */
export function AnalyticsChart({
  data,
  tone = "blue",
  height = 168,
  unit = "",
  /** Draws the dashed mean line. */
  showAverage = true,
  /** Highlights bars at or above this value. */
  target,
  /**
   * When set, the readout shows "value of denominator (n%)". A plain number
   * rather than a formatter function, because this component is rendered from
   * server components and functions cannot cross that boundary.
   */
  denominator,
}: {
  data: Point[];
  tone?: Tone;
  height?: number;
  unit?: string;
  showAverage?: boolean;
  target?: number;
  denominator?: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return null;

  const ceiling = Math.max(1, ...data.map((d) => d.max ?? d.value));
  const average = data.reduce((sum, d) => sum + d.value, 0) / data.length;

  // Four gridlines including zero, rounded to readable steps.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(ceiling * t));
  const plotHeight = height - 22; // leave room for the X labels
  const active = hover !== null ? data[hover] : null;

  return (
    <div data-accent={tone} className="w-full">
      {/* Hover readout — occupies fixed space so the chart never jumps. */}
      <div className="mb-2 flex h-[34px] items-center justify-between gap-3">
        {active ? (
          <div className="animate-fade">
            <p className="text-[16px] font-bold leading-none tabular-nums" style={{ color: "var(--tone)" }}>
              {denominator
                ? `${active.value} of ${denominator} (${Math.round((active.value / denominator) * 100)}%)`
                : `${active.value}${unit}`}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatDay(active.key, "long")}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-[16px] font-bold leading-none tabular-nums" style={{ color: "var(--text-strong)" }}>
              {average.toFixed(1)}
              {unit}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Average across {data.length} days
            </p>
          </div>
        )}

        {target !== undefined ? (
          <span
            className="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
            style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
          >
            Target {target}
            {unit}
          </span>
        ) : null}
      </div>

      <div className="flex gap-2">
        {/* Y axis */}
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[9.5px] font-semibold tabular-nums"
          style={{ height: plotHeight, color: "var(--text-faint)" }}
        >
          {[...ticks].reverse().map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative min-w-0 flex-1" style={{ height: plotHeight }}>
          {/* Gridlines */}
          {ticks.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute inset-x-0 h-px"
              style={{
                bottom: `${(i / (ticks.length - 1)) * 100}%`,
                background: "var(--line-soft)",
                opacity: i === 0 ? 1 : 0.7,
              }}
            />
          ))}

          {/* Average baseline */}
          {showAverage && average > 0 ? (
            <span
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed"
              style={{ bottom: `${(average / ceiling) * 100}%`, borderColor: "var(--tone)", opacity: 0.55 }}
            />
          ) : null}

          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((point, index) => {
              const ratio = Math.min(point.value / ceiling, 1);
              const hit = target !== undefined && point.value >= target;
              const isHover = hover === index;

              return (
                <button
                  key={point.key}
                  type="button"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                  aria-label={`${formatDay(point.key, "medium")}: ${point.value}${unit}`}
                  className={cn(
                    "group relative flex-1 rounded-t-[3px] transition-[opacity,transform] duration-150",
                    "focus-visible:outline-none"
                  )}
                  style={{
                    height: `${Math.max(ratio * 100, 2)}%`,
                    background: point.value === 0 ? "var(--surface-sunken)" : "var(--tone)",
                    opacity: point.value === 0 ? 1 : isHover ? 1 : hit ? 0.95 : 0.42 + ratio * 0.5,
                    transform: isHover ? "scaleY(1.02)" : undefined,
                    transformOrigin: "bottom",
                    boxShadow: isHover ? "0 0 0 1.5px var(--tone)" : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* X axis — first, middle and last, plus weekday initials when it fits. */}
      <div
        className="mt-1.5 flex justify-between pl-6 text-[9.5px] font-semibold"
        style={{ color: "var(--text-faint)" }}
      >
        <span>{formatDay(data[0].key, "short")}</span>
        {data.length > 6 ? (
          <span>{formatDay(data[Math.floor(data.length / 2)].key, "short")}</span>
        ) : null}
        <span>{weekdayShort(data[data.length - 1].key)} · today</span>
      </div>
    </div>
  );
}
