import type { DomainRule } from '../../core/types'

export const legalRules: DomainRule[] = [
  {
    id: 'LEG-CTX-001',
    domain: 'legal',
    evaluate: (context) => {
      const citationCount = Number(context.payload?.['citationCount'] ?? 0)
      if (citationCount < 1 && context.action.sensitivity !== 'low') {
        return {
          level: 'BLOCK',
          reason: 'Legal action requires citation evidence.',
          policyId: 'LEG-CTX-001',
          policyVersion: 'v1',
          auditSeverity: 'critical',
        }
      }
      return null
    },
  },
  {
    id: 'LEG-CTX-002',
    domain: 'legal',
    evaluate: (context) => {
      const riskLevel = String(context.payload?.['riskLevel'] ?? 'low')
      const reviewed = Boolean(context.payload?.['humanReviewed'])
      if ((riskLevel === 'high' || riskLevel === 'critical') && !reviewed) {
        return {
          level: 'CHALLENGE',
          reason: 'High-risk legal action requires human legal review.',
          policyId: 'LEG-CTX-002',
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
    id: 'LEG-CTX-003',
    domain: 'legal',
    evaluate: (context) => {
      if (context.metadata.anomalyScore >= 0.8) {
        return {
          level: 'WARN',
          reason: 'Anomaly score indicates elevated legal governance risk.',
          policyId: 'LEG-CTX-003',
          policyVersion: 'v1',
          auditSeverity: 'medium',
        }
      }
      return null
    },
  },
]
