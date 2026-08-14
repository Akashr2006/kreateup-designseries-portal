import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";
import { toDayKey } from "@/lib/dates";

import { WorklogReview, type ReviewRow } from "./WorklogReview";

export const metadata: Metadata = { title: "Worklog review" };
export const dynamic = "force-dynamic";

export default async function ConsoleWorklogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; domain?: string; year?: string; date?: string }>;
}) {
  await requirePermission("permWorklogs");
  const params = await searchParams;

  const status = params.status ?? "SUBMITTED";
  const domain = params.domain ?? "ALL";
  const year = params.year ?? "ALL";
  const date = params.date ?? "";

  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(date ? { date } : {}),
    ...(domain !== "ALL" || year !== "ALL"
      ? {
          user: {
            ...(domain !== "ALL" ? { domain } : {}),
            ...(year !== "ALL" ? { year } : {}),
          },
        }
      : {}),
  };

  const [logs, options, counts] = await Promise.all([
    prisma.worklog.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true, date: true, s1: true, s2: true, s3: true, s4: true, s5: true,
        status: true, mentorRemark: true,
        task: { select: { title: true } },
        user: { select: { id: true, name: true, rollNo: true, domain: true, year: true } },
      },
    }),
    filterOptions(),
    Promise.all([
      prisma.worklog.count({ where: { status: "SUBMITTED" } }),
      prisma.worklog.count({ where: { status: "FLAGGED" } }),
      prisma.worklog.count({ where: { status: "REVIEWED" } }),
      prisma.worklog.count({ where: { date: toDayKey() } }),
    ]),
  ]);

  const [awaiting, flagged, reviewed, todayCount] = counts;

  const rows: ReviewRow[] = logs.map((log) => ({
    id: log.id,
    date: log.date,
    s1: log.s1,
    s2: log.s2,
    s3: log.s3,
    s4: log.s4,
    s5: log.s5,
    status: log.status,
    mentorRemark: log.mentorRemark,
    taskTitle: log.task?.title ?? null,
    student: log.user,
  }));

  return (
    <div>
      <PageHeader
        title="Worklog review"
        description="Read what students actually did and sign it off. A flag sends the log back with your remark attached, and the student can revise and resubmit."
        actions={
          <LinkButton href="/api/export?table=worklogs" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={awaiting}
          icon="clock"
          tone={awaiting > 20 ? "red" : awaiting > 0 ? "amber" : "green"}
          caption={awaiting === 0 ? "Queue is clear" : "Sitting with you"}
        />
        <StatTile
          label="Flagged"
          value={flagged}
          icon="flag"
          tone={flagged > 0 ? "red" : "slate"}
          caption="Sent back for revision"
        />
        <StatTile label="Signed off" value={reviewed} icon="check-circle" tone="green" caption="All time" />
        <StatTile label="Submitted today" value={todayCount} icon="calendar" tone="blue" />
      </div>

      <WorklogReview
        logs={rows}
        options={{ domains: options.domains, years: options.years }}
        filters={{ status, domain, year, date }}
      />
    </div>
  );
}
