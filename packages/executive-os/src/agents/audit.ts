/**
 * Audit agent — evidence-pack and audit-log hygiene.
 *
 * - Evidence packs: unverified chain, broken chain (critical), expired packs,
 *   draft packs past their seal window
 * - Audit events: chain gaps (missing previousHash linkage)
 * - Control-family coverage: flag families with zero packs in the trailing window
 */
import type {
  ExecutiveAgent,
  AgentAction,
  AgentInsight,
  AgentResult,
} from '../contract.js'

export type PackStatus = 'draft' | 'sealed' | 'verified' | 'expired'
export type ChainIntegrity = 'VERIFIED' | 'UNVERIFIED' | 'BROKEN'
export type ControlFamily =
  | 'access'
  | 'change-mgmt'
  | 'incident-response'
  | 'dr-bcp'
  | 'integrity'
  | 'sdlc'
  | 'retention'

export interface EvidencePackSummary {
  packId: string
  controlFamily: ControlFamily
  eventType: string
  status: PackStatus
  chainIntegrity: ChainIntegrity
  allHashesVerified: boolean
  artifactCount: number
  ageDays: number
  verifiedAt?: string
}

export interface AuditSignal {
  packs: EvidencePackSummary[]
  // Known control families that the org SHOULD produce evidence for
  requiredFamilies?: ControlFamily[]
  // trailing window used for coverage check (default 90d)
  coverageWindowDays?: number
  // integrity-check metrics
  auditEventsLast30d?: number
  auditEventsChainGaps?: number
  // sealed-within-days SLA
  draftSealSlaDays?: number
}

const DEFAULT_COVERAGE = 90
const DEFAULT_SEAL_SLA = 14

export const auditAgent: ExecutiveAgent<AuditSignal> = {
  key: 'audit',
  name: 'Audit',
  domain: 'governance',
  mission: 'Keep the evidence chain unbroken; no control family without a paper trail.',
  version: '0.1.0',

  async run(req): Promise<AgentResult> {
    const insights: AgentInsight[] = []
    const actions: AgentAction[] = []
    const sig = req.input
    if (!sig) return { summary: 'No audit signal available.', insights, actions }

    const coverageDays = sig.coverageWindowDays ?? DEFAULT_COVERAGE
    const sealSla = sig.draftSealSlaDays ?? DEFAULT_SEAL_SLA

    const broken = sig.packs.filter((p) => p.chainIntegrity === 'BROKEN')
    if (broken.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${broken.length} evidence pack${broken.length > 1 ? 's' : ''} with BROKEN hash chain`,
        body: broken
          .slice(0, 10)
          .map((p) => `${p.packId} · ${p.controlFamily} · ${p.eventType}`)
          .join('\n'),
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Open incident; re-hash artifacts and re-seal, or investigate tampering.',
      })
      for (const p of broken.slice(0, 5)) {
        actions.push({
          actionClass: 'recommendation',
          title: `Investigate broken chain: ${p.packId}`,
          description: `${p.controlFamily} · ${p.eventType}`,
          riskLevel: 'critical',
          confidence: 1,
          requiresApproval: true,
        })
      }
    }

    const unverifiedSealed = sig.packs.filter(
      (p) => p.status === 'sealed' && p.chainIntegrity !== 'VERIFIED',
    )
    if (unverifiedSealed.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${unverifiedSealed.length} sealed pack(s) awaiting chain verification`,
        body: unverifiedSealed
          .slice(0, 10)
          .map((p) => `${p.packId} · ${p.controlFamily}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
      })
    }

    const staleDrafts = sig.packs.filter(
      (p) => p.status === 'draft' && p.ageDays > sealSla,
    )
    if (staleDrafts.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${staleDrafts.length} draft pack(s) past ${sealSla}d seal SLA`,
        body: staleDrafts
          .slice(0, 10)
          .map((p) => `${p.packId} · ${p.ageDays}d · ${p.controlFamily}`)
          .join('\n'),
        severity: 'warn',
        confidence: 1,
        recommendedNextStep: 'Seal or delete; no indefinite drafts.',
      })
    }

    const expired = sig.packs.filter((p) => p.status === 'expired')
    if (expired.length > 0) {
      insights.push({
        domain: 'governance',
        title: `${expired.length} pack(s) expired past retention`,
        body: expired.slice(0, 10).map((p) => `${p.packId} · ${p.controlFamily}`).join('\n'),
        severity: 'info',
        confidence: 1,
      })
    }

    if ((sig.auditEventsChainGaps ?? 0) > 0) {
      insights.push({
        domain: 'governance',
        title: `${sig.auditEventsChainGaps} audit-event chain gap${sig.auditEventsChainGaps! > 1 ? 's' : ''} detected`,
        body: `In last ${sig.auditEventsLast30d ?? '?'} events. previousHash linkage is missing or mismatched.`,
        severity: 'critical',
        confidence: 1,
        recommendedNextStep: 'Investigate immediately — chain gaps invalidate non-repudiation.',
      })
    }

    if (sig.requiredFamilies && sig.requiredFamilies.length > 0) {
      const present = new Set(
        sig.packs
          .filter((p) => p.ageDays <= coverageDays)
          .map((p) => p.controlFamily),
      )
      const missing = sig.requiredFamilies.filter((f) => !present.has(f))
      if (missing.length > 0) {
        insights.push({
          domain: 'governance',
          title: `${missing.length} control famil${missing.length > 1 ? 'ies' : 'y'} without evidence in last ${coverageDays}d`,
          body: missing.join(', '),
          severity: 'warn',
          confidence: 0.9,
          recommendedNextStep: 'Schedule control test or evidence capture for each gap.',
        })
      }
    }

    const ok =
      broken.length === 0 &&
      unverifiedSealed.length === 0 &&
      staleDrafts.length === 0 &&
      (sig.auditEventsChainGaps ?? 0) === 0
    const summary = ok
      ? 'Audit trail healthy.'
      : `Audit: ${broken.length} broken, ${unverifiedSealed.length} unverified, ${staleDrafts.length} stale draft, ${sig.auditEventsChainGaps ?? 0} chain gap(s).`
    return { summary, insights, actions }
  },
}
