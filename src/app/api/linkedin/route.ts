import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { requireApiPermission, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REWARD_RULES } from "@/lib/constants";
import { toDayKey } from "@/lib/dates";

const submitSchema = z.object({
  url: z
    .string()
    .trim()
    .url("That is not a valid link.")
    .refine((v) => /linkedin\.com/i.test(v), "The link has to point at LinkedIn."),
  caption: z.string().trim().max(600).default(""),
  postedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = submitSchema.parse(await request.json());

  if (data.postedOn > toDayKey()) return fail("The post date cannot be in the future.", 422);

  const duplicate = await prisma.linkedinPost.findFirst({
    where: { userId: user.id, url: data.url },
    select: { id: true },
  });
  if (duplicate) return fail("You have already submitted that post.", 409);

  const post = await prisma.linkedinPost.create({
    data: { ...data, userId: user.id },
    select: { id: true, url: true, postedOn: true, verified: true },
  });

  await audit(user.id, "LINKEDIN_SUBMIT", "LinkedinPost", post.id);

  return ok(post, 201);
});

// ---------------------------------------------------------------------------

const verifySchema = z.object({
  id: z.string().min(1),
  verified: z.boolean(),
  reactions: z.number().int().min(0).max(1_000_000).optional(),
  comments: z.number().int().min(0).max(1_000_000).optional(),
});

export const PATCH = handler(async (request: Request) => {
  const reviewer = await requireApiPermission("permLinkedinTracker");
  const { id, verified, reactions, comments } = verifySchema.parse(await request.json());

  const post = await prisma.linkedinPost.findUnique({
    where: { id },
    select: { id: true, userId: true, verified: true },
  });
  if (!post) return fail("That submission no longer exists.", 404);

  await prisma.linkedinPost.update({
    where: { id },
    data: {
      verified,
      ...(reactions !== undefined ? { reactions } : {}),
      ...(comments !== undefined ? { comments } : {}),
    },
  });

  // Points move with the verification flag, in both directions.
  if (post.verified !== verified) {
    const delta = verified ? REWARD_RULES.linkedinVerified : -REWARD_RULES.linkedinVerified;
    await prisma.$transaction([
      prisma.rewardEntry.create({
        data: {
          userId: post.userId,
          points: delta,
          reason: verified ? "LinkedIn post verified" : "LinkedIn verification withdrawn",
          source: "LINKEDIN",
        },
      }),
      prisma.user.update({
        where: { id: post.userId },
        data: { rewardPoints: { increment: delta } },
      }),
    ]);
  }

  await audit(reviewer.id, "LINKEDIN_VERIFY", "LinkedinPost", id, { verified });

  return ok({ id, verified });
});

export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  // A student may remove their own submission; the tracker owner may remove any.
  const post = await prisma.linkedinPost.findUnique({ where: { id }, select: { userId: true } });
  if (!post) return fail("That submission no longer exists.", 404);

  const isOwner = post.userId === user.id;
  const isReviewer = user.role === "SUPER_ADMIN" || user.permLinkedinTracker;
  if (!isOwner && !isReviewer) return fail("That submission is not yours.", 403);

  await prisma.linkedinPost.delete({ where: { id } });
  return ok({ deleted: id });
});
