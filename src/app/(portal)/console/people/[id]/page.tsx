import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader, DataRow } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MiniBars, ProgressRing } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { requireConsole } from "@/lib/auth";
import {
  ATTENDANCE_HOURS,
  PERMISSION_LABEL,
  ROLE_LABEL,
  WORKLOG_SLOTS,
  type Permission,
  type Role,
} from "@/lib/constants";
import { formatDay, relativeTime } from "@/lib/dates";
import { can, grantedPermissions, type PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { attendanceSummary } from "@/lib/queries";
import { titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: person?.name ?? "Person" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireConsole();
  const subject = viewer as PermissionSubject;
  const { id } = await params;

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, rollNo: true, email: true, department: true, year: true,
      mobile: true, domain: true, mentorName: true, linkedin: true, github: true,
      role: true, systemStatus: true, rewardPoints: true, lastLoginAt: true, createdAt: true,
      mustChangePassword: true,
      permUserManagement: true, permScanStudentQr: true, permMentorTasks: true,
      permLinkedinTracker: true, permWorklogs: true, permNotifications: true,
      permAttendanceLogs: true, permExtensionRequest: true, permAdminDatabase: true,
      permActivityApproval: true,
    },
  });

  if (!person) notFound();

  const showAttendance = can(subject, "permAttendanceLogs");
  const showWorklogs = can(subject, "permWorklogs");

  const [attendance, worklogs, tasks, passes, linkedin, rewards] = await Promise.all([
    showAttendance
      ? attendanceSummary(person.id, { days: 30, joinedAt: person.createdAt })
      : Promise.resolve(null),
    showWorklogs
      ? prisma.worklog.findMany({
          where: { userId: person.id },
          orderBy: { date: "desc" },
          take: 10,
          select: { id: true, date: true, s1: true, s2: true, s3: true, s4: true, s5: true, status: true, mentorRemark: true },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { assigneeId: person.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, points: true },
    }),
    prisma.activityPass.findMany({
      where: { userId: person.id },
      orderBy: { date: "desc" },
      take: 6,
      select: { id: true, date: true, destination: true, status: true, fromTime: true, toTime: true },
    }),
    prisma.linkedinPost.findMany({
      where: { userId: person.id },
      orderBy: { postedOn: "desc" },
      take: 5,
      select: { id: true, url: true, postedOn: true, verified: true, reactions: true },
    }),
    prisma.rewardEntry.findMany({
      where: { userId: person.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, points: true, reason: true, source: true },
    }),
  ]);

  const permissions = grantedPermissions(person as PermissionSubject);
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div>
      <div className="mb-3">
        <Link
          href="/console/people"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
          style={{ color: "var(--text-muted)" }}
        >
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Back to people
        </Link>
      </div>

      <PageHeader
        title={titleCase(person.name)}
        description={`${person.rollNo} · ${person.email}`}
        actions={
          <>
            <StatusBadge status={person.role} label={ROLE_LABEL[person.role as Role]} />
            <StatusBadge status={person.systemStatus} />
          </>
        }
      />

      {/* Identity ------------------------------------------------------- */}
      <Card thread className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={person.name} seed={person.id} size={64} ring />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
              {person.domain}
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {person.year} · {titleCase(person.department)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="amber" icon="trophy">
                {person.rewardPoints} points
              </Badge>
              {person.mustChangePassword ? (
                <Badge tone="red" icon="lock">
                  Still on the issued password
                </Badge>
              ) : null}
              <Badge tone="slate" icon="clock">
                {person.lastLoginAt ? `Seen ${relativeTime(person.lastLoginAt)}` : "Never signed in"}
              </Badge>
            </div>
          </div>

          {attendance ? (
            <div className="ml-auto flex items-center gap-4">
              <ProgressRing
                value={attendance.rate}
                size={82}
                tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
                sublabel="30 days"
              />
            </div>
          ) : null}
        </div>
      </Card>

      {/* KPIs ----------------------------------------------------------- */}
      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        {attendance ? (
          <StatTile
            label="Attendance"
            value={`${attendance.rate}%`}
            icon="check-circle"
            tone={attendance.rate >= 85 ? "green" : attendance.rate >= 70 ? "amber" : "red"}
            caption={`${attendance.fullDays} full days · ${attendance.streak}-day streak`}
          />
        ) : null}
        <StatTile label="Worklogs" value={worklogs.length} icon="clipboard" tone="blue" caption="Most recent shown below" />
        <StatTile label="Tasks done" value={doneTasks} unit={`/ ${tasks.length}`} icon="target" tone="green" />
        <StatTile
          label="Verified posts"
          value={linkedin.filter((p) => p.verified).length}
          icon="linkedin"
          tone="red"
          caption={`${linkedin.length} submitted`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {attendance ? (
            <Card>
              <CardHeader
                icon="chart"
                title="Attendance shape"
                subtitle={`${attendance.hoursLogged} of ${attendance.hoursPossible} hours over 30 days.`}
                action={
                  <LinkButton href="/console/attendance" size="sm" variant="ghost" iconRight="chevron-right">
                    Matrix
                  </LinkButton>
                }
              />
              <MiniBars
                data={attendance.byDay}
                tone="blue"
                height={72}
                formatLabel={(key, value) => `${formatDay(key, "medium")} — ${value}/${ATTENDANCE_HOURS.length}`}
              />
            </Card>
          ) : null}

          {showWorklogs ? (
            <Card>
              <CardHeader icon="clipboard" title="Recent worklogs" subtitle="Newest first." />
              {worklogs.length === 0 ? (
                <EmptyState compact icon="clipboard" title="No worklogs submitted yet" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {worklogs.map((log) => (
                    <li key={log.id} className="inset-panel p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {formatDay(log.date, "long")}
                        </span>
                        <StatusBadge status={log.status} />
                      </div>
                      <dl className="mt-2 flex flex-col gap-1.5">
                        {WORKLOG_SLOTS.map((slot) => {
                          const value = log[slot.key];
                          if (!value) return null;
                          return (
                            <div key={slot.key} className="flex gap-3">
                              <dt
                                className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-[0.07em]"
                                style={{ color: "var(--text-faint)" }}
                              >
                                {slot.label.replace("Slot ", "S")}
                              </dt>
                              <dd className="text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                                {value}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      {log.mentorRemark ? (
                        <p
                          data-accent={log.status === "FLAGGED" ? "red" : "green"}
                          className="mt-2 rounded-[8px] px-2.5 py-1.5 text-[11.5px]"
                          style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                        >
                          {log.mentorRemark}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader icon="target" title="Tasks" subtitle={`${tasks.length} assigned in total.`} />
            {tasks.length === 0 ? (
              <EmptyState compact icon="target" title="No tasks assigned" />
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <li key={task.id} className="inset-panel flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                        {task.title}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {task.dueDate ? `Due ${formatDay(task.dueDate, "medium")}` : "No due date"} · {task.points} pts
                      </span>
                    </span>
                    <StatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card>
            <CardHeader icon="user" title="Record" />
            <dl>
              <DataRow label="Roll number" value={person.rollNo} mono />
              <DataRow label="Email" value={person.email} mono />
              <DataRow label="Mobile" value={person.mobile} mono />
              <DataRow label="Department" value={titleCase(person.department)} />
              <DataRow label="Year / batch" value={person.year} />
              <DataRow label="Domain" value={person.domain} />
              <DataRow label="Mentor" value={person.mentorName} />
              <DataRow
                label="LinkedIn"
                value={
                  person.linkedin ? (
                    <a href={person.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                      Open profile
                    </a>
                  ) : (
                    ""
                  )
                }
              />
              <DataRow
                label="GitHub"
                value={
                  person.github ? (
                    <a href={person.github} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                      Open profile
                    </a>
                  ) : (
                    ""
                  )
                }
              />
              <DataRow label="On the portal since" value={formatDay(person.createdAt.toISOString().slice(0, 10), "long")} />
            </dl>
          </Card>

          {permissions.length > 0 ? (
            <Card>
              <CardHeader icon="shield" title="Console access" subtitle={`${permissions.length} modules granted.`} />
              <ul className="flex flex-wrap gap-1.5">
                {permissions.map((permission) => (
                  <li key={permission}>
                    <Badge tone="green" icon="check">
                      {PERMISSION_LABEL[permission as Permission]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader icon="ticket" title="Activity passes" />
            {passes.length === 0 ? (
              <EmptyState compact icon="ticket" title="No passes requested" />
            ) : (
              <ul className="flex flex-col gap-2">
                {passes.map((pass) => (
                  <li key={pass.id} className="flex items-center gap-2.5 border-b py-2 last:border-0" style={{ borderColor: "var(--line-soft)" }}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium" style={{ color: "var(--text-default)" }}>
                        {pass.destination}
                      </span>
                      <span className="block text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                        {formatDay(pass.date, "medium")} · {pass.fromTime}–{pass.toTime}
                      </span>
                    </span>
                    <StatusBadge status={pass.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="trophy" title="Points ledger" subtitle={`${person.rewardPoints} total.`} />
            {rewards.length === 0 ? (
              <EmptyState compact icon="trophy" title="No points yet" />
            ) : (
              <ul className="flex flex-col">
                {rewards.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 border-b py-2 last:border-0" style={{ borderColor: "var(--line-soft)" }}>
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--text-default)" }}>
                      {entry.reason}
                    </span>
                    <span
                      data-accent={entry.points >= 0 ? "green" : "red"}
                      className="shrink-0 text-[12.5px] font-bold tabular-nums"
                      style={{ color: "var(--tone)" }}
                    >
                      {entry.points >= 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
