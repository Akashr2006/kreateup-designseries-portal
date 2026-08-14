"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { WORKLOG_SLOTS } from "@/lib/constants";
import { formatDay } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type ReviewRow = {
  id: string;
  date: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  status: string;
  mentorRemark: string;
  taskTitle: string | null;
  student: { id: string; name: string; rollNo: string; domain: string; year: string };
};

const QUICK_REMARKS = [
  "Good detail — keep logging the blockers too.",
  "Clear progress. Link the task next time.",
  "Too vague. Say what you actually changed and why.",
  "Nice work this week.",
];

/**
 * The mentor review queue.
 *
 * Reviewing is a two-second action for a good log, so approving is a single
 * click straight from the list; a flag opens the dialog because it always needs
 * a written reason — a flag without one just confuses the student.
 */
export function WorklogReview({
  logs,
  options,
  filters,
}: {
  logs: ReviewRow[];
  options: { domains: string[]; years: string[] };
  filters: { status: string; domain: string; year: string; date: string };
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<ReviewRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      `${log.student.name} ${log.student.rollNo} ${log.s1} ${log.s2} ${log.s3} ${log.s4}`
        .toLowerCase()
        .includes(q)
    );
  }, [logs, query]);

  const applyFilter = (key: string, value: string) => {
    const query = new URLSearchParams(filters as unknown as Record<string, string>);
    if (value === "ALL" || !value) query.delete(key);
    else query.set(key, value);
    router.push(`/console/worklogs?${query.toString()}`);
  };

  const review = async (log: ReviewRow, status: string, remark: string) => {
    setBusy(log.id);
    try {
      const response = await fetch("/api/worklog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, status, mentorRemark: remark }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save the review", payload.error);
        return false;
      }
      toast.success(
        status === "REVIEWED" ? "Signed off" : status === "FLAGGED" ? "Sent back for revision" : "Reopened",
        status === "FLAGGED" ? "The student sees your remark on their worklog page." : undefined
      );
      router.refresh();
      return true;
    } catch {
      toast.error("Network problem");
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-2.5 lg:grid-cols-4">
          <Input
            icon="search"
            placeholder="Search student or log text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search worklogs"
          />
          <Select
            defaultValue={filters.status}
            onChange={(e) => applyFilter("status", e.target.value)}
            aria-label="Filter by status"
          >
            <option value="SUBMITTED">Awaiting review</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REVIEWED">Signed off</option>
            <option value="ALL">Every status</option>
          </Select>
          <Select
            defaultValue={filters.domain}
            onChange={(e) => applyFilter("domain", e.target.value)}
            aria-label="Filter by domain"
          >
            <option value="ALL">All domains</option>
            {options.domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            defaultValue={filters.date}
            onChange={(e) => applyFilter("date", e.target.value)}
            aria-label="Filter by date"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          tone="green"
          icon="check-circle"
          title={filters.status === "SUBMITTED" ? "The review queue is empty" : "Nothing matches"}
          description={
            filters.status === "SUBMITTED"
              ? "Every submitted worklog has been reviewed. New submissions land here automatically."
              : "Try a different status, domain or date."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((log) => (
            <li key={log.id} className="surface-flat overflow-hidden">
              <div className="flex flex-wrap items-start gap-3 p-3.5">
                <Link href={`/console/people/${log.student.id}`} className="min-w-0">
                  <PersonCell
                    name={log.student.name}
                    seed={log.student.id}
                    meta={`${log.student.rollNo} · ${shortYear(log.student.year)}`}
                  />
                </Link>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="slate" icon="calendar">
                    {formatDay(log.date, "medium")}
                  </Badge>
                  <Badge tone="blue">{log.student.domain}</Badge>
                  {log.taskTitle ? (
                    <Badge tone="slate" icon="target">
                      {log.taskTitle}
                    </Badge>
                  ) : null}
                  <StatusBadge status={log.status} />
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="ghost" icon="eye" onClick={() => setReviewing(log)}>
                    Read
                  </Button>
                  {log.status !== "REVIEWED" ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon="check"
                      loading={busy === log.id}
                      onClick={() => review(log, "REVIEWED", log.mentorRemark)}
                    >
                      Sign off
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--line-soft)" }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WORKLOG_SLOTS.slice(0, 4).map((slot) => (
                    <div key={slot.key}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
                        {slot.label}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {log[slot.key] || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {log.mentorRemark ? (
                  <p
                    data-accent={log.status === "FLAGGED" ? "red" : "green"}
                    className="mt-2.5 rounded-[8px] px-2.5 py-1.5 text-[11.5px]"
                    style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                  >
                    Your remark: {log.mentorRemark}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewing ? (
        <ReviewDialog
          log={reviewing}
          busy={busy === reviewing.id}
          onClose={() => setReviewing(null)}
          onReview={async (status, remark) => {
            const done = await review(reviewing, status, remark);
            if (done) setReviewing(null);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function ReviewDialog({
  log,
  busy,
  onClose,
  onReview,
}: {
  log: ReviewRow;
  busy: boolean;
  onClose: () => void;
  onReview: (status: string, remark: string) => void;
}) {
  const [remark, setRemark] = useState(log.mentorRemark);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${log.student.name} — ${formatDay(log.date, "long")}`}
      description={`${log.student.rollNo} · ${log.student.domain}`}
      footer={
        <>
          <Button
            variant="danger"
            icon="flag"
            loading={busy}
            disabled={remark.trim().length < 4}
            onClick={() => onReview("FLAGGED", remark)}
            title={remark.trim().length < 4 ? "Write a remark before flagging" : undefined}
          >
            Flag for revision
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button variant="success" icon="check" loading={busy} onClick={() => onReview("REVIEWED", remark)}>
            Sign off
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          {WORKLOG_SLOTS.map((slot) => {
            const value = log[slot.key];
            return (
              <div key={slot.key} className="inset-panel p-3">
                <dt className="flex items-baseline justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
                    {slot.label}
                  </span>
                  <span className="font-mono text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                    {slot.window}
                  </span>
                </dt>
                <dd className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: value ? "var(--text-default)" : "var(--text-faint)" }}>
                  {value || (slot.required ? "Not filled in." : "Nothing logged (optional slot).")}
                </dd>
              </div>
            );
          })}
        </dl>

        <Field
          label="Mentor remark"
          htmlFor="review-remark"
          help="Required to flag a log. Optional when you sign one off — but a line of feedback goes a long way."
        >
          <Textarea
            id="review-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="What was good, and what should change next time?"
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_REMARKS.map((preset) => (
            <button
              key={preset}
              onClick={() => setRemark(preset)}
              className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: "var(--line-default)", color: "var(--text-muted)" }}
            >
              {preset}
            </button>
          ))}
        </div>

        <p className="flex items-start gap-2 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          <Icon name="info" className="mt-px h-3.5 w-3.5 shrink-0" />
          Flagging sends the log back to the student. They can edit it, which puts it in this queue again.
        </p>
      </div>
    </Modal>
  );
}
