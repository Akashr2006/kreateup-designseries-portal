import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { ExtensionsClient, type ExtensionRow } from "./ExtensionsClient";

export const metadata: Metadata = { title: "Extension requests" };
export const dynamic = "force-dynamic";

export default async function ExtensionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission("permExtensionRequest");
  const status = (await searchParams).status ?? "PENDING";

  const [rows, counts] = await Promise.all([
    prisma.extensionRequest.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" },
      take: 120,
      select: {
        id: true, date: true, reason: true, status: true, remark: true, createdAt: true,
        reviewer: { select: { name: true } },
        user: { select: { id: true, name: true, rollNo: true, domain: true, year: true } },
      },
    }),
    Promise.all([
      prisma.extensionRequest.count({ where: { status: "PENDING" } }),
      prisma.extensionRequest.count({ where: { status: "APPROVED" } }),
      prisma.extensionRequest.count({ where: { status: "REJECTED" } }),
    ]),
  ]);

  const [pending, approved, rejected] = counts;

  const requests: ExtensionRow[] = rows.map((row) => ({
    id: row.id,
    date: row.date,
    reason: row.reason,
    status: row.status,
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
    reviewerName: row.reviewer?.name ?? null,
    student: row.user,
  }));

  return (
    <div>
      <PageHeader
        title="Extension requests"
        description="Worklogs lock one day after their date. This is the escape hatch: a student asks for one specific day to be reopened, and granting it lets them submit that single late worklog."
      />

      <div className="stagger mb-4 grid grid-cols-3 gap-3">
        <StatTile
          label="Waiting on you"
          value={pending}
          icon="clock"
          tone={pending > 0 ? "amber" : "green"}
          caption={pending === 0 ? "Queue is clear" : "Dates stay locked until decided"}
        />
        <StatTile label="Granted" value={approved} icon="check-circle" tone="green" caption="All time" />
        <StatTile label="Rejected" value={rejected} icon="close" tone="slate" />
      </div>

      <ExtensionsClient requests={requests} filter={status} />
    </div>
  );
}
