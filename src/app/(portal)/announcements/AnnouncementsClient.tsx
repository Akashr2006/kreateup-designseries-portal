"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { NOTIFICATION_CATEGORY } from "@/lib/constants";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  audienceValue: string;
  pinned: boolean;
  link: string;
  createdAt: string;
  authorName: string;
  read: boolean;
};

const CATEGORY_ICON: Record<string, IconName> = {
  GENERAL: "info",
  URGENT: "alert",
  EVENT: "calendar",
  DEADLINE: "clock",
  RESULT: "chart",
};

const CATEGORY_TONE: Record<string, "blue" | "red" | "amber" | "green" | "slate"> = {
  GENERAL: "blue",
  URGENT: "red",
  EVENT: "green",
  DEADLINE: "amber",
  RESULT: "blue",
};

export function AnnouncementsClient({ items }: { items: AnnouncementRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<string>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [locallyRead, setLocallyRead] = useState<Set<string>>(new Set());

  const unread = items.filter((item) => !item.read && !locallyRead.has(item.id));

  const filtered = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.category === filter)),
    [items, filter]
  );

  // Opening an announcement marks it read — no separate "mark as read" click.
  useEffect(() => {
    if (!openId) return;
    const item = items.find((i) => i.id === openId);
    if (!item || item.read || locallyRead.has(openId)) return;

    setLocallyRead((current) => new Set(current).add(openId));
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: openId }),
    })
      .then(() => router.refresh())
      .catch(() => {
        /* a failed read receipt is not worth interrupting the user for */
      });
  }, [openId, items, locallyRead, router]);

  const markAll = async () => {
    setMarking(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not mark everything read", payload.error);
        return;
      }
      setLocallyRead(new Set(items.map((i) => i.id)));
      toast.success("All caught up");
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setMarking(false);
    }
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [items]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")} label={`All (${items.length})`} />
          {NOTIFICATION_CATEGORY.filter((c) => counts.get(c)).map((category) => (
            <Chip
              key={category}
              active={filter === category}
              onClick={() => setFilter(category)}
              label={`${category.charAt(0)}${category.slice(1).toLowerCase()} (${counts.get(category)})`}
              tone={CATEGORY_TONE[category]}
            />
          ))}
        </div>

        {unread.length > 0 ? (
          <Button size="sm" variant="secondary" icon="check" loading={marking} onClick={markAll} className="ml-auto">
            Mark all read
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nothing here"
          description="There are no announcements in this category yet."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map((item) => {
            const isRead = item.read || locallyRead.has(item.id);
            const isOpen = openId === item.id;
            const tone = CATEGORY_TONE[item.category] ?? "blue";

            return (
              <li
                key={item.id}
                data-accent={tone}
                className="overflow-hidden rounded-[13px] border transition-colors"
                style={{
                  borderColor: isOpen ? "var(--tone)" : "var(--line-soft)",
                  background: "var(--surface-raised)",
                }}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                  >
                    <Icon name={CATEGORY_ICON[item.category] ?? "info"} className="h-[18px] w-[18px]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      {!isRead ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tone)" }} />
                      ) : null}
                      <span
                        className={cn("text-[14px] leading-snug", isRead ? "font-medium" : "font-bold")}
                        style={{ color: "var(--text-strong)", opacity: isRead ? 0.82 : 1 }}
                      >
                        {item.title}
                      </span>
                      {item.pinned ? <Badge tone="amber" icon="pin">Pinned</Badge> : null}
                    </span>

                    <span
                      className={cn("mt-1.5 block text-[12.5px] leading-relaxed", !isOpen && "line-clamp-2")}
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.body}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      <span className="font-semibold">{item.authorName}</span>
                      <span>·</span>
                      <span>{relativeTime(item.createdAt)}</span>
                      {item.audience !== "ALL" ? (
                        <>
                          <span>·</span>
                          <span>{item.audienceValue}</span>
                        </>
                      ) : null}
                    </span>
                  </span>

                  <Icon
                    name="chevron-down"
                    className="mt-1 h-4 w-4 shrink-0 transition-transform"
                    style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>

                {isOpen && item.link ? (
                  <div className="border-t px-4 py-3" style={{ borderColor: "var(--line-soft)" }}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      <Icon name="link" className="h-3.5 w-3.5" />
                      Open the linked resource
                      <Icon name="arrow-up-right" className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  label,
  tone = "blue",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "blue" | "red" | "amber" | "green" | "slate";
}) {
  return (
    <button
      data-accent={tone}
      onClick={onClick}
      className="h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors"
      style={{
        borderColor: active ? "var(--tone)" : "var(--line-default)",
        background: active ? "var(--tone-soft)" : "transparent",
        color: active ? "var(--tone)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}
