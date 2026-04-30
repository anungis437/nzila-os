import type { DomainRule } from '../../core/types'

export const commerceRules: DomainRule[] = [
  {
    id: 'COM-CTX-001',
    domain: 'commerce',
    evaluate: (context) => {
      const nextPrice = Number(context.payload?.['nextPrice'] ?? 0)
      const floorPrice = Number(context.payload?.['floorPrice'] ?? 0)
      if (nextPrice > 0 && floorPrice > 0 && nextPrice < floorPrice) {
        return {
          level: 'BLOCK',
          reason: 'Pricing floor breach detected.',
          policyId: 'COM-CTX-001',
          policyVersion: 'v1',
          auditSeverity: 'critical',
        }
      }
      return null
    },
  },
  {
    id: 'COM-CTX-002',
    domain: 'commerce',
    evaluate: (context) => {
      const plannedSpend = Number(context.payload?.['plannedSpend'] ?? 0)
      const threshold = Number(context.payload?.['approvalThreshold'] ?? 5000)
      const approved = Boolean(context.payload?.['budgetApproved'])
      if (plannedSpend > threshold && !approved) {
        return {
          level: 'CHALLENGE',
          reason: 'High-spend commerce action requires budget approval.',
          policyId: 'COM-CTX-002',
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
    id: 'COM-CTX-003',
    domain: 'commerce',
    evaluate: (context) => {
      if (context.metadata.anomalyScore >= 0.7 && context.action.sensitivity !== 'low') {
        return {
          level: 'WARN',
          reason: 'Commerce operation flagged by anomaly model.',
          policyId: 'COM-CTX-003',
          policyVersion: 'v1',
          auditSeverity: 'medium',
        }
      }
      return null
    },
  },
]
