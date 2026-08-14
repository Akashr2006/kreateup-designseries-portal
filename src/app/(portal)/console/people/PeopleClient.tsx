"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  PERMISSIONS,
  PERMISSION_HINT,
  PERMISSION_LABEL,
  ROLES,
  ROLE_LABEL,
  type Permission,
  type Role,
} from "@/lib/constants";
import { relativeTime } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type PersonRow = {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  department: string;
  year: string;
  mobile: string;
  domain: string;
  mentorName: string;
  role: string;
  systemStatus: string;
  rewardPoints: number;
  lastLoginAt: string | null;
  permissions: Record<Permission, boolean>;
};

export function PeopleClient({
  people,
  options,
  actorRole,
  canManage,
}: {
  people: PersonRow[];
  options: { years: string[]; domains: string[]; mentors: string[] };
  actorRole: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [domain, setDomain] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [suspending, setSuspending] = useState<PersonRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((person) => {
      if (role !== "ALL" && person.role !== role) return false;
      if (year !== "ALL" && person.year !== year) return false;
      if (domain !== "ALL" && person.domain !== domain) return false;
      if (status !== "ALL" && person.systemStatus !== status) return false;
      if (!q) return true;
      return `${person.name} ${person.rollNo} ${person.email} ${person.domain} ${person.mentorName}`
        .toLowerCase()
        .includes(q);
    });
  }, [people, query, role, year, domain, status]);

  const suspend = async () => {
    if (!suspending) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suspending.id }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not suspend the account", payload.error);
        return;
      }
      toast.success("Account suspended", "Their records are kept; they simply cannot sign in.");
      setSuspending(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  const resetFilters = () => {
    setQuery("");
    setRole("ALL");
    setYear("ALL");
    setDomain("ALL");
    setStatus("ALL");
  };

  const filtersActive = query || role !== "ALL" || year !== "ALL" || domain !== "ALL" || status !== "ALL";

  return (
    <>
      {/* Filters -------------------------------------------------------- */}
      <Card className="mb-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              icon="search"
              placeholder="Search name, roll number, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search people"
            />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
            <option value="ALL">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
            <option value="ALL">All years</option>
            {options.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Filter by domain">
            <option value="ALL">All domains</option>
            {options.domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Segment
            value={status}
            onChange={setStatus}
            options={[
              { key: "ALL", label: "Everyone" },
              { key: "ACTIVE", label: "Active" },
              { key: "SUSPENDED", label: "Suspended" },
            ]}
          />
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Showing <strong style={{ color: "var(--text-strong)" }}>{filtered.length}</strong> of {people.length}
          </p>
          {filtersActive ? (
            <Button size="sm" variant="ghost" icon="close" onClick={resetFilters} className="ml-auto">
              Clear filters
            </Button>
          ) : null}
        </div>
      </Card>

      {/* Table ---------------------------------------------------------- */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nobody matches those filters"
          description="Try widening the search, or clear the filters to see the whole roster."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <TableWrap className="hidden lg:block">
            <Table>
              <THead>
                <TR>
                  <TH>Person</TH>
                  <TH>Year</TH>
                  <TH>Domain</TH>
                  <TH>Mentor</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH numeric>Points</TH>
                  <TH numeric>Last seen</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {filtered.map((person) => (
                  <TR key={person.id} interactive>
                    <TD>
                      <Link href={`/console/people/${person.id}`}>
                        <PersonCell name={person.name} seed={person.id} meta={person.rollNo} />
                      </Link>
                    </TD>
                    <TD>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {shortYear(person.year)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {person.domain}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {person.mentorName.split(" - ")[0] || "—"}
                      </span>
                    </TD>
                    <TD>
                      <StatusBadge status={person.role} label={ROLE_LABEL[person.role as Role]} />
                    </TD>
                    <TD>
                      <StatusBadge status={person.systemStatus} />
                    </TD>
                    <TD numeric>{person.rewardPoints}</TD>
                    <TD numeric>
                      <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                        {person.lastLoginAt ? relativeTime(person.lastLoginAt) : "Never"}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex justify-end gap-1">
                        {canManage ? (
                          <Button size="sm" variant="ghost" icon="settings" onClick={() => setEditing(person)}>
                            Manage
                          </Button>
                        ) : null}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          {/* Cards below lg */}
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:hidden">
            {filtered.map((person) => (
              <li key={person.id} className="surface-flat p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/console/people/${person.id}`} className="min-w-0">
                    <PersonCell name={person.name} seed={person.id} meta={`${person.rollNo} · ${person.domain}`} />
                  </Link>
                  <StatusBadge status={person.role} label={ROLE_LABEL[person.role as Role]} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone="slate">{shortYear(person.year)}</Badge>
                  <Badge tone="amber" icon="trophy">
                    {person.rewardPoints}
                  </Badge>
                  <StatusBadge status={person.systemStatus} />
                  {canManage ? (
                    <Button size="sm" variant="ghost" icon="settings" className="ml-auto" onClick={() => setEditing(person)}>
                      Manage
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing ? (
        <ManageDialog
          person={editing}
          options={options}
          actorRole={actorRole}
          onClose={() => setEditing(null)}
          onSuspend={() => {
            setSuspending(editing);
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        onConfirm={suspend}
        loading={busy}
        destructive
        title={`Suspend ${suspending?.name ?? "this account"}?`}
        message="They will be signed out and unable to log in. Attendance, worklogs and passes are kept — this is a deactivation, not a deletion, so the programme record stays intact."
        confirmLabel="Suspend account"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function ManageDialog({
  person,
  options,
  actorRole,
  onClose,
  onSuspend,
}: {
  person: PersonRow;
  options: { years: string[]; domains: string[]; mentors: string[] };
  actorRole: string;
  onClose: () => void;
  onSuspend: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    name: person.name,
    year: person.year,
    domain: person.domain,
    mentorName: person.mentorName,
    mobile: person.mobile,
    role: person.role,
    systemStatus: person.systemStatus,
  });
  const [permissions, setPermissions] = useState(person.permissions);
  const [resetPassword, setResetPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // A super admin holds everything implicitly, so the checkboxes are inert.
  const permissionsLocked = form.role === "SUPER_ADMIN";
  const assignableRoles = ROLES.filter((role) => actorRole === "SUPER_ADMIN" || role === "STUDENT" || role === "MENTOR");

  const save = async () => {
    if (resetPassword && resetPassword.length < 10) {
      toast.warning("Password too short", "Use at least 10 characters.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          ...form,
          ...permissions,
          ...(resetPassword ? { resetPassword } : {}),
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save", payload.error);
        return;
      }
      toast.success(
        "Account updated",
        resetPassword ? "They will be asked to set a new password on next sign-in." : undefined
      );
      onClose();
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Manage ${person.name}`}
      description={`${person.rollNo} · ${person.email}`}
      footer={
        <>
          {person.systemStatus === "ACTIVE" ? (
            <Button variant="ghost" icon="lock" onClick={onSuspend} className="mr-auto" style={{ color: "var(--color-brand-red)" }}>
              Suspend account
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-faint)" }}>
            Record
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="m-name">
              <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile" htmlFor="m-mobile">
              <Input id="m-mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Year / batch" htmlFor="m-year">
              <Select id="m-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                <option value="">Not set</option>
                {options.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Domain" htmlFor="m-domain">
              <Select id="m-domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                {options.domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mentor" htmlFor="m-mentor" className="sm:col-span-2">
              <Select id="m-mentor" value={form.mentorName} onChange={(e) => setForm({ ...form, mentorName: e.target.value })}>
                <option value="">Not assigned</option>
                {options.mentors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-faint)" }}>
            Role & status
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Role"
              htmlFor="m-role"
              help={actorRole === "SUPER_ADMIN" ? undefined : "You can only assign roles below your own."}
            >
              <Select id="m-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
                {!assignableRoles.includes(form.role as Role) ? (
                  <option value={form.role}>{ROLE_LABEL[form.role as Role] ?? form.role}</option>
                ) : null}
              </Select>
            </Field>
            <Field label="Account status" htmlFor="m-status">
              <Select id="m-status" value={form.systemStatus} onChange={(e) => setForm({ ...form, systemStatus: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-faint)" }}>
            Console permissions
          </h3>
          <p className="mb-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
            {permissionsLocked
              ? "Super admins hold every permission implicitly — these switches do not apply."
              : "Each switch unlocks one console module. Grant the minimum the person actually needs."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERMISSIONS.map((permission) => (
              <Checkbox
                key={permission}
                label={PERMISSION_LABEL[permission]}
                description={PERMISSION_HINT[permission]}
                checked={permissionsLocked ? true : permissions[permission]}
                disabled={permissionsLocked}
                onChange={(e) => setPermissions({ ...permissions, [permission]: e.target.checked })}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--text-faint)" }}>
            Reset password
          </h3>
          <Field
            label="Issue a new password"
            htmlFor="m-password"
            help="Leave blank to keep the current password. The person will be asked to change whatever you set here."
          >
            <Input
              id="m-password"
              type="text"
              icon="lock"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="At least 10 characters"
              autoComplete="off"
            />
          </Field>
          {resetPassword ? (
            <p
              data-accent="amber"
              className="mt-2 flex items-start gap-2 rounded-[9px] p-2.5 text-[11.5px]"
              style={{ background: "var(--tone-soft)", color: "var(--tone)" }}
            >
              <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" />
              Share this password over a private channel, never in a group chat.
            </p>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}

function Segment({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Array<{ key: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className="h-7 rounded-[8px] px-2.5 text-[12px] font-semibold transition-colors"
          style={{
            background: value === option.key ? "var(--accent-soft)" : "transparent",
            color: value === option.key ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
