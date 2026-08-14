import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

const CONTROL =
  "w-full rounded-[10px] border bg-[var(--surface-raised)] px-3 text-[13.5px] text-[var(--text-strong)] " +
  "placeholder:text-[var(--text-faint)] transition-[border-color,box-shadow] duration-150 " +
  "focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Label({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline gap-1.5 text-[12px] font-semibold"
      style={{ color: "var(--text-default)" }}
    >
      {children}
      {required ? <span style={{ color: "var(--color-brand-red)" }}>*</span> : null}
      {hint ? (
        <span className="ml-auto text-[11px] font-normal" style={{ color: "var(--text-faint)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  help,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required} hint={hint}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: "var(--color-brand-red)" }}>
          <Icon name="alert" className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `ref` is declared explicitly: React 19 passes refs to function components as
 * an ordinary prop, so no forwardRef wrapper is needed — but the prop still has
 * to appear in the type for callers to pass one.
 */
export function Input({
  className,
  icon,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: IconName;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  if (!icon) {
    return (
      <input
        className={cn(CONTROL, "h-10", className)}
        style={{ borderColor: invalid ? "var(--color-brand-red)" : "var(--line-default)" }}
        {...rest}
      />
    );
  }

  return (
    <div className="relative">
      <Icon
        name={icon}
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
      <input
        className={cn(CONTROL, "h-10 pl-9", className)}
        style={{ borderColor: invalid ? "var(--color-brand-red)" : "var(--line-default)" }}
        {...rest}
      />
    </div>
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL, "min-h-[92px] resize-y py-2.5 leading-relaxed", className)}
      style={{ borderColor: invalid ? "var(--color-brand-red)" : "var(--line-default)" }}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  invalid,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, "h-10 cursor-pointer appearance-none pr-9", className)}
        style={{ borderColor: invalid ? "var(--color-brand-red)" : "var(--line-default)" }}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--text-faint)" }}
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors",
        "hover:border-[var(--accent)]",
        className
      )}
      style={{ borderColor: "var(--line-soft)", background: "var(--surface-raised)" }}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[4px] accent-[var(--color-brand-blue)]"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
