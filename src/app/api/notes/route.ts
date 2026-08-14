import { z } from "zod";

import { fail, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NOTE_COLORS } from "@/lib/constants";

/**
 * Notes are private by construction: every query is scoped to the signed-in
 * user's id, and there is no admin read path anywhere in the codebase.
 */

const createSchema = z.object({
  title: z.string().trim().max(120).default("Untitled note"),
  body: z.string().trim().max(8000).default(""),
  color: z.enum(NOTE_COLORS).default("blue"),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = createSchema.parse(await request.json());

  const note = await prisma.note.create({
    data: { ...data, title: data.title || "Untitled note", userId: user.id },
  });

  return ok(note, 201);
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(8000).optional(),
  color: z.enum(NOTE_COLORS).optional(),
  pinned: z.boolean().optional(),
});

export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id, ...changes } = updateSchema.parse(await request.json());

  const { count } = await prisma.note.updateMany({
    where: { id, userId: user.id },
    data: changes,
  });
  if (count === 0) return fail("That note is not yours.", 404);

  const note = await prisma.note.findUnique({ where: { id } });
  return ok(note);
});

export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());

  const { count } = await prisma.note.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return fail("That note is not yours.", 404);

  return ok({ deleted: id });
});
