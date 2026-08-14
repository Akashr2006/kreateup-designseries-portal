import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/PageHeader";
import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { AnalyticsChart } from "@/components/ui/AnalyticsChart";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { requireConsole } from "@/lib/auth";
import { ATTENDANCE_HOURS } from "@/lib/constants";
import { formatDay, relativeTime, toDayKey } from "@/lib/dates";
import { consoleNavFor } from "@/lib/nav";
import { can, type PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { consoleOverview } from "@/lib/queries";
import { pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Console" };
export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const user = await requireConsole();
  const subject = user as PermissionSubject;
  const today = toDayKey();

  const overview = await consoleOverview();

  // Only fetch the queues this admin is actually allowed to act on.
  const [pendingPasses, flaggedWorklogs, recentAudit, atRisk] = await Promise.all([
    can(subject, "permActivityApproval")
      ? prisma.activityPass.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 5,
          select: {
            id: true, date: true, fromTime: true, toTime: true, destination: true, createdAt: true,
            user: { select: { id: true, name: true, rollNo: true } },
          },
        })
      : Promise.resolve([]),
    can(subject, "permWorklogs")
      ? prisma.worklog.findMany({
          where: { status: "SUBMITTED" },
          orderBy: { date: "desc" },
          take: 5,
          select: { id: true, date: true, s1: true, user: { select: { id: true, name: true, rollNo: true, domain: true } } },
        })
      : Promise.resolve([]),
    can(subject, "permAdminDatabase")
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, action: true, entity: true, createdAt: true, actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
    can(subject, "permAttendanceLogs") ? lowAttendanceStudents() : Promise.resolve([]),
  ]);

  const navItems = consoleNavFor(subject).filter((item) => item.href !== "/console");

  return (
    <div>
      <PageHeader
        title="Console"
        description={`Programme health for ${formatDay(today, "long")}. Everything here reflects the live database — there is no nightly job in between.`}
        actions={
          <Badge tone="green" dot>
            {overview.activeCount} active accounts
          </Badge>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Today                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        <StatTile
          label="On the floor today"
          value={overview.presentToday}
          unit={`/ ${overview.studentCount}`}
          icon="users"
          tone={overview.attendanceRateToday >= 75 ? "green" : overview.attendanceRateToday >= 50 ? "amber" : "red"}
          caption={`${overview.attendanceRateToday}% checked in`}
          footer={<ProgressBar value={overview.attendanceRateToday} tone={overview.attendanceRateToday >= 75 ? "green" : "amber"} />}
        />
        <StatTile
          label="Worklogs today"
          value={overview.worklogsToday}
          unit={`/ ${overview.studentCount}`}
          icon="clipboard"
          tone={overview.worklogRateToday >= 70 ? "green" : "amber"}
          caption={`${overview.worklogRateToday}% submitted`}
          footer={<ProgressBar value={overview.worklogRateToday} tone={overview.worklogRateToday >= 70 ? "green" : "amber"} />}
        />
        <StatTile
          label="Passes awaiting you"
          value={overview.pendingPasses}
          icon="ticket"
          tone={overview.pendingPasses > 0 ? "amber" : "slate"}
          caption={overview.pendingPasses > 0 ? "Students are waiting" : "Queue is clear"}
          href={can(subject, "permActivityApproval") ? "/console/passes" : undefined}
        />
        <StatTile
          label="Flagged worklogs"
          value={overview.flaggedWorklogs}
          icon="alert"
          tone={overview.flaggedWorklogs > 0 ? "red" : "slate"}
          caption={overview.flaggedWorklogs > 0 ? "Sent back for revision" : "Nothing flagged"}
          href={can(subject, "permWorklogs") ? "/console/worklogs" : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Attendance trend */}
          <Card>
            <CardHeader
              icon="chart"
              title="Attendance — last 14 days"
              subtitle="Unique students who logged at least one hour."
            />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProgressRing
                value={overview.attendanceRateToday}
                size={100}
                tone={overview.attendanceRateToday >= 75 ? "green" : "amber"}
                sublabel="today"
              />
              <div className="min-w-0 flex-1">
                <AnalyticsChart
                  data={overview.trend}
                  tone="blue"
                  height={168}
                  unit=" students"
                  target={Math.round(overview.studentCount * 0.75)}
                  denominator={overview.studentCount}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <FloorStat label="Hours logged today" value={overview.hoursLoggedToday} />
              <FloorStat
                label="Avg hours per student"
                value={
                  overview.presentToday > 0
                    ? (overview.hoursLoggedToday / overview.presentToday).toFixed(1)
                    : "0"
                }
                suffix={`/ ${ATTENDANCE_HOURS.length}`}
              />
              <FloorStat label="Open tasks" value={overview.openTasks} />
            </div>
          </Card>

          {/* Queues */}
          {can(subject, "permActivityApproval") ? (
            <Card>
              <CardHeader
                icon="ticket"
                title="Pass requests waiting"
                subtitle="Oldest first — these students cannot leave until you decide."
                action={
                  <LinkButton href="/console/passes" size="sm" variant="ghost" iconRight="chevron-right">
                    Review all
                  </LinkButton>
                }
              />
              {pendingPasses.length === 0 ? (
                <EmptyState compact tone="green" icon="check-circle" title="Nothing waiting" description="Every request has been decided." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingPasses.map((pass) => (
                    <li key={pass.id}>
                      <Link href="/console/passes" className="inset-panel flex items-center gap-3 p-3 transition-colors hover:border-[var(--accent)]">
                        <PersonCell name={pass.user.name} seed={pass.user.id} meta={pass.user.rollNo} size={32} className="flex-1" />
                        <span className="hidden text-right sm:block">
                          <span className="block text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                            {pass.destination}
                          </span>
                          <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {formatDay(pass.date, "short")} · {pass.fromTime}–{pass.toTime}
                          </span>
                        </span>
                        <Badge tone="amber">{relativeTime(pass.createdAt)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {can(subject, "permWorklogs") ? (
            <Card>
              <CardHeader
                icon="clipboard"
                title="Worklogs to review"
                subtitle="Submitted and not yet signed off."
                action={
                  <LinkButton href="/console/worklogs" size="sm" variant="ghost" iconRight="chevron-right">
                    Open queue
                  </LinkButton>
                }
              />
              {flaggedWorklogs.length === 0 ? (
                <EmptyState compact tone="green" icon="check-circle" title="Queue is clear" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {flaggedWorklogs.map((log) => (
                    <li key={log.id}>
                      <Link href="/console/worklogs" className="inset-panel flex items-start gap-3 p-3 transition-colors hover:border-[var(--accent)]">
                        <PersonCell name={log.user.name} seed={log.user.id} meta={log.user.domain} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                            {log.s1}
                          </span>
                        </span>
                        <Badge tone="blue">{formatDay(log.date, "short")}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Side column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card>
            <CardHeader icon="grid" title="Your console modules" subtitle="What your account unlocks." />
            <ul className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inset-panel flex h-full flex-col gap-2 p-3 transition-colors hover:border-[var(--accent)]"
                  >
                    <Icon name={item.icon} className="h-[17px] w-[17px]" style={{ color: "var(--accent)" }} />
                    <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          {can(subject, "permAttendanceLogs") && atRisk.length > 0 ? (
            <Card>
              <CardHeader
                icon="alert"
                title="Below 75%"
                subtitle="Students who need a conversation."
                action={
                  <LinkButton href="/console/attendance" size="sm" variant="ghost" iconRight="chevron-right">
                    Matrix
                  </LinkButton>
                }
              />
              <ul className="flex flex-col gap-2">
                {atRisk.map((student) => (
                  <li key={student.id}>
                    <Link
                      href={`/console/people/${student.id}`}
                      className="flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-[var(--surface-inset)]"
                    >
                      <PersonCell name={student.name} seed={student.id} meta={student.domain} size={30} className="flex-1" />
                      <Badge tone={student.rate < 50 ? "red" : "amber"}>{student.rate}%</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader icon="layers" title="Cohort by domain" />
            <ul className="flex flex-col gap-2.5">
              {overview.domains.slice(0, 8).map((entry, index) => (
                <li key={entry.domain}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium" style={{ color: "var(--text-default)" }}>
                      {entry.domain}
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {entry.count}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct(entry.count, overview.studentCount)}
                    tone={(["blue", "red", "amber", "green"] as const)[index % 4]}
                    height={5}
                  />
                </li>
              ))}
            </ul>
          </Card>

          {can(subject, "permAdminDatabase") && recentAudit.length > 0 ? (
            <Card>
              <CardHeader
                icon="shield"
                title="Recent activity"
                subtitle="Every privileged action is recorded."
                action={
                  <LinkButton href="/console/database" size="sm" variant="ghost" iconRight="chevron-right">
                    Audit log
                  </LinkButton>
                }
              />
              <ul className="flex flex-col">
                {recentAudit.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2.5 border-b py-2 last:border-0"
                    style={{ borderColor: "var(--line-soft)" }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: "var(--text-default)" }}>
                      <span className="font-semibold">{entry.actor?.name.split(" ")[0] ?? "System"}</span>{" "}
                      {entry.action.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="shrink-0 text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                      {relativeTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FloorStat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="inset-panel p-3">
      <p className="text-[19px] font-bold leading-none tabular-nums" style={{ letterSpacing: "-0.03em" }}>
        {value}
        {suffix ? (
          <span className="ml-1 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        ) : null}
      </p>
      <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
    </div>
  );
}

/**
 * The five students with the weakest 30-day attendance. Computed in one query
 * plus one aggregation rather than per-student round trips.
 */
async function lowAttendanceStudents() {
  const from = toDayKey(new Date(Date.now() - 29 * 86_400_000));
  const to = toDayKey();

  const [students, rows] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", systemStatus: "ACTIVE" },
      select: { id: true, name: true, domain: true },
    }),
    prisma.attendance.groupBy({
      by: ["userId"],
      where: { date: { gte: from, lte: to } },
      _count: { userId: true },
    }),
  ]);

  const counts = new Map(rows.map((row) => [row.userId, row._count.userId]));

  // Working days in the window (Mon–Sat).
  let trackedDays = 0;
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(Date.now() - i * 86_400_000);
    if (date.getDay() !== 0) trackedDays += 1;
  }
  const possible = trackedDays * ATTENDANCE_HOURS.length;

  return students
    .map((student) => ({ ...student, rate: pct(counts.get(student.id) ?? 0, possible) }))
    .filter((student) => student.rate < 75)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 6);
}
