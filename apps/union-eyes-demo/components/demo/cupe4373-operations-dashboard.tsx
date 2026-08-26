import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  Inbox as InboxIcon,
  MessageSquare,
  Target,
} from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import { Progress } from "@nzila/union-eyes-ui/progress";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373DoctrineFooter } from "@/components/demo/cupe4373-doctrine-footer";
import {
  broadcastHistory,
  calendarEvents,
  continuityIndicators,
  dashboardPriorityCards,
  decisionsOfRecord,
  demoCases,
  inboxItems,
  motions,
  statusBreakdown,
  trustSignals,
  workloadDistribution,
} from "@/lib/demo/cupe4373-demo";

type Props = {
  locale: string;
};

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Cupe4373OperationsDashboard({ locale }: Props) {
  const totalStatus = statusBreakdown.reduce((sum, item) => sum + item.count, 0);
  const urgentCases = demoCases.filter((item) => item.urgency === "urgent");
  const newInbox = inboxItems.filter((i) => i.status === "new").length;
  const scheduledMotions = motions.filter((m) => m.status === "scheduled-vote").length;
  const sentBroadcasts = broadcastHistory.length;

  const foundationSurfaces = [
    {
      href: `/${locale}/dashboard/inbox`,
      label: "Inbox",
      value: String(newInbox),
      detail: `${newInbox} new of ${inboxItems.length} · unified intake stream`,
      icon: InboxIcon,
    },
    {
      href: `/${locale}/dashboard/priorities`,
      label: "Priorities",
      value: String(urgentCases.length + calendarEvents.length),
      detail: "Commitments owed this cadence cycle",
      icon: Target,
    },
    {
      href: `/${locale}/dashboard/governance`,
      label: "Governance",
      value: String(decisionsOfRecord.length),
      detail: `${scheduledMotions} motion${scheduledMotions === 1 ? "" : "s"} scheduled for vote`,
      icon: Gavel,
    },
    {
      href: `/${locale}/dashboard/communications`,
      label: "Communications",
      value: String(sentBroadcasts),
      detail: "Bulletins on the operating record (30d)",
      icon: MessageSquare,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <section className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div>
            <p className="font-semibold text-blue-950">Suggested demo path</p>
            <p className="mt-0.5 text-xs leading-5 text-blue-800">
              Open the most urgent case <span className="font-mono">UE-4373-026</span>, scan the
              chronology and agreement refs, click <em>Prepare meeting package</em>, and download
              the brief. End at <em>Reports</em> to export the continuity package.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/${locale}/dashboard/cases/UE-4373-026`}>
              Start with UE-4373-026 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="bg-white">
            <Link href={`/${locale}/dashboard/reports`}>Continuity brief</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-300 text-slate-700">
                CUPE Local 4373 demo
              </Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                Healthcare labour operations
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Steward operations center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              A focused view of active cases, follow-ups, deadlines, and continuity context for a
              healthcare local where operational memory cannot depend on one person being available.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/${locale}/dashboard/cases`}>
                Review cases <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/dashboard/reports`}>Open continuity brief</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        {dashboardPriorityCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-semibold text-slate-950">{card.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{card.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{card.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section aria-label="Foundation operational surfaces" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Foundation surfaces
          </h2>
          <p className="text-xs text-slate-500">
            Inbox · Priorities · Governance · Communications
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {foundationSurfaces.map((surface) => {
            const Icon = surface.icon;
            return (
              <Link
                key={surface.href}
                href={surface.href}
                className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">{surface.label}</p>
                    <span className="text-lg font-semibold text-slate-900">{surface.value}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{surface.detail}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-700" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Escalation watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urgentCases.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/dashboard/cases/${item.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={urgencyStyles[item.urgency]}>
                        {item.status}
                      </Badge>
                      <span className="text-xs font-mono text-slate-500">{item.id}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-slate-950">{item.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{item.nextStep}</p>
                  </div>
                  <div className="shrink-0 text-left text-xs text-slate-500 md:text-right">
                    <p className="font-medium text-slate-700">{item.assignedSteward}</p>
                    <p>Due {new Date(item.deadline).toLocaleDateString("en-CA")}</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Continuity risk indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {continuityIndicators.map((item) => (
              <div key={item} className="flex gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workload distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workloadDistribution.map((item) => (
              <div key={item.steward} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{item.steward}</span>
                  <span className="text-slate-500">{item.open} open</span>
                </div>
                <Progress value={item.open * 8} className="h-2" />
                <p className="text-xs text-slate-500">{item.urgent} urgent follow-up{item.urgent === 1 ? "" : "s"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Case status breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusBreakdown.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="font-medium text-slate-900">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${item.color}`} style={{ width: `${(item.count / totalStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operational trust</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trustSignals.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
                  <Icon className="h-4 w-4 text-slate-600" />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </div>
              );
            })}
            <div className="rounded-md bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              <FileText className="mr-2 inline h-3.5 w-3.5" />
              Chronology and documents support steward judgment. The system preserves context and leaves representation decisions with accountable stewards.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <Clock className="h-4 w-4 text-slate-500" />
          <span>Demo path: dashboard opens here, cases carry the narrative, and the case chronology shows how operational context survives handoff.</span>
        </div>
      </section>

      <Cupe4373DoctrineFooter
        reviewerOfRecord="Chief Steward (Denise Laurent) for operational reads; Executive for strategic posture"
        escalation="Anything that resists the cadence rolls into the next labour-management or executive meeting"
        context="All counts and breakdowns derive from the visible case roster, calendar, and operating record. No member scoring, no productivity ranking."
      />
    </div>
  );
}
