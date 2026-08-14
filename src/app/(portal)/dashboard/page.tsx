import type { Metadata } from "next";
import Link from "next/link";

import { CheckInPanel } from "@/components/features/CheckInPanel";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { AnalyticsChart } from "@/components/ui/AnalyticsChart";
import { ProgressRing } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { requireUser } from "@/lib/auth";
import { ATTENDANCE_CUTOFF_MINUTES, ATTENDANCE_HOURS } from "@/lib/constants";
import { formatDay, greeting, minutesSinceMidnight, relativeTime, toDayKey, weekdayShort } from "@/lib/dates";
import { studentDashboard } from "@/lib/queries";
import { shortYear, truncate } from "@/lib/utils";
import { canOpenConsole, type PermissionSubject } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = toDayKey();
  const data = await studentDashboard(user);

  const closed = minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES;
  const attendanceDelta =
    data.attendance.previousRate > 0
      ? data.attendance.rate - data.attendance.previousRate
      : null;

  const worklogDone = Boolean(data.worklog.todayLog);
  const attendanceDone = data.attendance.todayHours.length >= ATTENDANCE_HOURS.length;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <Card padded={false} thread className="animate-rise">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-faint)" }}>
              {formatDay(today, "long")}
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight sm:text-[28px]" style={{ letterSpacing: "-0.032em" }}>
              {greeting()}, {user.name.split(" ")[0]}
              <span style={{ color: "var(--color-brand-amber)" }}>.</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="blue">{user.domain}</Badge>
              {user.year ? <Badge tone="slate">{shortYear(user.year)}</Badge> : null}
              {user.mentorName ? <Badge tone="slate">Mentor · {user.mentorName.split(" - ")[0]}</Badge> : null}
            </div>
          </div>

          {/* Today's two obligations, at a glance. */}
          <div className="flex shrink-0 items-center gap-3">
            <TodayChip
              done={attendanceDone}
              label="Check-in"
              detail={`${data.attendance.todayHours.length}/${ATTENDANCE_HOURS.length} hrs`}
              href="/attendance"
            />
            <TodayChip
              done={worklogDone}
              label="Worklog"
              detail={worklogDone ? "Submitted" : "Not yet"}
              href="/worklog"
            />
          </div>
        </div>

        {user.mustChangePassword ? (
          <div
            data-accent="amber"
            className="flex flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-6"
            style={{ background: "var(--tone-soft)", borderColor: "var(--line-soft)" }}
          >
            <Icon name="lock" className="h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <p className="min-w-0 flex-1 text-[12.5px] font-medium" style={{ color: "var(--tone)" }}>
              You are still on the password your mentor issued. Set your own before you use the portal further.
            </p>
            <LinkButton href="/profile#security" size="sm" variant="secondary">
              Change password
            </LinkButton>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* KPI row                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Attendance"
          value={`${data.attendance.rate}%`}
          icon="check-circle"
          tone={data.attendance.rate >= 85 ? "green" : data.attendance.rate >= 70 ? "amber" : "red"}
          delta={attendanceDelta}
          caption={`${data.attendance.hoursLogged} of ${data.attendance.hoursPossible} hrs · 30 days`}
          href="/attendance"
        />
        <StatTile
          label="Worklogs this week"
          value={data.worklog.thisWeek}
          unit="/ 6"
          icon="clipboard"
          tone={data.worklog.thisWeek >= 5 ? "green" : data.worklog.thisWeek >= 3 ? "amber" : "red"}
          caption={data.worklog.flagged > 0 ? `${data.worklog.flagged} flagged for revision` : `${data.worklog.thisMonth} this month`}
          href="/worklog"
        />
        <StatTile
          label="Reward points"
          value={user.rewardPoints}
          icon="trophy"
          tone="amber"
          caption={data.rank ? `Rank ${data.rank.position} of ${data.rank.total}` : "Not ranked"}
          href="/leaderboard"
        />
        <StatTile
          label="Open tasks"
          value={data.openTaskCount}
          icon="target"
          tone={data.openTaskCount === 0 ? "green" : data.openTaskCount > 3 ? "red" : "blue"}
          caption={data.openTaskCount === 0 ? "Nothing pending" : "Assigned by your mentor"}
          href="/tasks"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main grid                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          {/* Check-in */}
          <Card className="animate-rise">
            <CardHeader
              icon="check-circle"
              title="Today's check-in"
              subtitle={
                attendanceDone
                  ? "All seven hours are in for today."
                  : "Tap each hour you were present for, then add one line about the work."
              }
              action={
                <LinkButton href="/attendance" size="sm" variant="ghost" iconRight="chevron-right">
                  History
                </LinkButton>
              }
            />
            <CheckInPanel date={today} loggedHours={data.attendance.todayHours} closed={closed} compact />
          </Card>

          {/* Attendance trend */}
          <Card className="animate-rise">
            <CardHeader
              icon="chart"
              title="Last 30 days"
              subtitle={`${data.attendance.daysPresent} days present · ${data.attendance.fullDays} full days · ${data.attendance.streak}-day streak`}
            />
            <div className="flex items-center gap-5">
              <ProgressRing
                value={data.attendance.rate}
                size={104}
                tone={data.attendance.rate >= 85 ? "green" : data.attendance.rate >= 70 ? "amber" : "red"}
                sublabel="attended"
              />
              <div className="min-w-0 flex-1">
                <AnalyticsChart
                  data={data.attendance.byDay}
                  tone="blue"
                  height={150}
                  unit=" hrs"
                  target={ATTENDANCE_HOURS.length}
                  denominator={ATTENDANCE_HOURS.length}
                />
              </div>
            </div>
          </Card>

          {/* Tasks */}
          <Card className="animate-rise">
            <CardHeader
              icon="target"
              title="What's on your plate"
              subtitle="Sprint deliverables assigned by your mentor."
              action={
                <LinkButton href="/tasks" size="sm" variant="ghost" iconRight="chevron-right">
                  All tasks
                </LinkButton>
              }
            />
            {data.tasks.length === 0 ? (
              <EmptyState
                compact
                icon="check-circle"
                tone="green"
                title="Nothing outstanding"
                description="Every task assigned to you is done. Your mentor will add more as the sprint moves."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href="/tasks"
                      className="inset-panel flex items-center gap-3 p-3 transition-colors hover:border-[var(--accent)]"
                    >
                      <span
                        data-accent={
                          task.priority === "CRITICAL" ? "red" : task.priority === "HIGH" ? "amber" : "blue"
                        }
                        className="h-8 w-[3px] shrink-0 rounded-full"
                        style={{ background: "var(--tone)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {task.title}
                        </span>
                        <span className="block text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {task.dueDate ? `Due ${formatDay(task.dueDate, "medium")}` : "No due date"} · {task.points} pts
                        </span>
                      </span>
                      <StatusBadge status={task.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Side column                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card className="animate-rise">
            <CardHeader
              icon="bell"
              title="Announcements"
              subtitle={data.unread > 0 ? `${data.unread} unread` : "You are up to date."}
              action={
                <LinkButton href="/announcements" size="sm" variant="ghost" iconRight="chevron-right">
                  All
                </LinkButton>
              }
            />
            {data.notifications.length === 0 ? (
              <EmptyState compact icon="bell" title="No announcements yet" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.notifications.map((item) => (
                  <li key={item.id}>
                    <Link href="/announcements" className="block rounded-[10px] p-2 -m-2 transition-colors hover:bg-[var(--surface-inset)]">
                      <span className="flex items-center gap-2">
                        {!item.read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-brand-blue)" }} />
                        ) : null}
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: "var(--text-strong)", opacity: item.read ? 0.75 : 1 }}
                        >
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {truncate(item.body, 96)}
                      </span>
                      <span className="mt-1.5 block text-[10.5px] font-medium" style={{ color: "var(--text-faint)" }}>
                        {relativeTime(item.createdAt)} · {item.author.name.split(" ")[0]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="animate-rise">
            <CardHeader
              icon="ticket"
              title="Activity passes"
              subtitle="Upcoming and pending requests."
              action={
                <LinkButton href="/passes" size="sm" variant="ghost" iconRight="chevron-right">
                  All
                </LinkButton>
              }
            />
            {data.passes.length === 0 ? (
              <EmptyState
                compact
                icon="ticket"
                title="No upcoming passes"
                description="Request one when you need to be off the floor during session hours."
                action={
                  <LinkButton href="/passes" size="sm" variant="secondary" icon="plus">
                    Request a pass
                  </LinkButton>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {data.passes.map((pass) => (
                  <li key={pass.id} className="inset-panel p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                          {pass.destination}
                        </p>
                        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                          {formatDay(pass.date, "medium")} · {pass.fromTime}–{pass.toTime}
                        </p>
                      </div>
                      <StatusBadge status={pass.status} />
                    </div>
                    {pass.status === "APPROVED" ? (
                      <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--color-brand-green)" }}>
                        {pass.passCode}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <QuickLinks isStaff={canOpenConsole(user as PermissionSubject)} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TodayChip({
  done,
  label,
  detail,
  href,
}: {
  done: boolean;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      data-accent={done ? "green" : "amber"}
      className="flex flex-col items-center gap-1.5 rounded-[13px] border px-4 py-3 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: "var(--tone)", background: "var(--tone-soft)" }}
    >
      <span
        className={done ? "grid h-8 w-8 place-items-center rounded-full" : "grid h-8 w-8 place-items-center rounded-full animate-pulse-ring"}
        style={{ background: "var(--tone)", color: "#fff" }}
      >
        <Icon name={done ? "check" : "clock"} className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--tone)" }}>
        {label}
      </span>
      <span className="text-[10.5px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
        {detail}
      </span>
    </Link>
  );
}

function QuickLinks({ isStaff }: { isStaff: boolean }) {
  return (
    <Card className="animate-rise">
      <CardHeader icon="sparkle" title="Quick actions" />
      <div className="grid grid-cols-2 gap-2">
        <QuickLink href="/worklog" icon="clipboard" label="Log today's work" tone="blue" />
        <QuickLink href="/passes" icon="ticket" label="Request a pass" tone="amber" />
        <QuickLink href="/notes" icon="note" label="Open my notes" tone="green" />
        {isStaff ? (
          <QuickLink href="/console" icon="chart" label="Admin console" tone="red" />
        ) : (
          <QuickLink href="/leaderboard" icon="trophy" label="Leaderboard" tone="red" />
        )}
      </div>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
  tone,
}: {
  href: string;
  icon: "clipboard" | "ticket" | "note" | "chart" | "trophy";
  label: string;
  tone: "blue" | "red" | "amber" | "green";
}) {
  return (
    <Link
      href={href}
      data-accent={tone}
      className="inset-panel flex flex-col gap-2 p-3 transition-colors hover:border-[var(--tone)]"
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-[9px]"
        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
      >
        <Icon name={icon} className="h-[17px] w-[17px]" />
      </span>
      <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
        {label}
      </span>
    </Link>
  );
}
