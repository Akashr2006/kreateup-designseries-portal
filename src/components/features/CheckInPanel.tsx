"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * The check-in control.
 *
 * Hours already logged render as locked and confirmed; the rest are selectable.
 * The whole panel goes into a "day complete" state once all seven are in, which
 * is the single clearest signal a student can get that they are done.
 */
export function CheckInPanel({
  date,
  loggedHours,
  closed,
  compact = false,
}: {
  date: string;
  loggedHours: number[];
  /** True once the 23:30 cutoff has passed. */
  closed: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const logged = useMemo(() => new Set(loggedHours), [loggedHours]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = ATTENDANCE_HOURS.filter((h) => !logged.has(h));
  const complete = remaining.length === 0;

  const toggle = (hour: number) => {
    if (logged.has(hour) || closed) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const selectAllRemaining = () => setSelected(new Set(remaining));

  const submit = async () => {
    if (selected.size === 0) {
      toast.warning("Pick at least one hour", "Tap the hours you were present for.");
      return;
    }
    if (reason.trim().length < 4) {
      toast.warning("Add a short description", "One line on what you worked on is enough.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours: [...selected], reason: reason.trim() }),
      });
      const payload = await response.json();

      if (!payload.ok) {
        toast.error("Could not record your check-in", payload.error);
        setSaving(false);
        return;
      }

      const count = payload.data.recorded.length as number;
      toast.success(
        `${count} ${count === 1 ? "hour" : "hours"} recorded`,
        payload.data.totalHours >= ATTENDANCE_HOURS.length
          ? "That is a full day. Nice work."
          : `${ATTENDANCE_HOURS.length - payload.data.totalHours} still open today.`
      );

      setSelected(new Set());
      setReason("");
      router.refresh();
    } catch {
      toast.error("Network problem", "Your check-in was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* --- Status line ------------------------------------------------- */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {complete ? (
          <Badge tone="green" icon="check-circle">
            Day complete — all {ATTENDANCE_HOURS.length} hours logged
          </Badge>
        ) : closed ? (
          <Badge tone="red" icon="clock">
            Check-in closed for today
          </Badge>
        ) : (
          <>
            <Badge tone={logged.size > 0 ? "amber" : "blue"} icon="clock">
              {logged.size} of {ATTENDANCE_HOURS.length} hours logged
            </Badge>
            {remaining.length > 0 && selected.size === 0 ? (
              <button
                onClick={selectAllRemaining}
                className="text-[12px] font-semibold underline underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                Select all remaining
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* --- Hour grid ---------------------------------------------------- */}
      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-4 sm:grid-cols-7"
        )}
      >
        {ATTENDANCE_HOURS.map((hour) => {
          const isLogged = logged.has(hour);
          const isSelected = selected.has(hour);
          const tone = isLogged ? "green" : isSelected ? "blue" : "slate";

          return (
            <button
              key={hour}
              type="button"
              data-accent={tone}
              onClick={() => toggle(hour)}
              disabled={isLogged || closed}
              aria-pressed={isSelected}
              title={`Hour ${hour} · ${HOUR_WINDOW[hour]}`}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-0.5 rounded-[12px] border py-2.5",
                "transition-[transform,border-color,background] duration-150",
                !isLogged && !closed && "hover:-translate-y-0.5 active:translate-y-0",
                (isLogged || closed) && "cursor-default"
              )}
              style={{
                borderColor: isLogged || isSelected ? "var(--tone)" : "var(--line-default)",
                background: isLogged || isSelected ? "var(--tone-soft)" : "var(--surface-raised)",
                opacity: closed && !isLogged ? 0.55 : 1,
              }}
            >
              {isLogged ? (
                <Icon name="check" className="h-4 w-4" style={{ color: "var(--tone)" }} />
              ) : (
                <span
                  className="text-[17px] font-bold leading-none tabular-nums"
                  style={{ color: isSelected ? "var(--tone)" : "var(--text-strong)" }}
                >
                  {hour}
                </span>
              )}
              <span
                className="text-[9.5px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: isLogged || isSelected ? "var(--tone)" : "var(--text-faint)" }}
              >
                {isLogged ? "Done" : `Hr ${hour}`}
              </span>
              <span className="mt-0.5 hidden text-[9px] tabular-nums sm:block" style={{ color: "var(--text-faint)" }}>
                {HOUR_WINDOW[hour].split(" – ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* --- Reason + submit ---------------------------------------------- */}
      {!complete && !closed ? (
        <div className="mt-4">
          <Field
            label="What did you work on?"
            htmlFor="checkin-reason"
            required
            help="One line is enough. This is what your mentor sees next to the hours."
          >
            <Textarea
              id="checkin-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Built the ticket detail route and fixed the redirect loop on session expiry."
              maxLength={400}
              rows={compact ? 2 : 3}
            />
          </Field>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              {selected.size > 0
                ? `Recording ${selected.size} ${selected.size === 1 ? "hour" : "hours"}: ${[...selected]
                    .sort((a, b) => a - b)
                    .join(", ")}`
                : "Tap the hours you attended above."}
            </p>
            <Button
              onClick={submit}
              loading={saving}
              disabled={selected.size === 0}
              icon={saving ? undefined : "check-circle"}
            >
              {saving ? "Recording…" : "Submit check-in"}
            </Button>
          </div>
        </div>
      ) : null}

      {complete ? (
        <p className="mt-3.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Everything for {new Date(date).getDate() === new Date().getDate() ? "today" : date} is in.
          Your next step is the worklog.
        </p>
      ) : null}

      {closed && !complete ? (
        <p className="mt-3.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Check-in closes at 11:30 PM. Ask your mentor to add the missing hours for you.
        </p>
      ) : null}
    </div>
  );
}
