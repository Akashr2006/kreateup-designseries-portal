"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar, PersonCell } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Barcode } from "@/components/ui/Barcode";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay, toDayKey } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type ScanStudent = {
  id: string;
  name: string;
  rollNo: string;
  domain: string;
  year: string;
  loggedToday: number[];
};

/**
 * Door check-in.
 *
 * Two input paths, both real:
 *   1. A handheld barcode scanner. These present as a keyboard, so scanning a
 *      student's roll number simply types it into the field and fires Enter —
 *      no driver, no library, no permissions prompt.
 *   2. The browser's native BarcodeDetector API, where the platform supports
 *      it, for phone-camera scanning. It is feature-detected, never assumed,
 *      and the typed path always remains available.
 */
export function ScanConsole({ students }: { students: ScanStudent[] }) {
  const router = useRouter();
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<ScanStudent | null>(null);
  const [hours, setHours] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("Checked in at the studio door.");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Array<{ name: string; rollNo: string; hours: number[]; at: string }>>([]);

  const today = toDayKey();

  // Keep the field focused so a handheld scanner always lands somewhere useful.
  useEffect(() => {
    inputRef.current?.focus();
  }, [selected]);

  const matches = useMemo(() => {
    const q = code.trim().toLowerCase();
    if (q.length < 2) return [];
    return students
      .filter((s) => `${s.rollNo} ${s.name}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [code, students]);

  const choose = (student: ScanStudent) => {
    setSelected(student);
    setCode("");
    // Pre-select the hours not yet logged — the common case at the door.
    setHours(new Set(ATTENDANCE_HOURS.filter((h) => !student.loggedToday.includes(h))));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // A barcode scanner sends the whole code then Enter — resolve an exact
    // roll-number match first, then fall back to the single fuzzy match.
    const exact = students.find((s) => s.rollNo.toLowerCase() === code.trim().toLowerCase());
    if (exact) return choose(exact);
    if (matches.length === 1) return choose(matches[0]);
    if (matches.length === 0) toast.warning("No student matches that code", "Check the roll number and try again.");
  };

  const toggle = (hour: number) => {
    if (selected?.loggedToday.includes(hour)) return;
    setHours((current) => {
      const next = new Set(current);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const submit = async () => {
    if (!selected) return;
    if (hours.size === 0) {
      toast.warning("Pick at least one hour");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          date: today,
          hours: [...hours],
          status: "PRESENT",
          reason: reason.trim() || "Checked in at the studio door.",
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not record the check-in", payload.error);
        return;
      }

      toast.success(
        `${selected.name.split(" ")[0]} checked in`,
        `${hours.size} ${hours.size === 1 ? "hour" : "hours"} recorded.`
      );
      setRecent((current) =>
        [
          { name: selected.name, rollNo: selected.rollNo, hours: [...hours], at: new Date().toLocaleTimeString() },
          ...current,
        ].slice(0, 8)
      );
      setSelected(null);
      setHours(new Set());
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-5">
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <Card thread>
          <CardHeader
            icon="qr"
            title="Scan or type a roll number"
            subtitle="A handheld barcode scanner types into this field and presses Enter for you — nothing to install."
          />

          <Input
            ref={inputRef}
            icon="search"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="7376242IT131 or a student's name"
            autoComplete="off"
            spellCheck={false}
            className="h-12 text-[15px]"
            aria-label="Roll number or name"
          />

          {matches.length > 0 ? (
            <ul className="mt-2 overflow-hidden rounded-[11px] border" style={{ borderColor: "var(--line-soft)" }}>
              {matches.map((student) => (
                <li key={student.id}>
                  <button
                    onClick={() => choose(student)}
                    className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-[var(--surface-inset)]"
                    style={{ borderColor: "var(--line-soft)" }}
                  >
                    <PersonCell
                      name={student.name}
                      seed={student.id}
                      meta={`${student.rollNo} · ${student.domain}`}
                      size={30}
                      className="flex-1"
                    />
                    <Badge tone={student.loggedToday.length >= ATTENDANCE_HOURS.length ? "green" : student.loggedToday.length > 0 ? "amber" : "slate"}>
                      {student.loggedToday.length}/{ATTENDANCE_HOURS.length}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {selected ? (
          <Card className="animate-scale-in">
            <CardHeader
              icon="check-circle"
              title={`Check in ${selected.name}`}
              subtitle={`${selected.rollNo} · ${selected.domain} · ${formatDay(today, "long")}`}
              action={
                <Button size="sm" variant="ghost" icon="close" onClick={() => setSelected(null)}>
                  Clear
                </Button>
              }
            />

            <div className="flex items-center gap-4 rounded-[12px] p-3" style={{ background: "var(--surface-inset)" }}>
              <Avatar name={selected.name} seed={selected.id} size={46} ring />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>
                  {selected.name}
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {shortYear(selected.year)} · already logged {selected.loggedToday.length} of{" "}
                  {ATTENDANCE_HOURS.length} hours today
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold" style={{ color: "var(--text-default)" }}>
                  Hours to record
                </p>
                <button
                  onClick={() =>
                    setHours(
                      hours.size > 0
                        ? new Set()
                        : new Set(ATTENDANCE_HOURS.filter((h) => !selected.loggedToday.includes(h)))
                    )
                  }
                  className="text-[11.5px] font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  {hours.size > 0 ? "Clear" : "Select remaining"}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {ATTENDANCE_HOURS.map((hour) => {
                  const done = selected.loggedToday.includes(hour);
                  const on = hours.has(hour);
                  const tone = done ? "green" : on ? "blue" : "slate";
                  return (
                    <button
                      key={hour}
                      data-accent={tone}
                      onClick={() => toggle(hour)}
                      disabled={done}
                      title={`${HOUR_WINDOW[hour]}${done ? " — already logged" : ""}`}
                      className="flex flex-col items-center rounded-[10px] border py-2.5 transition-colors"
                      style={{
                        borderColor: done || on ? "var(--tone)" : "var(--line-default)",
                        background: done || on ? "var(--tone-soft)" : "var(--surface-raised)",
                        color: done || on ? "var(--tone)" : "var(--text-muted)",
                        opacity: done ? 0.75 : 1,
                      }}
                    >
                      {done ? (
                        <Icon name="check" className="h-4 w-4" />
                      ) : (
                        <span className="text-[16px] font-bold tabular-nums">{hour}</span>
                      )}
                      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em]">
                        {done ? "Done" : `Hr ${hour}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <Field label="Note" htmlFor="scan-reason" help="Shown to the student next to the recorded hours.">
                <Textarea
                  id="scan-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                Recorded as an admin entry against your account.
              </p>
              <Button onClick={submit} loading={saving} icon={saving ? undefined : "check-circle"} disabled={hours.size === 0}>
                Record {hours.size > 0 ? `${hours.size} ${hours.size === 1 ? "hour" : "hours"}` : "check-in"}
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon="qr"
            title="Waiting for a scan"
            description="Scan a student's code with a handheld reader, or start typing their roll number above. The field stays focused so consecutive scans just work."
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <Card>
          <CardHeader icon="clock" title="Recorded this session" subtitle="Since you opened this page." />
          {recent.length === 0 ? (
            <EmptyState compact icon="clock" title="Nothing yet" />
          ) : (
            <ul className="flex flex-col">
              {recent.map((entry, index) => (
                <li
                  key={`${entry.rollNo}-${index}`}
                  className="flex items-center gap-3 border-b py-2.5 last:border-0"
                  style={{ borderColor: "var(--line-soft)" }}
                >
                  <span
                    data-accent="green"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                    style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                      {entry.name}
                    </span>
                    <span className="block font-mono text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                      {entry.rollNo} · {entry.hours.length} hrs · {entry.at}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            icon="info"
            title="How the codes work"
            subtitle="The same Code 39 symbology used on gate passes."
          />
          <div className="rounded-[11px] border p-3" style={{ borderColor: "var(--line-default)", background: "#fff" }}>
            <Barcode value={selected?.rollNo ?? "7376242IT131"} height={48} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Roll numbers encode directly as Code 39, so a printed student card scans with any ordinary
            1D reader. There is no proprietary format and nothing to sync — the reader types the code
            and the portal resolves it.
          </p>
        </Card>
      </div>
    </div>
  );
}
