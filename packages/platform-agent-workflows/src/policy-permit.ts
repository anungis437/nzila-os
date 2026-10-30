/**
 * A policy ALLOW is authoritative only when produced by a separately trusted
 * host policy authority. Agent-created { result:'allow' } JSON has no standing.
 *
 * The host resolver must authenticate the invoker and enforce revocation;
 * this port is NEVER an agent-selectable argument in production wiring.
 */
import type { AgentWorkflow } from './types'

export interface PolicyPermitRequest {
  workflowId: string
  stepId: string
  app: string
  orgId: string
  policyId: string
  executingAgentId: string
}

export interface TrustedPolicyDecision {
  verdict: 'ALLOW' | 'DENY' | 'REQUIRES_APPROVAL'
  decisionRef: string
  authoritySource: string
  issuedAt: string
  expiresAt: string
  boundWorkflowId: string
  boundStepId: string
  boundApp: string
  boundOrgId: string
  boundPolicyId: string
}

export interface TrustedPolicyAuthority {
  resolve(request: Readonly<PolicyPermitRequest>): Promise<TrustedPolicyDecision>
}

export interface VerifiedPolicyPermit {
  readonly request: Readonly<PolicyPermitRequest>
  readonly decision: Readonly<TrustedPolicyDecision>
}

const minted = new WeakSet<object>()
const MAX_POLICY_LIFETIME_MS = 5 * 60_000

export async function verifyOutcomePolicy(
  request: PolicyPermitRequest,
  trustedHostAuthority: TrustedPolicyAuthority,
  now = new Date(),
): Promise<VerifiedPolicyPermit> {
  if (!trustedHostAuthority || typeof trustedHostAuthority.resolve !== 'function') {
    throw new Error('Trusted policy authority unavailable')
  }
  if (Object.values(request).some(v => typeof v !== 'string' || !v ||
      v.length > 256 || /[\u0000-\u001f]/.test(v))) {
    throw new Error('Policy request identity and scope are required')
  }
  const result = await trustedHostAuthority.resolve(Object.freeze({ ...request }))
  const issued = Date.parse(result.issuedAt)
  const expiry = Date.parse(result.expiresAt)
  if (result.verdict !== 'ALLOW' ||
      !result.decisionRef || !result.authoritySource ||
      !Number.isFinite(issued) || !Number.isFinite(expiry) ||
      issued > now.getTime() + 30_000 ||
      expiry <= now.getTime() ||
      expiry > issued + MAX_POLICY_LIFETIME_MS ||
      result.boundWorkflowId !== request.workflowId ||
      result.boundStepId !== request.stepId ||
      result.boundApp !== request.app ||
      result.boundOrgId !== request.orgId ||
      result.boundPolicyId !== request.policyId) {
    throw new Error('Trusted policy ALLOW was not established')
  }
  const permit = Object.freeze({
    request: Object.freeze({ ...request }),
    decision: Object.freeze({ ...result }),
  })
  minted.add(permit)
  return permit
}

export function isVerifiedPolicyPermitFor(
  permit: unknown,
  workflow: AgentWorkflow,
  stepId: string,
  policyId: string,
  now = new Date(),
): permit is VerifiedPolicyPermit {
  if (!permit || typeof permit !== 'object' || !minted.has(permit)) return false
  const p = permit as VerifiedPolicyPermit
  return p.request.workflowId === workflow.id &&
    p.request.stepId === stepId &&
    p.request.app === workflow.app &&
    p.request.orgId === workflow.orgId &&
    p.request.policyId === policyId &&
    Date.parse(p.decision.expiresAt) > now.getTime()
}
