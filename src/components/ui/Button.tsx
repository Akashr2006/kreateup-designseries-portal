import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-[10px] font-semibold " +
  "transition-[background,color,box-shadow,transform] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50 active:translate-y-[0.5px]";

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[13.5px]",
  lg: "h-12 px-6 text-[15px]",
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brand-blue)] text-white shadow-[0_1px_2px_rgba(15,27,51,0.14)] " +
    "hover:bg-[var(--color-brand-blue-600)] active:bg-[var(--color-brand-blue-700)]",
  success:
    "bg-[var(--color-brand-green)] text-white hover:bg-[var(--color-brand-green-600)]",
  danger:
    "bg-[var(--color-brand-red)] text-white hover:bg-[var(--color-brand-red-600)]",
  secondary:
    "bg-[var(--surface-inset)] text-[var(--text-strong)] border border-[var(--line-default)] " +
    "hover:bg-[var(--surface-sunken)]",
  outline:
    "bg-transparent text-[var(--text-strong)] border border-[var(--line-default)] " +
    "hover:border-[var(--accent)] hover:text-[var(--accent)]",
  ghost:
    "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-strong)]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-[18px] w-[18px]" : "h-4 w-4";

  return (
    <button
      className={cn(BASE, SIZES[size], VARIANTS[variant], block && "w-full", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Icon name="spinner" className={cn(iconSize, "animate-spin")} />
      ) : icon ? (
        <Icon name={icon} className={iconSize} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} className={iconSize} /> : null}
    </button>
  );
}

export type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  className?: string;
  children?: ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  block = false,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-[18px] w-[18px]" : "h-4 w-4";

  return (
    <Link
      href={href}
      className={cn(BASE, SIZES[size], VARIANTS[variant], block && "w-full", className)}
      {...rest}
    >
      {icon ? <Icon name={icon} className={iconSize} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} className={iconSize} /> : null}
    </Link>
  );
}

/** Square icon-only button — used in toolbars and card headers. */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  ...rest
}: Omit<ButtonProps, "children" | "icon" | "iconRight"> & { icon: IconName; label: string }) {
  const box = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const glyph = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  return (
    <button
      aria-label={label}
      title={label}
      className={cn(BASE, box, "p-0", VARIANTS[variant], className)}
      {...rest}
    >
      <Icon name={icon} className={glyph} />
    </button>
  );
}
