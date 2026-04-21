/**
 * Controller agent — month-end close watchdog.
 */
import type {
  ExecutiveAgent,
  AgentInsight,
  AgentAction,
  AgentResult,
} from '../contract.js'

export interface OpenClosePeriod {
  periodId: string
  periodLabel: string
  endDate: string
  status: 'open' | 'in_progress' | 'pending_approval'
  daysSincePeriodEnd: number
}

export interface OverdueCloseTask {
  taskId: string
  periodLabel: string
  taskName: string
  assignedTo?: string | null
  daysOverdue: number
}

export interface OpenCloseException {
  exceptionId: string
  periodLabel: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  ageDays: number
}

export interface ControllerSignal {
  openPeriods: OpenClosePeriod[]
  overdueTasks: OverdueCloseTask[]
  openExceptions: OpenCloseException[]
  closeSlaDays?: number
}

const DEFAULT_SLA = 10

export const controllerAgent: ExecutiveAgent<ControllerSignal> = {
  key: 'controller',
  name: 'Controller',
  domain: 'finance',
  mission: 'Keep the month-end close on time, complete, and evidence-clean.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No close signal available.', insights, actions }

    const sla = sig.closeSlaDays ?? DEFAULT_SLA

    const stale = sig.openPeriods.filter((p) => p.daysSincePeriodEnd > sla)
    for (const p of stale) {
      insights.push({
        domain: 'finance',
        title: `${p.periodLabel} close is ${p.daysSincePeriodEnd} days past period end`,
        body: `Status: ${p.status}. SLA is ${sla} days.`,
        severity: p.daysSincePeriodEnd > sla * 2 ? 'critical' : 'warn',
        confidence: 1,
        recommendedNextStep: 'Review remaining tasks and unblock owners.',
      })
    }

    const ranked = [...sig.overdueTasks].sort((a, b) => b.daysOverdue - a.daysOverdue)
    if (ranked.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${ranked.length} close tasks overdue`,
        body: ranked
          .slice(0, 8)
          .map((t) => `${t.periodLabel} · ${t.taskName} · ${t.daysOverdue}d (${t.assignedTo ?? 'unassigned'})`)
          .join('\n'),
        severity: ranked[0]!.daysOverdue > 7 ? 'critical' : 'warn',
        confidence: 1,
      })
      for (const t of ranked.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Chase: ${t.taskName} (${t.periodLabel})`,
          description: `Overdue ${t.daysOverdue} days. Owner: ${t.assignedTo ?? 'unassigned'}.`,
          riskLevel: t.daysOverdue > 7 ? 'high' : 'medium',
          confidence: 0.9,
          requiresApproval: true,
        })
      }
    }

    const critical = sig.openExceptions.filter((e) => e.severity === 'critical')
    const high = sig.openExceptions.filter((e) => e.severity === 'high')
    if (critical.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${critical.length} CRITICAL close exceptions open`,
        body: critical.map((e) => `${e.periodLabel} · ${e.title} (${e.ageDays}d)`).join('\n'),
        severity: 'critical',
        confidence: 1,
      })
      for (const e of critical) {
        actions.push({
          actionClass: 'recommendation',
          title: `Escalate exception: ${e.title}`,
          description: `${e.periodLabel} · open ${e.ageDays} days.`,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }
    if (high.length > 0) {
      insights.push({
        domain: 'finance',
        title: `${high.length} high-severity exceptions open`,
        body: high.map((e) => `${e.periodLabel} · ${e.title} (${e.ageDays}d)`).join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const summary =
      stale.length === 0 && ranked.length === 0 && critical.length === 0
        ? 'Close on track. No overdue tasks, no critical exceptions.'
        : `Close needs attention: ${stale.length} stale period(s), ${ranked.length} overdue task(s), ${critical.length} critical exception(s).`
    return { summary, insights, actions }
  },
}
