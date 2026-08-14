import Link from "next/link";

import { LogoLockup } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10" style={{ background: "var(--surface-page)" }}>
      <main id="main" className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <LogoLockup height={24} />
        </div>

        <div className="surface overflow-hidden">
          <span aria-hidden className="brand-thread-bar block h-[3px] w-full" />
          <div className="p-8">
            <span
              data-accent="amber"
              className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name="search" className="h-6 w-6" />
            </span>

            <h1 className="text-[22px] font-bold" style={{ letterSpacing: "-0.028em" }}>
              That page does not exist
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              The link may be out of date, or the page may have moved. Your dashboard has everything
              you need.
            </p>

            <Link
              href="/dashboard"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[14px] font-semibold text-white"
              style={{ background: "var(--color-brand-blue)" }}
            >
              Back to the dashboard
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
