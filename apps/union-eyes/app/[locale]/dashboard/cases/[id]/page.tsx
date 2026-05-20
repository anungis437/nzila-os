import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarClock,
  FileText,
  FolderClock,
  Gavel,
  Inbox as InboxIcon,
  Link2,
  MessageSquareText,
  Paperclip,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373CaseActions } from "@/components/demo/cupe4373-case-actions";
import { Cupe4373CaseLifecycle } from "@/components/demo/cupe4373-case-lifecycle";
import { decisionsOfRecord, inboxItems } from "@/lib/demo/cupe4373-demo";
import { getDemoCaseFromDb } from "@/lib/demo/server/cupe4373-cases-repo";
import { listDecisionsForCase } from "@/lib/demo/server/cupe4373-governance";
import { getRetentionStatusForCase } from "@/lib/demo/server/cupe4373-retention";
import {
  deriveCaseUuid,
  getOrComputePriorityScoreForCase,
} from "@/lib/demo/server/cupe4373-cognition";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const demoCase = await getDemoCaseFromDb(id);
  if (!demoCase) {
    return { title: "Case not found | UnionEyes" };
  }
  return {
    title: `${demoCase.id} | Case Continuity | UnionEyes`,
    description: demoCase.summary,
  };
}

export default async function CaseDetailPage({ params }: PageProps) {
  const { locale, id } = await params;

  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole("steward") : true;
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  const demoCase = await getDemoCaseFromDb(id);
  if (!demoCase) {
    notFound();
  }
  const chronology = demoCase.timeline;
  const linkedInbox = inboxItems.filter((item) => item.linkedCaseId === demoCase.id);
  const citingDecisions = decisionsOfRecord.filter((d) =>
    d.precedentFor.includes(demoCase.id),
  );
  const liveDecisions = await listDecisionsForCase(demoCase.id);
  const retention = await getRetentionStatusForCase(demoCase);
  const priorityScore = await getOrComputePriorityScoreForCase(
    demoCase,
    deriveCaseUuid(demoCase.id),
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <Cupe4373SectionNav />

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Button asChild variant="ghost" className="w-fit px-0 text-slate-600 hover:bg-transparent">
          <Link href={`/${locale}/dashboard/cases`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to cases
          </Link>
        </Button>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={urgencyStyles[demoCase.urgency]}>
                {demoCase.status}
              </Badge>
              <span className="font-mono text-xs text-slate-500">{demoCase.id}</span>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                {demoCase.type}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{demoCase.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {demoCase.summary}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Cupe4373CaseActions demoCase={demoCase} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)_310px]">
        <aside className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Case summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Desired outcome" value={demoCase.desiredOutcome} />
              <Field label="Location" value={demoCase.location} />
              <Field label="Continuity" value={demoCase.continuityState} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-slate-500" />
                Worker information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Worker" value={demoCase.worker} />
              <Field label="Unit" value={demoCase.unit} />
              <Field label="Representation lead" value={demoCase.assignedSteward} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-slate-500" />
                Key dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Opened" value={formatDateTime(demoCase.opened)} />
              <Field label="Last updated" value={formatDateTime(demoCase.updated)} />
              <Field label="Next deadline" value={formatDateTime(demoCase.deadline)} emphasize />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-slate-500" />
                Agreement references
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoCase.agreementRefs.map((item) => (
                <Link
                  key={item}
                  href={`/${locale}/dashboard/agreements?q=${encodeURIComponent(item)}`}
                  className="block rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item}
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-6">
          <Cupe4373CaseLifecycle demoCase={demoCase} />
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-xl">Chronology timeline</CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Every entry preserves the actor, action, evidence, and next follow-up so context survives shift changes, steward handoff, and meeting preparation.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">
                  Chronology current
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {chronology.map((entry, index) => (
                  <article key={entry.id} className="grid gap-4 p-5 md:grid-cols-[150px_1fr]">
                    <div className="text-sm">
                      <p className="font-medium text-slate-950">{formatDate(entry.timestamp)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatTime(entry.timestamp)}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-6 top-1 hidden h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow md:block" />
                      {index < chronology.length - 1 && (
                        <div className="absolute -left-[19px] top-5 hidden h-[calc(100%+20px)] w-px bg-slate-200 md:block" />
                      )}
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{entry.action}</p>
                            <p className="mt-1 text-xs font-medium text-slate-500">{entry.actor}</p>
                          </div>
                          {entry.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {entry.attachments.map((attachment) => (
                                <span
                                  key={attachment}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {attachment}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{entry.notes}</p>
                        <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm leading-5 text-blue-900">
                          <span className="font-medium">Follow-up: </span>
                          {entry.followUp}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderClock className="h-4 w-4 text-slate-500" />
                Upcoming deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                {demoCase.nextStep}
              </div>
              <Field label="Deadline" value={formatDateTime(demoCase.deadline)} emphasize />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-slate-500" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoCase.attachments.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm text-slate-700">
                  <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-slate-500" />
                Escalation flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoCase.flags.length > 0 ? (
                demoCase.flags.map((item) => (
                  <div key={item} className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {item}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No active escalation flags.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-slate-500" />
                Operational notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoCase.notes.map((item) => (
                <div key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Related cases
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {demoCase.relatedCases.length > 0 ? (
                demoCase.relatedCases.map((item) => (
                  <Link
                    key={item}
                    href={`/${locale}/dashboard/cases/${item}`}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {item}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">No related case linked.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <InboxIcon className="h-4 w-4 text-slate-500" />
                Linked inbox messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {linkedInbox.length > 0 ? (
                <>
                  {linkedInbox.map((item) => (
                    <Link
                      key={item.id}
                      href={`/${locale}/dashboard/inbox`}
                      className="block rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <p className="font-medium text-slate-900">{item.subject}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.from} · {item.channel}
                      </p>
                    </Link>
                  ))}
                </>
              ) : (
                <p className="text-sm text-slate-500">No inbox items linked to this case.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gavel className="h-4 w-4 text-slate-500" />
                Cited in governance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {citingDecisions.length > 0 ? (
                citingDecisions.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${locale}/dashboard/governance`}
                    className="block rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{d.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.id} · {d.body}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">Not yet cited as precedent.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gavel className="h-4 w-4 text-emerald-600" />
                Decisions logged (live)
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] uppercase tracking-wider text-emerald-700">
                  pipeline
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {liveDecisions.length > 0 ? (
                liveDecisions.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{d.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {d.priority}
                      </Badge>
                    </div>
                    {d.rationale && (
                      <p className="mt-1 text-xs text-slate-600">{d.rationale}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">
                      {d.status}
                      {d.owner ? ` · ${d.owner}` : ""}
                      {d.dueDate ? ` · due ${d.dueDate}` : ""}
                    </p>
                    {d.pipelineRunId && (
                      <p className="mt-1 font-mono text-[10px] text-slate-400 break-all">
                        run: {d.pipelineRunId}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No decisions logged yet — use “Log decision” above to record one.
                </p>
              )}
            </CardContent>
          </Card>

          {retention && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Retention policy
                  <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] uppercase tracking-wider text-indigo-700">
                    {retention.policy.actionOnExpiry}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{retention.policy.name}</p>
                  <p className="text-xs text-slate-600">
                    {retention.policy.retentionPeriodYears} years ·{" "}
                    {retention.policy.retentionTrigger.replace(/_/g, " ")}
                  </p>
                </div>
                {retention.eligibleAt ? (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Eligible for {retention.policy.actionOnExpiry}:{" "}
                    <span className="font-mono">{retention.eligibleAt.slice(0, 10)}</span>
                    {typeof retention.daysUntilEligible === "number" && (
                      <span className="ml-2 text-slate-500">
                        ({retention.daysUntilEligible >= 0
                          ? `in ${retention.daysUntilEligible} days`
                          : `${Math.abs(retention.daysUntilEligible)} days overdue`})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Retention clock starts at case closure ({retention.policy.retentionTrigger.replace(/_/g, " ")}).
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Last enforced:{" "}
                  {retention.lastEnforcedAt
                    ? new Date(retention.lastEnforcedAt).toLocaleString("en-CA")
                    : "never"}
                </p>
                {retention.policy.regulatoryReference && (
                  <p className="text-[11px] text-slate-500">
                    Reg: {retention.policy.regulatoryReference}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {priorityScore && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4 text-violet-600" />
                  Priority intelligence
                  <Badge
                    variant="outline"
                    className="border-violet-200 bg-violet-50 text-[10px] uppercase tracking-wider text-violet-700"
                  >
                    {priorityScore.predictedPriority}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    Score
                  </span>
                  <span className="font-mono text-base text-slate-900">
                    {(priorityScore.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span>urgency ({priorityScore.features.urgencyWeight.toFixed(2)})</span>
                    <span className="text-slate-500">× 0.40</span>
                  </div>
                  <div className="flex justify-between">
                    <span>status ({priorityScore.features.statusWeight.toFixed(2)})</span>
                    <span className="text-slate-500">× 0.25</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      impacted ({priorityScore.features.membersImpacted} →{" "}
                      {priorityScore.features.membersImpactedWeight.toFixed(2)})
                    </span>
                    <span className="text-slate-500">× 0.20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      arbitration kw (
                      {priorityScore.features.hasArbitrationKeyword ? "yes" : "no"})
                    </span>
                    <span className="text-slate-500">× 0.15</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Model: <span className="font-mono">{priorityScore.modelKey}</span> v
                  {priorityScore.modelVersion}
                </p>
                <p className="text-[11px] text-slate-500">
                  Computed:{" "}
                  {new Date(priorityScore.occurredAt).toLocaleString("en-CA")}
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 leading-5 ${emphasize ? "font-semibold text-slate-950" : "text-slate-700"}`}>
        {value}
      </p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
}
