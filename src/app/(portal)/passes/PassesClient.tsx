"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LogoLockup } from "@/components/brand/Logo";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Barcode } from "@/components/ui/Barcode";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, DataRow } from "@/components/ui/Card";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { PASS_CATEGORY, PASS_CATEGORY_LABEL } from "@/lib/constants";
import { formatDay, relativeTime, toDayKey } from "@/lib/dates";

export type PassRow = {
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
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type PassHolder = {
  name: string;
  rollNo: string;
  department: string;
  year: string;
  domain: string;
  mentorName: string;
};

export function PassesClient({ passes, holder }: { passes: PassRow[]; holder: PassHolder }) {
  const router = useRouter();
  const toast = useToast();

  const [requestOpen, setRequestOpen] = useState(false);
  const [viewing, setViewing] = useState<PassRow | null>(null);
  const [withdrawing, setWithdrawing] = useState<PassRow | null>(null);
  const [busy, setBusy] = useState(false);

  const today = toDayKey();
  const [form, setForm] = useState({
    date: today,
    fromTime: "10:00",
    toTime: "12:00",
    destination: "",
    reason: "",
    category: "ACTIVITY",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const next: Record<string, string> = {};
    if (form.destination.trim().length < 3) next.destination = "Where are you going?";
    if (form.reason.trim().length < 10) next.reason = "Give a real reason — at least a sentence.";
    if (form.toTime <= form.fromTime) next.toTime = "The return time has to be after departure.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!payload.ok) {
        toast.error("Could not submit your request", payload.error);
        return;
      }

      toast.success("Request submitted", "Your mentor will see it in the approval queue.");
      setRequestOpen(false);
      setForm({ ...form, destination: "", reason: "" });
      router.refresh();
    } catch {
      toast.error("Network problem", "The request was not submitted.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!withdrawing) return;
    setBusy(true);
    try {
      const response = await fetch("/api/passes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: withdrawing.id }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not withdraw", payload.error);
        return;
      }
      toast.success("Request withdrawn");
      setWithdrawing(null);
      router.refresh();
    } catch {
      toast.error("Network problem");
    } finally {
      setBusy(false);
    }
  };

  const upcoming = passes.filter((p) => p.date >= today && p.status !== "CANCELLED");
  const past = passes.filter((p) => p.date < today || p.status === "CANCELLED");

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon="plus" onClick={() => setRequestOpen(true)}>
          Request a pass
        </Button>
      </div>

      {passes.length === 0 ? (
        <EmptyState
          title="No passes requested yet"
          description="Request a pass whenever you need to be away from the studio during session hours. An approved pass gives you a scannable slip to show at the gate."
          action={
            <Button icon="plus" onClick={() => setRequestOpen(true)}>
              Request a pass
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          {upcoming.length > 0 ? (
            <Card>
              <CardHeader icon="ticket" title="Upcoming & pending" subtitle={`${upcoming.length} active`} />
              <ul className="grid gap-2.5 md:grid-cols-2">
                {upcoming.map((pass) => (
                  <PassCard key={pass.id} pass={pass} onView={setViewing} onWithdraw={setWithdrawing} />
                ))}
              </ul>
            </Card>
          ) : null}

          {past.length > 0 ? (
            <Card>
              <CardHeader icon="clock" title="History" subtitle={`${past.length} past requests`} />
              <ul className="grid gap-2.5 md:grid-cols-2">
                {past.map((pass) => (
                  <PassCard key={pass.id} pass={pass} onView={setViewing} onWithdraw={setWithdrawing} muted />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Request dialog                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request an activity pass"
        description="One live request per day. Your mentor sees it immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} icon={busy ? undefined : "check"}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" htmlFor="pass-date" required>
              <Input
                id="pass-date"
                type="date"
                min={today}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Leaving at" htmlFor="pass-from" required>
              <Input
                id="pass-from"
                type="time"
                value={form.fromTime}
                onChange={(e) => setForm({ ...form, fromTime: e.target.value })}
              />
            </Field>
            <Field label="Back by" htmlFor="pass-to" required error={errors.toTime}>
              <Input
                id="pass-to"
                type="time"
                value={form.toTime}
                onChange={(e) => setForm({ ...form, toTime: e.target.value })}
                invalid={Boolean(errors.toTime)}
              />
            </Field>
          </div>

          <Field label="Category" htmlFor="pass-category" required>
            <Select
              id="pass-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {PASS_CATEGORY.map((category) => (
                <option key={category} value={category}>
                  {PASS_CATEGORY_LABEL[category]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Where are you going?" htmlFor="pass-destination" required error={errors.destination}>
            <Input
              id="pass-destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="e.g. College Health Centre"
              invalid={Boolean(errors.destination)}
            />
          </Field>

          <Field
            label="Reason"
            htmlFor="pass-reason"
            required
            error={errors.reason}
            help="Be specific — a vague reason is the most common cause of rejection."
          >
            <Textarea
              id="pass-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Follow-up consultation at the health centre. I will bring the slip back and submit it to my mentor."
              rows={3}
              invalid={Boolean(errors.reason)}
            />
          </Field>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- */}
      {/* Gate pass                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.status === "APPROVED" ? "Your gate pass" : "Request detail"}
        size="md"
        footer={
          viewing?.status === "APPROVED" ? (
            <Button variant="secondary" icon="download" onClick={() => window.print()} className="no-print">
              Print / save as PDF
            </Button>
          ) : undefined
        }
      >
        {viewing ? <GatePass pass={viewing} holder={holder} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(withdrawing)}
        onClose={() => setWithdrawing(null)}
        onConfirm={withdraw}
        loading={busy}
        destructive
        title="Withdraw this request?"
        message="The request will be marked cancelled and removed from your mentor's queue. You can submit a new one for the same date afterwards."
        confirmLabel="Withdraw request"
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function PassCard({
  pass,
  onView,
  onWithdraw,
  muted = false,
}: {
  pass: PassRow;
  onView: (pass: PassRow) => void;
  onWithdraw: (pass: PassRow) => void;
  muted?: boolean;
}) {
  return (
    <li
      data-accent={pass.status === "APPROVED" ? "green" : pass.status === "PENDING" ? "amber" : pass.status === "REJECTED" ? "red" : "slate"}
      className="surface-flat overflow-hidden"
      style={{ opacity: muted ? 0.82 : 1 }}
    >
      <div className="flex items-stretch">
        <span className="w-[3px] shrink-0" style={{ background: "var(--tone)" }} />
        <div className="min-w-0 flex-1 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--text-strong)" }}>
                {pass.destination}
              </p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {formatDay(pass.date, "long")} · {pass.fromTime}–{pass.toTime}
              </p>
            </div>
            <StatusBadge status={pass.status} />
          </div>

          <p className="mt-2 line-clamp-2 text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
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
              {pass.status === "PENDING" ? (
                <Button size="sm" variant="ghost" onClick={() => onWithdraw(pass)}>
                  Withdraw
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={pass.status === "APPROVED" ? "success" : "secondary"}
                icon={pass.status === "APPROVED" ? "ticket" : undefined}
                onClick={() => onView(pass)}
              >
                {pass.status === "APPROVED" ? "Show pass" : "Details"}
              </Button>
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * The slip a student shows at the gate. Deliberately high-contrast and
 * print-friendly: the barcode is real Code 39, so a standard scanner reads it.
 */
function GatePass({ pass, holder }: { pass: PassRow; holder: PassHolder }) {
  const approved = pass.status === "APPROVED";

  return (
    <div className="print-sheet overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line-default)" }}>
      <span aria-hidden className="brand-thread-bar block h-[4px] w-full" />

      <div className="p-4" style={{ background: "var(--surface-inset)" }}>
        <div className="flex items-start justify-between gap-3">
          <LogoLockup height={20} subtitle="Activity Gate Pass" />
          <StatusBadge status={pass.status} solid />
        </div>
      </div>

      <div className="p-4">
        <dl>
          <DataRow label="Student" value={<strong>{holder.name}</strong>} />
          <DataRow label="Roll number" value={holder.rollNo} mono />
          <DataRow label="Department" value={holder.department} />
          <DataRow label="Year / batch" value={holder.year} />
          <DataRow label="Domain" value={holder.domain} />
          <DataRow label="Mentor" value={holder.mentorName} />
          <DataRow label="Date" value={formatDay(pass.date, "long")} />
          <DataRow label="Window" value={`${pass.fromTime} — ${pass.toTime}`} mono />
          <DataRow label="Destination" value={pass.destination} />
          <DataRow label="Category" value={PASS_CATEGORY_LABEL[pass.category] ?? pass.category} />
          <DataRow label="Reason" value={pass.reason} />
          {pass.reviewerName ? <DataRow label="Approved by" value={pass.reviewerName} /> : null}
          {pass.remark ? <DataRow label="Remark" value={pass.remark} /> : null}
        </dl>

        {approved ? (
          <div className="mt-4 rounded-[12px] border p-3" style={{ borderColor: "var(--line-default)", background: "#fff" }}>
            <Barcode value={pass.passCode} height={54} />
          </div>
        ) : (
          <div
            data-accent={pass.status === "PENDING" ? "amber" : "red"}
            className="mt-4 flex items-start gap-2.5 rounded-[10px] p-3"
            style={{ background: "var(--tone-soft)" }}
          >
            <Icon name={pass.status === "PENDING" ? "clock" : "alert"} className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
            <p className="text-[12px] leading-snug" style={{ color: "var(--tone)" }}>
              {pass.status === "PENDING"
                ? "This pass is not valid yet — it is still waiting for approval. Do not leave the campus on an unapproved request."
                : pass.status === "REJECTED"
                  ? "This request was rejected. It is not a valid pass."
                  : "This request was withdrawn."}
            </p>
          </div>
        )}

        <p className="mt-3 text-center text-[10.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Issued by the KreateUp DesignSeries Portal. Valid only for the window shown above and only
          when the status reads Approved. Present this slip at the gate on request.
        </p>
      </div>
    </div>
  );
}
