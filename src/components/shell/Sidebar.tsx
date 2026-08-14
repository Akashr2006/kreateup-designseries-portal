"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoLockup } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { Counter } from "@/components/ui/Badge";
import { isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export type NavBadges = Record<string, number>;

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.description}
      className={cn(
        "group relative flex h-[38px] items-center gap-3 rounded-[10px] px-3",
        "text-[13.5px] font-medium transition-colors duration-150"
      )}
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        fontWeight: active ? 650 : 500,
      }}
    >
      {/* Active marker — a short brand-blue bar, not a full-width fill. */}
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-transform duration-200"
        style={{
          background: "var(--accent)",
          transform: active ? "translateY(-50%) scaleY(1)" : "translateY(-50%) scaleY(0)",
        }}
      />
      <Icon name={item.icon} className="h-[17px] w-[17px] shrink-0" />
      <span className="truncate">{item.label}</span>
      {badge ? <Counter value={badge} tone={active ? "blue" : "red"} /> : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-1.5 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] first:mt-0"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </p>
  );
}

export function SidebarNav({
  studentNav,
  consoleNav,
  badges = {},
  onNavigate,
}: {
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col px-2.5 pb-4" aria-label="Main">
      <SectionLabel>My portal</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {studentNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            badge={badges[item.href]}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {consoleNav.length > 0 ? (
        <>
          <SectionLabel>Admin console</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {consoleNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                badge={badges[item.href]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </>
      ) : null}
    </nav>
  );
}

export function Sidebar({
  studentNav,
  consoleNav,
  badges,
  footer,
}: {
  studentNav: NavItem[];
  consoleNav: NavItem[];
  badges?: NavBadges;
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r lg:flex"
      style={{ background: "var(--surface-rail)", borderColor: "var(--line-soft)" }}
    >
      <div className="shrink-0 px-4 pb-3 pt-4">
        <Link href="/dashboard" className="inline-block rounded-[10px]">
          <LogoLockup height={22} />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav studentNav={studentNav} consoleNav={consoleNav} badges={badges} />
      </div>

      {footer ? (
        <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--line-soft)" }}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
