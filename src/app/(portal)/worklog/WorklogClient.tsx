"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { WorklogEditor, type WorklogDraft } from "@/components/features/WorklogEditor";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { WORKLOG_SLOTS } from "@/lib/constants";
import { formatDay, toDayKey } from "@/lib/dates";

export type WorklogRow = {
  id: string;
  date: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  status: string;
  mentorRemark: string;
  taskId: string | null;
  task: { id: string; title: string } | null;
};

/**
 * The worklog history list plus the editor it opens.
 *
 * Rows expand in place rather than navigating — reading back a day's write-up
 * is a glance, not a destination.
 */
export function WorklogClient({
  logs,
  tasks,
  todayLog,
  extensions,
}: {
  logs: WorklogRow[];
  tasks: Array<{ id: string; title: string }>;
  todayLog: WorklogRow | null;
  /** date -> extension status, for the locked-row affordance. */
  extensions: Record<string, string>;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<WorklogDraft> | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extensionFor, setExtensionFor] = useState<string | null>(null);

  const today = toDayKey();

  const openFor = (log: WorklogRow | null, date = today) => {
    setDraft(
      log
        ? { date: log.date, s1: log.s1, s2: log.s2, s3: log.s3, s4: log.s4, s5: log.s5, taskId: log.taskId }
        : { date }
    );
    setEditorOpen(true);
  };

  return (
    <>
      <Card thread className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span
              data-accent={todayLog ? "green" : "amber"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name={todayLog ? "check-circle" : "clipboard"} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>
                {todayLog ? "Today's worklog is in" : "Today's worklog is not written yet"}
              </p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {todayLog
                  ? `Submitted for ${formatDay(today, "long")}. You can still edit it until 11:30 PM.`
                  : "Four required slots, plus an optional extra. Takes about two minutes."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => openFor(todayLog)}
            icon={todayLog ? "edit" : "plus"}
            variant={todayLog ? "secondary" : "primary"}
          >
            {todayLog ? "Edit today's log" : "Write today's log"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon="clipboard"
          title="Your worklog history"
          subtitle={`${logs.length} ${logs.length === 1 ? "entry" : "entries"} — newest first. Tap a row to read it back.`}
        />

        {logs.length === 0 ? (
          <EmptyState
            title="No worklogs yet"
            description="Your worklog is the record of what you actually built each day. It is what your mentor reads before a review."
            action={
              <Button onClick={() => openFor(null)} icon="plus">
                Write your first log
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {logs.map((log) => {
              const isOpen = expanded === log.id;
              const editable = log.date >= yesterdayKey();

              return (
                <li
                  key={log.id}
                  className="overflow-hidden rounded-[12px] border transition-colors"
                  style={{
                    borderColor: isOpen ? "var(--accent)" : "var(--line-soft)",
                    background: "var(--surface-raised)",
                  }}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <span
                      data-accent={log.status === "FLAGGED" ? "red" : log.status === "REVIEWED" ? "green" : "blue"}
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px] leading-none"
                      style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                    >
                      <span className="text-[15px] font-bold tabular-nums">{Number(log.date.slice(8))}</span>
                      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em]">
                        {formatDay(log.date, "short").split(" ")[1]}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {formatDay(log.date, "long")}
                        </span>
                        <StatusBadge status={log.status} />
                        {log.task ? (
                          <Badge tone="slate" icon="target">
                            {log.task.title}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {log.s1 || "—"}
                      </span>
                    </span>

                    <Icon
                      name="chevron-down"
                      className="h-4 w-4 shrink-0 transition-transform"
                      style={{
                        color: "var(--text-faint)",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}
                    />
                  </button>

                  {isOpen ? (
                    <div className="animate-fade border-t px-3 pb-3.5 pt-3" style={{ borderColor: "var(--line-soft)" }}>
                      <dl className="flex flex-col gap-2.5">
                        {WORKLOG_SLOTS.map((slot) => {
                          const value = log[slot.key];
                          if (!value) return null;
                          return (
                            <div key={slot.key} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                              <dt
                                className="shrink-0 text-[10.5px] font-bold uppercase tracking-[0.08em] sm:w-28 sm:pt-0.5"
                                style={{ color: "var(--text-faint)" }}
                              >
                                {slot.label}
                                <span className="ml-1.5 hidden font-mono font-normal tracking-normal sm:inline">
                                  {slot.window}
                                </span>
                              </dt>
                              <dd className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-default)" }}>
                                {value}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>

                      {log.mentorRemark ? (
                        <div
                          data-accent={log.status === "FLAGGED" ? "red" : "green"}
                          className="mt-3.5 flex items-start gap-2.5 rounded-[10px] p-3"
                          style={{ background: "var(--tone-soft)" }}
                        >
                          <Icon name="user" className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--tone)" }}>
                              Mentor remark
                            </p>
                            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--tone)" }}>
                              {log.mentorRemark}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3.5 flex justify-end">
                        {editable ? (
                          <Button size="sm" variant="secondary" icon="edit" onClick={() => openFor(log)}>
                            Edit this log
                          </Button>
                        ) : extensions[log.date] === "APPROVED" ? (
                          <Button size="sm" variant="secondary" icon="edit" onClick={() => openFor(log)}>
                            Edit (extension granted)
                          </Button>
                        ) : extensions[log.date] === "PENDING" ? (
                          <span className="text-[11.5px]" style={{ color: "var(--color-brand-amber-600)" }}>
                            Locked — extension request awaiting a decision.
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="clock"
                            onClick={() => setExtensionFor(log.date)}
                          >
                            Request an extension
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <WorklogEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={draft}
        tasks={tasks}
      />

      {extensionFor ? (
        <ExtensionDialog date={extensionFor} onClose={() => setExtensionFor(null)} />
      ) : null}
    </>
  );
}

/** Ask for one locked date to be reopened. */
function ExtensionDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not send the request", payload.error);
        return;
      }
      toast.success("Extension requested", "Your mentor will decide, and you will see the outcome here.");
      onClose();
      router.refresh();
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
      size="sm"
      title={`Reopen ${formatDay(date, "long")}?`}
      description="Worklogs lock a day after their date. Explain why you could not log this one in time — your mentor decides."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={reason.trim().length < 15}>
            Send request
          </Button>
        </>
      }
    >
      <Field
        label="What happened?"
        htmlFor="ext-reason"
        required
        help="Be specific. A vague request is the most common reason one gets rejected."
      >
        <Textarea
          id="ext-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. I was at the inter-college event all day and the studio wifi was down when I got back after 11:30."
        />
      </Field>
    </Modal>
  );
}

function yesterdayKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}
