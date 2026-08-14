"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { NOTIFICATION_CATEGORY, ROLES, ROLE_LABEL } from "@/lib/constants";
import { relativeTime } from "@/lib/dates";

export type PublishedRow = {
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
  readCount: number;
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

export function AnnouncementConsole({
  published,
  options,
  audienceSize,
}: {
  published: PublishedRow[];
  options: { years: string[]; domains: string[] };
  /** Total active accounts, used for the read-rate figure. */
  audienceSize: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<PublishedRow | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleting.id }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not delete", payload.error);
        return;
      }
      toast.success("Announcement removed");
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon="plus" onClick={() => setComposing(true)}>
          New announcement
        </Button>
      </div>

      {published.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nothing published yet"
          description="Announcements reach students on their dashboard, in the bell menu and on the announcements page. Pin the ones that must not scroll away."
          action={
            <Button icon="plus" onClick={() => setComposing(true)}>
              Write the first one
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {published.map((item) => {
            const tone = CATEGORY_TONE[item.category] ?? "blue";
            const readRate = audienceSize > 0 ? Math.round((item.readCount / audienceSize) * 100) : 0;

            return (
              <li key={item.id} data-accent={tone} className="surface-flat overflow-hidden">
                <div className="flex items-stretch">
                  <span className="w-[3px] shrink-0" style={{ background: "var(--tone)" }} />
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                          style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
                        >
                          <Icon name={CATEGORY_ICON[item.category] ?? "info"} className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-[14px] font-semibold leading-snug" style={{ color: "var(--text-strong)" }}>
                              {item.title}
                            </h3>
                            {item.pinned ? <Badge tone="amber" icon="pin">Pinned</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                            {item.authorName} · {relativeTime(item.createdAt)}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        icon="trash"
                        onClick={() => setDeleting(item)}
                        aria-label="Delete announcement"
                      />
                    </div>

                    <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {item.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge tone={tone}>{item.category.toLowerCase()}</Badge>
                      <Badge tone="slate" icon="users">
                        {item.audience === "ALL" ? "Everyone" : `${item.audience.toLowerCase()}: ${item.audienceValue}`}
                      </Badge>
                      <Badge tone={readRate >= 60 ? "green" : readRate >= 25 ? "amber" : "slate"} icon="eye">
                        {item.readCount} read{audienceSize > 0 ? ` · ${readRate}%` : ""}
                      </Badge>
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          <Icon name="link" className="h-3 w-3" />
                          Linked resource
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {composing ? <ComposeDialog options={options} onClose={() => setComposing(false)} /> : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        destructive
        title="Delete this announcement?"
        message="It disappears from everyone's feed immediately, along with its read receipts. This cannot be undone."
        confirmLabel="Delete announcement"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function ComposeDialog({
  options,
  onClose,
}: {
  options: { years: string[]; domains: string[] };
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "GENERAL",
    audience: "ALL",
    audienceValue: "",
    pinned: false,
    link: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const publish = async () => {
    const next: Record<string, string> = {};
    if (form.title.trim().length < 4) next.title = "Give the announcement a title.";
    if (form.body.trim().length < 10) next.body = "Write the announcement body.";
    if (form.audience !== "ALL" && !form.audienceValue) next.audienceValue = "Choose which cohort this goes to.";
    if (form.link && !/^https?:\/\//i.test(form.link)) next.link = "Links must start with http:// or https://";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          body: form.body.trim(),
          link: form.link.trim(),
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not publish", payload.error);
        return;
      }
      toast.success("Announcement published", "It is live on every matching dashboard now.");
      onClose();
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  const audienceChoices =
    form.audience === "YEAR" ? options.years : form.audience === "DOMAIN" ? options.domains : form.audience === "ROLE" ? [...ROLES] : [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="New announcement"
      description="This goes live immediately. There is no draft state — write it, then publish it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={publish} loading={saving} icon={saving ? undefined : "bell"}>
            Publish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" htmlFor="a-title" required error={errors.title}>
          <Input
            id="a-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Sprint 4 review — Friday 4:30 PM"
            invalid={Boolean(errors.title)}
          />
        </Field>

        <Field
          label="Body"
          htmlFor="a-body"
          required
          error={errors.body}
          hint={`${form.body.length}/4000`}
          help="Lead with what the reader has to do, then the detail."
        >
          <Textarea
            id="a-body"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value.slice(0, 4000) })}
            rows={6}
            placeholder="Every domain presents a five-minute walkthrough of what shipped this sprint. Bring a working build, not slides."
            invalid={Boolean(errors.body)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" htmlFor="a-category" help="Sets the colour and icon students see.">
            <Select id="a-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {NOTIFICATION_CATEGORY.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0)}
                  {category.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Audience" htmlFor="a-audience">
            <Select
              id="a-audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value, audienceValue: "" })}
            >
              <option value="ALL">Everyone in the programme</option>
              <option value="YEAR">A specific year / batch</option>
              <option value="DOMAIN">A specific domain</option>
              <option value="ROLE">A specific role</option>
            </Select>
          </Field>
        </div>

        {form.audience !== "ALL" ? (
          <Field label="Which one?" htmlFor="a-audience-value" required error={errors.audienceValue}>
            <Select
              id="a-audience-value"
              value={form.audienceValue}
              onChange={(e) => setForm({ ...form, audienceValue: e.target.value })}
              invalid={Boolean(errors.audienceValue)}
            >
              <option value="">Choose…</option>
              {audienceChoices.map((choice) => (
                <option key={choice} value={choice}>
                  {form.audience === "ROLE" ? ROLE_LABEL[choice as keyof typeof ROLE_LABEL] ?? choice : choice}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Link (optional)" htmlFor="a-link" error={errors.link}>
          <Input
            id="a-link"
            type="url"
            icon="link"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="https://…"
            invalid={Boolean(errors.link)}
          />
        </Field>

        <Checkbox
          label="Pin this announcement"
          description="Pinned announcements stay at the top of the feed until you unpin or delete them. Use it sparingly — pin everything and nothing stands out."
          checked={form.pinned}
          onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
        />
      </div>
    </Modal>
  );
}
