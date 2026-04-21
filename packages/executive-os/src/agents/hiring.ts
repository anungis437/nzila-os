/**
 * Hiring — open roles, pipeline, time-to-fill.
 *
 * - Roles open past target days-to-fill → critical
 * - Roles with zero applications → pipeline gap
 * - Applications in "new" state >N days → review backlog
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export interface OpenRole {
  id: string
  title: string
  department?: string | null
  postedDaysAgo: number
  applicationsCount: number
  closingInDays?: number | null // negative = already past close date
}

export interface ApplicationBacklog {
  applicationId: string
  roleTitle: string
  status: 'new' | 'reviewing' | 'interview' | 'offer' | 'rejected' | 'hired'
  daysInStatus: number
}

export interface HiringSignal {
  openRoles: ReadonlyArray<OpenRole>
  applications: ReadonlyArray<ApplicationBacklog>
  /** Target days-to-fill beyond which a role is "stale". Default 45. */
  targetDaysToFill?: number
  /** Days an application can sit in "new" before we flag. Default 5. */
  newApplicationSlaDays?: number
}

export const hiringAgent: ExecutiveAgent<HiringSignal> = {
  key: 'hiring',
  name: 'Hiring',
  domain: 'people',
  mission: 'Every open role has a live pipeline; every application has a timely response.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const signal: HiringSignal = req.input ?? { openRoles: [], applications: [] }
    const targetDtf = signal.targetDaysToFill ?? 45
    const newSla = signal.newApplicationSlaDays ?? 5

    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []

    const staleRoles = signal.openRoles.filter((r) => r.postedDaysAgo > targetDtf)
    if (staleRoles.length > 0) {
      insights.push({
        domain: 'people',
        title: `${staleRoles.length} role${staleRoles.length === 1 ? '' : 's'} open >${targetDtf}d`,
        body: staleRoles
          .slice(0, 8)
          .map((r) => `- ${r.title}${r.department ? ` (${r.department})` : ''} — ${r.postedDaysAgo}d`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { roleIds: staleRoles.map((r) => r.id) },
        recommendedNextStep: 'Re-post, widen channels, or close the requisition.',
      })
    }

    const empty = signal.openRoles.filter((r) => r.applicationsCount === 0 && r.postedDaysAgo >= 7)
    if (empty.length > 0) {
      insights.push({
        domain: 'people',
        title: `${empty.length} role${empty.length === 1 ? '' : 's'} with zero applications after 7d`,
        body: empty.slice(0, 8).map((r) => `- ${r.title}`).join('\n'),
        severity: 'warn',
        confidence: 0.85,
        evidence: { roleIds: empty.map((r) => r.id) },
        recommendedNextStep: 'Review JD, comp band, and posting channels.',
      })
    }

    const expired = signal.openRoles.filter((r) => r.closingInDays != null && r.closingInDays < 0)
    if (expired.length > 0) {
      insights.push({
        domain: 'people',
        title: `${expired.length} role${expired.length === 1 ? '' : 's'} past closing date but still open`,
        body: expired.slice(0, 8).map((r) => `- ${r.title}`).join('\n'),
        severity: 'critical',
        confidence: 0.95,
        evidence: { roleIds: expired.map((r) => r.id) },
        recommendedNextStep: 'Extend the closing date or close the posting.',
      })
      actions.push({
        actionClass: 'recommendation',
        title: 'Resolve expired job postings',
        payload: { roleIds: expired.map((r) => r.id) },
        requiresApproval: true,
        confidence: 0.9,
        riskLevel: 'low',
      })
    }

    const appBacklog = signal.applications.filter(
      (a) => a.status === 'new' && a.daysInStatus > newSla,
    )
    if (appBacklog.length > 0) {
      insights.push({
        domain: 'people',
        title: `${appBacklog.length} application${appBacklog.length === 1 ? '' : 's'} unreviewed >${newSla}d`,
        body: appBacklog
          .slice(0, 8)
          .map((a) => `- ${a.roleTitle} (${a.daysInStatus}d)`)
          .join('\n'),
        severity: 'warn',
        confidence: 0.9,
        evidence: { applicationIds: appBacklog.map((a) => a.applicationId) },
        recommendedNextStep: 'Review or auto-reject within SLA to respect candidates.',
      })
    }

    const summary =
      insights.length === 0
        ? 'Hiring pipeline healthy.'
        : `${insights.length} hiring signal${insights.length === 1 ? '' : 's'}.`
    return { summary, insights, actions }
  },
}
