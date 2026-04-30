import type { DomainRule } from '../../core/types'

export const labourRules: DomainRule[] = [
  {
    id: 'LAB-CTX-001',
    domain: 'labour',
    evaluate: (context) => {
      if (context.actor.role === 'viewer' && context.action.sensitivity !== 'low') {
        return {
          level: 'BLOCK',
          reason: 'Viewer role cannot execute sensitive labour actions.',
          policyId: 'LAB-CTX-001',
          policyVersion: 'v1',
          auditSeverity: 'high',
        }
      }
      return null
    },
  },
  {
    id: 'LAB-CTX-002',
    domain: 'labour',
    evaluate: (context) => {
      if (context.metadata.anomalyScore >= 0.85 && context.action.sensitivity === 'critical') {
        return {
          level: 'BLOCK',
          reason: 'Critical labour operation blocked due to anomaly risk.',
          policyId: 'LAB-CTX-002',
          policyVersion: 'v1',
          auditSeverity: 'critical',
        }
      }
      return null
    },
  },
  {
    id: 'LAB-CTX-003',
    domain: 'labour',
    evaluate: (context) => {
      const frequentOverrides = context.metadata.overrideHistory.filter((entry) =>
        entry.policyId.startsWith('LAB-'),
      ).length
      if (frequentOverrides >= 3) {
        return {
          level: 'CHALLENGE',
          reason: 'Repeated labour overrides require explicit justification.',
          policyId: 'LAB-CTX-003',
          policyVersion: 'v1',
          requiresJustification: true,
          requiresApproval: context.action.sensitivity === 'critical',
          auditSeverity: 'high',
        }
      }
      return null
    },
  },
]
