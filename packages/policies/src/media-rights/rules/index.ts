import type { DomainRule } from '../../core/types'

export const mediaRightsRules: DomainRule[] = [
  {
    id: 'MED-CTX-001',
    domain: 'media-rights',
    evaluate: (context) => {
      const withinRightsWindow = Boolean(context.payload?.['withinRightsWindow'])
      if (!withinRightsWindow && context.action.type.includes('publish')) {
        return {
          level: 'BLOCK',
          reason: 'Publishing outside licensed rights window is forbidden.',
          policyId: 'MED-CTX-001',
          policyVersion: 'v1',
          auditSeverity: 'critical',
        }
      }
      return null
    },
  },
  {
    id: 'MED-CTX-002',
    domain: 'media-rights',
    evaluate: (context) => {
      const payoutDeltaPct = Number(context.payload?.['payoutDeltaPct'] ?? 0)
      const approved = Boolean(context.payload?.['producerApproved'])
      if (Math.abs(payoutDeltaPct) >= 10 && !approved) {
        return {
          level: 'CHALLENGE',
          reason: 'Material payout change requires producer sign-off.',
          policyId: 'MED-CTX-002',
          policyVersion: 'v1',
          requiresApproval: true,
          requiresJustification: true,
          auditSeverity: 'high',
        }
      }
      return null
    },
  },
  {
    id: 'MED-CTX-003',
    domain: 'media-rights',
    evaluate: (context) => {
      if (context.metadata.overrideHistory.some((entry) => entry.policyId.startsWith('MED-'))) {
        return {
          level: 'WARN',
          reason: 'Prior media-rights overrides detected for this session.',
          policyId: 'MED-CTX-003',
          policyVersion: 'v1',
          auditSeverity: 'medium',
        }
      }
      return null
    },
  },
]
