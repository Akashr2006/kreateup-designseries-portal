import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_AUDIENCE, NOTIFICATION_CATEGORY } from "@/lib/constants";

const createSchema = z
  .object({
    title: z.string().trim().min(4, "Give the announcement a title.").max(160),
    body: z.string().trim().min(10, "Write the announcement body.").max(4000),
    category: z.enum(NOTIFICATION_CATEGORY).default("GENERAL"),
    audience: z.enum(NOTIFICATION_AUDIENCE).default("ALL"),
    audienceValue: z.string().trim().max(120).default(""),
    pinned: z.boolean().default(false),
    link: z.string().trim().max(400).default(""),
  })
  .refine((data) => data.audience === "ALL" || data.audienceValue.length > 0, {
    message: "Choose which cohort this goes to.",
    path: ["audienceValue"],
  });

export const POST = handler(async (request: Request) => {
  const author = await requireApiPermission("permNotifications");
  const data = createSchema.parse(await request.json());

  const notification = await prisma.notification.create({
    data: { ...data, authorId: author.id },
    select: { id: true, title: true },
  });

  await audit(author.id, "NOTIFICATION_PUBLISH", "Notification", notification.id, {
    audience: data.audience,
    value: data.audienceValue,
  });

  return ok(notification, 201);
});

// ---------------------------------------------------------------------------

/** Marks one announcement — or everything visible — as read. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id, all } = z
    .object({ id: z.string().optional(), all: z.boolean().optional() })
    .parse(await request.json());

  if (all) {
    const visible = await prisma.notification.findMany({
      where: {
        OR: [
          { audience: "ALL" },
          { audience: "YEAR", audienceValue: user.year },
          { audience: "DOMAIN", audienceValue: user.domain },
          { audience: "ROLE", audienceValue: user.role },
        ],
      },
      select: { id: true },
    });

    // `skipDuplicates` is not available on the SQLite connector, so filter
    // against what has already been read rather than relying on the database.
    const alreadyRead = await prisma.notificationRead.findMany({
      where: { userId: user.id, notificationId: { in: visible.map((n) => n.id) } },
      select: { notificationId: true },
    });
    const seen = new Set(alreadyRead.map((r) => r.notificationId));
    const fresh = visible.filter((n) => !seen.has(n.id));

    if (fresh.length > 0) {
      await prisma.notificationRead.createMany({
        data: fresh.map((n) => ({ notificationId: n.id, userId: user.id })),
      });
    }

    return ok({ read: fresh.length });
  }

  if (!id) return fail("Pass either an announcement id or all: true.", 422);

  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: id, userId: user.id } },
    create: { notificationId: id, userId: user.id },
    update: {},
  });

  return ok({ read: 1 });
});

// ---------------------------------------------------------------------------

export const DELETE = handler(async (request: Request) => {
  const author = await requireApiPermission("permNotifications");
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  await prisma.notification.delete({ where: { id } });
  await audit(author.id, "NOTIFICATION_DELETE", "Notification", id);

  return ok({ deleted: id });
});
