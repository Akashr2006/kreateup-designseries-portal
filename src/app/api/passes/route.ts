import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PASS_CATEGORY } from "@/lib/constants";
import { toDayKey } from "@/lib/dates";
import { generatePassCode } from "@/lib/utils";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fromTime: z.string().regex(TIME, "Use a 24-hour time like 14:30."),
    toTime: z.string().regex(TIME, "Use a 24-hour time like 16:00."),
    destination: z.string().trim().min(3, "Where are you going?").max(160),
    reason: z.string().trim().min(10, "Give a real reason (at least 10 characters).").max(600),
    category: z.enum(PASS_CATEGORY).default("ACTIVITY"),
  })
  .refine((data) => data.toTime > data.fromTime, {
    message: "The return time has to be after the departure time.",
    path: ["toTime"],
  });

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = createSchema.parse(await request.json());

  if (data.date < toDayKey()) {
    return fail("You cannot request a pass for a date that has already passed.", 422);
  }

  // One live request per day keeps the approval queue honest.
  const clash = await prisma.activityPass.findFirst({
    where: { userId: user.id, date: data.date, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true, status: true },
  });
  if (clash) {
    return fail(
      clash.status === "PENDING"
        ? "You already have a request waiting for approval on that date."
        : "You already have an approved pass for that date.",
      409
    );
  }

  const pass = await prisma.activityPass.create({
    data: { ...data, userId: user.id, status: "PENDING", passCode: generatePassCode() },
    select: { id: true, passCode: true, status: true },
  });

  await audit(user.id, "PASS_REQUEST", "ActivityPass", pass.id, { date: data.date });

  return ok(pass, 201);
});

// ---------------------------------------------------------------------------

const decideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  remark: z.string().trim().max(400).default(""),
});

export const PATCH = handler(async (request: Request) => {
  const reviewer = await requireApiPermission("permActivityApproval");
  const { id, status, remark } = decideSchema.parse(await request.json());

  const pass = await prisma.activityPass.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });
  if (!pass) return fail("That request no longer exists.", 404);
  if (pass.status !== "PENDING") return fail(`This request was already ${pass.status.toLowerCase()}.`, 409);

  if (status === "REJECTED" && remark.trim().length < 4) {
    return fail("Give the student a reason when you reject a request.", 422);
  }

  await prisma.activityPass.update({
    where: { id },
    data: { status, remark, reviewerId: reviewer.id, reviewedAt: new Date() },
  });

  await audit(reviewer.id, `PASS_${status}`, "ActivityPass", id, { student: pass.userId });

  return ok({ id, status });
});

// ---------------------------------------------------------------------------

/** A student may withdraw their own request while it is still pending. */
export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  const pass = await prisma.activityPass.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!pass || pass.userId !== user.id) return fail("That request is not yours.", 403);
  if (pass.status !== "PENDING") return fail("Only a pending request can be withdrawn.", 409);

  await prisma.activityPass.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(user.id, "PASS_CANCEL", "ActivityPass", id);

  return ok({ id, status: "CANCELLED" });
});
