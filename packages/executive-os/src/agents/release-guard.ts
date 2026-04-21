/**
 * Release Guard agent
 *
 * Protects production velocity without protecting it recklessly.
 *  - pending change requests past scheduled start (missed window)
 *  - changes missing approvers or rollback plan
 *  - high-risk changes with incomplete implementation checklist
 *  - stale PR-equivalent: changes in `proposed` status > N days
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract'

export type ChangeStatus =
  | 'proposed'
  | 'under_review'
  | 'approved'
  | 'scheduled'
  | 'implementing'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'closed'

export interface ChangeRecord {
  changeId: string
  changeNumber: string
  title: string
  status: ChangeStatus
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  approversRequired: number
  approversReceived: number
  hasRollbackPlan: boolean
  checklistTotal: number
  checklistDone: number
  scheduledStart?: string
  ageDays: number
}

export interface ReleaseGuardSignal {
  changes: ChangeRecord[]
  staleProposedDays?: number
}

const DEFAULT_STALE = 7

export const releaseGuardAgent: ExecutiveAgent<ReleaseGuardSignal> = {
  key: 'release-guard',
  name: 'Release Guard',
  domain: 'platform',
  mission: 'Ship fast without shipping unsafe; enforce change-management hygiene.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No release-guard signal available.', insights, actions }

    const staleDays = sig.staleProposedDays ?? DEFAULT_STALE

    const missingApprovers = sig.changes.filter(
      (c) =>
        ['under_review', 'proposed'].includes(c.status) &&
        c.approversReceived < c.approversRequired,
    )
    if (missingApprovers.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${missingApprovers.length} change(s) missing approvers`,
        body: missingApprovers
          .map((c) => `${c.changeNumber} · ${c.title} · ${c.approversReceived}/${c.approversRequired} approvers`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const noRollback = sig.changes.filter(
      (c) =>
        !c.hasRollbackPlan &&
        (c.riskLevel === 'high' || c.riskLevel === 'critical') &&
        !['closed', 'completed', 'rolled_back'].includes(c.status),
    )
    if (noRollback.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${noRollback.length} high-risk change(s) missing rollback plan`,
        body: noRollback
          .map((c) => `${c.changeNumber} · ${c.riskLevel} · ${c.title}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Block implementation until rollback is documented.',
      })
      for (const c of noRollback) {
        actions.push({
          actionClass: 'recommendation',
          title: `Require rollback plan: ${c.changeNumber}`,
          description: `${c.riskLevel} risk, no rollback plan documented.`,
          riskLevel: 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const checklistIncomplete = sig.changes.filter(
      (c) =>
        ['scheduled', 'implementing'].includes(c.status) &&
        c.checklistTotal > 0 &&
        c.checklistDone < c.checklistTotal,
    )
    if (checklistIncomplete.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${checklistIncomplete.length} active change(s) with incomplete checklist`,
        body: checklistIncomplete
          .map((c) => `${c.changeNumber} · ${c.checklistDone}/${c.checklistTotal} · ${c.title}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const stale = sig.changes.filter((c) => c.status === 'proposed' && c.ageDays > staleDays)
    if (stale.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${stale.length} proposed change(s) stale > ${staleDays}d`,
        body: stale
          .map((c) => `${c.changeNumber} · ${c.ageDays}d · ${c.title}`)
          .join('\n'),
        severity: 'info',
        confidence: 0.9,
        recommendedNextStep: 'Decide: schedule, park, or close.',
      })
    }

    const ok =
      missingApprovers.length === 0 &&
      noRollback.length === 0 &&
      checklistIncomplete.length === 0 &&
      stale.length === 0
    const summary = ok
      ? 'Release pipeline clean.'
      : `Release Guard: ${noRollback.length} no-rollback, ${missingApprovers.length} unapproved, ${checklistIncomplete.length} incomplete, ${stale.length} stale.`
    return { summary, insights, actions }
  },
}
