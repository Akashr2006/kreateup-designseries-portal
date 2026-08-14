"use client";

import { useEffect } from "react";

import { LogoLockup } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where a reporting call would go.
    console.error("[portal]", error);
  }, [error]);

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
              data-accent="red"
              className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name="alert" className="h-6 w-6" />
            </span>

            <h1 className="text-[22px] font-bold" style={{ letterSpacing: "-0.028em" }}>
              Something went wrong
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              This page failed to load. Nothing you submitted has been lost — try again, and tell the
              DesignSeries office if it keeps happening.
            </p>

            {error.digest ? (
              <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
                Reference: {error.digest}
              </p>
            ) : null}

            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={reset}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[14px] font-semibold text-white"
                style={{ background: "var(--color-brand-blue)" }}
              >
                <Icon name="refresh" className="h-4 w-4" />
                Try again
              </button>
              <a
                href="/dashboard"
                className="inline-flex h-11 items-center rounded-[10px] border px-5 text-[14px] font-semibold"
                style={{ borderColor: "var(--line-default)", color: "var(--text-strong)" }}
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
