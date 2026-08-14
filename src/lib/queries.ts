import "server-only";

import { prisma } from "./prisma";
import { ATTENDANCE_HOURS } from "./constants";
import {
  addDays,
  endOfMonth,
  lastNDays,
  rangeOfDays,
  startOfMonth,
  startOfWeek,
  toDayKey,
} from "./dates";
import { pct } from "./utils";

/** Fields every announcement list needs. */
const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  category: true,
  audience: true,
  audienceValue: true,
  pinned: true,
  link: true,
  createdAt: true,
  author: { select: { name: true, role: true } },
} as const;

/**
 * Announcements this user is allowed to see: everything addressed to ALL, plus
 * anything matching their year, domain or role.
 */
export async function visibleNotifications(user: {
  id: string;
  year: string;
  domain: string;
  role: string;
}) {
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { audience: "ALL" },
        { audience: "YEAR", audienceValue: user.year },
        { audience: "DOMAIN", audienceValue: user.domain },
        { audience: "ROLE", audienceValue: user.role },
      ],
    },
    select: NOTIFICATION_SELECT,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  const reads = await prisma.notificationRead.findMany({
    where: { userId: user.id, notificationId: { in: notifications.map((n) => n.id) } },
    select: { notificationId: true },
  });
  const readIds = new Set(reads.map((r) => r.notificationId));

  return notifications.map((n) => ({ ...n, read: readIds.has(n.id) }));
}

export async function unreadNotificationCount(user: {
  id: string;
  year: string;
  domain: string;
  role: string;
}) {
  const items = await visibleNotifications(user);
  return items.filter((n) => !n.read).length;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export type AttendanceSummary = {
  /** Percentage of trackable hours attended in the window. */
  rate: number;
  /** Percentage over the preceding window of the same length, for the delta. */
  previousRate: number;
  hoursLogged: number;
  hoursPossible: number;
  fullDays: number;
  daysPresent: number;
  daysTracked: number;
  streak: number;
  todayHours: number[];
  byDay: Array<{ key: string; value: number; max: number }>;
};

/**
 * Everything the dashboard and attendance page need in one pass.
 *
 * "Trackable" days exclude Sundays and any day before the student's account
 * existed — otherwise a student who joined last week would show a punishing
 * percentage they had no way of earning.
 */
export async function attendanceSummary(
  userId: string,
  options: { days?: number; joinedAt?: Date } = {}
): Promise<AttendanceSummary> {
  const days = options.days ?? 30;
  const today = toDayKey();

  const window = lastNDays(days, today);
  const previousWindow = lastNDays(days, addDays(window[0], -1));

  const joinKey = options.joinedAt ? toDayKey(options.joinedAt) : window[0];
  const trackable = (key: string) => new Date(key).getDay() !== 0 && key >= joinKey;

  const rows = await prisma.attendance.findMany({
    where: { userId, date: { gte: previousWindow[0], lte: today } },
    select: { date: true, hour: true },
  });

  const byDate = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = byDate.get(row.date) ?? new Set<number>();
    set.add(row.hour);
    byDate.set(row.date, set);
  }

  const countIn = (keys: string[]) => {
    const trackedDays = keys.filter(trackable);
    const logged = trackedDays.reduce((sum, key) => sum + (byDate.get(key)?.size ?? 0), 0);
    return {
      logged,
      possible: trackedDays.length * ATTENDANCE_HOURS.length,
      trackedDays,
    };
  };

  const current = countIn(window);
  const previous = countIn(previousWindow);

  const fullDays = current.trackedDays.filter(
    (key) => (byDate.get(key)?.size ?? 0) >= ATTENDANCE_HOURS.length
  ).length;
  const daysPresent = current.trackedDays.filter((key) => (byDate.get(key)?.size ?? 0) > 0).length;

  // Consecutive trackable days with at least one hour, walking backwards.
  let streak = 0;
  for (let i = current.trackedDays.length - 1; i >= 0; i -= 1) {
    const key = current.trackedDays[i];
    if (key === today && (byDate.get(key)?.size ?? 0) === 0) continue; // today is still open
    if ((byDate.get(key)?.size ?? 0) > 0) streak += 1;
    else break;
  }

  return {
    rate: pct(current.logged, current.possible),
    previousRate: pct(previous.logged, previous.possible),
    hoursLogged: current.logged,
    hoursPossible: current.possible,
    fullDays,
    daysPresent,
    daysTracked: current.trackedDays.length,
    streak,
    todayHours: [...(byDate.get(today) ?? [])].sort((a, b) => a - b),
    byDay: window.map((key) => ({
      key,
      value: byDate.get(key)?.size ?? 0,
      max: ATTENDANCE_HOURS.length,
    })),
  };
}

/** Month grid for the attendance calendar. */
export async function attendanceMonth(userId: string, monthKey: string) {
  const from = startOfMonth(monthKey);
  const to = endOfMonth(monthKey);

  const rows = await prisma.attendance.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: { date: true, hour: true, status: true, reason: true },
    orderBy: [{ date: "asc" }, { hour: "asc" }],
  });

  const byDate = new Map<string, { hours: number[]; reason: string; status: string }>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { hours: [], reason: row.reason, status: row.status };
    entry.hours.push(row.hour);
    if (!entry.reason) entry.reason = row.reason;
    byDate.set(row.date, entry);
  }

  return rangeOfDays(from, to).map((key) => ({
    date: key,
    hours: byDate.get(key)?.hours ?? [],
    reason: byDate.get(key)?.reason ?? "",
    status: byDate.get(key)?.status ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Worklog
// ---------------------------------------------------------------------------

export async function worklogSummary(userId: string) {
  const today = toDayKey();
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const [thisWeek, thisMonth, todayLog, flagged, recent] = await Promise.all([
    prisma.worklog.count({ where: { userId, date: { gte: weekStart, lte: today } } }),
    prisma.worklog.count({ where: { userId, date: { gte: monthStart, lte: today } } }),
    prisma.worklog.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.worklog.count({ where: { userId, status: "FLAGGED" } }),
    prisma.worklog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
      include: { task: { select: { id: true, title: true } } },
    }),
  ]);

  return { thisWeek, thisMonth, todayLog, flagged, recent };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function studentDashboard(user: {
  id: string;
  year: string;
  domain: string;
  role: string;
  createdAt: Date;
}) {
  const today = toDayKey();

  const [attendance, worklog, tasks, passes, notifications, rank] = await Promise.all([
    attendanceSummary(user.id, { days: 30, joinedAt: user.createdAt }),
    worklogSummary(user.id),
    prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 6,
      select: { id: true, title: true, status: true, priority: true, dueDate: true, points: true },
    }),
    prisma.activityPass.findMany({
      where: { userId: user.id, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 3,
      select: { id: true, date: true, fromTime: true, toTime: true, destination: true, status: true, passCode: true },
    }),
    visibleNotifications(user),
    leaderboardRank(user.id),
  ]);

  const openTaskCount = await prisma.task.count({
    where: { assigneeId: user.id, status: { notIn: ["DONE"] } },
  });

  return {
    attendance,
    worklog,
    tasks,
    openTaskCount,
    passes,
    notifications: notifications.slice(0, 4),
    unread: notifications.filter((n) => !n.read).length,
    rank,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export async function leaderboard(limit = 50) {
  return prisma.user.findMany({
    where: { role: "STUDENT", systemStatus: "ACTIVE" },
    orderBy: [{ rewardPoints: "desc" }, { name: "asc" }],
    take: limit,
    select: { id: true, name: true, rollNo: true, domain: true, year: true, rewardPoints: true },
  });
}

export async function leaderboardRank(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { rewardPoints: true, role: true } });
  if (!me || me.role !== "STUDENT") return null;

  const [ahead, total] = await Promise.all([
    prisma.user.count({
      where: { role: "STUDENT", systemStatus: "ACTIVE", rewardPoints: { gt: me.rewardPoints } },
    }),
    prisma.user.count({ where: { role: "STUDENT", systemStatus: "ACTIVE" } }),
  ]);

  return { position: ahead + 1, total, points: me.rewardPoints };
}

// ---------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------

export async function consoleOverview() {
  const today = toDayKey();
  const window = lastNDays(14, today);

  const [
    studentCount,
    activeCount,
    todayRows,
    worklogsToday,
    pendingPasses,
    flaggedWorklogs,
    openTasks,
    trendRows,
    domains,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { systemStatus: "ACTIVE" } }),
    prisma.attendance.findMany({ where: { date: today }, select: { userId: true, hour: true } }),
    prisma.worklog.count({ where: { date: today } }),
    prisma.activityPass.count({ where: { status: "PENDING" } }),
    prisma.worklog.count({ where: { status: "FLAGGED" } }),
    prisma.task.count({ where: { status: { notIn: ["DONE"] } } }),
    prisma.attendance.findMany({
      where: { date: { gte: window[0], lte: today } },
      select: { date: true, userId: true },
    }),
    prisma.user.groupBy({
      by: ["domain"],
      where: { role: "STUDENT" },
      _count: { domain: true },
      orderBy: { _count: { domain: "desc" } },
    }),
  ]);

  const presentToday = new Set(todayRows.map((r) => r.userId)).size;

  // Unique students per day for the 14-day trend.
  const perDay = new Map<string, Set<string>>();
  for (const row of trendRows) {
    const set = perDay.get(row.date) ?? new Set<string>();
    set.add(row.userId);
    perDay.set(row.date, set);
  }

  return {
    studentCount,
    activeCount,
    presentToday,
    attendanceRateToday: pct(presentToday, studentCount),
    hoursLoggedToday: todayRows.length,
    worklogsToday,
    worklogRateToday: pct(worklogsToday, studentCount),
    pendingPasses,
    flaggedWorklogs,
    openTasks,
    trend: window.map((key) => ({
      key,
      value: perDay.get(key)?.size ?? 0,
      max: studentCount,
    })),
    domains: domains.map((d) => ({ domain: d.domain, count: d._count.domain })),
  };
}

/** Per-student attendance table for the console, over a date range. */
export async function cohortAttendance(from: string, to: string, filters: { year?: string; domain?: string } = {}) {
  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.domain ? { domain: filters.domain } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rollNo: true, year: true, domain: true, mentorName: true },
  });

  const ids = students.map((s) => s.id);
  const rows = await prisma.attendance.findMany({
    where: { userId: { in: ids }, date: { gte: from, lte: to } },
    select: { userId: true, date: true, hour: true },
  });

  const trackedDays = rangeOfDays(from, to).filter((key) => new Date(key).getDay() !== 0);
  const possible = trackedDays.length * ATTENDANCE_HOURS.length;

  const byUser = new Map<string, Map<string, Set<number>>>();
  for (const row of rows) {
    const days = byUser.get(row.userId) ?? new Map<string, Set<number>>();
    const hours = days.get(row.date) ?? new Set<number>();
    hours.add(row.hour);
    days.set(row.date, hours);
    byUser.set(row.userId, days);
  }

  return {
    trackedDays,
    students: students.map((student) => {
      const days = byUser.get(student.id) ?? new Map<string, Set<number>>();
      const logged = [...days.values()].reduce((sum, set) => sum + set.size, 0);
      const fullDays = [...days.values()].filter((set) => set.size >= ATTENDANCE_HOURS.length).length;
      return {
        ...student,
        hours: logged,
        rate: pct(logged, possible),
        fullDays,
        daysPresent: days.size,
        perDay: trackedDays.map((key) => days.get(key)?.size ?? 0),
      };
    }),
  };
}

/** Distinct filter values, derived from the roster rather than hard-coded. */
export async function filterOptions() {
  const [years, domains, mentors] = await Promise.all([
    prisma.user.groupBy({ by: ["year"], where: { role: "STUDENT" }, orderBy: { year: "asc" } }),
    prisma.user.groupBy({ by: ["domain"], where: { role: "STUDENT" }, orderBy: { domain: "asc" } }),
    prisma.user.groupBy({ by: ["mentorName"], where: { role: "STUDENT" }, orderBy: { mentorName: "asc" } }),
  ]);

  return {
    years: years.map((y) => y.year).filter(Boolean),
    domains: domains.map((d) => d.domain).filter(Boolean),
    mentors: mentors.map((m) => m.mentorName).filter(Boolean),
  };
}
