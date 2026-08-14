import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REWARD_RULES, TASK_PRIORITY, TASK_STATUS } from "@/lib/constants";

const createSchema = z.object({
  title: z.string().trim().min(4, "Give the task a clear title.").max(160),
  description: z.string().trim().max(2000).default(""),
  /** Empty means "broadcast" — the task is created for every matching student. */
  assigneeIds: z.array(z.string()).default([]),
  domain: z.string().trim().max(120).default(""),
  year: z.string().trim().max(120).default(""),
  priority: z.enum(TASK_PRIORITY).default("MEDIUM"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  points: z.number().int().min(0).max(200).default(10),
});

/** Create one task, or fan it out across a cohort. */
export const POST = handler(async (request: Request) => {
  const author = await requireApiPermission("permMentorTasks");
  const data = createSchema.parse(await request.json());

  let assignees = data.assigneeIds;

  // No explicit assignees: resolve the cohort from domain/year filters.
  if (assignees.length === 0) {
    if (!data.domain && !data.year) {
      return fail("Pick at least one student, or a domain or year to broadcast to.", 422);
    }
    const cohort = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        systemStatus: "ACTIVE",
        ...(data.domain ? { domain: data.domain } : {}),
        ...(data.year ? { year: data.year } : {}),
      },
      select: { id: true },
    });
    assignees = cohort.map((s) => s.id);
  }

  if (assignees.length === 0) return fail("No active students match that cohort.", 422);

  await prisma.task.createMany({
    data: assignees.map((assigneeId) => ({
      title: data.title,
      description: data.description,
      authorId: author.id,
      assigneeId,
      domain: data.domain,
      year: data.year,
      priority: data.priority,
      status: "TODO",
      dueDate: data.dueDate,
      points: data.points,
    })),
  });

  await audit(author.id, "TASK_CREATE", "Task", "", {
    title: data.title,
    assigned: assignees.length,
  });

  return ok({ created: assignees.length }, 201);
});

// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(TASK_STATUS),
});

/**
 * Status change. A student may move their own task between TODO,
 * IN_PROGRESS, BLOCKED and SUBMITTED; only a mentor can mark it DONE, which is
 * what releases the reward points.
 */
export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id, status } = updateSchema.parse(await request.json());

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, assigneeId: true, status: true, points: true, title: true },
  });
  if (!task) return fail("That task no longer exists.", 404);

  const isOwner = task.assigneeId === user.id;
  const isMentor = user.role === "SUPER_ADMIN" || user.permMentorTasks;

  if (!isOwner && !isMentor) return fail("That task is not assigned to you.", 403);
  if (status === "DONE" && !isMentor) {
    return fail("Only your mentor can mark a task as done. Submit it for review instead.", 403);
  }

  const wasDone = task.status === "DONE";
  const nowDone = status === "DONE";

  await prisma.task.update({
    where: { id },
    data: { status, completedAt: nowDone ? new Date() : null },
  });

  // Award once when it first becomes DONE; claw back if it is reopened.
  if (!wasDone && nowDone && task.assigneeId) {
    const points = task.points || REWARD_RULES.taskCompletedBase;
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: { userId: task.assigneeId, points, reason: `Task completed: ${task.title}`, source: "TASK" },
      }),
      prisma.user.update({ where: { id: task.assigneeId }, data: { rewardPoints: { increment: points } } }),
    ]);
  } else if (wasDone && !nowDone && task.assigneeId) {
    const points = task.points || REWARD_RULES.taskCompletedBase;
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: { userId: task.assigneeId, points: -points, reason: `Task reopened: ${task.title}`, source: "TASK" },
      }),
      prisma.user.update({ where: { id: task.assigneeId }, data: { rewardPoints: { decrement: points } } }),
    ]);
  }

  await audit(user.id, "TASK_STATUS", "Task", id, { status });

  return ok({ id, status });
});

// ---------------------------------------------------------------------------

export const DELETE = handler(async (request: Request) => {
  const author = await requireApiPermission("permMentorTasks");
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  await prisma.task.delete({ where: { id } });
  await audit(author.id, "TASK_DELETE", "Task", id);

  return ok({ deleted: id });
});
