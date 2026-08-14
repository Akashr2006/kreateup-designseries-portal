import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(200)
      .refine((v) => /[a-z]/.test(v), "Include at least one lower-case letter.")
      .refine((v) => /[A-Z0-9]/.test(v), "Include at least one capital letter or number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The two new passwords do not match.",
    path: ["confirmPassword"],
  });

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { currentPassword, newPassword } = schema.parse(await request.json());

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!(await verifyPassword(currentPassword, record.passwordHash))) {
    return fail("Your current password is not right.", 401);
  }

  if (await verifyPassword(newPassword, record.passwordHash)) {
    return fail("Choose a password you have not used before.", 422);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });

  await audit(user.id, "PASSWORD_CHANGE", "User", user.id);

  return ok({ changed: true });
});
