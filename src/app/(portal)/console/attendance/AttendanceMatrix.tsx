"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay, weekdayShort } from "@/lib/dates";
import { cn, shortYear } from "@/lib/utils";

export type MatrixStudent = {
  id: string;
  name: string;
  rollNo: string;
  year: string;
  domain: string;
  mentorName: string;
  hours: number;
  rate: number;
  fullDays: number;
  daysPresent: number;
  perDay: number[];
};

/**
 * The cohort attendance grid.
 *
 * One row per student, one cell per tracked day, shaded by how much of the day
 * was logged. It is the single view that answers "who is slipping?" without
 * anyone having to open thirty individual profiles.
 */
export function AttendanceMatrix({
  students,
  trackedDays,
  from,
  to,
  options,
  filters,
}: {
  students: MatrixStudent[];
  trackedDays: string[];
  from: string;
  to: string;
  options: { years: string[]; domains: string[] };
  filters: { year: string; domain: string };
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "rate" | "hours">("rate");
  const [manualFor, setManualFor] = useState<MatrixStudent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? students.filter((s) => `${s.name} ${s.rollNo} ${s.domain}`.toLowerCase().includes(q))
      : students;

    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "hours") return b.hours - a.hours;
      return a.rate - b.rate; // weakest first — that is what needs attention
    });
  }, [students, query, sort]);

  const applyRange = (nextFrom: string, nextTo: string, nextYear: string, nextDomain: string) => {
    const query = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (nextYear !== "ALL") query.set("year", nextYear);
    if (nextDomain !== "ALL") query.set("domain", nextDomain);
    router.push(`/console/attendance?${query.toString()}`);
  };

  const average = students.length
    ? Math.round(students.reduce((sum, s) => sum + s.rate, 0) / students.length)
    : 0;

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-2.5 lg:grid-cols-5">
          <Field label="From" htmlFor="m-from">
            <Input
              id="m-from"
              type="date"
              defaultValue={from}
              max={to}
              onChange={(e) => applyRange(e.target.value, to, filters.year, filters.domain)}
            />
          </Field>
          <Field label="To" htmlFor="m-to">
            <Input
              id="m-to"
              type="date"
              defaultValue={to}
              min={from}
              onChange={(e) => applyRange(from, e.target.value, filters.year, filters.domain)}
            />
          </Field>
          <Field label="Year" htmlFor="m-year">
            <Select
              id="m-year"
              defaultValue={filters.year}
              onChange={(e) => applyRange(from, to, e.target.value, filters.domain)}
            >
              <option value="ALL">All years</option>
              {options.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="m-domain">
            <Select
              id="m-domain"
              defaultValue={filters.domain}
              onChange={(e) => applyRange(from, to, filters.year, e.target.value)}
            >
              <option value="ALL">All domains</option>
              {options.domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="m-search">
            <Input
              id="m-search"
              icon="search"
              placeholder="Name or roll number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={average >= 75 ? "green" : "amber"}>Cohort average {average}%</Badge>
          <Badge tone="slate">{trackedDays.length} tracked days</Badge>
          <Badge tone="slate">{filtered.length} students</Badge>

          <div className="ml-auto flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
            {(["rate", "hours", "name"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className="h-7 rounded-[8px] px-2.5 text-[12px] font-semibold capitalize transition-colors"
                style={{
                  background: sort === key ? "var(--accent-soft)" : "transparent",
                  color: sort === key ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {key === "rate" ? "Lowest first" : key}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No students match" description="Widen the date range or clear the filters." />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead style={{ background: "var(--surface-inset)" }}>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[190px] border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)", borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}
                  >
                    Student
                  </th>
                  <th
                    scope="col"
                    className="min-w-[120px] border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: "var(--text-muted)", borderColor: "var(--line-soft)" }}
                  >
                    Rate
                  </th>
                  {trackedDays.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      title={formatDay(day, "long")}
                      className="border-b px-1 py-2.5 text-center text-[9.5px] font-semibold"
                      style={{ color: "var(--text-faint)", borderColor: "var(--line-soft)" }}
                    >
                      <span className="block">{weekdayShort(day).slice(0, 1)}</span>
                      <span className="block tabular-nums">{Number(day.slice(8))}</span>
                    </th>
                  ))}
                  <th className="border-b px-3.5" style={{ borderColor: "var(--line-soft)" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id} className="border-b last:border-0" style={{ borderColor: "var(--line-soft)" }}>
                    <td
                      className="sticky left-0 z-10 px-3.5 py-2"
                      style={{ background: "var(--surface-raised)" }}
                    >
                      <Link href={`/console/people/${student.id}`}>
                        <PersonCell
                          name={student.name}
                          seed={student.id}
                          meta={`${student.rollNo} · ${shortYear(student.year)}`}
                          size={30}
                        />
                      </Link>
                    </td>
                    <td className="px-3.5 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-9 shrink-0 text-[12.5px] font-bold tabular-nums"
                          style={{
                            color:
                              student.rate >= 85
                                ? "var(--color-brand-green)"
                                : student.rate >= 75
                                  ? "var(--text-strong)"
                                  : "var(--color-brand-red)",
                          }}
                        >
                          {student.rate}%
                        </span>
                        <ProgressBar
                          value={student.rate}
                          tone={student.rate >= 85 ? "green" : student.rate >= 75 ? "blue" : student.rate >= 50 ? "amber" : "red"}
                          height={5}
                          className="w-14"
                        />
                      </div>
                    </td>

                    {student.perDay.map((count, index) => {
                      const ratio = count / ATTENDANCE_HOURS.length;
                      const tone = count === 0 ? "slate" : ratio >= 1 ? "green" : ratio >= 0.5 ? "amber" : "red";
                      return (
                        <td key={trackedDays[index]} className="px-0.5 py-2">
                          <span
                            data-accent={tone}
                            title={`${formatDay(trackedDays[index], "medium")} — ${count}/${ATTENDANCE_HOURS.length} hours`}
                            className={cn("mx-auto block h-6 w-6 rounded-[5px]")}
                            style={{
                              background:
                                count > 0
                                  ? `color-mix(in srgb, var(--tone) ${28 + ratio * 52}%, var(--surface-raised))`
                                  : "var(--surface-sunken)",
                            }}
                          />
                        </td>
                      );
                    })}

                    <td className="px-3.5 py-2">
                      <Button size="sm" variant="ghost" icon="plus" onClick={() => setManualFor(student)}>
                        Add
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-[10.5px]" style={{ borderColor: "var(--line-soft)", color: "var(--text-faint)" }}>
            <Legend tone="green" label="Full day" />
            <Legend tone="amber" label="Half or more" />
            <Legend tone="red" label="Under half" />
            <Legend tone="slate" label="Absent" />
            <span className="ml-auto">Sundays are excluded from the calculation.</span>
          </div>
        </Card>
      )}

      {manualFor ? (
        <ManualEntryDialog
          student={manualFor}
          onClose={() => setManualFor(null)}
          onSaved={() => {
            setManualFor(null);
            toast.success("Attendance recorded", "The change is in the audit log.");
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function Legend({ tone, label }: { tone: "green" | "amber" | "red" | "slate"; label: string }) {
  return (
    <span data-accent={tone} className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: tone === "slate" ? "var(--surface-sunken)" : "var(--tone)" }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------

function ManualEntryDialog({
  student,
  onClose,
  onSaved,
}: {
  student: MatrixStudent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState<Set<number>>(new Set(ATTENDANCE_HOURS));
  const [status, setStatus] = useState("PRESENT");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (hour: number) => {
    setHours((current) => {
      const next = new Set(current);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const save = async () => {
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
          userId: student.id,
          date,
          hours: [...hours],
          status,
          reason: reason.trim() || "Added by admin",
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not record attendance", payload.error);
        return;
      }
      onSaved();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record attendance — ${student.name}`}
      description="This overwrites whatever is currently stored for the hours you select, including a student's own check-in."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Record attendance
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="me-date" required>
            <Input
              id="me-date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor="me-status" required>
            <Select id="me-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="EXCUSED">Excused</option>
              <option value="ABSENT">Absent (recorded)</option>
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-default)" }}>
              Hours
            </p>
            <button
              onClick={() => setHours(hours.size === ATTENDANCE_HOURS.length ? new Set() : new Set(ATTENDANCE_HOURS))}
              className="text-[11.5px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              {hours.size === ATTENDANCE_HOURS.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ATTENDANCE_HOURS.map((hour) => {
              const on = hours.has(hour);
              return (
                <button
                  key={hour}
                  data-accent={on ? "blue" : "slate"}
                  onClick={() => toggle(hour)}
                  title={HOUR_WINDOW[hour]}
                  className="flex flex-col items-center rounded-[10px] border py-2 transition-colors"
                  style={{
                    borderColor: on ? "var(--tone)" : "var(--line-default)",
                    background: on ? "var(--tone-soft)" : "var(--surface-raised)",
                    color: on ? "var(--tone)" : "var(--text-muted)",
                  }}
                >
                  <span className="text-[15px] font-bold tabular-nums">{hour}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.06em]">Hr</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Note" htmlFor="me-reason" help="Why is this being added manually? Visible to the student.">
          <Textarea
            id="me-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Attended the placement drive — verified with the placement cell."
            rows={2}
          />
        </Field>

        <p className="flex items-start gap-2 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          <Icon name="shield" className="mt-px h-3.5 w-3.5 shrink-0" />
          Manual entries are marked as admin-sourced and recorded in the audit log against your account.
        </p>
      </div>
    </Modal>
  );
}
