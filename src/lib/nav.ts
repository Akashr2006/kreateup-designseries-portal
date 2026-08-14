import type { IconName } from "@/components/ui/Icon";
import type { Permission } from "./constants";
import { can, canOpenConsole, type PermissionSubject } from "./permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile bottom bar (max 4 + "More"). */
  primary?: boolean;
  /** Console items only: the permission that unlocks the item. */
  permission?: Permission;
  description: string;
};

/** Everything a signed-in student can reach. */
export const STUDENT_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "grid",
    primary: true,
    description: "Your day at a glance — attendance, worklog and what needs doing.",
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: "check-circle",
    primary: true,
    description: "Check in for the day and review your hour-by-hour history.",
  },
  {
    href: "/worklog",
    label: "Worklog",
    icon: "clipboard",
    primary: true,
    description: "Log what you worked on in each slot and track mentor remarks.",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: "target",
    primary: true,
    description: "Sprint deliverables assigned to you by your mentor.",
  },
  {
    href: "/passes",
    label: "Activity passes",
    icon: "ticket",
    description: "Request a gate pass and carry the approved slip on your phone.",
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: "bell",
    description: "Programme-wide notices from the DesignSeries team.",
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: "trophy",
    description: "Reward points across the cohort.",
  },
  {
    href: "/notes",
    label: "Notes",
    icon: "note",
    description: "Your private scratchpad. Never visible to anyone else.",
  },
  {
    href: "/profile",
    label: "Profile",
    icon: "user",
    description: "Your record, links and account security.",
  },
];

/** The admin console. Each item needs its own permission grant. */
export const CONSOLE_NAV: NavItem[] = [
  {
    href: "/console",
    label: "Overview",
    icon: "chart",
    primary: true,
    description: "Live programme health: today's floor, trends and what is waiting on you.",
  },
  {
    href: "/console/people",
    label: "People",
    icon: "users",
    permission: "permUserManagement",
    primary: true,
    description: "The roster — roles, permissions, account status.",
  },
  {
    href: "/console/attendance",
    label: "Attendance",
    icon: "check-circle",
    permission: "permAttendanceLogs",
    primary: true,
    description: "The full attendance matrix, plus manual entry.",
  },
  {
    href: "/console/worklogs",
    label: "Worklogs",
    icon: "clipboard",
    permission: "permWorklogs",
    primary: true,
    description: "Read every submission and leave mentor remarks.",
  },
  {
    href: "/console/tasks",
    label: "Tasks",
    icon: "target",
    permission: "permMentorTasks",
    description: "Assign sprint work and track completion.",
  },
  {
    href: "/console/passes",
    label: "Approvals",
    icon: "ticket",
    permission: "permActivityApproval",
    description: "Approve or reject gate pass requests.",
  },
  {
    href: "/console/extensions",
    label: "Extensions",
    icon: "clock",
    permission: "permExtensionRequest",
    description: "Reopen a locked worklog date for a student who missed the window.",
  },
  {
    href: "/console/announcements",
    label: "Announcements",
    icon: "bell",
    permission: "permNotifications",
    description: "Publish notices to the whole programme or a single cohort.",
  },
  {
    href: "/console/linkedin",
    label: "LinkedIn tracker",
    icon: "linkedin",
    permission: "permLinkedinTracker",
    description: "Verify build-in-public posts submitted by students.",
  },
  {
    href: "/console/scan",
    label: "QR check-in",
    icon: "qr",
    permission: "permScanStudentQr",
    description: "Mark attendance on behalf of a student at the studio door.",
  },
  {
    href: "/console/database",
    label: "Data & audit",
    icon: "layers",
    permission: "permAdminDatabase",
    description: "Export raw tables and read the audit trail.",
  },
];

/** Console items this specific user may see. */
export function consoleNavFor(user: PermissionSubject): NavItem[] {
  if (!canOpenConsole(user)) return [];
  return CONSOLE_NAV.filter((item) => !item.permission || can(user, item.permission));
}

/** Longest-prefix match so `/console/people/abc` still highlights "People". */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/console") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Human title for the current route, used by the top bar and <title>. */
export function titleFor(pathname: string): string {
  const all = [...STUDENT_NAV, ...CONSOLE_NAV];
  const matches = all
    .filter((item) => isActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.label ?? "Portal";
}
