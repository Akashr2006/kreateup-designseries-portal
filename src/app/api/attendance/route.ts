import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_CUTOFF_MINUTES, ATTENDANCE_HOURS, REWARD_RULES } from "@/lib/constants";
import { minutesSinceMidnight, toDayKey } from "@/lib/dates";

const checkInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  hours: z.array(z.number().int().min(1).max(7)).min(1, "Select at least one hour."),
  reason: z.string().trim().min(4, "Say what you worked on (at least 4 characters).").max(400),
});

/**
 * Student self check-in.
 *
 * Rules enforced server-side (the client mirrors them, but the server is the
 * authority): today or a past day only, never the future; the 23:30 cutoff
 * applies to same-day submissions; hours already logged are skipped rather
 * than erroring, so a partial re-submit tops up the day.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { date, hours, reason } = checkInSchema.parse(await request.json());

  const today = toDayKey();
  if (date > today) return fail("You cannot check in for a future date.", 422);
  if (date < today) {
    return fail(
      "Back-dated check-ins have to be added by an admin. Ask your mentor to log it for you.",
      422
    );
  }
  if (minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES) {
    return fail("Check-in for today closed at 11:30 PM.", 422);
  }

  const existing = await prisma.attendance.findMany({
    where: { userId: user.id, date },
    select: { hour: true },
  });
  const already = new Set(existing.map((row) => row.hour));
  const fresh = [...new Set(hours)].filter((hour) => !already.has(hour));

  if (fresh.length === 0) {
    return fail("You have already checked in for those hours today.", 409);
  }

  await prisma.attendance.createMany({
    data: fresh.map((hour) => ({
      userId: user.id,
      date,
      hour,
      reason,
      status: "PRESENT",
      source: "SELF",
    })),
  });

  // A full day earns points once, at the moment the day becomes complete.
  const total = already.size + fresh.length;
  if (already.size < ATTENDANCE_HOURS.length && total >= ATTENDANCE_HOURS.length) {
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: {
          userId: user.id,
          points: REWARD_RULES.fullDayAttendance,
          reason: `Full attendance on ${date}`,
          source: "ATTENDANCE",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { rewardPoints: { increment: REWARD_RULES.fullDayAttendance } },
      }),
    ]);
  }

  await audit(user.id, "ATTENDANCE_CHECKIN", "Attendance", `${user.id}:${date}`, { hours: fresh });

  return ok({ date, recorded: fresh, totalHours: total });
});

// ---------------------------------------------------------------------------

const manualSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.array(z.number().int().min(1).max(7)).min(1),
  status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"]).default("PRESENT"),
  reason: z.string().trim().max(400).default("Added by admin"),
});

/** Admin manual entry — can back-date, and overwrites whatever is there. */
export const PUT = handler(async (request: Request) => {
  const admin = await requireApiPermission("permAttendanceLogs");
  const { userId, date, hours, status, reason } = manualSchema.parse(await request.json());

  if (date > toDayKey()) return fail("You cannot record attendance for a future date.", 422);

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!target) return fail("That student is not on the roster.", 404);

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { userId, date, hour: { in: hours } } }),
    prisma.attendance.createMany({
      data: hours.map((hour) => ({
        userId,
        date,
        hour,
        reason,
        status,
        source: "ADMIN",
        markedBy: admin.id,
      })),
    }),
  ]);

  await audit(admin.id, "ATTENDANCE_MANUAL", "Attendance", `${userId}:${date}`, { hours, status });

  return ok({ userId, date, hours, status });
});

// ---------------------------------------------------------------------------

const deleteSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const DELETE = handler(async (request: Request) => {
  const admin = await requireApiPermission("permAttendanceLogs");
  const { userId, date } = deleteSchema.parse(await request.json());

  const { count } = await prisma.attendance.deleteMany({ where: { userId, date } });
  await audit(admin.id, "ATTENDANCE_CLEAR", "Attendance", `${userId}:${date}`, { removed: count });

  return ok({ removed: count });
});
