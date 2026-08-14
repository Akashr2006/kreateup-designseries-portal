import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { ATTENDANCE_HOURS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { toDayKey } from "@/lib/dates";
import { pct } from "@/lib/utils";

import { ScanConsole, type ScanStudent } from "./ScanConsole";

export const metadata: Metadata = { title: "Door check-in" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requirePermission("permScanStudentQr");
  const today = toDayKey();

  const [students, todayRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", systemStatus: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rollNo: true, domain: true, year: true },
    }),
    prisma.attendance.findMany({
      where: { date: today },
      select: { userId: true, hour: true },
    }),
  ]);

  const byUser = new Map<string, number[]>();
  for (const row of todayRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row.hour);
    byUser.set(row.userId, list);
  }

  const rows: ScanStudent[] = students.map((student) => ({
    ...student,
    loggedToday: (byUser.get(student.id) ?? []).sort((a, b) => a - b),
  }));

  const present = rows.filter((s) => s.loggedToday.length > 0).length;
  const complete = rows.filter((s) => s.loggedToday.length >= ATTENDANCE_HOURS.length).length;
  const partial = present - complete;

  return (
    <div>
      <PageHeader
        title="Door check-in"
        description="Record attendance on a student's behalf at the studio door. Use a handheld barcode reader, or type a roll number — either way the entry is marked as admin-sourced and written to the audit log."
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="On the floor"
          value={present}
          unit={`/ ${rows.length}`}
          icon="users"
          tone={pct(present, rows.length) >= 75 ? "green" : "amber"}
          caption={`${pct(present, rows.length)}% checked in today`}
        />
        <StatTile label="Full day logged" value={complete} icon="check-circle" tone="green" caption="All seven hours" />
        <StatTile label="Partial" value={partial} icon="clock" tone={partial > 0 ? "amber" : "slate"} caption="Some hours missing" />
        <StatTile
          label="Not seen today"
          value={rows.length - present}
          icon="alert"
          tone={rows.length - present > 0 ? "red" : "green"}
          caption="No hours logged at all"
        />
      </div>

      <ScanConsole students={rows} />
    </div>
  );
}
