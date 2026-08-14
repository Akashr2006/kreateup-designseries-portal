import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { addDays, toDayKey } from "@/lib/dates";
import { cohortAttendance, filterOptions } from "@/lib/queries";

import { AttendanceMatrix, type MatrixStudent } from "./AttendanceMatrix";

export const metadata: Metadata = { title: "Attendance matrix" };
export const dynamic = "force-dynamic";

export default async function ConsoleAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string; domain?: string }>;
}) {
  await requirePermission("permAttendanceLogs");
  const params = await searchParams;

  const today = toDayKey();
  const to = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today;
  const from =
    params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : addDays(to, -20);

  const year = params.year ?? "ALL";
  const domain = params.domain ?? "ALL";

  const [{ students, trackedDays }, options] = await Promise.all([
    cohortAttendance(from, to, {
      year: year === "ALL" ? undefined : year,
      domain: domain === "ALL" ? undefined : domain,
    }),
    filterOptions(),
  ]);

  const rows: MatrixStudent[] = students;

  const average = rows.length ? Math.round(rows.reduce((sum, s) => sum + s.rate, 0) / rows.length) : 0;
  const belowThreshold = rows.filter((s) => s.rate < 75).length;
  const perfect = rows.filter((s) => s.rate === 100).length;
  const totalHours = rows.reduce((sum, s) => sum + s.hours, 0);

  const exportQuery = new URLSearchParams({ table: "attendance", from, to });

  return (
    <div>
      <PageHeader
        title="Attendance matrix"
        description="Every student, every tracked day, in one grid. Sundays are excluded. Click a student to open their full record, or use Add to enter attendance on their behalf."
        actions={
          <LinkButton href={`/api/export?${exportQuery.toString()}`} variant="secondary" icon="download" size="sm">
            Export range
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Cohort average"
          value={`${average}%`}
          icon="chart"
          tone={average >= 85 ? "green" : average >= 75 ? "blue" : "amber"}
          caption={`${trackedDays.length} tracked days`}
        />
        <StatTile
          label="Below 75%"
          value={belowThreshold}
          icon="alert"
          tone={belowThreshold > 0 ? "red" : "green"}
          caption={belowThreshold > 0 ? "Need a conversation" : "Everyone is above the line"}
        />
        <StatTile label="At 100%" value={perfect} icon="trophy" tone="green" caption="Perfect attendance" />
        <StatTile label="Hours logged" value={totalHours} icon="clock" tone="blue" caption="Across the range" />
      </div>

      <AttendanceMatrix
        students={rows}
        trackedDays={trackedDays}
        from={from}
        to={to}
        options={{ years: options.years, domains: options.domains }}
        filters={{ year, domain }}
      />
    </div>
  );
}
