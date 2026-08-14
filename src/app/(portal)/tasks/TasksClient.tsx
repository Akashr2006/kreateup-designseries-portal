"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/lib/constants";
import { formatDay, toDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  points: number;
  authorName: string;
};

/** Board columns. DONE is terminal and only a mentor can set it. */
const COLUMNS: Array<{ status: TaskStatus; tone: "slate" | "blue" | "amber" | "green" | "red" }> = [
  { status: "TODO", tone: "slate" },
  { status: "IN_PROGRESS", tone: "blue" },
  { status: "SUBMITTED", tone: "amber" },
  { status: "DONE", tone: "green" },
];

export function TasksClient({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [filter, setFilter] = useState<"all" | "open" | "overdue">("open");

  const today = toDayKey();

  const filtered = useMemo(() => {
    if (filter === "all") return tasks;
    if (filter === "overdue") {
      return tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < today);
    }
    return tasks.filter((t) => t.status !== "DONE");
  }, [tasks, filter, today]);

  const move = async (task: TaskRow, status: TaskStatus) => {
    setBusy(task.id);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const payload = await response.json();

      if (!payload.ok) {
        toast.error("Could not update the task", payload.error);
        return;
      }

      toast.success(
        `Moved to ${TASK_STATUS_LABEL[status].toLowerCase()}`,
        status === "SUBMITTED" ? "Your mentor will review and close it." : undefined
      );
      router.refresh();
    } catch {
      toast.error("Network problem", "The task was not updated.");
    } finally {
      setBusy(null);
    }
  };

  const overdueCount = tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < today).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segment value={filter} onChange={setFilter} options={[
          { key: "open", label: `Open (${tasks.filter((t) => t.status !== "DONE").length})` },
          { key: "overdue", label: `Overdue (${overdueCount})` },
          { key: "all", label: `All (${tasks.length})` },
        ]} />

        <div className="ml-auto flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
          <ViewButton active={view === "board"} onClick={() => setView("board")} icon="layers" label="Board" />
          <ViewButton active={view === "list"} onClick={() => setView("list")} icon="menu" label="List" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          tone="green"
          title={filter === "overdue" ? "Nothing is overdue" : "No tasks here"}
          description={
            filter === "overdue"
              ? "You are on top of every deadline. Keep it that way."
              : "Your mentor has not assigned anything yet, or you have finished everything."
          }
        />
      ) : view === "board" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const items = filtered.filter((t) => t.status === column.status);
            const blocked = column.status === "TODO" ? filtered.filter((t) => t.status === "BLOCKED") : [];
            const all = [...items, ...blocked];

            return (
              <div key={column.status} data-accent={column.tone} className="min-w-0">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--tone)" }} />
                  <h2 className="text-[12.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--text-muted)" }}>
                    {TASK_STATUS_LABEL[column.status]}
                  </h2>
                  <span className="ml-auto text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-faint)" }}>
                    {all.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {all.length === 0 ? (
                    <div
                      className="rounded-[11px] border border-dashed py-6 text-center text-[11.5px]"
                      style={{ borderColor: "var(--line-default)", color: "var(--text-faint)" }}
                    >
                      Empty
                    </div>
                  ) : (
                    all.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        busy={busy === task.id}
                        onMove={move}
                        today={today}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padded={false}>
          <ul>
            {filtered.map((task, index) => (
              <li
                key={task.id}
                className={cn("flex flex-wrap items-center gap-3 p-3.5", index > 0 && "border-t")}
                style={{ borderColor: "var(--line-soft)" }}
              >
                <span
                  data-accent={priorityTone(task.priority)}
                  className="h-9 w-[3px] shrink-0 rounded-full"
                  style={{ background: "var(--tone)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {task.dueDate ? `Due ${formatDay(task.dueDate, "medium")}` : "No due date"} · {task.points} pts · {task.authorName}
                  </p>
                </div>
                <StatusBadge status={task.status} />
                <TaskActions task={task} busy={busy === task.id} onMove={move} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function TaskCard({
  task,
  busy,
  onMove,
  today,
}: {
  task: TaskRow;
  busy: boolean;
  onMove: (task: TaskRow, status: TaskStatus) => void;
  today: string;
}) {
  const overdue = task.status !== "DONE" && task.dueDate && task.dueDate < today;

  return (
    <article
      className="surface-flat overflow-hidden p-3"
      style={{ opacity: busy ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
          {task.title}
        </h3>
        {task.status === "BLOCKED" ? <StatusBadge status="BLOCKED" /> : null}
      </div>

      {task.description ? (
        <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {task.description}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={priorityTone(task.priority)}>{task.priority.toLowerCase()}</Badge>
        <Badge tone="slate" icon="trophy">
          {task.points}
        </Badge>
        {task.dueDate ? (
          <Badge tone={overdue ? "red" : "slate"} icon="calendar">
            {overdue ? "Overdue · " : ""}
            {formatDay(task.dueDate, "short")}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3">
        <TaskActions task={task} busy={busy} onMove={onMove} block />
      </div>
    </article>
  );
}

function TaskActions({
  task,
  busy,
  onMove,
  block = false,
}: {
  task: TaskRow;
  busy: boolean;
  onMove: (task: TaskRow, status: TaskStatus) => void;
  block?: boolean;
}) {
  if (task.status === "DONE") {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--color-brand-green)" }}>
        <Icon name="check-circle" className="h-3.5 w-3.5" />
        Signed off
      </span>
    );
  }

  const next: TaskStatus =
    task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "SUBMITTED" : "IN_PROGRESS";
  const label =
    task.status === "TODO" ? "Start" : task.status === "IN_PROGRESS" ? "Submit for review" : "Resume";

  return (
    <div className={cn("flex items-center gap-1.5", block && "w-full")}>
      <Button size="sm" variant="secondary" block={block} loading={busy} onClick={() => onMove(task, next)}>
        {label}
      </Button>
      {task.status !== "BLOCKED" && task.status !== "SUBMITTED" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onMove(task, "BLOCKED")}
          title="Flag as blocked so your mentor sees it"
        >
          Blocked
        </Button>
      ) : null}
    </div>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ key: T; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors"
          style={{
            background: value === option.key ? "var(--accent-soft)" : "transparent",
            color: value === option.key ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: "layers" | "menu";
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label} view`}
      title={`${label} view`}
      className="grid h-8 w-8 place-items-center rounded-[8px] transition-colors"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
      }}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function priorityTone(priority: string): "slate" | "blue" | "amber" | "red" {
  if (priority === "CRITICAL") return "red";
  if (priority === "HIGH") return "amber";
  if (priority === "MEDIUM") return "blue";
  return "slate";
}
