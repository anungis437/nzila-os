/**
 * Durable supersession of a certified council election (UE-CONV-K-009).
 *
 * The certified `council_elections` row is never updated. A correction inserts a new uncertified election and one
 * `election_certificate_successions` row that names the predecessor, the version, the provenance hash, the distinct
 * issuer and reviewer, and the decision. Platform migration 0033 creates that relation and is UNQUALIFIED. Until it
 * is applied, or until the authority kernel loads a grant, this function writes nothing.
 *
 * A request body is not a grant. The council vote route stays 501: this relation does not create an electorate.
 * Institutional notice is recorded as required and unsent. This module does not send a voter or officer notification,
 * and it does not store a ballot choice.
 */
import { createHash } from 'node:crypto'
import { appendCanonicalAuditLog, type CanonicalAuditEntry } from '@/lib/audit/canonical-audit-chain'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { asRlsTx } from '@/lib/authority/store/audit'
import type { SqlExecutor } from '@/lib/authority/store/executor'
import { isUuid } from '@/lib/authority/store/executor'

export interface SuccessionGrant {
  loadedBy: 'authority-kernel'
  action: 'election:supersede_certified_result'
  electionId: string
  organizationId: string
  issued: true
  issuerUserId: string
  reviewerUserId: string
  decisionReference: string
  provenanceHash: string
  disputeReference?: string | null
  recountReference?: string | null
  recusedUserIds?: readonly string[]
  /** When true, the succession records that an institutional notice is required. Nothing is sent. */
  institutionalNoticeRequired?: boolean
}

export type SuccessionCode =
  | 'NOT_FOUND'
  | 'NOT_CERTIFIED'
  | 'CORRECTION_UNISSUED'
  | 'RECUSAL_REQUIRED'
  | 'STALE_CERTIFICATE'
  | 'STORE_UNAPPLIED'
  | 'INVALID_GRANT'

export type SuccessionResult =
  | { ok: false; code: SuccessionCode; message: string }
  | {
      ok: true
      replayed: boolean
      successionId: string
      successorElectionId: string
      predecessorElectionId: string
      version: number
      provenanceHash: string
      institutionalNotice: 'required_not_sent' | 'not_required'
    }

interface LockedElection {
  id: string
  electionYear: number
  electionDate: string
  positionsAvailable: number
  candidates: unknown
  winners: unknown
  totalVotes: number
  participationRate: number | null
  verifiedBy: string | null
  verificationDate: string | null
}

const HASH = /^[0-9a-f]{64}$/
const MAX_REFERENCE = 200

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Hash of the certified facts. A later change to those facts makes an approved grant stale. */
export function certificateProvenance(row: LockedElection): string {
  return createHash('sha256')
    .update(
      `ue-election-certificate:v1\n${stable({
        id: row.id,
        electionYear: row.electionYear,
        electionDate: row.electionDate,
        positionsAvailable: row.positionsAvailable,
        candidates: row.candidates,
        winners: row.winners,
        totalVotes: row.totalVotes,
        participationRate: row.participationRate,
        verifiedBy: row.verifiedBy,
        verificationDate: row.verificationDate,
      })}`,
    )
    .digest('hex')
}

function fail(code: SuccessionCode, message: string): SuccessionResult {
  return { ok: false, code, message }
}

function isGrant(grant: SuccessionGrant | null, electionId: string, organizationId: string): grant is SuccessionGrant {
  return Boolean(
    grant &&
      grant.issued === true &&
      grant.loadedBy === 'authority-kernel' &&
      grant.action === 'election:supersede_certified_result' &&
      grant.electionId === electionId &&
      grant.organizationId === organizationId,
  )
}

function namedUserIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(namedUserIds)
  const record = value as Record<string, unknown>
  const ids = typeof record.userId === 'string' ? [record.userId] : []
  return [...ids, ...Object.values(record).flatMap(namedUserIds)]
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function lockedFrom(row: Record<string, unknown>): LockedElection {
  return {
    id: String(row.id),
    electionYear: Number(row.election_year),
    electionDate: String(row.election_date).slice(0, 10),
    positionsAvailable: Number(row.positions_available),
    candidates: jsonValue(row.candidates),
    winners: jsonValue(row.winners),
    totalVotes: Number(row.total_votes),
    participationRate: row.participation_rate === null || row.participation_rate === undefined ? null : Number(row.participation_rate),
    verifiedBy: row.verified_by === null || row.verified_by === undefined ? null : String(row.verified_by),
    verificationDate: row.verification_date === null || row.verification_date === undefined ? null : String(row.verification_date).slice(0, 10),
  }
}

/**
 * Inserts an uncertified successor and the succession row, or returns the existing receipt. The predecessor is
 * locked and not updated. A failed audit throws so the caller rolls the inserts back with it.
 */
export async function recordCertifiedSupersession(
  exec: SqlExecutor,
  electionId: string,
  grant: SuccessionGrant | null,
  organizationId: string,
): Promise<SuccessionResult> {
  if (!isUuid(electionId) || !isUuid(organizationId)) {
    return fail('INVALID_GRANT', 'The election and the acting organization must be uuids.')
  }
  if (!isGrant(grant, electionId, organizationId)) {
    return fail('CORRECTION_UNISSUED', 'A certified result is superseded only by an authority-kernel grant for that election. A request field is not a grant.')
  }
  const reference = grant.decisionReference?.trim() ?? ''
  if (reference.length === 0 || reference.length > MAX_REFERENCE || !HASH.test(grant.provenanceHash ?? '')) {
    return fail('INVALID_GRANT', 'The grant needs a 64-character provenance hash and a decision reference of at most 200 characters.')
  }
  const recused = new Set(grant.recusedUserIds ?? [])
  if (grant.issuerUserId === grant.reviewerUserId || recused.has(grant.issuerUserId) || recused.has(grant.reviewerUserId)) {
    return fail('RECUSAL_REQUIRED', 'The issuer and the reviewer must be different people, and neither may be recused.')
  }

  const stored = (
    await exec.query<Record<string, unknown>>(
      `SELECT id::text AS id, election_year, election_date::text AS election_date, positions_available, candidates, winners,
              total_votes, participation_rate, verified_by, verification_date::text AS verification_date
         FROM public.council_elections WHERE id = $1::uuid FOR UPDATE`,
      [electionId],
    )
  ).rows[0]
  if (!stored) return fail('NOT_FOUND', 'Election not found.')
  const locked = lockedFrom(stored)
  if (!locked.verifiedBy && !locked.verificationDate) {
    return fail('NOT_CERTIFIED', 'An uncertified election is corrected through the ordinary update.')
  }
  const interested = new Set([...namedUserIds(locked.candidates), ...namedUserIds(locked.winners)])
  if (interested.has(grant.issuerUserId) || interested.has(grant.reviewerUserId)) {
    return fail('RECUSAL_REQUIRED', 'A person named on the certified result cannot issue or review its supersession.')
  }

  const relation = (await exec.query<{ rel: string | null }>(`SELECT to_regclass('public.election_certificate_successions')::text AS rel`)).rows[0]?.rel
  if (!relation) {
    return fail('STORE_UNAPPLIED', 'The certified-successor relation is not in this database. Nothing was written.')
  }

  const prior = (
    await exec.query<{ id: string; successor_election_id: string; version: number }>(
      `SELECT id::text AS id, successor_election_id::text AS successor_election_id, version
         FROM public.election_certificate_successions
        WHERE predecessor_election_id = $1::uuid AND provenance_hash = $2 AND decision_reference = $3`,
      [electionId, grant.provenanceHash, reference],
    )
  ).rows[0]
  const currentHash = certificateProvenance(locked)
  if (prior) {
    return {
      ok: true,
      replayed: true,
      successionId: prior.id,
      successorElectionId: prior.successor_election_id,
      predecessorElectionId: electionId,
      version: Number(prior.version),
      provenanceHash: grant.provenanceHash,
      institutionalNotice: grant.institutionalNoticeRequired ? 'required_not_sent' : 'not_required',
    }
  }
  if (currentHash !== grant.provenanceHash) {
    return fail('STALE_CERTIFICATE', 'The certified facts changed after this grant was approved. Nothing was written.')
  }

  const version = Number(
    (
      await exec.query<{ v: number }>(
        `SELECT (COALESCE(MAX(version), 0) + 1)::int AS v
           FROM public.election_certificate_successions WHERE predecessor_election_id = $1::uuid`,
        [electionId],
      )
    ).rows[0]?.v ?? 1,
  )
  const successor = (
    await exec.query<{ id: string }>(
      `INSERT INTO public.council_elections
         (election_year, election_date, positions_available, candidates, winners, total_votes, participation_rate,
          verified_by, verification_date, contested_results)
       VALUES ($1, $2::date, $3, $4::jsonb, $5::jsonb, $6, $7, NULL, NULL, false)
       RETURNING id::text AS id`,
      [
        locked.electionYear,
        locked.electionDate,
        locked.positionsAvailable,
        JSON.stringify(locked.candidates),
        JSON.stringify(locked.winners),
        locked.totalVotes,
        locked.participationRate,
      ],
    )
  ).rows[0]
  if (!successor) throw new Error('the successor election was not stored')
  const notice = grant.institutionalNoticeRequired ? 'required_not_sent' : null
  const succession = (
    await exec.query<{ id: string }>(
      `INSERT INTO public.election_certificate_successions
         (organization_id, predecessor_election_id, successor_election_id, version, provenance_hash,
          dispute_reference, recount_reference, issuer_user_id, reviewer_user_id, decision_reference, institutional_notice)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id::text AS id`,
      [
        organizationId,
        electionId,
        successor.id,
        version,
        currentHash,
        grant.disputeReference ?? null,
        grant.recountReference ?? null,
        grant.issuerUserId,
        grant.reviewerUserId,
        reference,
        notice,
      ],
    )
  ).rows[0]
  if (!succession) throw new Error('the succession row was not stored')

  const audit: CanonicalAuditEntry = {
    organizationId,
    action: 'governance.election_certificate.supersede',
    resourceType: 'election_certificate_successions',
    resourceId: succession.id,
    details: {
      predecessorElectionId: electionId,
      successorElectionId: successor.id,
      version,
      provenanceHash: currentHash,
      decisionReference: reference,
      issuerUserId: grant.issuerUserId,
      reviewerUserId: grant.reviewerUserId,
      disputeReference: grant.disputeReference ?? null,
      recountReference: grant.recountReference ?? null,
      institutionalNotice: notice ?? 'not_required',
      predecessorRewritten: false,
    },
  }
  const tx = asRlsTx(exec)
  if (!(await appendMandatoryAudit(tx, audit))) await appendCanonicalAuditLog(tx, audit)

  const unchanged = (
    await exec.query<{ verified_by: string | null; total_votes: number }>(
      `SELECT verified_by, total_votes FROM public.council_elections WHERE id = $1::uuid`,
      [electionId],
    )
  ).rows[0]
  if (!unchanged || unchanged.verified_by !== locked.verifiedBy || Number(unchanged.total_votes) !== locked.totalVotes) {
    throw new Error('the certified election was rewritten; the supersession is rolled back')
  }

  return {
    ok: true,
    replayed: false,
    successionId: succession.id,
    successorElectionId: successor.id,
    predecessorElectionId: electionId,
    version,
    provenanceHash: currentHash,
    institutionalNotice: notice ?? 'not_required',
  }
}
