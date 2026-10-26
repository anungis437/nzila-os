/**
 * Authority Kernel — entry point.
 *
 *   decide(request, facts, resourceFacts, now) → Decision
 *
 * Pure and deterministic. Never throws: any internal failure, missing fact or
 * contradiction yields a deny Decision (fail closed). The clock is an explicit
 * argument so every decision is reproducible from its inputs.
 */
import { deny } from './common'
import type {
  AuthorityFacts,
  AuthorityRequest,
  Decision,
  ResourceFacts,
  ResourceType,
} from './ontology'
import { decideCase } from './policies/case'
import { decideFinancialTransaction, decideMemberFinancialRecord } from './policies/finance'
import { decideApproval, decideReview } from './policies/governance'
import { decideWorkAid } from './policies/workaid'

const ACTION_RESOURCE: Record<string, readonly ResourceType[]> = {
  case: ['case'],
  finance: ['financial_transaction', 'member_financial_record'],
  governance: ['approval_request'],
  review: ['governance_review'],
  workaid: ['workaid_matter'],
}

function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length
}

export function decide(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  resource: ResourceFacts | null | undefined,
  now: Date,
): Decision {
  try {
    return evaluate(req, facts, resource, now)
  } catch (error) {
    return deny(req, now, {
      code: 'FACTS_CONTRADICTORY',
      detail: `evaluation failed closed: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
}

function evaluate(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  resource: ResourceFacts | null | undefined,
  now: Date,
): Decision {
  // The counsel boundary needs no facts and admits no override.
  if (req.action === 'workaid:read_counsel_material') {
    return deny(req, now, {
      code: 'COUNSEL_CONTROLLED',
      detail: 'counsel-controlled material is not accessible to union principals; authority rests with counsel',
    })
  }

  if (!facts.principal.authenticated) return deny(req, now, { code: 'PRINCIPAL_NOT_AUTHENTICATED' })
  if (facts.principal.userId !== req.principalUserId) return deny(req, now, { code: 'PRINCIPAL_MISMATCH' })

  if (!resource) return deny(req, now, { code: 'RESOURCE_FACTS_MISSING' })
  if (req.organizationId !== req.resource.organizationId || req.organizationId !== resource.organizationId) {
    return deny(req, now, { code: 'FOREIGN_TENANT', detail: 'resource belongs to a different organization than the active context' })
  }
  if (resource.id !== req.resource.id || resource.kind !== req.resource.type) {
    return deny(req, now, { code: 'RESOURCE_FACTS_MISMATCH' })
  }
  const family = req.action.split(':')[0]
  if (!ACTION_RESOURCE[family]?.includes(req.resource.type)) {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} does not apply to ${req.resource.type}` })
  }

  // Authoritative rows must belong to the active tenant and be internally
  // consistent. A loader that returns anything else is broken; deny rather
  // than guess which row to trust.
  const org = req.organizationId
  const foreign =
    facts.mandates.some((m) => m.organizationId !== org) ||
    facts.relationships.some((r) => r.organizationId !== org) ||
    facts.delegations.some((d) => d.organizationId !== org) ||
    facts.recusals.some((r) => r.organizationId !== org) ||
    facts.consents.some((c) => c.organizationId !== org)
  if (foreign) {
    return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'facts include rows from another organization' })
  }
  if (
    !distinct(facts.mandates.map((m) => m.id)) ||
    !distinct(facts.relationships.map((r) => r.id)) ||
    !distinct(facts.delegations.map((d) => d.id)) ||
    !distinct(facts.consents.map((c) => c.id))
  ) {
    return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'duplicate authority rows' })
  }
  const own = facts.memberships.filter((m) => m.userId === req.principalUserId && m.organizationId === org)
  if (own.length > 1) return deny(req, now, { code: 'FACTS_CONTRADICTORY', detail: 'duplicate membership rows' })

  switch (resource.kind) {
    case 'case':
      return decideCase(req, facts, resource, now)
    case 'financial_transaction':
      return decideFinancialTransaction(req, facts, resource, now)
    case 'member_financial_record':
      return decideMemberFinancialRecord(req, facts, resource, now)
    case 'approval_request':
      return decideApproval(req, facts, resource, now)
    case 'governance_review':
      return decideReview(req, facts, resource, now)
    case 'workaid_matter':
      return decideWorkAid(req, facts, resource, now)
  }
}
