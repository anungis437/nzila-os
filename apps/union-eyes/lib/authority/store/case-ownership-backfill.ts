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
 *   3. `executeOwnershipBackfill` recomputes the plan and the source revision of every finding, including
 *      quarantined rows. A changed candidate set or a changed deferred row refuses the write. A replay of an
 *      already executed plan hash returns that receipt and does not assign again. Each new assignment goes
 *      through `assignCase`: the issuer needs a live `case:assign` mandate, an active issuance rule, and
 *      conflict checks. Deferred findings are never assigned.
 *
 * Run it inside one transaction: any refused case rolls the whole backfill back, so a backfill is all or nothing.
 * Two executions for one organization take the same transaction advisory lock, then re-read each candidate's
 * legacy owner and live assignee count. A conflicting assignment or a changed legacy owner refuses the write.
 * The runtime grant on grievances is SELECT, so this does not take FOR UPDATE on those rows.
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
  /** Hash of every finding, including deferred rows. A deferred-only change invalidates an approval. */
  sourceRevision: string
}

const MAX_REFERENCE = 200

export function hashBackfillCandidates(organizationId: string, candidates: readonly BackfillCandidate[]): string {
  const canonical = [...candidates]
    .sort((a, b) => (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0))
    .map((c) => `${c.caseId}:${c.assigneeUserId}`)
    .join('\n')
  return createHash('sha256').update(`ue-case-ownership-backfill:v1\n${organizationId}\n${canonical}`).digest('hex')
}

/** Covers candidates and quarantined findings. Order-independent. Detail text is not part of the hash. */
export function hashOwnershipSource(organizationId: string, findings: readonly OwnershipFinding[]): string {
  const canonical = [...findings]
    .sort((a, b) => (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0))
    .map((f) => `${f.caseId}|${f.kind}|${f.legacyOwner ?? ''}|${[...f.kernelAssignees].sort().join(',')}`)
    .join('\n')
  return createHash('sha256').update(`ue-case-ownership-source:v1\n${organizationId}\n${canonical}`).digest('hex')
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
  return {
    organizationId,
    candidates,
    deferred,
    truncated: report.truncated,
    planHash: hashBackfillCandidates(organizationId, candidates),
    sourceRevision: hashOwnershipSource(organizationId, report.findings),
  }
}

export interface ExecuteBackfillInput {
  organizationId: string
  /** Holder of case:assign authority; every assignment is judged against this person, not the legacy column. */
  issuerUserId: string
  /** The plan hash a reviewer approved. */
  approvedPlanHash: string
  /** Hash of the full finding set, including quarantined rows, at the time of approval. */
  approvedSourceRevision: string
  /** The recorded institutional decision that approved the plan (minute, resolution or ticket reference). */
  decisionReference: string
  effectiveAt: Date
  limit?: number
}

interface BackfillReceipt {
  caseId: string
  assigneeUserId: string
  relationshipId: string
}

async function priorBackfillReceipt(exec: SqlExecutor, organizationId: string, planHash: string, decisionReference: string): Promise<BackfillReceipt[]> {
  const rows = (
    await exec.query<{ case_id: string | null; assignee: string | null; relationship_id: string | null }>(
      `SELECT details->>'resourceId' AS case_id, details->>'holder' AS assignee, resource_id::text AS relationship_id
         FROM public.audit_logs
        WHERE organization_id = $1::uuid
          AND action = 'authority.relationship.grant'
          AND details->>'source' = 'legacy_owner_column_backfill'
          AND details->>'planHash' = $2
          AND details->>'decisionReference' = $3`,
      [organizationId, planHash, decisionReference],
    )
  ).rows
  return rows
    .filter((row) => row.case_id && row.assignee && row.relationship_id)
    .map((row) => ({ caseId: String(row.case_id), assigneeUserId: String(row.assignee), relationshipId: String(row.relationship_id) }))
}

export async function executeOwnershipBackfill(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: ExecuteBackfillInput,
): Promise<{ assigned: BackfillReceipt[]; planHash: string; sourceRevision: string; replayed: boolean }> {
  if (!isUuid(input.organizationId)) throw new AuthorityStoreError('INVALID_CONTEXT', 'organizationId must be a uuid')
  const reference = input.decisionReference?.trim() ?? ''
  if (reference.length === 0 || reference.length > MAX_REFERENCE) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'a recorded decision reference of at most 200 characters is required')
  }
  if (!/^[0-9a-f]{64}$/.test(input.approvedPlanHash ?? '')) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'an approved plan hash is required')
  }
  if (!/^[0-9a-f]{64}$/.test(input.approvedSourceRevision ?? '')) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'an approved source revision is required')
  }
  await exec.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`, [`ue-ownership-backfill:${input.organizationId}`])
  const plan = await planOwnershipBackfill(exec, deps.memberships, input.organizationId, { limit: input.limit })
  if (plan.truncated) {
    throw new AuthorityStoreError('PRECONDITION', 'the plan exceeds the page limit; raise the limit and have the full plan approved')
  }
  const matches = plan.planHash === input.approvedPlanHash && plan.sourceRevision === input.approvedSourceRevision
  if (!matches) {
    const prior = await priorBackfillReceipt(exec, input.organizationId, input.approvedPlanHash, reference)
    const covered = new Set(prior.map((row) => row.caseId))
    if (prior.length > 0 && plan.candidates.every((candidate) => covered.has(candidate.caseId))) {
      return { assigned: prior, planHash: input.approvedPlanHash, sourceRevision: input.approvedSourceRevision, replayed: true }
    }
    if (plan.planHash !== input.approvedPlanHash) {
      throw new AuthorityStoreError('PRECONDITION', 'the candidate set changed since it was approved; review and approve the current plan')
    }
    throw new AuthorityStoreError('PRECONDITION', 'the historical source changed since it was approved; review and approve the current plan')
  }
  const assigned: BackfillReceipt[] = []
  for (const c of plan.candidates) {
    const current = (
      await exec.query<{ legacy: string | null; assignees: string }>(
        `SELECT g.union_rep_id::text AS legacy,
                (SELECT count(*)::text FROM ue_authority_resource_relationships r
                  WHERE r.organization_id = g.organization_id AND r.resource_type = 'case' AND r.resource_id = g.id
                    AND r.relation = 'assignee' AND r.revoked_at IS NULL) AS assignees
           FROM public.grievances g
          WHERE g.organization_id = $1::uuid AND g.id = $2::uuid`,
        [input.organizationId, c.caseId],
      )
    ).rows[0]
    if (!current || current.legacy !== c.assigneeUserId || Number(current.assignees) !== 0) {
      throw new AuthorityStoreError('PRECONDITION', 'a conflicting assignment or a changed legacy owner appeared before the write')
    }
    const relationshipId = await assignCase(exec, deps, {
      organizationId: input.organizationId,
      issuerUserId: input.issuerUserId,
      caseId: c.caseId,
      assigneeUserId: c.assigneeUserId,
      permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document', 'process_ocr'],
      effectiveAt: input.effectiveAt,
      auditDetails: {
        source: 'legacy_owner_column_backfill',
        decisionReference: reference,
        planHash: plan.planHash,
        sourceRevision: plan.sourceRevision,
      },
    })
    assigned.push({ caseId: c.caseId, assigneeUserId: c.assigneeUserId, relationshipId })
  }
  return { assigned, planHash: plan.planHash, sourceRevision: plan.sourceRevision, replayed: false }
}
