import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar, PersonCell } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/Table";
import { requireUser } from "@/lib/auth";
import { REWARD_RULES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { leaderboard, leaderboardRank } from "@/lib/queries";
import { shortYear } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await requireUser();

  const [rows, rank, myLedger] = await Promise.all([
    leaderboard(60),
    leaderboardRank(user.id),
    prisma.rewardEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, points: true, reason: true, source: true, createdAt: true },
    }),
  ]);

  const top = rows[0]?.rewardPoints ?? 1;
  const podium = rows.slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description="Reward points come from full attendance days, submitted worklogs, completed tasks and verified LinkedIn posts. The ranking is across every active student in the programme."
      />

      {/* Podium — three columns, ordered 2 / 1 / 3 for the classic shape. */}
      {podium.length === 3 ? (
        <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-4 sm:mb-5">
          {[podium[1], podium[0], podium[2]].map((person, index) => {
            const place = index === 0 ? 2 : index === 1 ? 1 : 3;
            const tone = place === 1 ? "amber" : place === 2 ? "slate" : "red";
            return (
              <Card key={person.id} className={place === 1 ? "sm:-mt-4" : ""} thread={place === 1}>
                <div data-accent={tone} className="flex flex-col items-center text-center">
                  <span className="relative">
                    <Avatar name={person.name} seed={person.id} size={place === 1 ? 58 : 46} ring />
                    <span
                      className="absolute -bottom-1 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: "var(--tone)", boxShadow: "0 0 0 2px var(--surface-raised)" }}
                    >
                      {place}
                    </span>
                  </span>
                  <p
                    className="mt-4 line-clamp-2 text-[12.5px] font-semibold leading-tight"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {person.name}
                  </p>
                  <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                    {shortYear(person.year)}
                  </p>
                  <p
                    className="mt-2 text-[20px] font-bold tabular-nums leading-none"
                    style={{ color: "var(--tone)", letterSpacing: "-0.03em" }}
                  >
                    {person.rewardPoints}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
                    points
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-5">
        <Card padded={false}>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader
              icon="trophy"
              title="Standings"
              subtitle={`Top ${rows.length} of the active cohort.`}
            />
          </div>

          <TableWrap className="rounded-none border-x-0 border-b-0 hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH className="w-14">#</TH>
                  <TH>Student</TH>
                  <TH>Domain</TH>
                  <TH className="w-40">Progress</TH>
                  <TH numeric>Points</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((person, index) => {
                  const isMe = person.id === user.id;
                  return (
                    <TR key={person.id} interactive className={isMe ? "font-semibold" : undefined}>
                      <TD>
                        <span
                          className="grid h-7 w-7 place-items-center rounded-[8px] text-[12px] font-bold tabular-nums"
                          style={{
                            background: index < 3 ? "var(--color-brand-amber-050)" : "var(--surface-inset)",
                            color: index < 3 ? "var(--color-brand-amber-600)" : "var(--text-muted)",
                          }}
                        >
                          {index + 1}
                        </span>
                      </TD>
                      <TD>
                        <span className="flex items-center gap-2">
                          <PersonCell
                            name={person.name}
                            seed={person.id}
                            meta={`${person.rollNo} · ${shortYear(person.year)}`}
                            size={30}
                          />
                          {isMe ? <Badge tone="blue">You</Badge> : null}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          {person.domain}
                        </span>
                      </TD>
                      <TD>
                        <ProgressBar value={(person.rewardPoints / top) * 100} tone={index < 3 ? "amber" : "blue"} />
                      </TD>
                      <TD numeric>
                        <span className="text-[13.5px] font-bold" style={{ color: "var(--text-strong)" }}>
                          {person.rewardPoints}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>

          <ul className="px-4 pb-4 md:hidden">
            {rows.map((person, index) => (
              <li
                key={person.id}
                className="flex items-center gap-3 border-b py-2.5 last:border-0"
                style={{ borderColor: "var(--line-soft)" }}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[11.5px] font-bold tabular-nums"
                  style={{
                    background: index < 3 ? "var(--color-brand-amber-050)" : "var(--surface-inset)",
                    color: index < 3 ? "var(--color-brand-amber-600)" : "var(--text-muted)",
                  }}
                >
                  {index + 1}
                </span>
                <PersonCell
                  name={person.name}
                  seed={person.id}
                  meta={person.domain}
                  size={30}
                  className="flex-1"
                />
                <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {person.rewardPoints}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4 sm:gap-5">
          {rank ? (
            <Card thread>
              <CardHeader icon="target" title="Where you stand" />
              <div className="flex items-center gap-4">
                <Avatar name={user.name} seed={user.id} size={54} ring />
                <div className="min-w-0">
                  <p className="text-[26px] font-bold leading-none tabular-nums" style={{ letterSpacing: "-0.03em" }}>
                    #{rank.position}
                    <span className="ml-1.5 text-[14px] font-semibold" style={{ color: "var(--text-muted)" }}>
                      of {rank.total}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[13px] font-semibold" style={{ color: "var(--color-brand-amber-600)" }}>
                    {rank.points} points
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar value={(rank.points / top) * 100} tone="amber" height={8} showValue />
                <p className="mt-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  {rank.position === 1
                    ? "You are top of the cohort. Hold it."
                    : `${top - rank.points} points behind the leader.`}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader icon="info" title="How points are earned" />
            <ul className="flex flex-col gap-2">
              <RuleRow tone="green" icon="check-circle" label="Full attendance day" points={REWARD_RULES.fullDayAttendance} />
              <RuleRow tone="blue" icon="clipboard" label="Worklog submitted" points={REWARD_RULES.worklogSubmitted} />
              <RuleRow tone="amber" icon="target" label="Task completed" points={REWARD_RULES.taskCompletedBase} suffix="+" />
              <RuleRow tone="red" icon="linkedin" label="Verified LinkedIn post" points={REWARD_RULES.linkedinVerified} />
            </ul>
          </Card>

          <Card>
            <CardHeader icon="clock" title="Your recent points" subtitle="Newest first." />
            {myLedger.length === 0 ? (
              <p className="py-6 text-center text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                No points recorded yet.
              </p>
            ) : (
              <ul className="flex flex-col">
                {myLedger.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 border-b py-2.5 last:border-0"
                    style={{ borderColor: "var(--line-soft)" }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium" style={{ color: "var(--text-default)" }}>
                        {entry.reason}
                      </span>
                      <span className="block text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
                        {entry.source.toLowerCase()}
                      </span>
                    </span>
                    <span
                      data-accent={entry.points >= 0 ? "green" : "red"}
                      className="shrink-0 text-[13px] font-bold tabular-nums"
                      style={{ color: "var(--tone)" }}
                    >
                      {entry.points >= 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  tone,
  icon,
  label,
  points,
  suffix = "",
}: {
  tone: "blue" | "red" | "amber" | "green";
  icon: "check-circle" | "clipboard" | "target" | "linkedin";
  label: string;
  points: number;
  suffix?: string;
}) {
  return (
    <li data-accent={tone} className="flex items-center gap-3 rounded-[10px] px-2.5 py-2" style={{ background: "var(--tone-soft)" }}>
      <Icon name={icon} className="h-4 w-4 shrink-0" style={{ color: "var(--tone)" }} />
      <span className="flex-1 text-[12.5px] font-medium" style={{ color: "var(--text-default)" }}>
        {label}
      </span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--tone)" }}>
        +{points}
        {suffix}
      </span>
    </li>
  );
}
