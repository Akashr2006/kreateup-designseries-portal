import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";

import { ApprovalsClient, type ApprovalRow } from "./ApprovalsClient";

export const metadata: Metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

export default async function ConsolePassesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission("permActivityApproval");
  const params = await searchParams;
  const status = params.status ?? "PENDING";

  const [passes, counts] = await Promise.all([
    prisma.activityPass.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: status === "PENDING" ? { createdAt: "asc" } : [{ date: "desc" }, { createdAt: "desc" }],
      take: 150,
      select: {
        id: true, date: true, fromTime: true, toTime: true, destination: true, reason: true,
        category: true, status: true, passCode: true, remark: true, createdAt: true,
        reviewer: { select: { name: true } },
        user: { select: { id: true, name: true, rollNo: true, domain: true, year: true, mobile: true } },
      },
    }),
    Promise.all([
      prisma.activityPass.count({ where: { status: "PENDING" } }),
      prisma.activityPass.count({ where: { status: "APPROVED", date: { gte: toDayKey() } } }),
      prisma.activityPass.count({ where: { status: "APPROVED" } }),
      prisma.activityPass.count({ where: { status: "REJECTED" } }),
    ]),
  ]);

  const [pending, activeToday, approved, rejected] = counts;

  const rows: ApprovalRow[] = passes.map((pass) => ({
    id: pass.id,
    date: pass.date,
    fromTime: pass.fromTime,
    toTime: pass.toTime,
    destination: pass.destination,
    reason: pass.reason,
    category: pass.category,
    status: pass.status,
    passCode: pass.passCode,
    remark: pass.remark,
    createdAt: pass.createdAt.toISOString(),
    reviewerName: pass.reviewer?.name ?? null,
    student: pass.user,
  }));

  return (
    <div>
      <PageHeader
        title="Activity approvals"
        description="Gate pass requests, oldest first. Approving issues a signed slip with a scannable code; rejecting always needs a written reason."
        actions={
          <LinkButton href="/api/export?table=passes" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Waiting on you"
          value={pending}
          icon="clock"
          tone={pending > 5 ? "red" : pending > 0 ? "amber" : "green"}
          caption={pending === 0 ? "Queue is clear" : "Students cannot leave until decided"}
        />
        <StatTile label="Active passes" value={activeToday} icon="ticket" tone="green" caption="Approved, today or later" />
        <StatTile label="Approved (all time)" value={approved} icon="check-circle" tone="blue" />
        <StatTile label="Rejected" value={rejected} icon="close" tone="slate" />
      </div>

      <ApprovalsClient passes={rows} filter={status} />
    </div>
  );
}
