"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { TASK_PRIORITY, TASK_STATUS, TASK_STATUS_LABEL, type TaskStatus } from "@/lib/constants";
import { formatDay, toDayKey } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type ConsoleTaskRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  points: number;
  assignee: { id: string; name: string; rollNo: string; domain: string; year: string } | null;
  authorName: string;
};

export type Candidate = {
  id: string;
  name: string;
  rollNo: string;
  domain: string;
  year: string;
};

export function TaskConsole({
  tasks,
  students,
  options,
}: {
  tasks: ConsoleTaskRow[];
  students: Candidate[];
  options: { domains: string[]; years: string[] };
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ConsoleTaskRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const today = toDayKey();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status === "OPEN" && task.status === "DONE") return false;
      if (status !== "OPEN" && status !== "ALL" && task.status !== status) return false;
      if (!q) return true;
      return `${task.title} ${task.assignee?.name ?? ""} ${task.assignee?.rollNo ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [tasks, query, status]);

  const setTaskStatus = async (task: ConsoleTaskRow, next: TaskStatus) => {
    setBusy(task.id);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: next }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not update the task", payload.error);
        return;
      }
      toast.success(
        next === "DONE" ? "Task signed off" : `Moved to ${TASK_STATUS_LABEL[next].toLowerCase()}`,
        next === "DONE" ? `${task.points} points awarded.` : undefined
      );
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(deleting.id);
    try {
      await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleting.id }),
      });
      toast.success("Task deleted");
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <Input
              icon="search"
              placeholder="Search task or student…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tasks"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[190px]" aria-label="Filter by status">
            <option value="OPEN">Open tasks</option>
            {TASK_STATUS.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
            <option value="ALL">Every status</option>
          </Select>
          <Button icon="plus" onClick={() => setCreating(true)} className="ml-auto">
            Assign task
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon="target"
          title="No tasks here"
          description="Assign work to a single student, or broadcast it across a whole domain or year in one go."
          action={
            <Button icon="plus" onClick={() => setCreating(true)}>
              Assign a task
            </Button>
          }
        />
      ) : (
        <>
          <TableWrap className="hidden lg:block">
            <Table>
              <THead>
                <TR>
                  <TH>Task</TH>
                  <TH>Assignee</TH>
                  <TH>Priority</TH>
                  <TH>Due</TH>
                  <TH numeric>Points</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {filtered.map((task) => {
                  const overdue = task.status !== "DONE" && task.dueDate && task.dueDate < today;
                  return (
                    <TR key={task.id} interactive>
                      <TD>
                        <span className="block max-w-[280px] truncate font-semibold" style={{ color: "var(--text-strong)" }}>
                          {task.title}
                        </span>
                        <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>
                          by {task.authorName}
                        </span>
                      </TD>
                      <TD>
                        {task.assignee ? (
                          <Link href={`/console/people/${task.assignee.id}`}>
                            <PersonCell
                              name={task.assignee.name}
                              seed={task.assignee.id}
                              meta={`${task.assignee.rollNo} · ${shortYear(task.assignee.year)}`}
                              size={28}
                            />
                          </Link>
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>Unassigned</span>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={task.priority} />
                      </TD>
                      <TD>
                        <span className="text-[12px]" style={{ color: overdue ? "var(--color-brand-red)" : "var(--text-muted)" }}>
                          {task.dueDate ? formatDay(task.dueDate, "medium") : "—"}
                          {overdue ? " · late" : ""}
                        </span>
                      </TD>
                      <TD numeric>{task.points}</TD>
                      <TD>
                        <StatusBadge status={task.status} />
                      </TD>
                      <TD>
                        <span className="flex justify-end gap-1">
                          {task.status !== "DONE" ? (
                            <Button
                              size="sm"
                              variant="success"
                              icon="check"
                              loading={busy === task.id}
                              onClick={() => setTaskStatus(task, "DONE")}
                            >
                              Sign off
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" loading={busy === task.id} onClick={() => setTaskStatus(task, "IN_PROGRESS")}>
                              Reopen
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" icon="trash" onClick={() => setDeleting(task)} aria-label="Delete task" />
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="grid gap-2.5 sm:grid-cols-2 lg:hidden">
            {filtered.map((task) => (
              <li key={task.id} className="surface-flat p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
                    {task.title}
                  </p>
                  <StatusBadge status={task.status} />
                </div>
                {task.assignee ? (
                  <div className="mt-2.5">
                    <PersonCell name={task.assignee.name} seed={task.assignee.id} meta={task.assignee.domain} size={28} />
                  </div>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={task.priority} />
                  <Badge tone="slate" icon="trophy">
                    {task.points}
                  </Badge>
                  {task.dueDate ? (
                    <Badge tone={task.dueDate < today && task.status !== "DONE" ? "red" : "slate"} icon="calendar">
                      {formatDay(task.dueDate, "short")}
                    </Badge>
                  ) : null}
                  {task.status !== "DONE" ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon="check"
                      className="ml-auto"
                      loading={busy === task.id}
                      onClick={() => setTaskStatus(task, "DONE")}
                    >
                      Sign off
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating ? (
        <AssignDialog students={students} options={options} onClose={() => setCreating(false)} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={Boolean(busy)}
        destructive
        title="Delete this task?"
        message="The task disappears from the student's board. Any points already awarded for it stay on their ledger."
        confirmLabel="Delete task"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function AssignDialog({
  students,
  options,
  onClose,
}: {
  students: Candidate[];
  options: { domains: string[]; years: string[] };
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<"individual" | "cohort">("individual");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    points: 10,
    domain: "",
    year: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students.slice(0, 40);
    return students
      .filter((s) => `${s.name} ${s.rollNo} ${s.domain}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [students, search]);

  const cohortSize = useMemo(() => {
    if (mode !== "cohort") return selected.size;
    return students.filter(
      (s) => (!form.domain || s.domain === form.domain) && (!form.year || s.year === form.year)
    ).length;
  }, [mode, selected, students, form.domain, form.year]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (form.title.trim().length < 4) {
      toast.warning("Give the task a title");
      return;
    }
    if (mode === "individual" && selected.size === 0) {
      toast.warning("Pick at least one student");
      return;
    }
    if (mode === "cohort" && !form.domain && !form.year) {
      toast.warning("Choose a domain or a year to broadcast to");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          assigneeIds: mode === "individual" ? [...selected] : [],
          domain: mode === "cohort" ? form.domain : "",
          year: mode === "cohort" ? form.year : "",
          priority: form.priority,
          dueDate: form.dueDate || null,
          points: Number(form.points) || 0,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not assign the task", payload.error);
        return;
      }
      toast.success(
        `Task assigned to ${payload.data.created} ${payload.data.created === 1 ? "student" : "students"}`
      );
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
      size="lg"
      title="Assign a task"
      description="Give it to specific students, or broadcast it across a domain or year in one action."
      footer={
        <>
          <span className="mr-auto text-[11.5px] font-medium" style={{ color: "var(--text-faint)" }}>
            {cohortSize} {cohortSize === 1 ? "student" : "students"} will receive this
          </span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={cohortSize === 0}>
            Assign task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" htmlFor="t-title" required>
          <Input
            id="t-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Ship the domain sprint deliverable"
          />
        </Field>

        <Field label="Description" htmlFor="t-desc" help="What does done look like? Be concrete.">
          <Textarea
            id="t-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Acceptance criteria, links, anything the student needs to get started."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Priority" htmlFor="t-priority">
            <Select id="t-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {TASK_PRIORITY.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0)}
                  {p.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="t-due">
            <Input id="t-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Points" htmlFor="t-points" help="Awarded on sign-off.">
            <Input
              id="t-points"
              type="number"
              min={0}
              max={200}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-default)" }}>
            Who gets it?
          </p>
          <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
            {(["individual", "cohort"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setMode(option)}
                className="h-8 flex-1 rounded-[8px] px-3 text-[12.5px] font-semibold capitalize transition-colors"
                style={{
                  background: mode === option ? "var(--accent-soft)" : "transparent",
                  color: mode === option ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {option === "individual" ? "Specific students" : "Whole cohort"}
              </button>
            ))}
          </div>
        </div>

        {mode === "cohort" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Domain" htmlFor="t-domain">
              <Select id="t-domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                <option value="">Any domain</option>
                {options.domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year / batch" htmlFor="t-year">
              <Select id="t-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                <option value="">Any year</option>
                {options.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div>
            <Input
              icon="search"
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search students"
            />
            <div
              className="mt-2 max-h-56 overflow-y-auto rounded-[10px] border"
              style={{ borderColor: "var(--line-soft)" }}
            >
              {visible.map((student) => {
                const on = selected.has(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => toggle(student.id)}
                    className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 transition-colors"
                    style={{
                      borderColor: "var(--line-soft)",
                      background: on ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border"
                      style={{
                        borderColor: on ? "var(--accent)" : "var(--line-strong)",
                        background: on ? "var(--accent)" : "transparent",
                      }}
                    >
                      {on ? <Icon name="check" className="h-3 w-3 text-white" /> : null}
                    </span>
                    <PersonCell
                      name={student.name}
                      seed={student.id}
                      meta={`${student.rollNo} · ${student.domain}`}
                      size={26}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
