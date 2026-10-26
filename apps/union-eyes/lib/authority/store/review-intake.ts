/**
 * Member review intake and the oversight list.
 *
 * Any active member may open a complaint, appeal or reconsideration. The opener
 * and the complainant are the authenticated principal. Opening a review confers
 * no oversight power and sends no notice: no review-notification policy is adopted.
 *
 * The list has two closed sets. `own` is reviews this principal opened or filed,
 * excluding a row that names them as adverse. `oversight` loads only reviews
 * named on this principal's live monitor mandates, then keeps a row only when
 * `review:monitor` allows that exact review. A missing mandate, a foreign
 * organization, a recusal, a complainant or an adverse party produces an empty
 * oversight list. The response never carries respondent identifiers.
 */
import { assessMandate } from '../common'
import { decide } from '../kernel'
import type { AuthorityRequest, GovernanceReviewFacts } from '../ontology'
import { AuthorityStoreError, bindSessionActor, isPrincipalId, isUuid, parsePgTextArray, type SqlExecutor } from './executor'
import type { EnforcementDeps } from './enforce'
import { loadAuthorityFacts } from './facts'
import { requirePrincipals, requireUuids } from './mutations'
import { REVIEW_INTAKE_TYPES, type ReviewIntakeType } from '../review-intake-types'
import { registerReview } from './workflow'

type Row = Record<string, unknown>

export { REVIEW_INTAKE_TYPES, type ReviewIntakeType }

const NOTIFICATION = { notificationDelivered: false, notificationPolicy: 'not_adopted' } as const

export interface OwnReview {
  id: string
  reviewType: string
  status: 'open' | 'closed'
  openedAt: Date
  participation: 'opened' | 'complainant'
}

export interface OversightReview {
  id: string
  reviewType: string
  status: 'open' | 'closed'
  openedAt: Date
  classification: 'standard' | 'privileged'
  complainantUserId: string | null
}

export interface ReviewIntakeList {
  own: OwnReview[]
  oversight: OversightReview[]
  notificationDelivered: false
  notificationPolicy: 'not_adopted'
}

function clock(deps: { now?: () => Date }): Date {
  return (deps.now ?? (() => new Date()))()
}

function asStatus(value: unknown): 'open' | 'closed' | null {
  return value === 'open' || value === 'closed' ? value : null
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value))
}

async function requireActiveMember(exec: SqlExecutor, deps: EnforcementDeps, organizationId: string, userId: string): Promise<void> {
  const rows = (await deps.memberships(exec, organizationId, [userId])).filter(
    (row) => row.userId === userId && row.organizationId === organizationId,
  )
  if (rows.length !== 1 || rows[0].status !== 'active') {
    throw new AuthorityStoreError('DENIED', 'NOT_AN_ACTIVE_MEMBER: only an active member may open or read a review')
  }
}

function normaliseAdverse(actorUserId: string, adverseUserIds: readonly string[] | undefined): string[] {
  const ids = [...(adverseUserIds ?? [])]
  if (ids.length > 8) throw new AuthorityStoreError('INVALID_CONTEXT', 'ADVERSE_LIST_TOO_LONG: name at most eight people')
  const seen = new Set<string>()
  for (const id of ids) {
    if (!isPrincipalId(id)) throw new AuthorityStoreError('INVALID_CONTEXT', 'ADVERSE_ID_INVALID: expected an internal principal id')
    if (id === actorUserId) throw new AuthorityStoreError('INVALID_CONTEXT', 'SELF_ADVERSE: you cannot name yourself')
    if (seen.has(id)) throw new AuthorityStoreError('INVALID_CONTEXT', 'ADVERSE_ID_DUPLICATE: each person is named once')
    seen.add(id)
  }
  return ids
}

export async function openMemberReview(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: { organizationId: string; actorUserId: string; reviewType: string; adverseUserIds?: readonly string[] },
): Promise<{ id: string; reviewType: ReviewIntakeType; status: 'open'; notificationDelivered: false; notificationPolicy: 'not_adopted' }> {
  requireUuids(input.organizationId)
  requirePrincipals(input.actorUserId)
  if (!REVIEW_INTAKE_TYPES.includes(input.reviewType as ReviewIntakeType)) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'REVIEW_TYPE_NOT_ALLOWED: choose a complaint, an appeal or a reconsideration')
  }
  const reviewType = input.reviewType as ReviewIntakeType
  const adverseUserIds = normaliseAdverse(input.actorUserId, input.adverseUserIds)
  await bindSessionActor(exec, input.actorUserId, 'review opener')
  await requireActiveMember(exec, deps, input.organizationId, input.actorUserId)
  const id = await registerReview(exec, deps, {
    organizationId: input.organizationId,
    openedBy: input.actorUserId,
    complainantUserId: input.actorUserId,
    reviewType,
    adverseUserIds,
    classification: 'standard',
  })
  return { id, reviewType, status: 'open', ...NOTIFICATION }
}

export async function listMemberReviewIntake(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: { organizationId: string; actorUserId: string },
): Promise<ReviewIntakeList> {
  requireUuids(input.organizationId)
  requirePrincipals(input.actorUserId)
  await bindSessionActor(exec, input.actorUserId, 'review reader')
  await requireActiveMember(exec, deps, input.organizationId, input.actorUserId)
  const now = clock(deps)
  const ownRows = (
    await exec.query<Row>(
      `SELECT id::text AS id, review_type, status, created_at, opened_by, complainant_user_id
         FROM ue_authority_reviews
        WHERE organization_id = $1::uuid
          AND (opened_by = $2 OR complainant_user_id = $2)
          AND NOT ($2 = ANY(adverse_user_ids))
        ORDER BY created_at DESC, id`,
      [input.organizationId, input.actorUserId],
    )
  ).rows
  const own: OwnReview[] = []
  for (const row of ownRows) {
    const status = asStatus(row.status)
    if (!status || !isUuid(row.id)) continue
    own.push({
      id: String(row.id),
      reviewType: String(row.review_type),
      status,
      openedAt: asDate(row.created_at),
      participation: String(row.opened_by) === input.actorUserId ? 'opened' : 'complainant',
    })
  }

  const facts = await loadAuthorityFacts(exec, deps.memberships, {
    organizationId: input.organizationId,
    principalUserId: input.actorUserId,
    authenticated: true,
    now,
  })
  const candidateIds = new Set<string>()
  for (const mandate of facts.mandates) {
    if (mandate.principalUserId !== input.actorUserId || mandate.kind !== 'governance_review') continue
    if (!assessMandate(mandate, input.organizationId, now).effective) continue
    if (!mandate.powers.includes('monitor')) continue
    for (const id of mandate.scope.resourceIds ?? []) if (isUuid(id)) candidateIds.add(id)
  }
  const oversight: OversightReview[] = []
  if (candidateIds.size > 0) {
    const rows = (
      await exec.query<Row>(
        `SELECT id::text AS id, review_type, status, created_at, complainant_user_id, adverse_user_ids, classification
           FROM ue_authority_reviews
          WHERE organization_id = $1::uuid AND id = ANY($2::uuid[])
          ORDER BY created_at DESC, id`,
        [input.organizationId, [...candidateIds]],
      )
    ).rows
    for (const row of rows) {
      const status = asStatus(row.status)
      if (!status || !isUuid(row.id)) continue
      const resource: GovernanceReviewFacts = {
        kind: 'governance_review',
        id: String(row.id),
        organizationId: input.organizationId,
        adverseUserIds: parsePgTextArray(row.adverse_user_ids),
        complainantUserId: (row.complainant_user_id as string | null) ?? null,
        classification: row.classification === 'privileged' ? 'privileged' : 'standard',
        remediationOwnerUserId: null,
      }
      const request: AuthorityRequest = {
        principalUserId: input.actorUserId,
        organizationId: input.organizationId,
        action: 'review:monitor',
        resource: { type: 'governance_review', id: resource.id, organizationId: input.organizationId },
      }
      if (decide(request, facts, resource, now).effect !== 'allow') continue
      oversight.push({
        id: resource.id,
        reviewType: String(row.review_type),
        status,
        openedAt: asDate(row.created_at),
        classification: resource.classification,
        complainantUserId: resource.complainantUserId ?? null,
      })
    }
  }
  return { own, oversight, ...NOTIFICATION }
}
