/**
 * Flow — Policy Enforcement
 *
 * Integrates platform-policy-engine for quote generation,
 * price override, quote export, PO generation, and manual payment
 * confirmation operations.
 * Org-aware: accepts OrgQuotePolicy for configurable thresholds.
 */
import type { PolicyEvaluationInput, PolicyDefinition } from '@nzila/platform-policy-engine'
import { evaluatePolicy, isBlocked } from '@nzila/platform-policy-engine'
import type { OrgQuotePolicy } from '@nzila/platform-commerce-org/types'
import { SHOPMOICA_QUOTE_POLICY } from '@nzila/platform-commerce-org/defaults'

export type QuoterPolicyAction =
  | 'quote_generation'
  | 'price_override'
  | 'quote_export'
  | 'po_generation'
  | 'manual_payment_confirmation'

function buildQuoterPolicies(orgQuotePolicy?: OrgQuotePolicy): PolicyDefinition[] {
  const threshold = orgQuotePolicy?.approvalThreshold ?? SHOPMOICA_QUOTE_POLICY.approvalThreshold
  return [
  {
    id: 'quoter-generation',
    name: 'Quote Generation Policy',
    description: 'Controls who can generate quotes and under what conditions',
    version: '1.0.0',
    type: 'access',
    enabled: true,
    scope: { resources: ['flow'] },
    rules: [
      {
        id: 'require-org',
        description: 'Require valid org context',
        conditions: [{ field: 'action', operator: 'eq', value: 'quote_generation' }],
        effect: 'allow',
        severity: 'critical',
      },
    ],
    metadata: {},
  },
  {
    id: 'quoter-price-override',
    name: 'Price Override Policy',
    description: 'Requires approval for price overrides above threshold',
    version: '1.0.0',
    type: 'approval',
    enabled: true,
    scope: { resources: ['flow'] },
    rules: [
      {
        id: 'override-approval',
        description: `Price overrides above $${threshold.toLocaleString()} require approval`,
        conditions: [
          { field: 'context.amount', operator: 'gt', value: threshold },
        ],
        effect: 'require_approval',
        severity: 'critical',
        requireApprovers: 1,
        approverRoles: ['admin', 'finance'],
      },
    ],
    metadata: {},
  },
  {
    id: 'quoter-export',
    name: 'Quote Export Policy',
    description: 'Controls quote export operations',
    version: '1.0.0',
    type: 'access',
    enabled: true,
    scope: { resources: ['flow'] },
    rules: [
      {
        id: 'export-audit',
        description: 'All exports must be audited',
        conditions: [{ field: 'action', operator: 'eq', value: 'quote_export' }],
        effect: 'allow',
        severity: 'warning',
      },
    ],
    metadata: {},
  },
  {
    id: 'quoter-po-generation',
    name: 'PO Generation Policy',
    description: 'Requires payment clearance and admin/finance role for PO generation',
    version: '1.0.0',
    type: 'approval',
    enabled: true,
    scope: { resources: ['flow'] },
    rules: [
      {
        id: 'po-payment-gate',
        description: 'PO generation requires payment clearance',
        conditions: [
          { field: 'action', operator: 'eq', value: 'po_generation' },
          { field: 'context.paymentCleared', operator: 'eq', value: false },
        ],
        effect: 'deny',
        severity: 'critical',
      },
      {
        id: 'po-role-gate',
        description: 'PO generation requires admin or finance role',
        conditions: [
          { field: 'action', operator: 'eq', value: 'po_generation' },
        ],
        effect: 'allow',
        severity: 'warning',
        requireApprovers: 1,
        approverRoles: ['admin', 'finance'],
      },
    ],
    metadata: {},
  },
  {
    id: 'quoter-manual-payment',
    name: 'Manual Payment Confirmation Policy',
    description: 'Manual payment confirmations require finance role and audit',
    version: '1.0.0',
    type: 'approval',
    enabled: true,
    scope: { resources: ['flow'] },
    rules: [
      {
        id: 'manual-payment-role',
        description: 'Manual payment confirmation requires finance role',
        conditions: [
          { field: 'action', operator: 'eq', value: 'manual_payment_confirmation' },
        ],
        effect: 'allow',
        severity: 'critical',
        requireApprovers: 1,
        approverRoles: ['admin', 'finance'],
      },
    ],
    metadata: {},
  },
]
}

export interface PolicyCheckResult {
  allowed: boolean
  action: QuoterPolicyAction
  reason?: string
  policyId?: string
}

export async function checkQuoterPolicy(
  action: QuoterPolicyAction,
  context: Record<string, unknown>,
  orgQuotePolicy?: OrgQuotePolicy,
): Promise<PolicyCheckResult> {
  const orgId = (context.orgId as string) ?? 'default'
  const policies = buildQuoterPolicies(orgQuotePolicy)
  const input: PolicyEvaluationInput = {
    policyId: '',
    action,
    resource: 'flow',
    actor: {
      userId: (context.userId as string) ?? 'system',
      roles: (context.roles as string[]) ?? [],
    },
    context,
    orgId,
    environment: (context.environment as string) ?? 'production',
  }

  const policy = policies.find((p) =>
    p.rules.some((r) => r.conditions.some((c) => c.value === action)),
  )

  if (!policy) {
    return { allowed: true, action }
  }

  const result = evaluatePolicy(policy, { ...input, policyId: policy.id })
  const blocked = isBlocked([result])

  return {
    allowed: !blocked,
    action,
    reason: blocked ? result.decisions[0]?.reason : undefined,
    policyId: policy.id,
  }
}
