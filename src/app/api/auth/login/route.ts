import { z } from "zod";

import { audit, fail, handler, ok } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  /** Accepts either the college email or the roll number. */
  identifier: z.string().min(3).max(120),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional(),
});

export const POST = handler(async (request: Request) => {
  const { identifier, password } = schema.parse(await request.json());
  const key = identifier.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: key.toLowerCase() }, { rollNo: key.toUpperCase() }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
      systemStatus: true,
      mustChangePassword: true,
    },
  });

  // Same message for "no such account" and "wrong password" so the form cannot
  // be used to enumerate which emails exist.
  const GENERIC = "That email or password is not right. Please check and try again.";

  if (!user) {
    // Constant-ish work so a missing account is not obviously faster.
    await verifyPassword(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    return fail(GENERIC, 401);
  }

  if (user.systemStatus === "SUSPENDED") {
    return fail("This account has been suspended. Please contact the DesignSeries office.", 403);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail(GENERIC, 401);

  await createSession({ sub: user.id, email: user.email, name: user.name, role: user.role });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await audit(user.id, "LOGIN", "User", user.id);

  return ok({
    id: user.id,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
});
