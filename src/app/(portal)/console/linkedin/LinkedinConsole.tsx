"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PersonCell } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { REWARD_RULES } from "@/lib/constants";
import { formatDay } from "@/lib/dates";
import { shortYear, truncate } from "@/lib/utils";

export type PostRow = {
  id: string;
  url: string;
  caption: string;
  postedOn: string;
  reactions: number;
  comments: number;
  verified: boolean;
  student: { id: string; name: string; rollNo: string; domain: string; year: string };
};

/**
 * The build-in-public tracker.
 *
 * Verifying a post is the action that awards points, so it is deliberately a
 * two-step flow: open the post, then confirm — never a one-click toggle that
 * could be fired by accident on a scrolling list.
 */
export function LinkedinConsole({
  posts,
  filter,
  options,
}: {
  posts: PostRow[];
  filter: string;
  options: { domains: string[] };
}) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<PostRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) =>
      `${post.student.name} ${post.student.rollNo} ${post.caption}`.toLowerCase().includes(q)
    );
  }, [posts, query]);

  const setFilter = (next: string) => router.push(`/console/linkedin?status=${next}`);

  const verify = async (post: PostRow, verified: boolean, reactions?: number, comments?: number) => {
    setBusy(post.id);
    try {
      const response = await fetch("/api/linkedin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, verified, reactions, comments }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not update", payload.error);
        return false;
      }
      toast.success(
        verified ? "Post verified" : "Verification withdrawn",
        verified
          ? `${REWARD_RULES.linkedinVerified} points added to ${post.student.name.split(" ")[0]}.`
          : `${REWARD_RULES.linkedinVerified} points removed.`
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
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="min-w-[220px] flex-1 sm:max-w-sm">
            <Input
              icon="search"
              placeholder="Search student or caption…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search posts"
            />
          </div>
          <div className="flex items-center gap-1 rounded-[10px] border p-0.5" style={{ borderColor: "var(--line-default)" }}>
            {[
              { key: "PENDING", label: "Unverified" },
              { key: "VERIFIED", label: "Verified" },
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
          icon="linkedin"
          title={filter === "PENDING" ? "Nothing to verify" : "No submissions here"}
          description={
            filter === "PENDING"
              ? "Every submitted post has been reviewed. New submissions land here as students post them."
              : "Try a different filter."
          }
        />
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {filtered.map((post) => (
            <li
              key={post.id}
              data-accent={post.verified ? "green" : "amber"}
              className="surface-flat overflow-hidden"
            >
              <div className="flex items-stretch">
                <span className="w-[3px] shrink-0" style={{ background: "var(--tone)" }} />
                <div className="min-w-0 flex-1 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/console/people/${post.student.id}`} className="min-w-0">
                      <PersonCell
                        name={post.student.name}
                        seed={post.student.id}
                        meta={`${post.student.rollNo} · ${shortYear(post.student.year)}`}
                      />
                    </Link>
                    <Badge tone={post.verified ? "green" : "amber"} icon={post.verified ? "check-circle" : "clock"}>
                      {post.verified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>

                  <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {post.caption ? truncate(post.caption, 180) : "No caption submitted."}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge tone="slate" icon="calendar">
                      {formatDay(post.postedOn, "medium")}
                    </Badge>
                    <Badge tone="slate">{post.reactions} reactions</Badge>
                    <Badge tone="slate">{post.comments} comments</Badge>

                    <span className="ml-auto flex items-center gap-1.5">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] font-semibold transition-colors hover:border-[var(--accent)]"
                        style={{ borderColor: "var(--line-default)", color: "var(--text-strong)" }}
                      >
                        <Icon name="arrow-up-right" className="h-3.5 w-3.5" />
                        Open post
                      </a>
                      {post.verified ? (
                        <Button size="sm" variant="ghost" loading={busy === post.id} onClick={() => verify(post, false)}>
                          Withdraw
                        </Button>
                      ) : (
                        <Button size="sm" variant="success" icon="check" onClick={() => setReviewing(post)}>
                          Verify
                        </Button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewing ? (
        <VerifyDialog
          post={reviewing}
          busy={busy === reviewing.id}
          onClose={() => setReviewing(null)}
          onVerify={async (reactions, comments) => {
            const done = await verify(reviewing, true, reactions, comments);
            if (done) setReviewing(null);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function VerifyDialog({
  post,
  busy,
  onClose,
  onVerify,
}: {
  post: PostRow;
  busy: boolean;
  onClose: () => void;
  onVerify: (reactions: number, comments: number) => void;
}) {
  const [reactions, setReactions] = useState(post.reactions);
  const [comments, setComments] = useState(post.comments);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Verify ${post.student.name.split(" ")[0]}'s post`}
      description={`Verifying awards ${REWARD_RULES.linkedinVerified} reward points. Open the post first and check it is genuinely about the programme work.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="success" icon="check" loading={busy} onClick={() => onVerify(reactions, comments)}>
            Verify and award points
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inset-panel flex items-center gap-2.5 p-3 text-[12.5px] font-semibold transition-colors hover:border-[var(--accent)]"
          style={{ color: "var(--accent)" }}
        >
          <Icon name="linkedin" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{post.url}</span>
          <Icon name="arrow-up-right" className="h-3.5 w-3.5 shrink-0" />
        </a>

        {post.caption ? (
          <div className="inset-panel p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
              Caption submitted
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-default)" }}>
              {post.caption}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reactions" htmlFor="v-reactions" help="Optional — recorded for the engagement report.">
            <Input
              id="v-reactions"
              type="number"
              min={0}
              value={reactions}
              onChange={(e) => setReactions(Number(e.target.value))}
            />
          </Field>
          <Field label="Comments" htmlFor="v-comments">
            <Input
              id="v-comments"
              type="number"
              min={0}
              value={comments}
              onChange={(e) => setComments(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
