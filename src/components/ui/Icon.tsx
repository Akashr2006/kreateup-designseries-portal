/**
 * Icon layer.
 *
 * Glyphs come from Lucide â€” a real, professionally drawn, consistently
 * optically-corrected icon set. This module is a thin adapter: it maps the
 * portal's semantic names (`"check-circle"`, `"worklog"`) onto Lucide
 * components, so call sites stay readable and the underlying set can be
 * swapped in one file.
 *
 * Usage:  <Icon name="calendar" className="h-5 w-5" />
 */

import {
  AlertTriangle, ArrowRight, ArrowUpRight, Bell, BookOpen, Calendar, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Download, Ellipsis,
  Eye, EyeOff, Filter, Flag, Info, Layers, LayoutGrid, Link2,
  Loader2, Lock, LogOut, Mail, Menu, Minus, Moon, Pencil, Phone,
  Pin, Plus, QrCode, RefreshCw, Search, Settings, Shield, Sparkles, Sun, Target,
  Ticket, Trash2, TrendingUp, Trophy, Upload, User, Users, X,
  type LucideIcon,
} from "lucide-react";

import type { SVGProps } from "react";

export type IconName =
  | "grid" | "calendar" | "check-circle" | "clock" | "clipboard" | "layers"
  | "bell" | "note" | "user" | "users" | "shield" | "chart" | "settings"
  | "search" | "plus" | "minus" | "close" | "check" | "chevron-down"
  | "chevron-right" | "chevron-left" | "arrow-right" | "arrow-up-right"
  | "arrow-trend" | "download" | "upload" | "filter" | "sun" | "moon"
  | "logout" | "menu" | "more" | "alert" | "info" | "pin" | "edit" | "trash"
  | "link" | "linkedin" | "github" | "mail" | "phone" | "sparkle" | "target"
  | "flag" | "lock" | "eye" | "eye-off" | "refresh" | "qr" | "ticket" | "book"
  | "trophy" | "spinner";

/** Lucide accepts `absoluteStrokeWidth`; the plain SVG brand marks ignore it. */
type Glyph = (props: SVGProps<SVGSVGElement> & { absoluteStrokeWidth?: boolean }) => React.ReactNode;

const MAP: Record<IconName, Glyph> = {
  grid: LayoutGrid,
  calendar: Calendar,
  "check-circle": CheckCircle2,
  clock: Clock,
  clipboard: ClipboardList,
  layers: Layers,
  bell: Bell,
  note: Pencil,
  user: User,
  users: Users,
  shield: Shield,
  chart: TrendingUp,
  settings: Settings,
  search: Search,
  plus: Plus,
  minus: Minus,
  close: X,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  "arrow-trend": TrendingUp,
  download: Download,
  upload: Upload,
  filter: Filter,
  sun: Sun,
  moon: Moon,
  logout: LogOut,
  menu: Menu,
  more: Ellipsis,
  alert: AlertTriangle,
  info: Info,
  pin: Pin,
  edit: Pencil,
  trash: Trash2,
  link: Link2,
  linkedin: BrandLinkedin,
  github: BrandGithub,
  mail: Mail,
  phone: Phone,
  sparkle: Sparkles,
  target: Target,
  flag: Flag,
  lock: Lock,
  eye: Eye,
  "eye-off": EyeOff,
  refresh: RefreshCw,
  qr: QrCode,
  ticket: Ticket,
  book: BookOpen,
  trophy: Trophy,
  spinner: Loader2,
};

/**
 * Brand marks.
 *
 * Icon sets deliberately exclude company logos for trademark reasons, so these
 * two are the official LinkedIn and GitHub glyph paths â€” solid fills rather
 * than strokes, which is how both brands specify their mark.
 */
function BrandLinkedin({
  absoluteStrokeWidth: _abs,
  strokeWidth: _sw,
  ...props
}: SVGProps<SVGSVGElement> & { absoluteStrokeWidth?: boolean }) {
  // Brand marks are solid fills, so Lucide's stroke props are dropped rather
  // than forwarded onto the DOM node.
  return (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
  );
}

function BrandGithub({
  absoluteStrokeWidth: _abs,
  strokeWidth: _sw,
  ...props
}: SVGProps<SVGSVGElement> & { absoluteStrokeWidth?: boolean }) {
  // Brand marks are solid fills, so Lucide's stroke props are dropped rather
  // than forwarded onto the DOM node.
  return (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.26.8-.57v-2c-3.34.72-4.04-1.6-4.04-1.6-.54-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .31.2.68.82.56A12 12 0 0 0 12 .3z" />
  </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  /** Accessible label. Omit for purely decorative icons. */
  title?: string;
};

export function Icon({ name, title, className, ...rest }: IconProps) {
  const Glyph = MAP[name] ?? Info;

  return (
    <Glyph
      className={className}
      strokeWidth={1.9}
      absoluteStrokeWidth
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    />
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Icon name="spinner" className={`${className} animate-spin`} />;
}

