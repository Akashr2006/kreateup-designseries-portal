import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";
import { addDays, toDayKey } from "@/lib/dates";

import { LinkedinConsole, type PostRow } from "./LinkedinConsole";

export const metadata: Metadata = { title: "LinkedIn tracker" };
export const dynamic = "force-dynamic";

export default async function ConsoleLinkedinPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission("permLinkedinTracker");
  const params = await searchParams;
  const status = params.status ?? "PENDING";

  const where =
    status === "VERIFIED" ? { verified: true } : status === "PENDING" ? { verified: false } : {};

  const weekAgo = addDays(toDayKey(), -7);

  const [posts, options, counts] = await Promise.all([
    prisma.linkedinPost.findMany({
      where,
      orderBy: { postedOn: "desc" },
      take: 150,
      select: {
        id: true, url: true, caption: true, postedOn: true, reactions: true,
        comments: true, verified: true,
        user: { select: { id: true, name: true, rollNo: true, domain: true, year: true } },
      },
    }),
    filterOptions(),
    Promise.all([
      prisma.linkedinPost.count({ where: { verified: false } }),
      prisma.linkedinPost.count({ where: { verified: true } }),
      prisma.linkedinPost.count({ where: { postedOn: { gte: weekAgo } } }),
      prisma.linkedinPost.aggregate({ where: { verified: true }, _sum: { reactions: true } }),
    ]),
  ]);

  const [unverified, verified, thisWeek, engagement] = counts;

  const rows: PostRow[] = posts.map((post) => ({
    id: post.id,
    url: post.url,
    caption: post.caption,
    postedOn: post.postedOn,
    reactions: post.reactions,
    comments: post.comments,
    verified: post.verified,
    student: post.user,
  }));

  return (
    <div>
      <PageHeader
        title="LinkedIn tracker"
        description="Build-in-public submissions from students. Open each post before you verify it — verification is what awards the reward points, and it can be withdrawn if the post turns out to be unrelated."
        actions={
          <LinkButton href="/api/export?table=linkedin" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting verification"
          value={unverified}
          icon="clock"
          tone={unverified > 10 ? "red" : unverified > 0 ? "amber" : "green"}
          caption={unverified === 0 ? "Queue is clear" : "Open each one before verifying"}
        />
        <StatTile label="Verified" value={verified} icon="check-circle" tone="green" caption="All time" />
        <StatTile label="Posted this week" value={thisWeek} icon="calendar" tone="blue" caption="Last 7 days" />
        <StatTile
          label="Verified reactions"
          value={engagement._sum.reactions ?? 0}
          icon="arrow-trend"
          tone="amber"
          caption="Total engagement recorded"
        />
      </div>

      <LinkedinConsole posts={rows} filter={status} options={{ domains: options.domains }} />
    </div>
  );
}
