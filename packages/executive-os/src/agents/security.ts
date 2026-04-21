/**
 * Security agent
 *
 * Supply-chain + runtime security hygiene. Reads a curated signal the
 * host builds from the audit tool (`tooling/security/supply-chain-policy`),
 * Trivy, and waiver tables.
 *
 * Focus: separate shipped-with-waiver findings from raw findings, and
 * escalate expired/expiring waivers.
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface VulnFinding {
  advisoryId: string
  packageName: string
  severity: VulnSeverity
  affectedRange?: string
  introducedViaPath?: string
  waived: boolean
  waiverExpiresAt?: string // ISO
  daysUntilWaiverExpires?: number
  /** Assigned remediation owner. Ownerless high/critical is a governance gap. */
  owner?: string | null
  /** Due date for remediation (any state). Past-due + unresolved → overdue. */
  daysUntilDue?: number
  /** Finding status. If set, only 'open' and 'in_progress' participate in active queues. */
  status?: 'open' | 'in_progress' | 'accepted_risk' | 'resolved' | 'suppressed'
}

export interface SecuritySignal {
  findings: VulnFinding[]
  waiverWarnDays?: number // default 14
  lastScanAt?: string
  scanStaleDays?: number // default 7
}

const DEFAULT_WAIVER_WARN = 14
const DEFAULT_SCAN_STALE = 7

export const securityAgent: ExecutiveAgent<SecuritySignal> = {
  key: 'security',
  name: 'Security',
  domain: 'platform',
  mission: 'No unknown critical exposures in production; every waiver has a paper trail and a clock.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No security signal available.', insights, actions }

    const warnDays = sig.waiverWarnDays ?? DEFAULT_WAIVER_WARN
    const staleDays = sig.scanStaleDays ?? DEFAULT_SCAN_STALE

    const unwaived = sig.findings.filter((f) => !f.waived)
    const unwaivedCrit = unwaived.filter((f) => f.severity === 'critical')
    const unwaivedHigh = unwaived.filter((f) => f.severity === 'high')

    if (unwaivedCrit.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${unwaivedCrit.length} CRITICAL vulnerabilit${unwaivedCrit.length === 1 ? 'y' : 'ies'} unwaived`,
        body: unwaivedCrit
          .slice(0, 10)
          .map((f) => `${f.advisoryId} · ${f.packageName}${f.affectedRange ? ` @ ${f.affectedRange}` : ''}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Patch today or file an approved waiver with remediation plan.',
      })
      for (const f of unwaivedCrit.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Remediate critical: ${f.advisoryId} (${f.packageName})`,
          description: f.affectedRange ? `Affected: ${f.affectedRange}` : undefined,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    if (unwaivedHigh.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${unwaivedHigh.length} HIGH vulnerabilit${unwaivedHigh.length === 1 ? 'y' : 'ies'} unwaived`,
        body: unwaivedHigh
          .slice(0, 10)
          .map((f) => `${f.advisoryId} · ${f.packageName}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const expiring = sig.findings.filter(
      (f) =>
        f.waived &&
        f.daysUntilWaiverExpires !== undefined &&
        f.daysUntilWaiverExpires >= 0 &&
        f.daysUntilWaiverExpires <= warnDays,
    )
    const expired = sig.findings.filter(
      (f) => f.waived && f.daysUntilWaiverExpires !== undefined && f.daysUntilWaiverExpires < 0,
    )

    if (expired.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${expired.length} waiver(s) EXPIRED — findings are now live`,
        body: expired
          .map((f) => `${f.advisoryId} · ${f.packageName} · expired ${Math.abs(f.daysUntilWaiverExpires!)}d ago`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Patch, renew waiver, or remove dependency.',
      })
    }
    if (expiring.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${expiring.length} waiver(s) expiring within ${warnDays}d`,
        body: expiring
          .map((f) => `${f.advisoryId} · ${f.packageName} · ${f.daysUntilWaiverExpires}d`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    if (sig.lastScanAt) {
      const ageDays = (req.now ? req.now.getTime() : Date.now()) - new Date(sig.lastScanAt).getTime()
      const days = Math.floor(ageDays / 86_400_000)
      if (days > staleDays) {
        insights.push({
          domain: 'platform',
          title: `Security scan stale (${days}d)`,
          body: `Last scan: ${sig.lastScanAt}. Pipeline should run every ${staleDays}d.`,
          severity: 'warn',
          confidence: 1,
          recommendedNextStep: 'Run `tooling/security/supply-chain-policy check-vulns` and publish.',
        })
      }
    }

    // Overdue = due date passed and status unresolved.
    const overdue = unwaived.filter(
      (f) =>
        f.daysUntilDue !== undefined &&
        f.daysUntilDue < 0 &&
        (!f.status || f.status === 'open' || f.status === 'in_progress'),
    )
    if (overdue.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${overdue.length} finding(s) past due date`,
        body: overdue
          .slice(0, 10)
          .map(
            (f) =>
              `${f.advisoryId} · ${f.packageName} · ${f.severity} · ${Math.abs(f.daysUntilDue!)}d late${f.owner ? ` · ${f.owner}` : ' · unowned'}`,
          )
          .join('\n'),
        severity: overdue.some((f) => f.severity === 'critical' || f.severity === 'high') ? 'critical' : 'warn',
        confidence: 1,
        recommendedNextStep: 'Escalate to owner; re-estimate remediation or file a waiver.',
      })
    }

    // Ownerless high/critical findings — explicit governance gap.
    const ownerlessHigh = unwaived.filter(
      (f) => (f.severity === 'high' || f.severity === 'critical') && !f.owner,
    )
    if (ownerlessHigh.length > 0) {
      insights.push({
        domain: 'platform',
        title: `${ownerlessHigh.length} high/critical finding(s) have no owner`,
        body: ownerlessHigh
          .slice(0, 10)
          .map((f) => `${f.advisoryId} · ${f.packageName} · ${f.severity}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
        recommendedNextStep: 'Assign an owner; ownerless findings silently age out.',
      })
      for (const f of ownerlessHigh.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Assign owner for ${f.advisoryId}`,
          description: `${f.packageName} · ${f.severity} · no owner.`,
          riskLevel: f.severity === 'critical' ? 'critical' : 'high',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const ok =
      unwaivedCrit.length === 0 &&
      unwaivedHigh.length === 0 &&
      expired.length === 0 &&
      expiring.length === 0 &&
      overdue.length === 0 &&
      ownerlessHigh.length === 0
    const summary = ok
      ? 'Security posture clean.'
      : `Security: ${unwaivedCrit.length} crit, ${unwaivedHigh.length} high, ${expired.length} expired waivers, ${expiring.length} expiring, ${overdue.length} overdue, ${ownerlessHigh.length} ownerless.`
    return { summary, insights, actions }
  },
}
