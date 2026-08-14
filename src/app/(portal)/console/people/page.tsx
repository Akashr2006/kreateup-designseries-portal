import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS, type Permission } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { filterOptions } from "@/lib/queries";

import { PeopleClient, type PersonRow } from "./PeopleClient";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const admin = await requirePermission("permUserManagement");

  const [people, options] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ systemStatus: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, rollNo: true, email: true, department: true, year: true,
        mobile: true, domain: true, mentorName: true, role: true, systemStatus: true,
        rewardPoints: true, lastLoginAt: true,
        permUserManagement: true, permScanStudentQr: true, permMentorTasks: true,
        permLinkedinTracker: true, permWorklogs: true, permNotifications: true,
        permAttendanceLogs: true, permExtensionRequest: true, permAdminDatabase: true,
        permActivityApproval: true,
      },
    }),
    filterOptions(),
  ]);

  const rows: PersonRow[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    rollNo: person.rollNo,
    email: person.email,
    department: person.department,
    year: person.year,
    mobile: person.mobile,
    domain: person.domain,
    mentorName: person.mentorName,
    role: person.role,
    systemStatus: person.systemStatus,
    rewardPoints: person.rewardPoints,
    lastLoginAt: person.lastLoginAt?.toISOString() ?? null,
    permissions: Object.fromEntries(
      PERMISSIONS.map((permission) => [permission, person[permission as keyof typeof person] === true])
    ) as Record<Permission, boolean>,
  }));

  const students = rows.filter((r) => r.role === "STUDENT").length;
  const staff = rows.length - students;
  const suspended = rows.filter((r) => r.systemStatus === "SUSPENDED").length;
  const neverSignedIn = rows.filter((r) => !r.lastLoginAt).length;

  return (
    <div>
      <PageHeader
        title="People"
        description="The programme roster. Change a role, grant a console module, reset a password, or suspend an account — every action here is written to the audit log."
        actions={
          <LinkButton href="/api/export?table=students" variant="secondary" icon="download" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Students" value={students} icon="users" tone="blue" />
        <StatTile label="Staff accounts" value={staff} icon="shield" tone="green" caption="Mentors and admins" />
        <StatTile
          label="Suspended"
          value={suspended}
          icon="lock"
          tone={suspended > 0 ? "red" : "slate"}
          caption={suspended > 0 ? "Cannot sign in" : "None"}
        />
        <StatTile
          label="Never signed in"
          value={neverSignedIn}
          icon="alert"
          tone={neverSignedIn > 0 ? "amber" : "green"}
          caption={neverSignedIn > 0 ? "Still on the issued password" : "Everyone has logged in"}
        />
      </div>

      <PeopleClient people={rows} options={options} actorRole={admin.role} canManage />
    </div>
  );
}
