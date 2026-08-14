/**
 * Shared vocabulary for the portal.
 *
 * Prisma models store these as plain strings (so the schema stays portable
 * between SQLite and Postgres); this file is the single source of truth for
 * what those strings may be, plus the labels shown in the UI.
 */

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export const ROLES = ["STUDENT", "MENTOR", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: "Student",
  MENTOR: "Mentor",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

/** Rank used for "can this user act on that user" checks. */
export const ROLE_RANK: Record<Role, number> = {
  STUDENT: 0,
  MENTOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const PERMISSIONS = [
  "permUserManagement",
  "permScanStudentQr",
  "permMentorTasks",
  "permLinkedinTracker",
  "permWorklogs",
  "permNotifications",
  "permAttendanceLogs",
  "permExtensionRequest",
  "permAdminDatabase",
  "permActivityApproval",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  permUserManagement: "User management",
  permScanStudentQr: "Scan student QR",
  permMentorTasks: "Mentor tasks",
  permLinkedinTracker: "LinkedIn tracker",
  permWorklogs: "Worklog review",
  permNotifications: "Notifications",
  permAttendanceLogs: "Attendance logs",
  permExtensionRequest: "Extension requests",
  permAdminDatabase: "Admin database",
  permActivityApproval: "Activity approval",
};

export const PERMISSION_HINT: Record<Permission, string> = {
  permUserManagement: "Create, edit, suspend and re-role portal accounts.",
  permScanStudentQr: "Open the QR scanner and mark attendance on behalf of a student.",
  permMentorTasks: "Assign and grade tasks for mentees.",
  permLinkedinTracker: "Verify LinkedIn posts submitted by students.",
  permWorklogs: "Read every worklog and leave mentor remarks.",
  permNotifications: "Publish announcements to cohorts.",
  permAttendanceLogs: "Read the full attendance matrix and add manual entries.",
  permExtensionRequest: "Grant late-submission windows for worklogs.",
  permAdminDatabase: "Export raw tables and view the audit trail.",
  permActivityApproval: "Approve or reject gate pass requests.",
};

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** The seven trackable hours of a DesignSeries day. */
export const ATTENDANCE_HOURS = [1, 2, 3, 4, 5, 6, 7] as const;

export const HOUR_WINDOW: Record<number, string> = {
  1: "08:45 – 09:35",
  2: "09:35 – 10:25",
  3: "10:40 – 11:35",
  4: "11:35 – 12:30",
  5: "13:30 – 14:20",
  6: "14:20 – 15:10",
  7: "15:25 – 16:25",
};

export const ATTENDANCE_STATUS = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

/** Submissions close at 23:30 local time, matching the legacy portal rule. */
export const ATTENDANCE_CUTOFF_MINUTES = 23 * 60 + 30;

// ---------------------------------------------------------------------------
// Worklog slots
// ---------------------------------------------------------------------------

export const WORKLOG_SLOTS = [
  { key: "s1", label: "Slot 1", window: "08:45 – 10:25", required: true },
  { key: "s2", label: "Slot 2", window: "10:40 – 12:30", required: true },
  { key: "s3", label: "Slot 3", window: "13:30 – 15:10", required: true },
  { key: "s4", label: "Slot 4", window: "15:25 – 16:25", required: true },
  { key: "s5", label: "Extra", window: "After hours", required: false },
] as const;

export type WorklogSlotKey = (typeof WORKLOG_SLOTS)[number]["key"];

export const WORKLOG_STATUS = ["SUBMITTED", "REVIEWED", "FLAGGED"] as const;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_STATUS = ["TODO", "IN_PROGRESS", "SUBMITTED", "DONE", "BLOCKED"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const TASK_PRIORITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITY)[number];

// ---------------------------------------------------------------------------
// Activity passes
// ---------------------------------------------------------------------------

export const PASS_STATUS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type PassStatus = (typeof PASS_STATUS)[number];

export const PASS_CATEGORY = ["ACTIVITY", "MEDICAL", "PLACEMENT", "EVENT", "OTHER"] as const;

export const PASS_CATEGORY_LABEL: Record<string, string> = {
  ACTIVITY: "Activity",
  MEDICAL: "Medical",
  PLACEMENT: "Placement",
  EVENT: "Event",
  OTHER: "Other",
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_CATEGORY = ["GENERAL", "URGENT", "EVENT", "DEADLINE", "RESULT"] as const;
export const NOTIFICATION_AUDIENCE = ["ALL", "YEAR", "DOMAIN", "ROLE"] as const;

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const NOTE_COLORS = ["blue", "red", "amber", "green", "slate"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

// ---------------------------------------------------------------------------
// Reward rules
// ---------------------------------------------------------------------------

export const REWARD_RULES = {
  fullDayAttendance: 5,
  worklogSubmitted: 4,
  taskCompletedBase: 10,
  linkedinVerified: 15,
} as const;
