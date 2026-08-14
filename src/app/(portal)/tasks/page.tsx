import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";

import { TasksClient, type TaskRow } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const today = toDayKey();

  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      points: true,
      author: { select: { name: true } },
    },
  });

  const rows: TaskRow[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    points: task.points,
    authorName: task.author.name,
  }));

  const done = rows.filter((t) => t.status === "DONE");
  const open = rows.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const earned = done.reduce((sum, t) => sum + t.points, 0);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Sprint deliverables assigned by your mentor. Move a task along as you work on it — submitting it puts it in your mentor's review queue, and they close it out."
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        <StatTile label="Open" value={open.length} icon="target" tone={open.length > 3 ? "amber" : "blue"} caption="Assigned to you" />
        <StatTile
          label="Overdue"
          value={overdue.length}
          icon="alert"
          tone={overdue.length > 0 ? "red" : "green"}
          caption={overdue.length > 0 ? "Past the due date" : "Nothing late"}
        />
        <StatTile label="Completed" value={done.length} icon="check-circle" tone="green" caption="Signed off by a mentor" />
        <StatTile label="Points earned" value={earned} icon="trophy" tone="amber" caption="From completed tasks" />
      </div>

      <TasksClient tasks={rows} />
    </div>
  );
}
