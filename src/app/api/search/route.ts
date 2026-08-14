import { handler, ok } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canOpenConsole, type PermissionSubject } from "@/lib/permissions";

/** Backs the ⌘K palette. People results are console-only. */
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2 || !canOpenConsole(user as PermissionSubject)) {
    return ok({ people: [] });
  }

  const people = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { rollNo: { contains: query.toUpperCase() } },
        { email: { contains: query.toLowerCase() } },
        { domain: { contains: query } },
      ],
    },
    select: { id: true, name: true, rollNo: true, domain: true, role: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return ok({ people });
});
