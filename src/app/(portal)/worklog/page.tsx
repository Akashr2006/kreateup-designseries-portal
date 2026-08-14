import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { worklogSummary } from "@/lib/queries";
import { startOfWeek, toDayKey } from "@/lib/dates";

import { WorklogClient, type WorklogRow } from "./WorklogClient";

export const metadata: Metadata = { title: "Worklog" };
export const dynamic = "force-dynamic";

export default async function WorklogPage() {
  const user = await requireUser();
  const today = toDayKey();

  const [summary, openTasks, reviewed, extensionRows] = await Promise.all([
    worklogSummary(user.id),
    prisma.task.findMany({
      where: { assigneeId: user.id, status: { notIn: ["DONE"] } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.worklog.count({ where: { userId: user.id, status: "REVIEWED" } }),
    prisma.extensionRequest.findMany({
      where: { userId: user.id },
      select: { date: true, status: true },
    }),
  ]);

  const extensions = Object.fromEntries(extensionRows.map((row) => [row.date, row.status]));

  const logs: WorklogRow[] = summary.recent.map((log) => ({
    id: log.id,
    date: log.date,
    s1: log.s1,
    s2: log.s2,
    s3: log.s3,
    s4: log.s4,
    s5: log.s5,
    status: log.status,
    mentorRemark: log.mentorRemark,
    taskId: log.taskId,
    task: log.task,
  }));

  const todayLog = logs.find((log) => log.date === today) ?? null;

  // Six working days a week (Mon–Sat), so that is the weekly target.
  const weekTarget = 6;
  const weekStart = startOfWeek(today);

  return (
    <div>
      <PageHeader
        title="Worklog"
        description="A short, honest write-up of each slot. This is the record your mentor reads before a review, and the thing you will be glad to have when you write your portfolio."
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        <StatTile
          label="This week"
          value={summary.thisWeek}
          unit={`/ ${weekTarget}`}
          icon="calendar"
          tone={summary.thisWeek >= 5 ? "green" : summary.thisWeek >= 3 ? "amber" : "red"}
          caption={`Week of ${weekStart.slice(8)}${weekStart.slice(5, 7) === today.slice(5, 7) ? "" : "/" + weekStart.slice(5, 7)}`}
        />
        <StatTile
          label="This month"
          value={summary.thisMonth}
          icon="clipboard"
          tone="blue"
          caption="Logs submitted"
        />
        <StatTile
          label="Reviewed"
          value={reviewed}
          icon="check-circle"
          tone="green"
          caption="Signed off by a mentor"
        />
        <StatTile
          label="Needs revision"
          value={summary.flagged}
          icon="alert"
          tone={summary.flagged > 0 ? "red" : "slate"}
          caption={summary.flagged > 0 ? "Open them and add detail" : "Nothing flagged"}
        />
      </div>

      <WorklogClient logs={logs} tasks={openTasks} todayLog={todayLog} extensions={extensions} />
    </div>
  );
}
