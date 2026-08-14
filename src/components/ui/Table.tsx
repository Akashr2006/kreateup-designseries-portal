import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Table shell.
 *
 * On phones a data table is the wrong shape, so every screen that uses this
 * also renders a card list below `md`. The wrapper still scrolls horizontally
 * as a fallback for tablet widths.
 */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("overflow-x-auto rounded-[12px] border", className)}
      style={{ borderColor: "var(--line-soft)" }}
    >
      {children}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full border-collapse text-left", className)}>{children}</table>;
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead style={{ background: "var(--surface-inset)" }}>
      {children}
    </thead>
  );
}

export function TH({
  children,
  className,
  numeric = false,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em]",
        numeric && "text-right",
        className
      )}
      style={{ color: "var(--text-muted)", borderColor: "var(--line-soft)" }}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b last:border-0 transition-colors",
        interactive && "hover:bg-[var(--surface-inset)]",
        className
      )}
      style={{ borderColor: "var(--line-soft)" }}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  numeric = false,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3.5 py-2.5 align-middle text-[13px]", numeric && "text-right tabular-nums", className)}
      style={{ color: "var(--text-default)" }}
      {...rest}
    >
      {children}
    </td>
  );
}
