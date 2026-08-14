import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";
import { toDayKey } from "@/lib/dates";

import { TaskConsole, type Candidate, type ConsoleTaskRow } from "./TaskConsole";

export const metadata: Metadata = { title: "Task assignment" };
export const dynamic = "force-dynamic";

export default async function ConsoleTasksPage() {
  await requirePermission("permMentorTasks");
  const today = toDayKey();

  const [tasks, students, options] = await Promise.all([
    prisma.task.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 250,
      select: {
        id: true, title: true, description: true, status: true, priority: true,
        dueDate: true, points: true,
        assignee: { select: { id: true, name: true, rollNo: true, domain: true, year: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", systemStatus: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rollNo: true, domain: true, year: true },
    }),
    filterOptions(),
  ]);

  const rows: ConsoleTaskRow[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    points: task.points,
    assignee: task.assignee,
    authorName: task.author.name,
  }));

  const candidates: Candidate[] = students;

  const open = rows.filter((t) => t.status !== "DONE").length;
  const awaitingSignOff = rows.filter((t) => t.status === "SUBMITTED").length;
  const blocked = rows.filter((t) => t.status === "BLOCKED").length;
  const overdue = rows.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < today).length;

  return (
    <div>
      <PageHeader
        title="Task assignment"
        description="Give a student sprint work, or broadcast the same task across a whole domain or year. Signing a task off is what releases its reward points."
        actions={
          <LinkButton href="/api/export?table=tasks" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open" value={open} icon="target" tone="blue" caption="Not yet signed off" />
        <StatTile
          label="Awaiting sign-off"
          value={awaitingSignOff}
          icon="clock"
          tone={awaitingSignOff > 0 ? "amber" : "green"}
          caption={awaitingSignOff > 0 ? "Students submitted these" : "Nothing waiting"}
        />
        <StatTile
          label="Blocked"
          value={blocked}
          icon="alert"
          tone={blocked > 0 ? "red" : "slate"}
          caption={blocked > 0 ? "Students flagged a blocker" : "None"}
        />
        <StatTile label="Overdue" value={overdue} icon="calendar" tone={overdue > 0 ? "red" : "green"} caption="Past the due date" />
      </div>

      <TaskConsole
        tasks={rows}
        students={candidates}
        options={{ domains: options.domains, years: options.years }}
      />
    </div>
  );
}
