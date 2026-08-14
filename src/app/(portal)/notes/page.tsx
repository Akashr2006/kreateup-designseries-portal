import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { NotesClient, type NoteRow } from "./NotesClient";

export const metadata: Metadata = { title: "Notes" };
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await requireUser();

  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, body: true, color: true, pinned: true, updatedAt: true },
  });

  const rows: NoteRow[] = notes.map((note) => ({
    ...note,
    updatedAt: note.updatedAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Your private scratchpad inside the portal. Nobody else can read these — not your mentor, not an admin."
        actions={
          <Badge tone="green" icon="lock">
            Private to you
          </Badge>
        }
      />
      <NotesClient notes={rows} />
    </div>
  );
}
