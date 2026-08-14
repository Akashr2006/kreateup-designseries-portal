import { z } from "zod";

import { audit, handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Students may edit only the fields that are theirs to own. Academic details
 * (roll number, department, year, domain, mentor) come from the roster and are
 * changed by an admin through /api/admin/users.
 */
const schema = z.object({
  mobile: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^[+\d][\d\s-]{7,19}$/.test(v), "That does not look like a phone number.")
    .default(""),
  linkedin: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/(www\.)?linkedin\.com\//i.test(v), "Use a full linkedin.com URL.")
    .default(""),
  github: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/(www\.)?github\.com\//i.test(v), "Use a full github.com URL.")
    .default(""),
});

export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = schema.parse(await request.json());

  await prisma.user.update({ where: { id: user.id }, data });
  await audit(user.id, "PROFILE_UPDATE", "User", user.id, data);

  return ok(data);
});
