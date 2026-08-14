import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/lib/auth";
import { consoleNavFor, STUDENT_NAV } from "@/lib/nav";
import type { PermissionSubject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unreadNotificationCount } from "@/lib/queries";
import { toDayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";

/**
 * The authenticated shell. Everything under (portal) is guarded here, so no
 * page below has to repeat the session check.
 *
 * Badge counts are computed once per navigation and passed down, which keeps
 * every nav item's dot in sync without a client-side polling loop.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const subject = user as PermissionSubject;

  const consoleNav = consoleNavFor(subject);

  const [unread, openTasks, pendingPasses, flaggedWorklogs, pendingReviews] = await Promise.all([
    unreadNotificationCount(user),
    prisma.task.count({ where: { assigneeId: user.id, status: { notIn: ["DONE"] } } }),
    can(subject, "permActivityApproval")
      ? prisma.activityPass.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    can(subject, "permWorklogs")
      ? prisma.worklog.count({ where: { status: "FLAGGED" } })
      : Promise.resolve(0),
    can(subject, "permWorklogs")
      ? prisma.worklog.count({ where: { status: "SUBMITTED", date: toDayKey() } })
      : Promise.resolve(0),
  ]);

  const badges: Record<string, number> = {
    "/announcements": unread,
    "/tasks": openTasks,
    "/console/passes": pendingPasses,
    "/console/worklogs": flaggedWorklogs + pendingReviews,
  };

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo,
        role: user.role,
        domain: user.domain,
        year: user.year,
        rewardPoints: user.rewardPoints,
        mustChangePassword: user.mustChangePassword,
      }}
      studentNav={STUDENT_NAV}
      consoleNav={consoleNav}
      badges={badges}
      today={toDayKey()}
    >
      {children}
    </AppShell>
  );
}
