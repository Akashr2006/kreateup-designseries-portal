import type { Metadata } from "next";

import { AttendanceMonthView } from "@/components/features/AttendanceMonthView";
import { CheckInPanel } from "@/components/features/CheckInPanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { MiniBars, ProgressRing } from "@/components/ui/Progress";
import { StatTile } from "@/components/ui/StatTile";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/Table";
import { EmptyRow } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth";
import { ATTENDANCE_CUTOFF_MINUTES, ATTENDANCE_HOURS, HOUR_WINDOW } from "@/lib/constants";
import { formatDay, minutesSinceMidnight, monthLabel, startOfMonth, toDayKey } from "@/lib/dates";
import { attendanceMonth, attendanceSummary } from "@/lib/queries";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const today = toDayKey();
  const monthKey = params.month ? `${params.month}-01` : startOfMonth(today);

  const [summary, month] = await Promise.all([
    attendanceSummary(user.id, { days: 30, joinedAt: user.createdAt }),
    attendanceMonth(user.id, monthKey),
  ]);

  const closed = minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES;
  const delta = summary.previousRate > 0 ? summary.rate - summary.previousRate : null;

  // Most recent days first, only the ones with something on them.
  const recent = [...month].reverse().filter((day) => day.hours.length > 0).slice(0, 14);

  const monthLogged = month.reduce((sum, day) => sum + day.hours.length, 0);
  const monthFullDays = month.filter((d) => d.hours.length >= ATTENDANCE_HOURS.length).length;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Seven trackable hours a day. Check in for the ones you attended, and keep an eye on the running percentage — anything under 75% gets flagged to your mentor."
        actions={
          <Badge tone={summary.streak >= 5 ? "green" : "blue"} icon="sparkle">
            {summary.streak}-day streak
          </Badge>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 sm:mb-5">
        <StatTile
          label="30-day rate"
          value={`${summary.rate}%`}
          icon="check-circle"
          tone={summary.rate >= 85 ? "green" : summary.rate >= 70 ? "amber" : "red"}
          delta={delta}
          caption={`${summary.hoursLogged} of ${summary.hoursPossible} hours`}
        />
        <StatTile
          label="Full days"
          value={summary.fullDays}
          unit={`/ ${summary.daysTracked}`}
          icon="calendar"
          tone="blue"
          caption="All seven hours logged"
        />
        <StatTile
          label="Days present"
          value={summary.daysPresent}
          unit={`/ ${summary.daysTracked}`}
          icon="users"
          tone="green"
          caption="At least one hour"
        />
        <StatTile
          label="Current streak"
          value={summary.streak}
          unit="days"
          icon="sparkle"
          tone="amber"
          caption="Consecutive days present"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] sm:gap-5">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card thread>
            <CardHeader
              icon="check-circle"
              title={`Check in — ${formatDay(today, "long")}`}
              subtitle="Each hour is logged separately, so a partial day is recorded honestly."
            />
            <CheckInPanel date={today} loggedHours={summary.todayHours} closed={closed} />
          </Card>

          <Card>
            <CardHeader
              icon="clock"
              title="Recent days"
              subtitle={`The last ${recent.length} days you logged, most recent first.`}
            />

            {/* Table from md up… */}
            <TableWrap className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Hours</TH>
                    <TH numeric>Logged</TH>
                    <TH>What you worked on</TH>
                  </TR>
                </THead>
                <TBody>
                  {recent.length === 0 ? (
                    <EmptyRow colSpan={4} message="Nothing logged this month yet." />
                  ) : (
                    recent.map((day) => (
                      <TR key={day.date} interactive>
                        <TD>
                          <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
                            {formatDay(day.date, "medium")}
                          </span>
                        </TD>
                        <TD>
                          <span className="flex gap-1">
                            {ATTENDANCE_HOURS.map((hour) => (
                              <span
                                key={hour}
                                data-accent={day.hours.includes(hour) ? "green" : "slate"}
                                title={`Hour ${hour} · ${HOUR_WINDOW[hour]}`}
                                className="grid h-5 w-5 place-items-center rounded-[5px] text-[9.5px] font-bold"
                                style={{
                                  background: day.hours.includes(hour) ? "var(--tone)" : "var(--surface-sunken)",
                                  color: day.hours.includes(hour) ? "#fff" : "var(--text-faint)",
                                }}
                              >
                                {hour}
                              </span>
                            ))}
                          </span>
                        </TD>
                        <TD numeric>
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                day.hours.length >= ATTENDANCE_HOURS.length
                                  ? "var(--color-brand-green)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {day.hours.length}/{ATTENDANCE_HOURS.length}
                          </span>
                        </TD>
                        <TD>
                          <span className="line-clamp-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                            {day.reason || "—"}
                          </span>
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrap>

            {/* …cards on phones. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {recent.length === 0 ? (
                <li className="py-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                  Nothing logged this month yet.
                </li>
              ) : (
                recent.map((day) => (
                  <li key={day.date} className="inset-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                        {formatDay(day.date, "medium")}
                      </span>
                      <Badge tone={day.hours.length >= ATTENDANCE_HOURS.length ? "green" : "amber"}>
                        {day.hours.length}/{ATTENDANCE_HOURS.length} hrs
                      </Badge>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {ATTENDANCE_HOURS.map((hour) => (
                        <span
                          key={hour}
                          data-accent={day.hours.includes(hour) ? "green" : "slate"}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            background: day.hours.includes(hour) ? "var(--tone)" : "var(--surface-sunken)",
                          }}
                        />
                      ))}
                    </div>
                    {day.reason ? (
                      <p className="mt-2 line-clamp-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {day.reason}
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card>
            <CardHeader
              icon="calendar"
              title={monthLabel(monthKey)}
              subtitle={`${monthFullDays} full days · ${monthLogged} hours this month`}
            />
            <AttendanceMonthView days={month} monthKey={monthKey} />
          </Card>

          <Card>
            <CardHeader icon="chart" title="30-day shape" subtitle="Hours logged per day." />
            <div className="flex items-center gap-4">
              <ProgressRing
                value={summary.rate}
                size={88}
                tone={summary.rate >= 85 ? "green" : summary.rate >= 70 ? "amber" : "red"}
                sublabel="rate"
              />
              <div className="min-w-0 flex-1">
                <MiniBars
                  data={summary.byDay}
                  tone="blue"
                  height={56}
                  formatLabel={(key, value) => `${formatDay(key, "medium")} — ${value}/${ATTENDANCE_HOURS.length}`}
                />
              </div>
            </div>

            <div
              data-accent={summary.rate >= 75 ? "green" : "red"}
              className="mt-4 flex items-start gap-2.5 rounded-[10px] p-3"
              style={{ background: "var(--tone-soft)" }}
            >
              <Icon name={summary.rate >= 75 ? "check-circle" : "alert"} className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
              <p className="text-[12px] leading-snug" style={{ color: "var(--tone)" }}>
                {summary.rate >= 75
                  ? "You are comfortably above the 75% threshold. Keep it steady."
                  : `You are below the 75% threshold. You need ${Math.max(
                      0,
                      Math.ceil((0.75 * summary.hoursPossible - summary.hoursLogged) / ATTENDANCE_HOURS.length)
                    )} more full days to get back above it.`}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader icon="info" title="Session hours" subtitle="The seven trackable hours." />
            <ul className="flex flex-col gap-1.5">
              {ATTENDANCE_HOURS.map((hour) => (
                <li
                  key={hour}
                  className="flex items-center justify-between rounded-[8px] px-2.5 py-1.5"
                  style={{ background: summary.todayHours.includes(hour) ? "var(--color-brand-green-050)" : "transparent" }}
                >
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-default)" }}>
                    Hour {hour}
                  </span>
                  <span className="font-mono text-[11.5px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {HOUR_WINDOW[hour]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
