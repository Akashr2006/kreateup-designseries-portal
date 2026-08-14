"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDay, relativeTime } from "@/lib/dates";
import { shortYear } from "@/lib/utils";

export type ExtensionRow = {
  id: string;
  date: string;
  reason: string;
  status: string;
  remark: string;
  createdAt: string;
  reviewerName: string | null;
  student: { id: string; name: string; rollNo: string; domain: string; year: string };
};

export function ExtensionsClient({ requests, filter }: { requests: ExtensionRow[]; filter: string }) {
  const router = useRouter();
  const toast = useToast();

  const [rejecting, setRejecting] = useState<ExtensionRow | null>(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (row: ExtensionRow, status: "APPROVED" | "REJECTED", note: string) => {
    setBusy(row.id);
    try {
      const response = await fetch("/api/extensions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status, remark: note }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not save the decision", payload.error);
        return false;
      }
      toast.success(
        status === "APPROVED" ? "Extension granted" : "Request rejected",
        status === "APPROVED"
          ? `${row.student.name.split(" ")[0]} can now submit the worklog for ${formatDay(row.date, "medium")}.`
          : undefined
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

  return (
    <>
      <Card className="mb-4">
        <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)", width: "fit-content" }}>
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((key) => (
            <button
              key={key}
              onClick={() => router.push(`/console/extensions?status=${key}`)}
              className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold capitalize transition-colors"
              style={{
                background: filter === key ? "var(--accent-soft)" : "transparent",
                color: filter === key ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {key.toLowerCase()}
            </button>
          ))}
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState
          tone="green"
          icon="check-circle"
          title={filter === "PENDING" ? "Nothing waiting" : "No requests here"}
          description={
            filter === "PENDING"
              ? "No student is asking for a locked worklog date to be reopened."
              : "Try a different status filter."
          }
        />
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {requests.map((row) => (
            <li
              key={row.id}
              data-accent={row.status === "APPROVED" ? "green" : row.status === "PENDING" ? "amber" : "red"}
              className="surface-flat overflow-hidden"
            >
              <div className="flex items-stretch">
                <span className="w-[3px] shrink-0" style={{ background: "var(--tone)" }} />
                <div className="min-w-0 flex-1 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/console/people/${row.student.id}`} className="min-w-0">
                      <PersonCell
                        name={row.student.name}
                        seed={row.student.id}
                        meta={`${row.student.rollNo} · ${shortYear(row.student.year)}`}
                      />
                    </Link>
                    <StatusBadge status={row.status} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue" icon="calendar">
                      Reopen {formatDay(row.date, "long")}
                    </Badge>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      asked {relativeTime(row.createdAt)}
                    </span>
                  </div>

                  <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {row.reason}
                  </p>

                  {row.remark ? (
                    <p className="mt-2 rounded-[8px] px-2.5 py-1.5 text-[11.5px]" style={{ background: "var(--tone-soft)", color: "var(--tone)" }}>
                      <span className="font-semibold">{row.reviewerName ?? "Reviewer"}:</span> {row.remark}
                    </p>
                  ) : null}

                  {row.status === "PENDING" ? (
                    <div className="mt-3 flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="danger"
                        icon="close"
                        disabled={busy === row.id}
                        onClick={() => {
                          setRemark("");
                          setRejecting(row);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        icon="check"
                        loading={busy === row.id}
                        onClick={() => decide(row, "APPROVED", "")}
                      >
                        Grant extension
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        size="sm"
        title="Reject this extension?"
        description="A reason is required — the student needs to know why the date stays locked."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={Boolean(busy)}
              disabled={remark.trim().length < 4}
              onClick={async () => {
                if (rejecting && (await decide(rejecting, "REJECTED", remark.trim()))) setRejecting(null);
              }}
            >
              Reject request
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="ext-remark" required>
          <Textarea
            id="ext-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="e.g. This is the third late request this month — talk to your mentor in person."
          />
        </Field>
      </Modal>
    </>
  );
}
