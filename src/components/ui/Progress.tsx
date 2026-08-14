import { clamp, cn } from "@/lib/utils";
import type { Tone } from "./Badge";

/** Circular progress meter — the dashboard's primary "how am I doing" read. */
export function ProgressRing({
  value,
  size = 96,
  thickness = 9,
  tone = "blue",
  label,
  sublabel,
  className,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  thickness?: number;
  tone?: Tone;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const safe = clamp(Math.round(value), 0, 100);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  return (
    <div data-accent={tone} className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${safe} percent`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--tone)"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 700ms var(--ease-out-quint)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: size * 0.26, color: "var(--text-strong)", letterSpacing: "-0.03em" }}
        >
          {label ?? `${safe}%`}
        </span>
        {sublabel ? (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "blue",
  height = 6,
  showValue = false,
  className,
}: {
  value: number;
  tone?: Tone;
  height?: number;
  showValue?: boolean;
  className?: string;
}) {
  const safe = clamp(Math.round(value), 0, 100);

  return (
    <div data-accent={tone} className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative w-full overflow-hidden rounded-full"
        style={{ height, background: "var(--surface-sunken)" }}
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${safe}%`,
            background: "var(--tone)",
            transition: "width 700ms var(--ease-out-quint)",
          }}
        />
      </div>
      {showValue ? (
        <span className="w-9 shrink-0 text-right text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
          {safe}%
        </span>
      ) : null}
    </div>
  );
}

/**
 * Compact bar chart drawn with divs. Used for the 14-day attendance trend and
 * the admin analytics view — no charting library, so it themes natively and
 * costs nothing in bundle size.
 */
export function MiniBars({
  data,
  tone = "blue",
  height = 56,
  formatLabel,
}: {
  data: Array<{ key: string; value: number; max?: number }>;
  tone?: Tone;
  height?: number;
  formatLabel?: (key: string, value: number) => string;
}) {
  const ceiling = Math.max(1, ...data.map((d) => d.max ?? d.value));

  return (
    <div data-accent={tone} className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((point) => {
        const ratio = clamp(point.value / ceiling, 0, 1);
        return (
          <div
            key={point.key}
            className="group relative flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max(ratio * 100, 3)}%`,
              background: ratio > 0 ? "var(--tone)" : "var(--surface-sunken)",
              opacity: 0.35 + ratio * 0.65,
              transition: "height 500ms var(--ease-out-quint)",
            }}
            title={formatLabel ? formatLabel(point.key, point.value) : `${point.key}: ${point.value}`}
          />
        );
      })}
    </div>
  );
}
