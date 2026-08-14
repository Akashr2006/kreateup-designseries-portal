"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PASS_CATEGORY_LABEL } from "@/lib/constants";
import { formatDay, relativeTime } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type ApprovalRow = {
  id: string;
  date: string;
  fromTime: string;
  toTime: string;
  destination: string;
  reason: string;
  category: string;
  status: string;
  passCode: string;
  remark: string;
  createdAt: string;
  reviewerName: string | null;
  student: { id: string; name: string; rollNo: string; domain: string; year: string; mobile: string };
};

const REJECT_REASONS = [
  "Clashes with the mandatory review session.",
  "Not enough detail — resubmit with specifics.",
  "Talk to your mentor in person first.",
  "Too close to the sprint deadline.",
];

export function ApprovalsClient({
  passes,
  filter,
}: {
  passes: ApprovalRow[];
  filter: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [rejecting, setRejecting] = useState<ApprovalRow | null>(null);
  const [viewing, setViewing] = useState<ApprovalRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passes;
    return passes.filter((pass) =>
      `${pass.student.name} ${pass.student.rollNo} ${pass.destination} ${pass.reason}`
        .toLowerCase()
        .includes(q)
    );
  }, [passes, query]);

  const decide = async (pass: ApprovalRow, status: "APPROVED" | "REJECTED", remark: string) => {
    setBusy(pass.id);
    try {
      const response = await fetch("/api/passes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pass.id, status, remark }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save the decision", payload.error);
        return false;
      }
      toast.success(
        status === "APPROVED" ? "Pass approved" : "Request rejected",
        status === "APPROVED"
          ? `${pass.student.name.split(" ")[0]} can now show the signed slip at the gate.`
          : "They will see your reason on their passes page."
      );
      router.refresh();
      return true;
    } catch {
      toast.error("Network problem");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const setFilter = (next: string) => router.push(`/console/passes?status=${next}`);

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <Input
              icon="search"
              placeholder="Search student, destination or reason…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search requests"
            />
          </div>
          <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
            {[
              { key: "PENDING", label: "Pending" },
              { key: "APPROVED", label: "Approved" },
              { key: "REJECTED", label: "Rejected" },
              { key: "ALL", label: "All" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key)}
                className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors"
                style={{
                  background: filter === option.key ? "var(--accent-soft)" : "transparent",
                  color: filter === option.key ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          tone="green"
          icon="check-circle"
          title={filter === "PENDING" ? "Nothing waiting" : "No requests here"}
          description={
            filter === "PENDING"
              ? "Every request has been decided. New ones appear here the moment a student submits."
              : "Try a different status filter."
          }
        />
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {filtered.map((pass) => (
            <li
              key={pass.id}
              data-accent={
                pass.status === "APPROVED" ? "green" : pass.status === "PENDING" ? "amber" : pass.status === "REJECTED" ? "red" : "slate"
              }
              className="surface-flat overflow-hidden"
            >
              <div className="flex items-stretch">
                <span className="w-[3px] shrink-0" style={{ background: "var(--tone)" }} />
                <div className="min-w-0 flex-1 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/console/people/${pass.student.id}`} className="min-w-0">
                      <PersonCell
                        name={pass.student.name}
                        seed={pass.student.id}
                        meta={`${pass.student.rollNo} · ${shortYear(pass.student.year)}`}
                      />
                    </Link>
                    <StatusBadge status={pass.status} />
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Detail icon="calendar" label="When" value={`${formatDay(pass.date, "medium")} · ${pass.fromTime}–${pass.toTime}`} />
                    <Detail icon="target" label="Where" value={pass.destination} />
                  </div>

                  <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {pass.reason}
                  </p>

                  {pass.remark ? (
                    <p className="mt-2 rounded-[8px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--tone-soft)", color: "var(--tone)" }}>
                      <span className="font-semibold">{pass.reviewerName ?? "Reviewer"}:</span> {pass.remark}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="slate">{PASS_CATEGORY_LABEL[pass.category] ?? pass.category}</Badge>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      Requested {relativeTime(pass.createdAt)}
                    </span>

                    <span className="ml-auto flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(pass)}>
                        Details
                      </Button>
                      {pass.status === "PENDING" ? (
                        <>
                          <Button size="sm" variant="danger" icon="close" disabled={busy === pass.id} onClick={() => setRejecting(pass)}>
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            icon="check"
                            loading={busy === pass.id}
                            onClick={() => decide(pass, "APPROVED", "")}
                          >
                            Approve
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Reject dialog -------------------------------------------------- */}
      {rejecting ? (
        <RejectDialog
          pass={rejecting}
          busy={busy === rejecting.id}
          onClose={() => setRejecting(null)}
          onReject={async (remark) => {
            const done = await decide(rejecting, "REJECTED", remark);
            if (done) setRejecting(null);
          }}
        />
      ) : null}

      {/* Detail dialog -------------------------------------------------- */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Request detail"
        description={viewing ? `${viewing.student.name} · ${viewing.student.rollNo}` : undefined}
      >
        {viewing ? (
          <div className="flex flex-col gap-3">
            <div className="inset-panel p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
                Reason given
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-default)" }}>
                {viewing.reason}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Detail icon="calendar" label="Date" value={formatDay(viewing.date, "long")} />
              <Detail icon="clock" label="Window" value={`${viewing.fromTime} – ${viewing.toTime}`} />
              <Detail icon="target" label="Destination" value={viewing.destination} />
              <Detail icon="layers" label="Category" value={PASS_CATEGORY_LABEL[viewing.category] ?? viewing.category} />
              <Detail icon="users" label="Domain" value={viewing.student.domain} />
              <Detail icon="phone" label="Mobile" value={viewing.student.mobile || "Not on file"} />
              {viewing.status === "APPROVED" ? (
                <Detail icon="ticket" label="Pass code" value={viewing.passCode} />
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------

function Detail({
  icon,
  label,
  value,
}: {
  icon: "calendar" | "clock" | "target" | "layers" | "users" | "phone" | "ticket";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--text-faint)" }} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
          {label}
        </p>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--text-default)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function RejectDialog({
  pass,
  busy,
  onClose,
  onReject,
}: {
  pass: ApprovalRow;
  busy: boolean;
  onClose: () => void;
  onReject: (remark: string) => void;
}) {
  const [remark, setRemark] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Reject ${pass.student.name.split(" ")[0]}'s request?`}
      description="A reason is required — a rejection without one just generates a follow-up question."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={remark.trim().length < 4}
            onClick={() => onReject(remark.trim())}
          >
            Reject request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Reason" htmlFor="reject-remark" required>
          <Textarea
            id="reject-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="Why is this being rejected?"
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {REJECT_REASONS.map((preset) => (
            <button
              key={preset}
              onClick={() => setRemark(preset)}
              className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: "var(--line-default)", color: "var(--text-muted)" }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
