import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { SummaryCard } from '@/components/ui/summary-card'
import { AlertTriangle, BrainCircuit, FileCheck2, ShieldCheck, Activity } from 'lucide-react'
import Link from 'next/link'
import { getKTDecisionIntelligenceSnapshot } from '../_kt-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Decision Intelligence — Nzila OS Control Plane',
  description:
    'Institutional decision command layer: situation appraisal, root-cause analysis, decision science, and continuity-aware governance rationale.',
}

export default async function DecisionIntelligencePage() {
  const snapshot = await getKTDecisionIntelligenceSnapshot()

  const openSituations = snapshot.situationAssessments.filter((s) => s.status !== 'resolved').length
  const activeProblems = snapshot.problemAnalyses.filter((p) => p.status !== 'closed').length
  const decisionsUnderReview = snapshot.decisionAnalyses.filter((d) => d.status === 'under-review').length

  return (
    <div className="space-y-8">
      <PageHeader
        title="Decision Intelligence"
        description="Kepner-Tregoe reasoning infrastructure for explainable governance, continuity preservation, and procurement-grade decision traceability."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Open Situations"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={openSituations}
        />
        <SummaryCard
          title="Active Problem Analyses"
          icon={<BrainCircuit className="h-5 w-5" />}
          value={activeProblems}
        />
        <SummaryCard
          title="Decisions In Review"
          icon={<ShieldCheck className="h-5 w-5" />}
          value={decisionsUnderReview}
        />
        <SummaryCard
          title="Sealed Evidence Packs"
          icon={<FileCheck2 className="h-5 w-5" />}
          value={snapshot.evidencePacks.filter((p) => p.sealed).length}
        />
        <SummaryCard
          title="Continuity Risk"
          icon={<Activity className="h-5 w-5" />}
          value={snapshot.continuitySignal.overallRiskScore}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Institutional Reasoning Surfaces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured decision science connected to replayable governance, evidence chains, and continuity telemetry.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Link href="/governance/problem-analysis" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Problem Analysis</p>
            <p className="mt-1 text-xs text-muted-foreground">Forensic IS / IS NOT deviation analysis.</p>
          </Link>
          <Link href="/governance/decision-matrices" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Decision Matrices</p>
            <p className="mt-1 text-xs text-muted-foreground">MUST/WANT weighted alternatives with rationale.</p>
          </Link>
          <Link href="/governance/risk-analysis" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Risk Analysis</p>
            <p className="mt-1 text-xs text-muted-foreground">Pre-mortem and opportunity posture.</p>
          </Link>
          <Link href="/governance/continuity-drift" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Continuity Drift</p>
            <p className="mt-1 text-xs text-muted-foreground">Institutional MRI with drift and fragility indicators.</p>
          </Link>
          <Link href="/governance/history" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Governance History</p>
            <p className="mt-1 text-xs text-muted-foreground">Replayable lineage of operational governance.</p>
          </Link>
          <Link href="/governance/replay" className="rounded-md border border-border p-4 transition-colors hover:bg-muted/40">
            <p className="text-sm font-medium text-foreground">Governance Replay</p>
            <p className="mt-1 text-xs text-muted-foreground">Rationale playback with rejected paths and accepted risks.</p>
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Situation Appraisal Priority Matrix</h2>
          <StatusBadge
            status={snapshot.continuitySignal.overallRiskScore >= 65 ? 'degraded' : 'healthy'}
            label={snapshot.continuitySignal.overallRiskScore >= 65 ? 'Elevated continuity risk' : 'Continuity risk within threshold'}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Concern</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Category</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Urgency</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Impact</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Priority</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Trend</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.situationAssessments
                .slice()
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{s.concern}</td>
                    <td className="px-3 py-2 capitalize">{s.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.urgency}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.impact}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.priorityScore}</td>
                    <td className="px-3 py-2 capitalize">{s.trend}</td>
                    <td className="px-3 py-2">{s.ownerId}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
