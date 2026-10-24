/**
 * Authority store — governed backfill of case ownership from the legacy primary-representative column on grievances.
 *
 * The legacy column is not an authority source (see case-ownership.ts). Turning its values into kernel
 * assignments is an institutional decision about which recorded owners are genuine, so this module never acts on
 * its own reading of the column:
 *
 *   1. `planOwnershipBackfill` is read-only. It lists the cases whose legacy owner is an eligible, active
 *      representative with no kernel assignment, defers every other drift kind to a person, and hashes the exact
 *      candidate set.
 *   2. A person with authority reviews that plan and approves its hash, naming the decision that approves it.
 *   3. `executeOwnershipBackfill` recomputes the plan, refuses if it differs from the approved hash, refuses a
 *      truncated plan, and then makes each assignment through `assignCase`: the issuer needs `case:assign`
 *      authority, an active issuance rule, and conflict checks, exactly as for any other assignment.
 *
 * Run it inside one transaction: any refused case rolls the whole backfill back, so a backfill is all or nothing.
 */
import { createHash } from 'node:crypto'
import type { EnforcementDeps } from './enforce'
import type { MembershipSource } from './facts'
import { AuthorityStoreError, isUuid, type SqlExecutor } from './executor'
import { reconcileCaseOwnership, type OwnershipFinding } from './case-ownership'
import { assignCase } from './lifecycle'

export interface BackfillCandidate {
  caseId: string
  assigneeUserId: string
}

export interface OwnershipBackfillPlan {
  organizationId: string
  candidates: BackfillCandidate[]
  /** Cases the backfill will not touch because the legacy value needs a human decision first. */
  deferred: OwnershipFinding[]
  truncated: boolean
  planHash: string
}

const MAX_REFERENCE = 200

export function hashBackfillCandidates(organizationId: string, candidates: readonly BackfillCandidate[]): string {
  const canonical = [...candidates]
    .sort((a, b) => (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0))
    .map((c) => `${c.caseId}:${c.assigneeUserId}`)
    .join('\n')
  return createHash('sha256').update(`ue-case-ownership-backfill:v1\n${organizationId}\n${canonical}`).digest('hex')
}

export async function planOwnershipBackfill(
  exec: SqlExecutor,
  memberships: MembershipSource,
  organizationId: string,
  options: { limit?: number } = {},
): Promise<OwnershipBackfillPlan> {
  const report = await reconcileCaseOwnership(exec, memberships, organizationId, options)
  const candidates = report.findings
    .filter((f) => f.kind === 'backfill_candidate' && f.legacyOwner !== null)
    .map((f) => ({ caseId: f.caseId, assigneeUserId: f.legacyOwner as string }))
  const deferred = report.findings.filter((f) => f.kind !== 'backfill_candidate')
  return { organizationId, candidates, deferred, truncated: report.truncated, planHash: hashBackfillCandidates(organizationId, candidates) }
}

export interface ExecuteBackfillInput {
  organizationId: string
  /** Holder of case:assign authority; every assignment is judged against this person, not the legacy column. */
  issuerUserId: string
  /** The plan hash a reviewer approved. */
  approvedPlanHash: string
  /** The recorded institutional decision that approved the plan (minute, resolution or ticket reference). */
  decisionReference: string
  effectiveAt: Date
  limit?: number
}

export async function executeOwnershipBackfill(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: ExecuteBackfillInput,
): Promise<{ assigned: { caseId: string; assigneeUserId: string; relationshipId: string }[]; planHash: string }> {
  if (!isUuid(input.organizationId)) throw new AuthorityStoreError('INVALID_CONTEXT', 'organizationId must be a uuid')
  const reference = input.decisionReference?.trim() ?? ''
  if (reference.length === 0 || reference.length > MAX_REFERENCE) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'a recorded decision reference of at most 200 characters is required')
  }
  if (!/^[0-9a-f]{64}$/.test(input.approvedPlanHash ?? '')) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'an approved plan hash is required')
  }
  const plan = await planOwnershipBackfill(exec, deps.memberships, input.organizationId, { limit: input.limit })
  if (plan.truncated) {
    throw new AuthorityStoreError('PRECONDITION', 'the plan exceeds the page limit; raise the limit and have the full plan approved')
  }
  if (plan.planHash !== input.approvedPlanHash) {
    throw new AuthorityStoreError('PRECONDITION', 'the candidate set changed since it was approved; review and approve the current plan')
  }
  const assigned: { caseId: string; assigneeUserId: string; relationshipId: string }[] = []
  for (const c of plan.candidates) {
    const relationshipId = await assignCase(exec, deps, {
      organizationId: input.organizationId,
      issuerUserId: input.issuerUserId,
      caseId: c.caseId,
      assigneeUserId: c.assigneeUserId,
      permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'],
      effectiveAt: input.effectiveAt,
      auditDetails: { source: 'legacy_owner_column_backfill', decisionReference: reference, planHash: plan.planHash },
    })
    assigned.push({ caseId: c.caseId, assigneeUserId: c.assigneeUserId, relationshipId })
  }
  return { assigned, planHash: plan.planHash }
}
