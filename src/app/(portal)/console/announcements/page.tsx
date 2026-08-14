import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";

import { AnnouncementConsole, type PublishedRow } from "./AnnouncementConsole";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function ConsoleAnnouncementsPage() {
  await requirePermission("permNotifications");

  const [notifications, options, audienceSize] = await Promise.all([
    prisma.notification.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true, title: true, body: true, category: true, audience: true,
        audienceValue: true, pinned: true, link: true, createdAt: true,
        author: { select: { name: true } },
        _count: { select: { reads: true } },
      },
    }),
    filterOptions(),
    prisma.user.count({ where: { systemStatus: "ACTIVE" } }),
  ]);

  const rows: PublishedRow[] = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    category: item.category,
    audience: item.audience,
    audienceValue: item.audienceValue,
    pinned: item.pinned,
    link: item.link,
    createdAt: item.createdAt.toISOString(),
    authorName: item.author.name,
    readCount: item._count.reads,
  }));

  const pinned = rows.filter((r) => r.pinned).length;
  const totalReads = rows.reduce((sum, r) => sum + r.readCount, 0);
  const avgReadRate =
    rows.length > 0 && audienceSize > 0
      ? Math.round((totalReads / (rows.length * audienceSize)) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Publish notices to the whole programme or to a single year, domain or role. Everything you publish is live the moment you hit publish — read receipts are tracked per student."
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Published" value={rows.length} icon="bell" tone="blue" caption="Most recent 80 shown" />
        <StatTile label="Pinned" value={pinned} icon="pin" tone={pinned > 3 ? "amber" : "green"} caption={pinned > 3 ? "Consider unpinning some" : "Held at the top"} />
        <StatTile label="Audience" value={audienceSize} icon="users" tone="slate" caption="Active accounts" />
        <StatTile
          label="Average read rate"
          value={`${avgReadRate}%`}
          icon="eye"
          tone={avgReadRate >= 60 ? "green" : avgReadRate >= 30 ? "amber" : "red"}
          caption="Across everything published"
        />
      </div>

      <AnnouncementConsole
        published={rows}
        options={{ years: options.years, domains: options.domains }}
        audienceSize={audienceSize}
      />
    </div>
  );
}
