import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Every page opens the same way: a title, one line explaining what the page is
 * for, and the page's primary action on the right. Consistency here is what
 * makes a portal feel like one product rather than a pile of screens.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Filters or tabs, rendered below the title row. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-[22px] font-bold leading-tight sm:text-[25px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {title}
          </h1>
          {description ? (
            <p
              className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

/** Horizontal scrolling filter/segment strip used under page headers. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0",
        className
      )}
    >
      {children}
    </div>
  );
}
