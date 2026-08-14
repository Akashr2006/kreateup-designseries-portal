"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { WORKLOG_SLOTS, type WorklogSlotKey } from "@/lib/constants";
import { formatDay, toDayKey } from "@/lib/dates";

export type WorklogDraft = {
  date: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  taskId: string | null;
};

const EMPTY: WorklogDraft = { date: toDayKey(), s1: "", s2: "", s3: "", s4: "", s5: "", taskId: null };

/**
 * The worklog form.
 *
 * Slots 1–4 are required and each needs a real sentence — a ten-character floor
 * is enough to stop "done" and "wip" without being precious about it. The draft
 * is mirrored to localStorage on every keystroke so a dropped connection or an
 * accidental refresh never costs a student their day's write-up.
 */
export function WorklogEditor({
  open,
  onClose,
  initial,
  tasks,
  editable = true,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<WorklogDraft>;
  tasks: Array<{ id: string; title: string }>;
  editable?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [draft, setDraft] = useState<WorklogDraft>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<WorklogSlotKey, string>>>({});

  const storageKey = `kup-worklog-draft-${draft.date}`;

  // Load any unsaved draft when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const base = { ...EMPTY, ...initial };
    setDraft(base);
    setErrors({});

    // Only restore a local draft when there is nothing saved on the server yet.
    const hasServerContent = Boolean(initial?.s1 || initial?.s2 || initial?.s3 || initial?.s4);
    if (hasServerContent) return;

    try {
      const cached = localStorage.getItem(`kup-worklog-draft-${base.date}`);
      if (cached) setDraft({ ...base, ...JSON.parse(cached) });
    } catch {
      /* a corrupt draft is not worth surfacing to the user */
    }
  }, [open, initial]);

  // Mirror every change.
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* storage may be full or blocked — the form still works */
    }
  }, [draft, open, storageKey]);

  const set = (key: keyof WorklogDraft, value: string | null) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const next: Partial<Record<WorklogSlotKey, string>> = {};
    for (const slot of WORKLOG_SLOTS) {
      if (!slot.required) continue;
      const value = draft[slot.key].trim();
      if (value.length < 10) {
        next[slot.key] = `Write at least a sentence for ${slot.label.toLowerCase()}.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      toast.warning("Some slots need more detail", "Slots 1 to 4 are required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();

      if (!payload.ok) {
        toast.error("Could not save your worklog", payload.error);
        setSaving(false);
        return;
      }

      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* nothing to clean up */
      }

      toast.success(
        payload.data.created ? "Worklog submitted" : "Worklog updated",
        payload.data.created
          ? "Your mentor will see it in the review queue."
          : "It has gone back into the review queue."
      );
      onClose();
      router.refresh();
    } catch {
      toast.error("Network problem", "Your draft is saved locally — try submitting again.");
    } finally {
      setSaving(false);
    }
  };

  const filled = WORKLOG_SLOTS.filter((s) => s.required && draft[s.key].trim().length >= 10).length;
  const requiredCount = WORKLOG_SLOTS.filter((s) => s.required).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editable ? `Worklog — ${formatDay(draft.date, "long")}` : "Worklog"}
      description={
        editable
          ? "Write what you actually did in each slot. Specific beats long: what you built, what broke, what you decided."
          : undefined
      }
      footer={
        editable ? (
          <>
            <span className="mr-auto text-[11.5px] font-medium" style={{ color: "var(--text-faint)" }}>
              {filled} of {requiredCount} required slots complete
            </span>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving} icon={saving ? undefined : "check"}>
              {saving ? "Saving…" : "Submit worklog"}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="wl-date" help="Yesterday stays open until 11:30 PM today.">
            <Select
              id="wl-date"
              value={draft.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={!editable}
            >
              <option value={toDayKey()}>Today — {formatDay(toDayKey(), "medium")}</option>
              <option value={yesterday()}>Yesterday — {formatDay(yesterday(), "medium")}</option>
            </Select>
          </Field>

          <Field label="Link to a task" htmlFor="wl-task" help="Optional — helps your mentor trace progress.">
            <Select
              id="wl-task"
              value={draft.taskId ?? ""}
              onChange={(e) => set("taskId", e.target.value || null)}
              disabled={!editable || tasks.length === 0}
            >
              <option value="">{tasks.length === 0 ? "No open tasks" : "Not linked to a task"}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {WORKLOG_SLOTS.map((slot) => (
          <Field
            key={slot.key}
            label={`${slot.label} · ${slot.window}`}
            htmlFor={`wl-${slot.key}`}
            required={slot.required}
            hint={`${draft[slot.key].length}/1200`}
            error={errors[slot.key]}
            help={
              slot.key === "s5"
                ? "Anything you did outside session hours — optional."
                : undefined
            }
          >
            <Textarea
              id={`wl-${slot.key}`}
              value={draft[slot.key]}
              onChange={(e) => set(slot.key, e.target.value.slice(0, 1200))}
              placeholder={PLACEHOLDERS[slot.key]}
              rows={2}
              disabled={!editable}
              invalid={Boolean(errors[slot.key])}
            />
          </Field>
        ))}

        {editable ? (
          <p className="flex items-start gap-2 text-[11.5px] leading-snug" style={{ color: "var(--text-faint)" }}>
            <Icon name="info" className="mt-px h-3.5 w-3.5 shrink-0" />
            Your draft is kept on this device as you type. Editing a reviewed worklog sends it back
            to your mentor for another look.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}

const PLACEHOLDERS: Record<WorklogSlotKey, string> = {
  s1: "e.g. Set up the ticket schema and wrote the migration. Hit a naming clash on `status` and renamed it.",
  s2: "e.g. Built the list view with pagination. Empty and error states still to do.",
  s3: "e.g. Paired with Nishaa on the auth redirect bug — the cookie was being set after the redirect.",
  s4: "e.g. Wrote the handoff notes and pushed the branch for review.",
  s5: "e.g. Read through the Next.js caching docs to understand why the dashboard was stale.",
};
