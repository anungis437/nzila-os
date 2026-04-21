/**
 * Legal agent — corporate filings & compliance calendar hygiene.
 *
 * - Overdue filings (pending past dueDate) → critical
 * - Filings due within warn window (default 14d) → warn
 * - Overdue compliance tasks → critical
 * - Blocked compliance tasks → warn
 * - Governance actions stuck in pending_approval > stuck window (default 14d)
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export type FilingStatus = 'pending' | 'submitted' | 'accepted'
export type FilingKind =
  | 'annual_return'
  | 'director_change'
  | 'address_change'
  | 'articles_amendment'
  | 'other'

export interface FilingRecord {
  filingId: string
  kind: FilingKind
  status: FilingStatus
  dueDate: string // ISO date
  daysUntilDue: number // negative = overdue
}

export type ComplianceTaskStatus = 'open' | 'done' | 'blocked'
export type ComplianceTaskKind = 'year_end' | 'month_close' | 'governance'

export interface ComplianceTaskRecord {
  taskId: string
  title: string
  kind: ComplianceTaskKind
  status: ComplianceTaskStatus
  dueDate: string
  daysUntilDue: number
  hasEvidence: boolean
}

export type GovernanceActionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'rejected'

export interface GovernanceActionRecord {
  actionId: string
  actionType: string
  status: GovernanceActionStatus
  ageDays: number
}

export interface LegalSignal {
  filings: FilingRecord[]
  tasks: ComplianceTaskRecord[]
  governanceActions: GovernanceActionRecord[]
  warnDays?: number // filings/tasks due-soon (default 14)
  stuckApprovalDays?: number // governance actions stuck in pending_approval (default 14)
}

const DEFAULT_WARN = 14
const DEFAULT_STUCK = 14

export const legalAgent: ExecutiveAgent<LegalSignal> = {
  key: 'legal',
  name: 'Legal',
  domain: 'governance',
  mission: 'No late filings, no orphaned compliance tasks, no stalled governance decisions.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No legal signal available.', insights, actions }

    const warnDays = sig.warnDays ?? DEFAULT_WARN
    const stuckDays = sig.stuckApprovalDays ?? DEFAULT_STUCK

    const overdueFilings = sig.filings.filter(
      (f) => f.status === 'pending' && f.daysUntilDue < 0,
    )
    const dueSoonFilings = sig.filings.filter(
      (f) => f.status === 'pending' && f.daysUntilDue >= 0 && f.daysUntilDue <= warnDays,
    )

    if (overdueFilings.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${overdueFilings.length} overdue statutory filing${overdueFilings.length > 1 ? 's' : ''}`,
        body: overdueFilings
          .map((f) => `${f.kind} · due ${f.dueDate} · ${Math.abs(f.daysUntilDue)}d overdue`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'File today; check for penalty interest.',
      })
      for (const f of overdueFilings) {
        actions.push({
          actionClass: 'recommendation',
          title: `File overdue: ${f.kind}`,
          description: `Due ${f.dueDate}, ${Math.abs(f.daysUntilDue)}d overdue.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    if (dueSoonFilings.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${dueSoonFilings.length} filing(s) due within ${warnDays}d`,
        body: dueSoonFilings
          .map((f) => `${f.kind} · ${f.dueDate} · ${f.daysUntilDue}d`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const overdueTasks = sig.tasks.filter(
      (t) => t.status === 'open' && t.daysUntilDue < 0,
    )
    const blockedTasks = sig.tasks.filter((t) => t.status === 'blocked')
    const openNoEvidence = sig.tasks.filter(
      (t) => t.status === 'done' && !t.hasEvidence,
    )

    if (overdueTasks.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${overdueTasks.length} overdue compliance task${overdueTasks.length > 1 ? 's' : ''}`,
        body: overdueTasks
          .slice(0, 10)
          .map((t) => `${t.kind} · ${t.title} · ${Math.abs(t.daysUntilDue)}d overdue`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
      })
    }
    if (blockedTasks.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${blockedTasks.length} compliance task(s) blocked`,
        body: blockedTasks.slice(0, 10).map((t) => `${t.kind} · ${t.title}`).join('\n'),
        severity: 'warn',
        confidence: 1,
        recommendedNextStep: 'Unblock or escalate — blocks compound into audit findings.',
      })
    }
    if (openNoEvidence.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${openNoEvidence.length} completed task(s) missing evidence document`,
        body: openNoEvidence.slice(0, 10).map((t) => t.title).join('\n'),
        severity: 'warn',
        confidence: 0.9,
        recommendedNextStep: 'Attach evidence document or re-open task.',
      })
    }

    const stuck = sig.governanceActions.filter(
      (g) => g.status === 'pending_approval' && g.ageDays > stuckDays,
    )
    if (stuck.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${stuck.length} governance action(s) stuck in approval > ${stuckDays}d`,
        body: stuck.map((g) => `${g.actionType} · ${g.ageDays}d`).join('\n'),
        severity: 'warn',
        confidence: 1,
        recommendedNextStep: 'Chase approvers or withdraw the action.',
      })
    }

    const ok =
      overdueFilings.length === 0 &&
      dueSoonFilings.length === 0 &&
      overdueTasks.length === 0 &&
      blockedTasks.length === 0 &&
      openNoEvidence.length === 0 &&
      stuck.length === 0
    const summary = ok
      ? 'Legal calendar clear.'
      : `Legal: ${overdueFilings.length} overdue filing(s), ${overdueTasks.length} overdue task(s), ${blockedTasks.length} blocked, ${stuck.length} stuck approval(s).`
    return { summary, insights, actions }
  },
}
