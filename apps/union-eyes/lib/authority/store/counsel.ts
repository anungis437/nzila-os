/**
 * Authority store — counsel engagement register, durable nonce store and the assertion-backed verifier.
 *
 * The register records an INSTITUTION's appointment of counsel to one matter (capacity, information barrier, term).
 * The nonce store makes counsel assertions single-use across instances: the unique index is the replay control and
 * only a SHA-256 of the nonce is stored. Neither holds counsel content. Counsel-side signature verification is NOT
 * implemented here; it is the injected `CounselAssertionVerifier`, and without one every assertion is refused.
 */
import { createHash } from 'node:crypto'
import {
  authenticateCounselAssertion,
  type CounselAssertion,
  type CounselAssertionVerifier,
  type CounselCapacityKind,
  type CounselEngagement,
  type CounselNonceStore,
} from '../counsel-boundary'
import { auditAuthorityMutation } from './audit'
import type { CounselIdentityVerifier, EnforcementDeps } from './enforce'
import { AuthorityStoreError, bindSessionActor, type SqlExecutor } from './executor'
import { loadHolderMandates } from './facts'
import { requirePrincipals, requireUuids } from './mutations'

type Row = Record<string, unknown>

const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)))

/**
 * Records an engagement. The recorder is the authenticated principal of the transaction and must be an active
 * executive holding a live executive-office mandate. The database independently refuses a recorder or counsel who is
 * the member or the referrer, a member-counsel engagement without an information barrier and a bounded term, and a
 * matter outside this organization.
 */
export async function recordCounselEngagement(
  exec: SqlExecutor,
  deps: Pick<EnforcementDeps, 'memberships' | 'now'>,
  i: {
    organizationId: string
    recorderUserId: string
    matterId: string
    counselUserId: string
    capacity: CounselCapacityKind
    informationBarrier: boolean
    effectiveAt: Date
    expiresAt?: Date | null
  },
): Promise<string> {
  requireUuids(i.organizationId, i.matterId)
  requirePrincipals(i.recorderUserId, i.counselUserId)
  await bindSessionActor(exec, i.recorderUserId, 'engagement recorder')
  const m = (await deps.memberships(exec, i.organizationId, [i.recorderUserId])).filter((x) => x.userId === i.recorderUserId && x.organizationId === i.organizationId)
  if (m.length !== 1 || m[0].status !== 'active' || !m[0].capacities.includes('executive')) {
    throw new AuthorityStoreError('DENIED', 'ENGAGEMENT_RECORDER_NOT_AUTHORIZED: only an active executive may record a counsel engagement')
  }
  const now = (deps.now ?? (() => new Date()))()
  const office = (await loadHolderMandates(exec, i.organizationId, i.recorderUserId)).some(
    (x) => x.kind === 'executive_office' && x.sourceInstrument.length > 0 && x.powers.includes('approve') && x.effectiveAt <= now && x.expiresAt !== null && x.expiresAt > now,
  )
  if (!office) throw new AuthorityStoreError('DENIED', 'ENGAGEMENT_RECORDER_NOT_AUTHORIZED: no live executive-office mandate')
  const row = (
    await exec.query<Row>(
      `INSERT INTO ue_authority_counsel_engagements
         (organization_id, matter_id, counsel_user_id, capacity, information_barrier, recorded_by, effective_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text AS id`,
      [i.organizationId, i.matterId, i.counselUserId, i.capacity, i.informationBarrier, i.recorderUserId, i.effectiveAt, i.expiresAt ?? null],
    )
  ).rows[0]
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'counsel.engage',
    resourceType: 'ue_authority_counsel_engagements',
    resourceId: id,
    details: { matterId: i.matterId, counsel: i.counselUserId, capacity: i.capacity, recordedBy: i.recorderUserId },
  })
  return id
}

/** Ends an engagement at once. The revoker must be the authenticated principal and an active executive. */
export async function revokeCounselEngagement(
  exec: SqlExecutor,
  deps: Pick<EnforcementDeps, 'memberships'>,
  i: { organizationId: string; revokerUserId: string; engagementId: string },
): Promise<void> {
  requireUuids(i.organizationId, i.engagementId)
  requirePrincipals(i.revokerUserId)
  await bindSessionActor(exec, i.revokerUserId, 'engagement revoker')
  const m = (await deps.memberships(exec, i.organizationId, [i.revokerUserId])).filter((x) => x.userId === i.revokerUserId && x.organizationId === i.organizationId)
  if (m.length !== 1 || m[0].status !== 'active' || !m[0].capacities.includes('executive')) {
    throw new AuthorityStoreError('DENIED', 'ENGAGEMENT_RECORDER_NOT_AUTHORIZED: only an active executive may revoke a counsel engagement')
  }
  const r = await exec.query(
    `UPDATE ue_authority_counsel_engagements SET revoked_at = now(), revoked_by = $3
      WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [i.organizationId, i.engagementId, i.revokerUserId],
  )
  if (r.rows.length !== 1) throw new AuthorityStoreError('NOT_FOUND', 'no live engagement with this id in this organization')
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'counsel.engagement_revoke', resourceType: 'ue_authority_counsel_engagements', resourceId: i.engagementId, details: { actor: i.revokerUserId } })
}

/** The newest engagement for this counsel on this matter, including revoked and lapsed ones (the evaluator judges liveness). */
export async function loadCounselEngagement(
  exec: SqlExecutor,
  i: { organizationId: string; matterId: string; userId: string },
): Promise<CounselEngagement | null> {
  requireUuids(i.organizationId, i.matterId)
  const row = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, matter_id::text AS matter_id, counsel_user_id, capacity,
              information_barrier, effective_at, expires_at, revoked_at
         FROM ue_authority_counsel_engagements
        WHERE organization_id = $1 AND matter_id = $2 AND counsel_user_id = $3
        ORDER BY created_at DESC LIMIT 1`,
      [i.organizationId, i.matterId, i.userId],
    )
  ).rows[0]
  if (!row) return null
  return {
    engagementId: String(row.id),
    organizationId: String(row.organization_id),
    matterId: String(row.matter_id),
    counselUserId: String(row.counsel_user_id),
    capacity: row.capacity as CounselCapacityKind,
    informationBarrier: row.information_barrier === true,
    effectiveAt: toDate(row.effective_at),
    expiresAt: row.expires_at ? toDate(row.expires_at) : null,
    revokedAt: row.revoked_at ? toDate(row.revoked_at) : null,
  }
}

/**
 * Durable single-use nonce register inside the caller's transaction. The insert is atomic against the unique index, so
 * two concurrent consumers of one nonce cannot both succeed. If the surrounding transaction rolls back, the nonce is
 * not burned, which is intended: nothing was authorized.
 */
export function createDurableNonceStore(exec: SqlExecutor, ctx: { organizationId: string; matterId: string; consumedBy: string }): CounselNonceStore {
  requireUuids(ctx.organizationId, ctx.matterId)
  requirePrincipals(ctx.consumedBy)
  return {
    async consume(nonce: string, expiresAt: Date): Promise<boolean> {
      const hash = createHash('sha256').update(nonce).digest('hex')
      const r = await exec.query(
        `INSERT INTO ue_authority_counsel_nonces (organization_id, matter_id, nonce_hash, consumed_by, expires_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organization_id, nonce_hash) DO NOTHING RETURNING id::text AS id`,
        [ctx.organizationId, ctx.matterId, hash, ctx.consumedBy, expiresAt],
      )
      if (r.rows.length !== 1) return false
      await auditAuthorityMutation(exec, {
        organizationId: ctx.organizationId,
        action: 'counsel.nonce_consume',
        resourceType: 'ue_authority_counsel_nonces',
        resourceId: String((r.rows[0] as Row).id),
        details: { matterId: ctx.matterId, consumedBy: ctx.consumedBy },
      })
      return true
    },
  }
}

/**
 * A per-request `CounselIdentityVerifier` backed by a counsel-signed assertion. `isCounselFor` is true only when the
 * assertion authenticates (envelope, signature, single-use nonce) and names exactly the session principal. The
 * engagement comes from the durable register. With no signature verifier configured it is always false.
 */
export function createAssertionBackedCounselVerifier(i: {
  assertion: CounselAssertion
  allowedIssuers: readonly string[]
  signatureVerifier?: CounselAssertionVerifier
  now?: () => Date
}): CounselIdentityVerifier {
  return {
    async isCounselFor(exec, input) {
      const result = await authenticateCounselAssertion(
        i.assertion,
        { allowedIssuers: i.allowedIssuers, organizationId: input.organizationId, matterId: input.matterId, now: (i.now ?? (() => new Date()))() },
        { verifier: i.signatureVerifier, nonces: createDurableNonceStore(exec, { organizationId: input.organizationId, matterId: input.matterId, consumedBy: input.userId }) },
      )
      return result.ok && result.subject === input.userId
    },
    engagement: (exec, input) => loadCounselEngagement(exec, input),
  }
}
