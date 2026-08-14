/**
 * Seeds the portal from the real DesignSeries roster (prisma/data/roster.csv)
 * and generates a plausible operating history on top of it: attendance for the
 * last six working weeks, worklogs, tasks, gate passes, announcements, notes,
 * LinkedIn submissions and a reward ledger.
 *
 * Run with:  npm run db:seed      (or `npm run db:reset` to wipe first)
 *
 * The generated history uses a fixed-seed PRNG, so re-seeding produces the same
 * database every time — screenshots and demos stay stable.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  ATTENDANCE_HOURS,
  PASS_CATEGORY,
  REWARD_RULES,
} from "../src/lib/constants";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "designseries@2026";
const HISTORY_WEEKS = 6;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260810);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const chance = (p: number) => rand() < p;
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

// ---------------------------------------------------------------------------
// Date helpers (duplicated here so the seed has no runtime deps on src/)
// ---------------------------------------------------------------------------

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Working days (Mon–Sat, matching the DesignSeries schedule) for the history window. */
function workingDays(weeks: number): string[] {
  const today = new Date();
  const days: string[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i -= 1) {
    const date = shiftDays(today, -i);
    if (date.getDay() !== 0) days.push(dayKey(date));
  }
  return days;
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180: quoted fields, escaped quotes, CRLF)
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const truthy = (value: string) => /^(true|yes|1|y)$/i.test(value.trim());

// ---------------------------------------------------------------------------
// Roster import
// ---------------------------------------------------------------------------

type RosterRow = {
  name: string;
  rollNo: string;
  email: string;
  department: string;
  year: string;
  mobile: string;
  domain: string;
  mentorName: string;
  linkedin: string;
  github: string;
  role: string;
  perms: Record<string, boolean>;
};

function loadRoster(): RosterRow[] {
  const csv = readFileSync(join(process.cwd(), "prisma", "data", "roster.csv"), "utf8");
  const [, ...rows] = parseCsv(csv);

  const seen = new Set<string>();
  const out: RosterRow[] = [];

  for (const cells of rows) {
    const get = (i: number) => (cells[i] ?? "").trim();

    const email = get(2).toLowerCase();
    const rollNo = get(1).toUpperCase();
    if (!email || !rollNo || seen.has(email)) continue;
    seen.add(email);

    const sheetRole = get(10).toUpperCase();
    const domain = get(6) || "Data not Feeded";

    // The roster only distinguishes Student / Admin. Programme leads (domain
    // "OVERALL LEAD") get the super-admin role so there is always an account
    // that can manage everything.
    let role: string = sheetRole === "ADMIN" ? "ADMIN" : "STUDENT";
    if (role === "ADMIN" && /overall lead/i.test(domain)) role = "SUPER_ADMIN";

    out.push({
      name: get(0).replace(/\s+/g, " ").trim(),
      rollNo,
      email,
      department: get(3).replace(/\s+/g, " ").trim(),
      year: get(4).replace(/\s+/g, " ").trim(),
      mobile: get(5),
      domain: domain.replace(/\s+/g, " ").trim(),
      mentorName: get(7).replace(/\s+/g, " ").trim(),
      linkedin: get(8),
      github: get(9),
      role,
      perms: {
        permUserManagement: truthy(get(12)),
        permScanStudentQr: truthy(get(13)),
        permMentorTasks: truthy(get(14)),
        permLinkedinTracker: truthy(get(15)),
        permWorklogs: truthy(get(16)),
        permNotifications: truthy(get(17)),
        permAttendanceLogs: truthy(get(18)),
        permExtensionRequest: truthy(get(19)),
        permAdminDatabase: truthy(get(20)),
        permActivityApproval: truthy(get(21)),
      },
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Content pools for the generated history
// ---------------------------------------------------------------------------

const WORK_BY_DOMAIN: Record<string, string[]> = {
  "Automation - N8n": [
    "Built an n8n workflow that pushes new form responses into the CRM and pings the owner on Slack.",
    "Debugged a failing webhook node — the payload was double-encoded, added a Function node to unwrap it.",
    "Documented the error-handling branch for the lead-routing automation.",
    "Set up scheduled triggers for the weekly digest and tested the retry policy.",
    "Mapped the Airtable schema to the automation payload and fixed three field mismatches.",
  ],
  "Customer Experience (CX) Full Stack": [
    "Implemented the ticket detail route and wired it to the REST endpoint.",
    "Refactored the shared form components so validation lives in one place.",
    "Wrote integration tests for the auth flow and fixed the redirect loop on expiry.",
    "Optimised the dashboard query — moved aggregation to the database, cut load time to under 200ms.",
    "Built the pagination layer and handled the empty and error states properly.",
  ],
  "Customer Experience (CX) UIUX": [
    "Redrew the onboarding flow in Figma after the usability session; cut it from five screens to three.",
    "Built the component library page with states for hover, focus, disabled and loading.",
    "Ran a contrast audit across the palette and fixed six failing text pairs.",
    "Prototyped the mobile navigation and tested the thumb-reach on three device sizes.",
    "Documented spacing and type scale tokens for handoff.",
  ],
  "Customer Experience (CX) No Code": [
    "Rebuilt the landing page in the no-code builder and connected the form to the pipeline.",
    "Set up conditional logic on the intake form so irrelevant sections stay hidden.",
    "Connected analytics events and verified they fire on each funnel step.",
  ],
  "Smart Marketing Tools & Automation": [
    "Drafted the campaign brief and mapped the segment rules for the launch sequence.",
    "Set up the drip sequence and A/B tested two subject lines across a small sample.",
    "Built the reporting sheet that pulls campaign metrics automatically each morning.",
    "Audited the tag manager container and removed four stale triggers.",
  ],
  "Brand Identity & Visual Design": [
    "Explored three logo lockup directions and narrowed to the one that holds up at 24px.",
    "Built the brand sheet: palette, type pairing, spacing rules and misuse examples.",
    "Designed the social template set and exported the reusable master files.",
    "Reworked the poster grid so the headline stays readable on dark photography.",
  ],
  "Video Production & Motion Design": [
    "Storyboarded the 30-second explainer and locked the voiceover script.",
    "Cut the rough edit and synced the b-roll to the beat markers.",
    "Animated the lower-thirds pack and made the timing consistent across all six.",
    "Colour-graded the interview footage and cleaned up the room tone in audio.",
  ],
  default: [
    "Worked through the assigned module and pushed the day's progress for review.",
    "Paired with a teammate on the blocker from yesterday and unblocked it.",
    "Wrote up the research notes and shared them with the domain channel.",
    "Reviewed feedback from the mentor and applied the requested changes.",
    "Prepared the demo for the weekly review session.",
  ],
};

function workFor(domain: string): string {
  const pool = WORK_BY_DOMAIN[domain] ?? WORK_BY_DOMAIN.default;
  return pick(pool);
}

const ATTENDANCE_REASONS = [
  "Present for the full session.",
  "Working on the assigned sprint task.",
  "Domain review session with mentor.",
  "Studio work — prototype build.",
  "Client-brief workshop.",
];

const TASK_TITLES = [
  "Ship the domain sprint deliverable",
  "Publish a build-in-public LinkedIn post",
  "Complete the accessibility audit checklist",
  "Prepare the weekly demo walkthrough",
  "Write documentation for your module",
  "Peer-review two teammates' submissions",
  "Fix the review comments from last sprint",
  "Record a two-minute progress update",
];

const PASS_DESTINATIONS = [
  "College Health Centre",
  "Main Auditorium — Guest Lecture",
  "Placement Cell",
  "Erode — Client Meeting",
  "Home (Sathyamangalam)",
  "Library Block",
];

const NOTE_SEEDS = [
  { title: "Sprint checklist", body: "1. Finish the layout pass\n2. Hook up the API\n3. Ask mentor about the edge case\n4. Push before 4pm" },
  { title: "Mentor feedback", body: "Keep the copy shorter. Lead with the outcome, not the process. Rework the second slide." },
  { title: "Things to learn", body: "- Server components vs client components\n- Proper focus management\n- Reading query plans" },
  { title: "Demo script", body: "Open with the problem, show the before, show the after, close with the number that moved." },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function wipe() {
  // Order matters: children before parents.
  await prisma.auditLog.deleteMany();
  await prisma.rewardEntry.deleteMany();
  await prisma.linkedinPost.deleteMany();
  await prisma.note.deleteMany();
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityPass.deleteMany();
  await prisma.worklog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("→ Clearing existing data…");
  await wipe();

  const roster = loadRoster();
  console.log(`→ Importing ${roster.length} roster entries…`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await prisma.user.createMany({
    data: roster.map((row, index) => ({
      name: row.name,
      rollNo: row.rollNo,
      email: row.email,
      department: row.department,
      year: row.year,
      mobile: row.mobile,
      domain: row.domain,
      mentorName: row.mentorName,
      linkedin: row.linkedin,
      github: row.github,
      role: row.role,
      systemStatus: "ACTIVE",
      passwordHash,
      mustChangePassword: true,
      avatarSeed: index,
      ...row.perms,
    })),
  });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, domain: true, year: true, rollNo: true },
  });
  const students = users.filter((u) => u.role === "STUDENT");
  const staff = users.filter((u) => u.role !== "STUDENT");
  const superAdmin = users.find((u) => u.role === "SUPER_ADMIN") ?? staff[0] ?? users[0];

  console.log(`   ${students.length} students, ${staff.length} staff accounts.`);

  const days = workingDays(HISTORY_WEEKS);
  const today = dayKey(new Date());

  // -- Attendance ----------------------------------------------------------
  console.log(`→ Generating attendance across ${days.length} working days…`);

  const attendanceRows: Array<{
    userId: string;
    date: string;
    hour: number;
    reason: string;
    status: string;
    source: string;
  }> = [];

  // Each student gets a personal reliability score so the analytics have shape.
  const reliability = new Map(students.map((s) => [s.id, 0.62 + rand() * 0.36]));

  for (const student of students) {
    const score = reliability.get(student.id) ?? 0.8;
    for (const date of days) {
      if (!chance(score)) continue; // absent that day

      const full = chance(score);
      const hours = full ? ATTENDANCE_HOURS.slice() : ATTENDANCE_HOURS.slice(0, between(3, 6));
      const reason = pick(ATTENDANCE_REASONS);

      for (const hour of hours) {
        attendanceRows.push({
          userId: student.id,
          date,
          hour,
          reason,
          status: hour === 1 && chance(0.08) ? "LATE" : "PRESENT",
          source: chance(0.9) ? "SELF" : "QR",
        });
      }
    }
  }

  for (let i = 0; i < attendanceRows.length; i += 2000) {
    await prisma.attendance.createMany({ data: attendanceRows.slice(i, i + 2000) });
  }
  console.log(`   ${attendanceRows.length} attendance records.`);

  // -- Tasks ---------------------------------------------------------------
  console.log("→ Creating tasks…");

  const taskRows = students.flatMap((student) => {
    const count = between(1, 3);
    return Array.from({ length: count }, () => {
      const status = pick(["TODO", "IN_PROGRESS", "SUBMITTED", "DONE", "DONE", "BLOCKED"] as const);
      return {
        title: pick(TASK_TITLES),
        description:
          "Deliverable for the current DesignSeries sprint. Attach your worklog for the day you complete it so your mentor can trace the work.",
        authorId: pick(staff.length ? staff : users).id,
        assigneeId: student.id,
        domain: student.domain,
        year: student.year,
        priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"] as const),
        status,
        dueDate: days[Math.max(0, days.length - between(1, 12))],
        points: pick([5, 10, 10, 15, 20]),
        completedAt: status === "DONE" ? new Date() : null,
      };
    });
  });

  await prisma.task.createMany({ data: taskRows });
  const tasks = await prisma.task.findMany({ select: { id: true, assigneeId: true, status: true, points: true } });
  console.log(`   ${tasks.length} tasks.`);

  const tasksByStudent = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    const list = tasksByStudent.get(task.assigneeId) ?? [];
    list.push(task);
    tasksByStudent.set(task.assigneeId, list);
  }

  // -- Worklogs ------------------------------------------------------------
  console.log("→ Generating worklogs…");

  const worklogRows: Array<Record<string, unknown>> = [];
  for (const student of students) {
    const score = reliability.get(student.id) ?? 0.8;
    const linked = tasksByStudent.get(student.id) ?? [];
    for (const date of days) {
      if (!chance(score * 0.85)) continue;
      const reviewed = chance(0.45);
      worklogRows.push({
        userId: student.id,
        date,
        s1: workFor(student.domain),
        s2: workFor(student.domain),
        s3: workFor(student.domain),
        s4: workFor(student.domain),
        s5: chance(0.25) ? workFor(student.domain) : "",
        taskId: linked.length && chance(0.5) ? pick(linked).id : null,
        status: reviewed ? (chance(0.12) ? "FLAGGED" : "REVIEWED") : "SUBMITTED",
        mentorRemark: reviewed
          ? pick([
              "Good detail — keep logging the blockers too.",
              "Clear progress. Link the task next time.",
              "Slot 3 is vague, expand on what changed.",
              "Nice work this week.",
            ])
          : "",
        reviewedBy: reviewed ? superAdmin.id : null,
        reviewedAt: reviewed ? new Date() : null,
      });
    }
  }

  for (let i = 0; i < worklogRows.length; i += 1000) {
    await prisma.worklog.createMany({ data: worklogRows.slice(i, i + 1000) as never });
  }
  console.log(`   ${worklogRows.length} worklogs.`);

  // -- Activity passes -----------------------------------------------------
  console.log("→ Creating activity passes…");

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codeBlock = () => Array.from({ length: 4 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");

  const passRows = students
    .filter(() => chance(0.55))
    .flatMap((student) =>
      Array.from({ length: between(1, 2) }, () => {
        const status = pick(["PENDING", "PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED"] as const);
        const decided = status === "APPROVED" || status === "REJECTED";
        const from = between(9, 14);
        return {
          userId: student.id,
          date: pick(days.slice(-14)),
          fromTime: `${String(from).padStart(2, "0")}:00`,
          toTime: `${String(from + between(1, 3)).padStart(2, "0")}:30`,
          destination: pick(PASS_DESTINATIONS),
          reason: pick([
            "Consultation at the health centre, will submit the slip afterwards.",
            "Attending the guest session on product strategy.",
            "Placement drive pre-screening round.",
            "Client review meeting with the domain mentor.",
            "Family emergency, informed the mentor over call.",
          ]),
          category: pick(PASS_CATEGORY),
          status,
          passCode: `KUP-${codeBlock()}-${codeBlock()}`,
          remark: status === "REJECTED" ? "Clashes with the mandatory review session." : "",
          reviewerId: decided ? superAdmin.id : null,
          reviewedAt: decided ? new Date() : null,
        };
      })
    );

  await prisma.activityPass.createMany({ data: passRows });
  console.log(`   ${passRows.length} activity passes.`);

  // -- Announcements -------------------------------------------------------
  console.log("→ Publishing announcements…");

  const announcements = [
    {
      title: "Sprint 4 review — Friday 4:30 PM",
      body: "Every domain presents a five-minute walkthrough of what shipped this sprint. Bring a working build, not slides. Order of presentation goes up on the studio board Thursday evening.",
      category: "EVENT",
      audience: "ALL",
      audienceValue: "",
      pinned: true,
    },
    {
      title: "Worklogs now lock at 11:30 PM",
      body: "Same-day worklogs must be submitted before 11:30 PM. If you genuinely could not log in time, raise an extension request from the Worklog page and your mentor will review it.",
      category: "DEADLINE",
      audience: "ALL",
      audienceValue: "",
      pinned: true,
    },
    {
      title: "LinkedIn build-in-public — weekly minimum",
      body: "One post per week per student. Submit the link in the LinkedIn tracker so it can be verified. Verified posts carry reward points.",
      category: "GENERAL",
      audience: "ALL",
      audienceValue: "",
      pinned: false,
    },
    {
      title: "Second years: portfolio clinic on Wednesday",
      body: "Bring your current portfolio draft. We will review structure, case-study depth and presentation. Sign-up sheet is in the studio.",
      category: "EVENT",
      audience: "YEAR",
      audienceValue: "2025-2029 - IIB",
      pinned: false,
    },
    {
      title: "Automation track: n8n version upgrade",
      body: "The shared n8n instance moves to the new major version this weekend. Export your workflows before Friday evening — some legacy nodes will need remapping afterwards.",
      category: "URGENT",
      audience: "DOMAIN",
      audienceValue: "Automation - N8n",
      pinned: false,
    },
    {
      title: "Attendance audit results published",
      body: "The mid-term attendance audit is complete. Anyone below 75% has been flagged to their mentor. Check your dashboard for your current figure.",
      category: "RESULT",
      audience: "ALL",
      audienceValue: "",
      pinned: false,
    },
  ];

  for (const [index, item] of announcements.entries()) {
    await prisma.notification.create({
      data: {
        ...item,
        authorId: superAdmin.id,
        createdAt: shiftDays(new Date(), -index * 2),
      },
    });
  }
  console.log(`   ${announcements.length} announcements.`);

  // -- Notes ---------------------------------------------------------------
  console.log("→ Adding private notes…");

  const noteRows = students
    .filter(() => chance(0.4))
    .map((student) => {
      const seed = pick(NOTE_SEEDS);
      return {
        userId: student.id,
        title: seed.title,
        body: seed.body,
        color: pick(["blue", "red", "amber", "green", "slate"] as const),
        pinned: chance(0.25),
      };
    });

  await prisma.note.createMany({ data: noteRows });
  console.log(`   ${noteRows.length} notes.`);

  // -- LinkedIn tracker ----------------------------------------------------
  console.log("→ Recording LinkedIn submissions…");

  const linkedinRows = students
    .filter((s) => chance(0.6))
    .flatMap((student) =>
      Array.from({ length: between(1, 3) }, () => ({
        userId: student.id,
        url: `https://www.linkedin.com/posts/${student.rollNo.toLowerCase()}-activity-${between(
          7000000000000000000,
          7999999999999999999
        )}`,
        caption: pick([
          "Week 4 of DesignSeries — shipped the automation that saves our team two hours a day.",
          "Building in public: here is what broke and how we fixed it.",
          "Three usability lessons from testing our onboarding with real users.",
          "Finished the brand system for our sprint client. Swipe for the before and after.",
        ]),
        postedOn: pick(days.slice(-21)),
        reactions: between(8, 260),
        comments: between(0, 34),
        verified: chance(0.65),
      }))
    );

  await prisma.linkedinPost.createMany({ data: linkedinRows });
  console.log(`   ${linkedinRows.length} LinkedIn submissions.`);

  // -- Reward ledger -------------------------------------------------------
  console.log("→ Computing reward points…");

  const rewardRows: Array<{ userId: string; points: number; reason: string; source: string }> = [];

  const attendanceCount = new Map<string, number>();
  for (const row of attendanceRows) {
    attendanceCount.set(row.userId, (attendanceCount.get(row.userId) ?? 0) + 1);
  }
  const worklogCount = new Map<string, number>();
  for (const row of worklogRows) {
    const id = row.userId as string;
    worklogCount.set(id, (worklogCount.get(id) ?? 0) + 1);
  }
  const verifiedPosts = new Map<string, number>();
  for (const row of linkedinRows) {
    if (row.verified) verifiedPosts.set(row.userId, (verifiedPosts.get(row.userId) ?? 0) + 1);
  }

  const totals = new Map<string, number>();
  const addReward = (userId: string, points: number, reason: string, source: string) => {
    if (points <= 0) return;
    rewardRows.push({ userId, points, reason, source });
    totals.set(userId, (totals.get(userId) ?? 0) + points);
  };

  for (const student of students) {
    const fullDays = Math.floor((attendanceCount.get(student.id) ?? 0) / ATTENDANCE_HOURS.length);
    addReward(student.id, fullDays * REWARD_RULES.fullDayAttendance, `${fullDays} full attendance days`, "ATTENDANCE");

    const logs = worklogCount.get(student.id) ?? 0;
    addReward(student.id, logs * REWARD_RULES.worklogSubmitted, `${logs} worklogs submitted`, "WORKLOG");

    const done = (tasksByStudent.get(student.id) ?? []).filter((t) => t.status === "DONE");
    const taskPoints = done.reduce((sum, t) => sum + (t.points || REWARD_RULES.taskCompletedBase), 0);
    addReward(student.id, taskPoints, `${done.length} tasks completed`, "TASK");

    const posts = verifiedPosts.get(student.id) ?? 0;
    addReward(student.id, posts * REWARD_RULES.linkedinVerified, `${posts} verified LinkedIn posts`, "LINKEDIN");
  }

  for (let i = 0; i < rewardRows.length; i += 1000) {
    await prisma.rewardEntry.createMany({ data: rewardRows.slice(i, i + 1000) });
  }

  for (const [userId, points] of totals) {
    await prisma.user.update({ where: { id: userId }, data: { rewardPoints: points } });
  }
  console.log(`   ${rewardRows.length} ledger entries.`);

  await prisma.auditLog.create({
    data: {
      actorId: superAdmin.id,
      action: "SEED",
      entity: "System",
      meta: JSON.stringify({ users: roster.length, days: days.length, today }),
    },
  });

  console.log("\n✓ Seed complete.\n");
  console.log("  Sign in with any roster email. Default password for every account:");
  console.log(`     ${DEFAULT_PASSWORD}\n`);
  const demoSuper = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { email: true } });
  const demoAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { email: true } });
  const demoStudent = await prisma.user.findFirst({ where: { role: "STUDENT" }, select: { email: true } });
  console.log(`  Super admin : ${demoSuper?.email ?? "—"}`);
  console.log(`  Admin       : ${demoAdmin?.email ?? "—"}`);
  console.log(`  Student     : ${demoStudent?.email ?? "—"}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
