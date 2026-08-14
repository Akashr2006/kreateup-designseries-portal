import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { StatTile } from "@/components/ui/StatTile";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/Table";
import { requirePermission } from "@/lib/auth";
import { relativeTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Data & audit" };
export const dynamic = "force-dynamic";

const TABLES: Array<{
  key: string;
  label: string;
  icon: IconName;
  tone: "blue" | "red" | "amber" | "green";
  description: string;
}> = [
  { key: "students", label: "People", icon: "users", tone: "blue", description: "The full roster with roles, permissions and account status." },
  { key: "attendance", label: "Attendance", icon: "check-circle", tone: "green", description: "One row per student, per day, per hour." },
  { key: "worklogs", label: "Worklogs", icon: "clipboard", tone: "amber", description: "Every slot write-up with its mentor remark." },
  { key: "passes", label: "Activity passes", icon: "ticket", tone: "red", description: "Requests, decisions and issued pass codes." },
  { key: "tasks", label: "Tasks", icon: "target", tone: "blue", description: "Assignments, status and points awarded." },
  { key: "linkedin", label: "LinkedIn posts", icon: "linkedin", tone: "green", description: "Submissions with verification state and engagement." },
  { key: "rewards", label: "Reward ledger", icon: "trophy", tone: "amber", description: "Every points movement, with its reason." },
  { key: "audit", label: "Audit log", icon: "shield", tone: "red", description: "Every privileged action taken in the console." },
];

/** Actions grouped for a friendlier audit read-out. */
const ACTION_TONE: Record<string, "blue" | "red" | "amber" | "green" | "slate"> = {
  LOGIN: "slate",
  LOGOUT: "slate",
  SEED: "slate",
  EXPORT: "amber",
  PASSWORD_CHANGE: "blue",
  PROFILE_UPDATE: "blue",
  ATTENDANCE_CHECKIN: "green",
  ATTENDANCE_MANUAL: "amber",
  ATTENDANCE_CLEAR: "red",
  WORKLOG_CREATE: "green",
  WORKLOG_UPDATE: "blue",
  WORKLOG_REVIEW: "blue",
  TASK_CREATE: "green",
  TASK_STATUS: "blue",
  TASK_DELETE: "red",
  PASS_REQUEST: "blue",
  PASS_APPROVED: "green",
  PASS_REJECTED: "red",
  PASS_CANCEL: "slate",
  NOTIFICATION_PUBLISH: "green",
  NOTIFICATION_DELETE: "red",
  LINKEDIN_SUBMIT: "blue",
  LINKEDIN_VERIFY: "green",
  USER_CREATE: "green",
  USER_UPDATE: "amber",
  USER_SUSPEND: "red",
};

export default async function DatabasePage() {
  await requirePermission("permAdminDatabase");

  const [audit, counts] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, action: true, entity: true, entityId: true, meta: true, createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.attendance.count(),
      prisma.worklog.count(),
      prisma.activityPass.count(),
      prisma.task.count(),
      prisma.linkedinPost.count(),
      prisma.rewardEntry.count(),
      prisma.auditLog.count(),
    ]),
  ]);

  const [users, attendance, worklogs, passes, tasks, linkedin, rewards, auditCount] = counts;

  const rowCounts: Record<string, number> = {
    students: users,
    attendance,
    worklogs,
    passes,
    tasks,
    linkedin,
    rewards,
    audit: auditCount,
  };

  const totalRows = counts.reduce((sum, n) => sum + n, 0);

  return (
    <div>
      <PageHeader
        title="Data & audit"
        description="Export any table as CSV, and read the trail of every privileged action taken in the console. Exports are themselves recorded — the audit log is not something the console can be used to hide from."
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total rows" value={totalRows.toLocaleString()} icon="layers" tone="blue" caption="Across all tables" />
        <StatTile label="Attendance records" value={attendance.toLocaleString()} icon="check-circle" tone="green" />
        <StatTile label="Worklog entries" value={worklogs.toLocaleString()} icon="clipboard" tone="amber" />
        <StatTile label="Audit entries" value={auditCount.toLocaleString()} icon="shield" tone="red" caption="Every privileged action" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-5">
        {/* Exports ------------------------------------------------------- */}
        <Card>
          <CardHeader
            icon="download"
            title="Exports"
            subtitle="CSV with a UTF-8 byte-order mark, so Excel opens it correctly without an import wizard."
          />
          <ul className="grid gap-2">
            {TABLES.map((table) => (
              <li key={table.key}>
                <a
                  href={`/api/export?table=${table.key}`}
                  data-accent={table.tone}
                  className="inset-panel flex items-center gap-3 p-3 transition-colors hover:border-[var(--tone)]"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                  >
                    <Icon name={table.icon} className="h-[17px] w-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
                        {table.label}
                      </span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--text-faint)" }}>
                        {rowCounts[table.key]?.toLocaleString() ?? 0} rows
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
                      {table.description}
                    </span>
                  </span>
                  <Icon name="download" className="h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
                </a>
              </li>
            ))}
          </ul>

          <div
            data-accent="amber"
            className="mt-4 flex items-start gap-2.5 rounded-[10px] p-3"
            style={{ background: "var(--tone-soft)" }}
          >
            <Icon name="lock" className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <p className="text-[11.5px] leading-snug" style={{ color: "var(--tone)" }}>
              These files contain personal data — names, roll numbers, phone numbers and email
              addresses. Keep them off shared drives and delete them once you are done.
            </p>
          </div>
        </Card>

        {/* Audit --------------------------------------------------------- */}
        <Card padded={false}>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader
              icon="shield"
              title="Audit trail"
              subtitle="The last 100 privileged actions, newest first."
            />
          </div>

          {audit.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState compact icon="shield" title="Nothing recorded yet" />
            </div>
          ) : (
            <>
              <TableWrap className="hidden rounded-none border-x-0 border-b-0 md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>When</TH>
                      <TH>Who</TH>
                      <TH>Action</TH>
                      <TH>Entity</TH>
                      <TH>Details</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {audit.map((entry) => (
                      <TR key={entry.id}>
                        <TD>
                          <span className="whitespace-nowrap text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                            {relativeTime(entry.createdAt)}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-strong)" }}>
                            {entry.actor?.name ?? "System"}
                          </span>
                        </TD>
                        <TD>
                          <Badge tone={ACTION_TONE[entry.action] ?? "slate"}>
                            {entry.action.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                            {entry.entity}
                          </span>
                        </TD>
                        <TD>
                          <span
                            className="block max-w-[260px] truncate font-mono text-[11px]"
                            style={{ color: "var(--text-faint)" }}
                            title={entry.meta}
                          >
                            {entry.meta && entry.meta !== "{}" ? entry.meta : "—"}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>

              <ul className="px-4 pb-4 md:hidden">
                {audit.map((entry) => (
                  <li key={entry.id} className="border-b py-2.5 last:border-0" style={{ borderColor: "var(--line-soft)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={ACTION_TONE[entry.action] ?? "slate"}>
                        {entry.action.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                      <span className="text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-default)" }}>
                      {entry.actor?.name ?? "System"} · {entry.entity}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
