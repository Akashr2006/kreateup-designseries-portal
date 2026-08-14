import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoLockup, Wordmark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/Theme";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/** Marketing-side facts, pulled live so the panel is never out of date. */
async function programmeStats() {
  const [students, worklogs, checkIns] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.worklog.count(),
    prisma.attendance.count(),
  ]);
  return { students, worklogs, checkIns };
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const stats = await programmeStats();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ------------------------------------------------------------------ */}
      {/* Brand panel — desktop only. Built entirely from CSS + inline SVG.   */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: "var(--surface-raised)" }}
      >
        <BrandBackdrop />

        <div className="relative">
          <LogoLockup height={28} subtitle="DesignSeries Portal" />
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-[38px] font-bold leading-[1.12]" style={{ letterSpacing: "-0.03em" }}>
            One place for the
            <br />
            work you do <span className="text-gradient-brand">every day.</span>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Check in for the day, log what you built in each slot, pick up your sprint tasks and
            carry an approved gate pass on your phone — without a single spreadsheet.
          </p>

          <ul className="mt-9 grid gap-3">
            <FeatureRow
              tone="blue"
              icon="check-circle"
              title="Hour-accurate attendance"
              body="Seven trackable hours a day, with your own live percentage."
            />
            <FeatureRow
              tone="red"
              icon="clipboard"
              title="Slot-by-slot worklogs"
              body="Four required slots and an optional extra, reviewed by your mentor."
            />
            <FeatureRow
              tone="amber"
              icon="ticket"
              title="Gate passes that actually work"
              body="Request, get approved, show the signed slip at the gate."
            />
            <FeatureRow
              tone="green"
              icon="chart"
              title="Analytics for mentors"
              body="Cohort health, flagged logs and pending approvals in one console."
            />
          </ul>
        </div>

        <div className="relative flex items-center gap-8">
          <Stat value={stats.students} label="Students" />
          <Stat value={stats.checkIns} label="Check-ins logged" />
          <Stat value={stats.worklogs} label="Worklogs" />
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Form panel                                                          */}
      {/* ------------------------------------------------------------------ */}
      <main
        id="main"
        className="flex flex-col justify-center px-5 py-10 sm:px-10"
        style={{ background: "var(--surface-page)" }}
      >
        <div className="mx-auto flex w-full max-w-[420px] flex-col">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Wordmark height={26} />
            <ThemeToggle compact />
          </div>

          <div className="hidden justify-end lg:flex">
            <ThemeToggle compact />
          </div>

          <div className="mt-2">
            <h1 className="text-[27px] font-bold leading-tight" style={{ letterSpacing: "-0.028em" }}>
              Sign in
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Use your college email address. If you have not set a password yet, use the one your
              mentor shared with you — you will be asked to change it.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Trouble signing in? Contact your domain mentor or the DesignSeries office.
            <br />
            Sessions are signed and expire automatically.
          </p>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FeatureRow({
  tone,
  icon,
  title,
  body,
}: {
  tone: "blue" | "red" | "amber" | "green";
  icon: "check-circle" | "clipboard" | "ticket" | "chart";
  title: string;
  body: string;
}) {
  return (
    <li data-accent={tone} className="flex items-start gap-3.5">
      <span
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
        style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
      >
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span>
        <span className="block text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
          {title}
        </span>
        <span className="block text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
          {body}
        </span>
      </span>
    </li>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[22px] font-bold tabular-nums leading-none" style={{ letterSpacing: "-0.03em" }}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
    </div>
  );
}

/**
 * Decorative backdrop: a soft four-colour wash plus a faint dot grid. Pure CSS
 * and inline SVG — nothing here is a raster image.
 */
function BrandBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 8% 2%, color-mix(in srgb, #1a73e8 14%, transparent), transparent 62%)," +
            "radial-gradient(560px 380px at 96% 22%, color-mix(in srgb, #ea4335 11%, transparent), transparent 60%)," +
            "radial-gradient(620px 420px at 78% 96%, color-mix(in srgb, #34a853 13%, transparent), transparent 62%)," +
            "radial-gradient(420px 300px at 24% 88%, color-mix(in srgb, #f9ab00 11%, transparent), transparent 60%)",
        }}
      />
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]">
        <defs>
          <pattern id="kup-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--line-default)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#kup-dots)" />
      </svg>
      <span aria-hidden className="brand-thread-bar absolute inset-x-0 top-0 h-[4px]" />
    </>
  );
}
