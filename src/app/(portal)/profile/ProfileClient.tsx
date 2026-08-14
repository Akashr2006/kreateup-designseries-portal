"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

/** Editable slice of the profile: the links and phone number a student owns. */
export function ProfileLinksForm({
  initial,
}: {
  initial: { mobile: string; linkedin: string; github: string };
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const dirty =
    form.mobile !== initial.mobile ||
    form.linkedin !== initial.linkedin ||
    form.github !== initial.github;

  const save = async () => {
    const next: Record<string, string> = {};
    if (form.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(form.linkedin)) {
      next.linkedin = "Use the full URL, starting with https://www.linkedin.com/";
    }
    if (form.github && !/^https?:\/\/(www\.)?github\.com\//i.test(form.github)) {
      next.github = "Use the full URL, starting with https://github.com/";
    }
    if (form.mobile && !/^[+\d][\d\s-]{7,19}$/.test(form.mobile)) {
      next.mobile = "That does not look like a phone number.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save", payload.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon="link"
        title="Your links"
        subtitle="These are the only profile fields you can change yourself. Academic details come from the roster — ask an admin if something is wrong."
      />

      <div className="flex flex-col gap-4">
        <Field label="Mobile number" htmlFor="p-mobile" error={errors.mobile}>
          <Input
            id="p-mobile"
            icon="phone"
            inputMode="tel"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            placeholder="9876543210"
            invalid={Boolean(errors.mobile)}
          />
        </Field>

        <Field
          label="LinkedIn profile"
          htmlFor="p-linkedin"
          error={errors.linkedin}
          help="Used by the LinkedIn tracker to match your build-in-public posts."
        >
          <Input
            id="p-linkedin"
            icon="linkedin"
            type="url"
            value={form.linkedin}
            onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
            placeholder="https://www.linkedin.com/in/your-handle/"
            invalid={Boolean(errors.linkedin)}
          />
        </Field>

        <Field label="GitHub profile" htmlFor="p-github" error={errors.github}>
          <Input
            id="p-github"
            icon="github"
            type="url"
            value={form.github}
            onChange={(e) => setForm({ ...form, github: e.target.value })}
            placeholder="https://github.com/your-handle"
            invalid={Boolean(errors.github)}
          />
        </Field>

        <div className="flex items-center justify-end gap-2">
          {dirty ? (
            <Button variant="ghost" onClick={() => setForm(initial)} disabled={saving}>
              Discard
            </Button>
          ) : null}
          <Button onClick={save} loading={saving} disabled={!dirty}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Password change. The only place a password is ever set after seeding. */
export function PasswordForm({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const strength = scorePassword(form.newPassword);

  const save = async () => {
    const next: Record<string, string> = {};
    if (!form.currentPassword) next.currentPassword = "Enter your current password.";
    if (form.newPassword.length < 10) next.newPassword = "Use at least 10 characters.";
    else if (!/[a-z]/.test(form.newPassword)) next.newPassword = "Include a lower-case letter.";
    else if (!/[A-Z0-9]/.test(form.newPassword)) next.newPassword = "Include a capital letter or a number.";
    if (form.newPassword !== form.confirmPassword) next.confirmPassword = "The two passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not change your password", payload.error);
        return;
      }
      toast.success("Password changed", "Use the new one next time you sign in.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card thread={mustChange}>
      <CardHeader
        icon="lock"
        title="Password"
        subtitle={
          mustChange
            ? "You are still on the password your mentor issued. Set your own now."
            : "Change your password. You will stay signed in on this device."
        }
      />

      {mustChange ? (
        <div
          data-accent="amber"
          className="mb-4 flex items-start gap-2.5 rounded-[10px] p-3"
          style={{ background: "var(--tone-soft)" }}
        >
          <Icon name="alert" className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
          <p className="text-[12px] leading-snug" style={{ color: "var(--tone)" }}>
            Shared default passwords are the single most common way a portal account gets misused.
            Change it before you log anything else.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field label="Current password" htmlFor="pw-current" required error={errors.currentPassword}>
          <Input
            id="pw-current"
            type={show ? "text" : "password"}
            icon="lock"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            invalid={Boolean(errors.currentPassword)}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="pw-new"
          required
          error={errors.newPassword}
          help="At least 10 characters, with a lower-case letter and either a capital or a number."
        >
          <Input
            id="pw-new"
            type={show ? "text" : "password"}
            icon="lock"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            invalid={Boolean(errors.newPassword)}
          />
        </Field>

        {form.newPassword ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  data-accent={strength.tone}
                  className="h-1.5 flex-1 rounded-full"
                  style={{
                    background: index < strength.score ? "var(--tone)" : "var(--surface-sunken)",
                    transition: "background 200ms",
                  }}
                />
              ))}
            </div>
            <span data-accent={strength.tone} className="w-16 text-right text-[11px] font-bold" style={{ color: "var(--tone)" }}>
              {strength.label}
            </span>
          </div>
        ) : null}

        <Field label="Confirm new password" htmlFor="pw-confirm" required error={errors.confirmPassword}>
          <Input
            id="pw-confirm"
            type={show ? "text" : "password"}
            icon="lock"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            invalid={Boolean(errors.confirmPassword)}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-[4px] accent-[var(--color-brand-blue)]"
          />
          Show passwords
        </label>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving} icon={saving ? undefined : "lock"}>
            Change password
          </Button>
        </div>
      </div>
    </Card>
  );
}

function scorePassword(value: string): { score: number; label: string; tone: "red" | "amber" | "green" } {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { score: Math.max(score, 1), label: "Weak", tone: "red" };
  if (score === 2) return { score, label: "Fair", tone: "amber" };
  if (score === 3) return { score, label: "Good", tone: "green" };
  return { score: 4, label: "Strong", tone: "green" };
}
