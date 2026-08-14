"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter both your email (or roll number) and your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, remember }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not sign you in. Please try again.");
        setLoading(false);
        return;
      }

      // A full refresh so the server layout picks up the new session cookie.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network problem — check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4" noValidate>
      {error ? (
        <div
          data-accent="red"
          role="alert"
          className="animate-scale-in flex items-start gap-2.5 rounded-[11px] p-3"
          style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
        >
          <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
          <p className="text-[12.5px] font-medium leading-snug">{error}</p>
        </div>
      ) : null}

      <Field label="Email or roll number" htmlFor="identifier" required>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          icon="mail"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          placeholder="yourname.dept24@bitsathy.ac.in"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            icon="lock"
            autoComplete="current-password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
            invalid={Boolean(error)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[8px] transition-colors hover:bg-[var(--surface-inset)]"
            style={{ color: "var(--text-faint)" }}
          >
            <Icon name={showPassword ? "eye-off" : "eye"} className="h-[17px] w-[17px]" />
          </button>
        </div>
      </Field>

      <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded-[4px] accent-[var(--color-brand-blue)]"
        />
        Keep me signed in on this device
      </label>

      <Button type="submit" size="lg" block loading={loading} iconRight={loading ? undefined : "arrow-right"}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
