# KreateUp DesignSeries Portal

A complete attendance, worklog, task, gate-pass and analytics platform for the KreateUp
DesignSeries programme — built from scratch on **Next.js 15 (App Router) + React 19 + TypeScript**
with a **Node.js** API layer and a **Prisma** database.

It replaces the previous Google-Sheets-backed portal with a real relational database, real
server-side authorisation, and an interface designed around the two things a student actually
does every day: check in, and write up what they built.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Getting started](#getting-started)
3. [Signing in](#signing-in)
4. [Architecture](#architecture)
5. [Design system](#design-system)
6. [Data model](#data-model)
7. [API reference](#api-reference)
8. [Permissions](#permissions)
9. [Business rules](#business-rules)
10. [Project structure](#project-structure)
11. [Deploying](#deploying)
12. [Verification performed](#verification-performed)

---

## What it does

### For students

| Module | What it is |
| :-- | :-- |
| **Dashboard** | The day at a glance — today's two obligations (check-in, worklog), a live attendance percentage, open tasks, points, announcements and upcoming passes. |
| **Attendance** | Seven trackable hours a day, logged individually. Month calendar with proportional day fills, 30-day trend, streak, and a live read on the 75% threshold. |
| **Worklog** | Four required slots plus an optional extra. Drafts autosave to the device. Mentor remarks come back inline. |
| **Tasks** | A board (or list) of sprint deliverables. Students move work along and submit it; only a mentor can close it. |
| **Activity passes** | Request a gate pass; an approved one becomes a printable slip with a **real Code 39 barcode** any 1D scanner reads. |
| **Announcements** | Notices targeted at everyone, a year, a domain or a role. Read receipts tracked. |
| **Leaderboard** | Reward points across the cohort, with a podium and a personal ledger. |
| **Notes** | A private scratchpad. Scoped to the owner in every query — there is no admin read path anywhere in the codebase. |
| **Profile** | Academic record (read-only, from the roster), editable links, and password management with a strength meter. |

### For mentors and admins

| Module | What it is |
| :-- | :-- |
| **Console overview** | Live programme health: who is on the floor, 14-day trend, queues waiting on you, students below 75%, cohort split by domain, recent audit activity. |
| **People** | The roster. Change roles, grant individual console modules, reset passwords, suspend accounts. |
| **Attendance matrix** | Every student × every tracked day in one grid, shaded by completeness. Manual entry on a student's behalf. |
| **Worklog review** | Read submissions, sign them off, or flag them back with a required written reason. |
| **Task assignment** | Assign to specific students, or broadcast across a domain or year in one action. |
| **Approvals** | The gate-pass queue, oldest first. Rejections require a reason. |
| **Announcements** | Publish, target and pin, with per-announcement read rates. |
| **LinkedIn tracker** | Verify build-in-public posts. Verification is what awards points, and it can be withdrawn. |
| **Door check-in** | Record attendance at the studio door via a handheld barcode reader or typed roll number. |
| **Data & audit** | CSV export of eight tables, plus the full audit trail of every privileged action. |

---

## Getting started

```bash
npm install
```

```bash
cp .env.example .env
```

Generate a session secret and paste it into `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Create the database and load the roster:

```bash
npm run setup
```

Start the dev server:

```bash
npm run dev
```

The portal is at **http://localhost:3000**.

### Scripts

| Command | What it does |
| :-- | :-- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | Generate client + push schema + seed |
| `npm run db:seed` | Seed only |
| `npm run db:reset` | Wipe and reseed |
| `npm run db:studio` | Prisma Studio |

---

## Signing in

The seed imports the **real roster of 74 people** from `prisma/data/roster.csv`
(63 students, 11 staff accounts) and generates six weeks of plausible operating history on top of
it — around 12,000 attendance records, 1,500 worklogs, 137 tasks, 50 gate passes and a full
reward ledger.

Sign in with any roster email address. Every seeded account shares one password:

```
designseries@2026
```

Accounts to try:

| Role | Email |
| :-- | :-- |
| Super Admin | `do20354@bitsathy.ac.in` |
| Admin | `harishahamedk.it24@bitsathy.ac.in` |
| Student | `rhythanut.ad24@bitsathy.ac.in` |

Every seeded account is flagged `mustChangePassword`, so the portal prompts for a real password on
first use. Change `SEED_DEFAULT_PASSWORD` in `.env` before seeding a real deployment.

> The seed uses a fixed-seed PRNG, so re-seeding reproduces the same database every time.

---

## Architecture

```
Browser (React 19, client components only where interaction demands it)
   │
   ├── Server Components ──► src/lib/queries.ts ──┐
   │   (every page reads its own data directly)   │
   │                                              ├──► Prisma ──► SQLite / Postgres
   └── fetch() ──► Route Handlers (Node runtime) ─┘
                  src/app/api/**  ·  zod validation  ·  audit log
                        │
   Edge middleware ─────┘
   (cookie presence only — signature + account re-read happen in the portal layout)
```

**Why it is shaped this way**

- **Reads go through server components.** No client-side data fetching, no loading spinners on
  first paint, no API surface to secure for reads that the page already has permission for.
- **Writes go through route handlers.** Each one validates with zod, re-checks permission
  server-side, and writes an audit row. The client is never trusted.
- **Middleware only checks that a cookie exists.** Verifying the JWT signature and re-reading the
  account happens in `src/app/(portal)/layout.tsx`, because Prisma cannot run on the edge — and
  because a suspended account must lose access immediately, not when its token expires.
- **Dates are `YYYY-MM-DD` strings, not `Date` objects.** "Did this student check in today?" must
  not depend on the server's timezone. This was a real failure mode of the sheet-based portal.

---

## Design system

The palette comes straight from the KreateUp wordmark:

| Token | Hex | Meaning in the UI |
| :-- | :-- | :-- |
| `--color-brand-blue` | `#1A73E8` | Primary. Carries the interface. |
| `--color-brand-red` | `#EA4335` | Needs attention. |
| `--color-brand-amber` | `#F9AB00` | Pending / waiting. |
| `--color-brand-green` | `#34A853` | Confirmed / done. |

Blue does the interface work; the other three are reserved for **meaning**, so colour always says
something. A row of tiles reads as one set rather than four competing blocks.

**No generated imagery anywhere.** Every visual element is authored in code:

- The **wordmark and mark** (`src/components/brand/Logo.tsx`) are SVG text and hand-plotted paths.
- The **icon set** (`src/components/ui/Icon.tsx`) is ~55 hand-written glyphs on a 24×24 grid with a
  1.75 stroke. No icon font, no third-party pack.
- **Avatars** are typographic — initials on one of the four brand tints, so no profile photography
  is ever needed.
- **Charts** (rings, bars, sparkline columns) are SVG and divs. No charting library.
- **Empty states** use an inline geometric SVG figure that themes correctly.
- The **barcode** is a real Code 39 implementation, not decorative artwork.

Signature element: the **four-colour brand thread**, a 3px rule capping hero surfaces, modals and
the login panel.

**Theming.** Every colour is a CSS custom property on `:root` / `.dark`. There is not a single
hard-coded hex in a component. A blocking script in `<head>` applies the stored theme before first
paint, so there is no white flash on a dark-mode reload.

**Responsive.** Not a scaled-down desktop:

- Desktop: 252px fixed nav rail, page title + ⌘K search in the top bar, multi-column grids.
- Mobile: bottom tab bar (4 primary + More), a slide-in drawer for the full nav, and modals that
  become **bottom sheets** with a drag affordance. Data tables are replaced by card lists below
  `md` — the matrix keeps its own horizontal scroller so the page body never scrolls sideways.

**Accessibility.** Semantic landmarks, a skip link, focus trapping in dialogs, `aria-current` on
nav, `aria-pressed` on toggles, visible focus rings, and `prefers-reduced-motion` honoured.

---

## Data model

Eleven models in `prisma/schema.prisma`:

| Model | Notes |
| :-- | :-- |
| `User` | Roster record + role + ten granular permission flags + reward total. |
| `Attendance` | One row per `(student, day, hour)`. Unique on that triple. |
| `Worklog` | One row per `(student, day)`, five slots. Unique on the pair. |
| `Task` | Author, assignee, priority, status, points, due date. |
| `ActivityPass` | Request, decision, reviewer, and a unique `passCode`. |
| `Notification` + `NotificationRead` | Announcement plus per-user read receipts. |
| `Note` | Private, owner-scoped. |
| `LinkedinPost` | Submission plus verification state. |
| `RewardEntry` | The points ledger. `User.rewardPoints` is its running total. |
| `AuditLog` | Every privileged mutation. |

Enums are modelled as strings validated in `src/lib/constants.ts`, so the schema stays portable
between SQLite and Postgres with a one-line provider change.

---

## API reference

All responses use one envelope: `{ ok: true, data }` or `{ ok: false, error, details }`.

| Endpoint | Methods | Guard |
| :-- | :-- | :-- |
| `/api/auth/login` | `POST` | public |
| `/api/auth/logout` | `POST` | public |
| `/api/auth/password` | `POST` | signed in |
| `/api/search` | `GET` | signed in (people results console-only) |
| `/api/attendance` | `POST` self · `PUT` manual · `DELETE` | `permAttendanceLogs` for PUT/DELETE |
| `/api/worklog` | `POST` upsert · `PATCH` review | `permWorklogs` for PATCH |
| `/api/tasks` | `POST` · `PATCH` · `DELETE` | `permMentorTasks` for POST/DELETE |
| `/api/passes` | `POST` · `PATCH` decide · `DELETE` withdraw | `permActivityApproval` for PATCH |
| `/api/notes` | `POST` · `PATCH` · `DELETE` | owner only, always |
| `/api/notifications` | `POST` · `PATCH` read · `DELETE` | `permNotifications` for POST/DELETE |
| `/api/linkedin` | `POST` · `PATCH` verify · `DELETE` | `permLinkedinTracker` for PATCH |
| `/api/profile` | `PATCH` | signed in (own record, safe fields only) |
| `/api/admin/users` | `POST` · `PATCH` · `DELETE` suspend | `permUserManagement` |
| `/api/export` | `GET` | per-table permission |

---

## Permissions

Four roles — `STUDENT`, `MENTOR`, `ADMIN`, `SUPER_ADMIN` — plus ten independent module grants
mirroring the source spreadsheet columns:

`permUserManagement` · `permScanStudentQr` · `permMentorTasks` · `permLinkedinTracker` ·
`permWorklogs` · `permNotifications` · `permAttendanceLogs` · `permExtensionRequest` ·
`permAdminDatabase` · `permActivityApproval`

Rules enforced in `src/lib/permissions.ts` and re-checked on every route handler:

- `SUPER_ADMIN` holds every permission implicitly.
- A **suspended account holds no permissions at all**, and cannot sign in.
- Nobody may edit, promote or suspend an account **at or above their own rank**.
- Nobody may change their own role.
- The console navigation only renders modules the account actually holds — and the server guard
  redirects to `/dashboard?denied=1` regardless of what the client renders.

---

## Business rules

- **Check-in closes at 23:30.** Back-dated entries must come from an admin.
- **Re-submitting hours tops up the day** rather than erroring — already-logged hours are skipped.
- **Worklog slots 1–4 are required**, each needing at least a sentence. Yesterday stays open until
  23:30 today; anything older is locked pending an extension.
- **Editing a reviewed worklog returns it to the queue** and clears the mentor remark.
- **Only a mentor can mark a task `DONE`.** Students submit for review.
- **Points move in both directions.** Reopening a task or withdrawing a LinkedIn verification
  claws the points back through a negative ledger entry.
- **One live pass request per day.** Rejections require a written reason.
- **Sundays are excluded** from every attendance calculation, as are days before the account
  existed — otherwise a student who joined last week shows a percentage they had no way to earn.
- **Accounts are suspended, never deleted.** Attendance, worklogs and passes are the programme's
  record and must survive an account closing.

---

## Project structure

```
prisma/
  schema.prisma            11 models
  seed.ts                  roster import + six weeks of generated history
  data/roster.csv          the real 74-person roster
src/
  app/
    layout.tsx             theme boot, toast provider, metadata
    login/                 split-panel sign-in
    (portal)/              authenticated shell — guarded once, here
      dashboard/ attendance/ worklog/ tasks/ passes/
      announcements/ leaderboard/ notes/ profile/
      console/             overview, people, attendance, worklogs,
                           tasks, passes, announcements, linkedin,
                           scan, database
    api/                   route handlers
  components/
    brand/Logo.tsx         wordmark, mark, lockup, brand thread
    shell/                 sidebar, top bar, mobile nav, ⌘K palette
    ui/                    button, card, badge, field, modal, toast,
                           table, avatar, progress, barcode, icons…
    features/              check-in panel, calendar, worklog editor
  lib/
    auth.ts permissions.ts queries.ts constants.ts dates.ts
    api.ts nav.ts utils.ts prisma.ts
  middleware.ts
```

---

## Deploying

The project runs on Vercel with two changes:

1. **Swap the database.** SQLite does not persist on serverless. In `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

   Point `DATABASE_URL` at Neon, Supabase or Vercel Postgres. No other schema change is needed —
   the models deliberately avoid provider-specific features.

2. **Set the environment variables** in the Vercel dashboard: `DATABASE_URL`, `AUTH_SECRET`,
   `SESSION_DAYS`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`.

Then `npx prisma db push` against the production database and `npm run db:seed` once.

Cookies are already `secure` in production, `httpOnly` and `sameSite=lax`, and the app sends
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` headers.

---

## Verification performed

Everything below was executed against the running application, not assumed:

- `npm run typecheck` — clean.
- `npm run build` — succeeds; 38 routes compiled.
- **Authentication** — signed in as super admin and as a student through the real form.
- **Write paths** — attendance check-in and worklog submission through the UI; verified the
  metrics, calendar, history table and reward ledger all updated (5 + 4 = 9 points awarded).
- **Every API endpoint** — notes CRUD, announcements publish/read/delete, profile update,
  LinkedIn submit/verify/delete, task create, CSV export (74 rows + header), search.
- **Validation guards** — short worklog slots rejected `422`; future-dated check-in rejected `422`;
  duplicate check-in rejected `409`; unknown pass id rejected `404`.
- **Permission boundary** — as a student, all eight privileged endpoints returned `403`, the
  console nav rendered zero links, `/console/people` redirected to `/dashboard?denied=1`, and the
  people search leaked zero records.
- **Responsive** — at 375px: zero horizontal page overflow, bottom tab bar present, sidebar hidden;
  the 63-row attendance matrix scrolls inside its own container.
- **Console** — no browser errors logged across the whole session.
