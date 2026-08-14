"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "@/components/ui/Icon";

import { AttendanceCalendar, type CalendarDay } from "./AttendanceCalendar";

/**
 * Bridges the (client) calendar to the (server) month query. Changing month
 * pushes `?month=` and lets the server component refetch, so the calendar
 * never has to own a data-fetching path of its own.
 */
export function AttendanceMonthView({ days, monthKey }: { days: CalendarDay[]; monthKey: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const changeMonth = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("month", next.slice(0, 7));
    startTransition(() => router.push(`/attendance?${query.toString()}`, { scroll: false }));
  };

  return (
    <div className="relative">
      {pending ? (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-[12px]" style={{ background: "color-mix(in srgb, var(--surface-raised) 70%, transparent)" }}>
          <Icon name="spinner" className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : null}
      <AttendanceCalendar days={days} monthKey={monthKey} onChangeMonth={changeMonth} />
    </div>
  );
}
