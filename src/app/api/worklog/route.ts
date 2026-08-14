import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_CUTOFF_MINUTES, REWARD_RULES } from "@/lib/constants";
import { minutesSinceMidnight, toDayKey } from "@/lib/dates";

const slot = z.string().trim().max(1200);

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  s1: slot.min(10, "Slot 1 needs a real description (at least 10 characters)."),
  s2: slot.min(10, "Slot 2 needs a real description (at least 10 characters)."),
  s3: slot.min(10, "Slot 3 needs a real description (at least 10 characters)."),
  s4: slot.min(10, "Slot 4 needs a real description (at least 10 characters)."),
  s5: slot.default(""),
  taskId: z.string().nullable().optional(),
});

/**
 * Create or update a worklog. One row per student per day, so this upserts:
 * a student editing today's log simply overwrites it, which is what everyone
 * expects from a daily journal.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = schema.parse(await request.json());

  const today = toDayKey();
  if (data.date > today) return fail("You cannot log work for a future date.", 422);

  // Same-day logs close at 23:30; yesterday's stays open until the same time
  // the next day so a late-evening session can still be written up.
  if (data.date === today && minutesSinceMidnight() > ATTENDANCE_CUTOFF_MINUTES) {
    return fail("Worklog submission for today closed at 11:30 PM.", 422);
  }

  const daysOld = Math.round(
    (new Date(today).getTime() - new Date(data.date).getTime()) / 86_400_000
  );
  if (daysOld > 1) {
    // A locked date is still writable if a mentor approved an extension for
    // exactly that day — that is the whole point of the extension flow.
    const extension = await prisma.extensionRequest.findUnique({
      where: { userId_date: { userId: user.id, date: data.date } },
      select: { status: true },
    });

    if (extension?.status !== "APPROVED") {
      return fail(
        extension?.status === "PENDING"
          ? "That date is locked and your extension request is still awaiting a decision."
          : "This date is locked. Raise an extension request and your mentor can reopen it.",
        422
      );
    }
  }

  // Only accept a task the student actually owns.
  let taskId: string | null = null;
  if (data.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, assigneeId: user.id },
      select: { id: true },
    });
    taskId = task?.id ?? null;
  }

  const existing = await prisma.worklog.findUnique({
    where: { userId_date: { userId: user.id, date: data.date } },
    select: { id: true },
  });

  const worklog = await prisma.worklog.upsert({
    where: { userId_date: { userId: user.id, date: data.date } },
    create: {
      userId: user.id,
      date: data.date,
      s1: data.s1,
      s2: data.s2,
      s3: data.s3,
      s4: data.s4,
      s5: data.s5,
      taskId,
      status: "SUBMITTED",
    },
    update: {
      s1: data.s1,
      s2: data.s2,
      s3: data.s3,
      s4: data.s4,
      s5: data.s5,
      taskId,
      // Editing a reviewed log sends it back for review.
      status: "SUBMITTED",
      mentorRemark: "",
      reviewedBy: null,
      reviewedAt: null,
    },
  });

  // Points only on first submission for that date.
  if (!existing) {
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: {
          userId: user.id,
          points: REWARD_RULES.worklogSubmitted,
          reason: `Worklog submitted for ${data.date}`,
          source: "WORKLOG",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { rewardPoints: { increment: REWARD_RULES.worklogSubmitted } },
      }),
    ]);
  }

  await audit(user.id, existing ? "WORKLOG_UPDATE" : "WORKLOG_CREATE", "Worklog", worklog.id, {
    date: data.date,
  });

  return ok({ id: worklog.id, date: worklog.date, created: !existing });
});

// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["SUBMITTED", "REVIEWED", "FLAGGED"]),
  mentorRemark: z.string().trim().max(600).default(""),
});

/** Mentor review — sets the status and attaches a remark. */
export const PATCH = handler(async (request: Request) => {
  const reviewer = await requireApiPermission("permWorklogs");
  const { id, status, mentorRemark } = reviewSchema.parse(await request.json());

  const worklog = await prisma.worklog.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!worklog) return fail("That worklog no longer exists.", 404);

  await prisma.worklog.update({
    where: { id },
    data: {
      status,
      mentorRemark,
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
    },
  });

  await audit(reviewer.id, "WORKLOG_REVIEW", "Worklog", id, { status });

  return ok({ id, status });
});
