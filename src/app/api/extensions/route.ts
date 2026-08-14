import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";

/**
 * Extension requests — the escape hatch for the worklog lock.
 *
 * A worklog closes one day after its date. Rather than letting students
 * back-date freely (which makes the record worthless), they ask for one
 * specific day to be reopened and a mentor decides.
 */

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  reason: z.string().trim().min(15, "Explain what happened — at least 15 characters.").max(600),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { date, reason } = createSchema.parse(await request.json());

  const today = toDayKey();
  if (date > today) return fail("You cannot request an extension for a future date.", 422);

  // Only a genuinely locked date needs one.
  const daysOld = Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86_400_000);
  if (daysOld <= 1) {
    return fail("That date is still open — you can submit the worklog directly.", 422);
  }
  if (daysOld > 30) {
    return fail("That date is more than a month old and can no longer be reopened.", 422);
  }

  const existing = await prisma.extensionRequest.findUnique({
    where: { userId_date: { userId: user.id, date } },
    select: { status: true },
  });
  if (existing) {
    return fail(
      existing.status === "PENDING"
        ? "You already have a request pending for that date."
        : `That date was already ${existing.status.toLowerCase()}.`,
      409
    );
  }

  const created = await prisma.extensionRequest.create({
    data: { userId: user.id, date, reason },
    select: { id: true, date: true, status: true },
  });

  await audit(user.id, "EXTENSION_REQUEST", "ExtensionRequest", created.id, { date });

  return ok(created, 201);
});

// ---------------------------------------------------------------------------

const decideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  remark: z.string().trim().max(400).default(""),
});

export const PATCH = handler(async (request: Request) => {
  const reviewer = await requireApiPermission("permExtensionRequest");
  const { id, status, remark } = decideSchema.parse(await request.json());

  const found = await prisma.extensionRequest.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, date: true },
  });
  if (!found) return fail("That request no longer exists.", 404);
  if (found.status !== "PENDING") {
    return fail(`This request was already ${found.status.toLowerCase()}.`, 409);
  }
  if (status === "REJECTED" && remark.trim().length < 4) {
    return fail("Give the student a reason when you reject a request.", 422);
  }

  await prisma.extensionRequest.update({
    where: { id },
    data: { status, remark, reviewerId: reviewer.id, reviewedAt: new Date() },
  });

  await audit(reviewer.id, `EXTENSION_${status}`, "ExtensionRequest", id, {
    student: found.userId,
    date: found.date,
  });

  return ok({ id, status });
});
