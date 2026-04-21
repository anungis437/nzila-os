/**
 * Grants agent
 *
 * Non-dilutive capital pipeline: grant deadlines, reporting obligations,
 * and drawdown coverage. We do NOT calculate eligibility — we enforce
 * calendar hygiene and reporting discipline.
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract.js'

export type GrantStage =
  | 'prospecting'
  | 'drafting'
  | 'submitted'
  | 'awarded'
  | 'reporting'
  | 'closed'
  | 'rejected'

export interface Grant {
  grantId: string
  program: string // e.g. SR&ED, NSERC, Prompt
  stage: GrantStage
  amount: number
  currency?: string
  applicationDueDate?: string
  daysUntilAppDue?: number
  reportDueDate?: string
  daysUntilReportDue?: number
  awardedAt?: string
  drawnDownAmount?: number
  owner?: string | null
}

export interface GrantsSignal {
  grants: Grant[]
  reportingWindowDays?: number // default 30
  submissionWindowDays?: number // default 45
}

const DEFAULT_REPORT_WIN = 30
const DEFAULT_SUBMIT_WIN = 45

export const grantsAgent: ExecutiveAgent<GrantsSignal> = {
  key: 'grants',
  name: 'Grants',
  domain: 'revenue',
  mission: 'Never miss a grant deadline; draw down what we have been awarded.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No grants signal available.', insights, actions }

    const rWin = sig.reportingWindowDays ?? DEFAULT_REPORT_WIN
    const sWin = sig.submissionWindowDays ?? DEFAULT_SUBMIT_WIN

    const draftingDueSoon = sig.grants.filter(
      (g) =>
        g.stage === 'drafting' &&
        g.daysUntilAppDue !== undefined &&
        g.daysUntilAppDue >= 0 &&
        g.daysUntilAppDue <= sWin,
    )
    const missedApplications = sig.grants.filter(
      (g) => g.stage === 'drafting' && g.daysUntilAppDue !== undefined && g.daysUntilAppDue < 0,
    )

    if (missedApplications.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${missedApplications.length} grant application(s) MISSED`,
        body: missedApplications
          .map((g) => `${g.program} · due ${g.applicationDueDate} (${Math.abs(g.daysUntilAppDue!)}d ago) · owner ${g.owner ?? 'unassigned'}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Document miss; identify next cycle or alternative program.',
      })
    }

    if (draftingDueSoon.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${draftingDueSoon.length} grant application(s) due in ${sWin}d`,
        body: draftingDueSoon
          .map((g) => `${g.program} · $${g.amount.toLocaleString()} · due ${g.applicationDueDate} (${g.daysUntilAppDue}d) · ${g.owner ?? 'unassigned'}`)
          .join('\n'),
        severity: draftingDueSoon.some((g) => (g.daysUntilAppDue ?? 99) <= 7) ? 'warn' : 'info',
        confidence: 1,
      })
      for (const g of draftingDueSoon.filter((g) => !g.owner)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Assign owner for ${g.program} application`,
          description: `Due in ${g.daysUntilAppDue} days. $${g.amount.toLocaleString()}.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const reportDue = sig.grants.filter(
      (g) =>
        g.stage === 'reporting' &&
        g.daysUntilReportDue !== undefined &&
        g.daysUntilReportDue <= rWin,
    )
    const missedReports = reportDue.filter((g) => (g.daysUntilReportDue ?? 0) < 0)
    if (missedReports.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${missedReports.length} grant report(s) LATE`,
        body: missedReports
          .map((g) => `${g.program} · report due ${g.reportDueDate} (${Math.abs(g.daysUntilReportDue!)}d ago)`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'File immediately; late reports trigger clawback on many programs.',
      })
      for (const g of missedReports) {
        actions.push({
          actionClass: 'recommendation',
          title: `URGENT: file ${g.program} report`,
          description: `${Math.abs(g.daysUntilReportDue!)}d late.`,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }
    const upcomingReports = reportDue.filter((g) => (g.daysUntilReportDue ?? 0) >= 0)
    if (upcomingReports.length > 0) {
      insights.push({
        domain: 'revenue',
        title: `${upcomingReports.length} grant report(s) due in ${rWin}d`,
        body: upcomingReports
          .map((g) => `${g.program} · report due ${g.reportDueDate} (${g.daysUntilReportDue}d)`)
          .join('\n'),
        severity: upcomingReports.some((g) => (g.daysUntilReportDue ?? 99) <= 7) ? 'warn' : 'info',
        confidence: 1,
      })
    }

    const underdrawn = sig.grants.filter(
      (g) =>
        (g.stage === 'awarded' || g.stage === 'reporting') &&
        g.drawnDownAmount !== undefined &&
        g.drawnDownAmount < g.amount * 0.5,
    )
    if (underdrawn.length > 0) {
      const unutilized = underdrawn.reduce((s, g) => s + (g.amount - (g.drawnDownAmount ?? 0)), 0)
      insights.push({
        domain: 'revenue',
        title: `${underdrawn.length} awarded grant(s) < 50% drawn · $${unutilized.toLocaleString()} unused`,
        body: underdrawn
          .map((g) => `${g.program} · $${(g.drawnDownAmount ?? 0).toLocaleString()} / $${g.amount.toLocaleString()}`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.8,
        recommendedNextStep: 'Schedule drawdown or reallocate to eligible spend.',
      })
    }

    const ok =
      missedApplications.length === 0 &&
      draftingDueSoon.length === 0 &&
      missedReports.length === 0 &&
      upcomingReports.length === 0 &&
      underdrawn.length === 0
    const summary = ok
      ? 'Grants calendar clean.'
      : `Grants: ${missedApplications.length} missed apps, ${draftingDueSoon.length} upcoming apps, ${missedReports.length} late reports, ${underdrawn.length} underdrawn.`
    return { summary, insights, actions }
  },
}
