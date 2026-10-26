/**
 * Authority store — union-side WorkAid consent and disclosure (register UE-CONV-G-002).
 *
 * What this module does: member (or authorised representative) referral, explicit informed and versioned consent,
 * per-document disclosure authorisation, a stable pseudonymous matter id, revocation that takes effect at
 * once, and the ONLY read path counsel has into union-held material.
 *
 * What it does NOT do, and cannot: authenticate counsel. Counsel acts solely through the injected
 * `CounselIdentityVerifier` (see `createAssertionBackedCounselVerifier`, which in turn needs a
 * `CounselAssertionVerifier`). This repository ships no counsel-side issuer, so with no verifier configured every
 * counsel read is refused (`COUNSEL_NOT_VERIFIABLE`). Two gates stay external and separate:
 *   - counsel-side activation: a counsel-side system exists and its signature issuer allow-list is registered;
 *   - key custody (UE-CONV-G-003): who holds and rotates the keys that sign counsel assertions.
 *
 * Every function runs inside `runAuthorityTransaction`. Each protected mutation and its canonical audit record
 * commit together; a failed audit rolls the mutation back (the database refuses COMMIT for any event no audit row
 * names). The actor is always the transaction's authenticated principal, never a parameter that can be forged.
 */
import { randomUUID } from 'node:crypto'
import { classifyDocument, DEFAULT_DOCUMENT_CLASS_POLICY, type DocumentInfoClass } from '../document-class'
import {
  MAX_CONSENT_TERM_DAYS,
  MAX_PURPOSE_LENGTH,
  normaliseCategories,
  SHAREABLE_DOCUMENT_CLASSES,
  type CounselManifest,
  type WorkAidCategory,
  type WorkAidRefusalCode,
} from '../workaid-disclosure'
import { decide } from '../kernel'
import { auditAuthorityMutation } from './audit'
import { assertAllowed, enforceAuthority, requireCounselSession, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, bindSessionActor, isUuid, parsePgTextArray, type SqlExecutor } from './executor'
import { loadAuthorityFacts, loadHolderMandates, loadRelationships } from './facts'
import { requirePrincipals, requireUuids } from './mutations'
import { loadCase, loadDocument } from './resources'
import { referToWorkAid } from './workflow'
import type { AuthorityRequest, WorkAidMatterFacts } from '../ontology'

type Row = Record<string, unknown>
type Deps = Pick<EnforcementDeps, 'memberships' | 'now'> & Partial<Pick<EnforcementDeps, 'documentPolicy'>>

const DAY_MS = 86_400_000
const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)))
const clock = (deps: { now?: () => Date }): Date => (deps.now ?? (() => new Date()))()
const refuse = (code: WorkAidRefusalCode, detail: string): AuthorityStoreError => new AuthorityStoreError('DENIED', `${code}: ${detail}`)

// ── Consent wording (institution-recorded, versioned) ────────────────────────

async function requireExecutiveOffice(exec: SqlExecutor, deps: Deps, organizationId: string, userId: string, verb: string): Promise<void> {
  const m = (await deps.memberships(exec, organizationId, [userId])).filter((x) => x.userId === userId && x.organizationId === organizationId)
  if (m.length !== 1 || m[0].status !== 'active' || !m[0].capacities.includes('executive')) {
    throw new AuthorityStoreError('DENIED', `CONSENT_TEXT_NOT_AUTHORIZED: only an active executive may ${verb} consent wording`)
  }
  const now = clock(deps)
  const office = (await loadHolderMandates(exec, organizationId, userId)).some(
    (x) => x.kind === 'executive_office' && x.sourceInstrument.length > 0 && x.powers.includes('approve') && x.effectiveAt <= now && x.expiresAt !== null && x.expiresAt > now,
  )
  if (!office) throw new AuthorityStoreError('DENIED', `CONSENT_TEXT_NOT_AUTHORIZED: no live executive-office mandate to ${verb} consent wording`)
}

/**
 * Records a version of the member-facing consent wording. The wording itself is an institutional and legal decision
 * (contract section 5, open decision) and is NOT authored by this code: nothing can be consented to until an
 * executive holding a live office mandate records the approved text.
 */
export async function recordConsentText(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; recorderUserId: string; version: string; body: string; effectiveAt: Date },
): Promise<string> {
  requireUuids(i.organizationId)
  requirePrincipals(i.recorderUserId)
  await bindSessionActor(exec, i.recorderUserId, 'consent wording recorder')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.recorderUserId, 'record')
  const id = String(
    (
      await exec.query<Row>(
        `INSERT INTO ue_authority_workaid_consent_texts (organization_id, version, body, body_sha256, recorded_by, effective_at)
         VALUES ($1,$2,$3,encode(sha256(convert_to($3, 'UTF8')), 'hex'),$4,$5) RETURNING id::text AS id`,
        [i.organizationId, i.version, i.body, i.recorderUserId, i.effectiveAt],
      )
    ).rows[0].id,
  )
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'workaid.consent_text_record', resourceType: 'ue_authority_workaid_consent_texts', resourceId: id, details: { version: i.version } })
  return id
}

/** Retires a wording version: no new consent can be captured against it. Existing grants keep their recorded text. */
export async function retireConsentText(exec: SqlExecutor, deps: Deps, i: { organizationId: string; retirerUserId: string; textId: string }): Promise<void> {
  requireUuids(i.organizationId, i.textId)
  requirePrincipals(i.retirerUserId)
  await bindSessionActor(exec, i.retirerUserId, 'consent wording retirer')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.retirerUserId, 'retire')
  const r = await exec.query(
    `UPDATE ue_authority_workaid_consent_texts SET retired_at = now(), retired_by = $3 WHERE organization_id = $1 AND id = $2 AND retired_at IS NULL RETURNING id`,
    [i.organizationId, i.textId, i.retirerUserId],
  )
  if (r.rows.length !== 1) throw new AuthorityStoreError('NOT_FOUND', 'no live consent wording with this id in this organization')
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'workaid.consent_text_retire', resourceType: 'ue_authority_workaid_consent_texts', resourceId: i.textId })
}

export interface ConsentTextView {
  id: string
  version: string
  body: string
  bodySha256: string
  effectiveAt: Date
}

/** The wording a member would consent to now: the newest effective, un-retired version. Null when none is recorded. */
export async function loadCurrentConsentText(exec: SqlExecutor, organizationId: string, now: Date = new Date()): Promise<ConsentTextView | null> {
  requireUuids(organizationId)
  const r = (
    await exec.query<Row>(
      `SELECT id::text AS id, version, body, body_sha256, effective_at FROM ue_authority_workaid_consent_texts
        WHERE organization_id = $1 AND retired_at IS NULL AND effective_at <= $2
        ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
      [organizationId, now],
    )
  ).rows[0]
  return r ? { id: String(r.id), version: String(r.version), body: String(r.body), bodySha256: String(r.body_sha256), effectiveAt: toDate(r.effective_at) } : null
}

const WORDING_VERSION = /^[A-Za-z0-9._-]{1,64}$/

function assertWordingInput(version: string, body: string): { version: string; body: string } {
  const trimmedVersion = typeof version === 'string' ? version.trim() : ''
  const trimmedBody = typeof body === 'string' ? body.trim() : ''
  if (!WORDING_VERSION.test(trimmedVersion) || trimmedBody.length === 0 || trimmedBody.length > 8000) {
    throw new AuthorityStoreError('INVALID_CONTEXT', 'WORDING_INVALID: a version and the institution-supplied wording are required')
  }
  return { version: trimmedVersion, body: trimmedBody }
}

async function requireProposalStore(exec: SqlExecutor): Promise<void> {
  const rel = (await exec.query<{ rel: string | null }>(`SELECT to_regclass('public.ue_authority_workaid_consent_text_proposals') AS rel`)).rows[0]?.rel
  if (!rel) throw new AuthorityStoreError('PRECONDITION', 'STORE_UNAPPLIED: consent wording proposals are not installed')
}

function isProposalVersionTaken(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : ''
  const message = error instanceof Error ? error.message : String(error)
  return code === '23505' || message.includes('ue_authority_wa_proposal_open_uq')
}

export interface ConsentWordingProposalView {
  id: string
  version: string
  body: string
  bodySha256: string
  ownProposal: boolean
  proposedAt: Date
}

/**
 * Records institution-supplied wording as a proposal. It is not current consent text.
 * The body is the caller's text. This function does not author wording.
 */
export async function proposeConsentWording(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; proposerUserId: string; version: string; body: string },
): Promise<string> {
  await requireProposalStore(exec)
  requireUuids(i.organizationId)
  requirePrincipals(i.proposerUserId)
  await bindSessionActor(exec, i.proposerUserId, 'consent wording proposer')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.proposerUserId, 'propose')
  const wording = assertWordingInput(i.version, i.body)
  let id: string
  try {
    id = String(
      (
        await exec.query<Row>(
          `INSERT INTO ue_authority_workaid_consent_text_proposals (organization_id, version, body, body_sha256, proposed_by)
           VALUES ($1,$2,$3,encode(sha256(convert_to($3, 'UTF8')), 'hex'),$4) RETURNING id::text AS id`,
          [i.organizationId, wording.version, wording.body, i.proposerUserId],
        )
      ).rows[0].id,
    )
  } catch (error) {
    if (isProposalVersionTaken(error)) throw new AuthorityStoreError('PRECONDITION', 'WORDING_ALREADY_PROPOSED: an open proposal already uses this version')
    throw error
  }
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'workaid.consent_text_propose', resourceType: 'ue_authority_workaid_consent_text_proposals', resourceId: id, details: { version: wording.version } })
  return id
}

/** Open proposals in this organization. The other executive's identity is not returned. */
export async function listOpenConsentWordingProposals(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; reviewerUserId: string },
): Promise<ConsentWordingProposalView[]> {
  await requireProposalStore(exec)
  requireUuids(i.organizationId)
  requirePrincipals(i.reviewerUserId)
  await bindSessionActor(exec, i.reviewerUserId, 'consent wording reviewer')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.reviewerUserId, 'review')
  const rows = (
    await exec.query<Row>(
      `SELECT id::text AS id, version, body, body_sha256, proposed_by, proposed_at
         FROM ue_authority_workaid_consent_text_proposals
        WHERE organization_id = $1 AND adopted_at IS NULL AND withdrawn_at IS NULL
        ORDER BY proposed_at ASC, created_at ASC`,
      [i.organizationId],
    )
  ).rows
  return rows.map((r) => ({
    id: String(r.id),
    version: String(r.version),
    body: String(r.body),
    bodySha256: String(r.body_sha256),
    ownProposal: String(r.proposed_by) === i.reviewerUserId,
    proposedAt: toDate(r.proposed_at),
  }))
}

/**
 * Adopts a proposal by inserting the stored body as current consent wording.
 * The adopter cannot change the text, and cannot be the proposer.
 */
export async function adoptConsentWording(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; adopterUserId: string; proposalId: string },
): Promise<{ textId: string; version: string; bodySha256: string }> {
  await requireProposalStore(exec)
  requireUuids(i.organizationId, i.proposalId)
  requirePrincipals(i.adopterUserId)
  await bindSessionActor(exec, i.adopterUserId, 'consent wording adopter')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.adopterUserId, 'adopt')
  const row = (
    await exec.query<Row>(
      `SELECT version, body, body_sha256, proposed_by, adopted_at, withdrawn_at
         FROM ue_authority_workaid_consent_text_proposals
        WHERE organization_id = $1 AND id = $2`,
      [i.organizationId, i.proposalId],
    )
  ).rows[0]
  if (!row) throw new AuthorityStoreError('NOT_FOUND', 'no consent wording proposal with this id in this organization')
  if (row.adopted_at || row.withdrawn_at) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the consent wording proposal is already adopted or withdrawn')
  if (String(row.proposed_by) === i.adopterUserId) throw new AuthorityStoreError('DENIED', 'WORDING_ADOPTION_SEGREGATION: the proposer cannot adopt the wording')
  const now = clock(deps)
  const textId = await recordConsentText(exec, deps, {
    organizationId: i.organizationId,
    recorderUserId: i.adopterUserId,
    version: String(row.version),
    body: String(row.body),
    effectiveAt: now,
  })
  const updated = await exec.query(
    `UPDATE ue_authority_workaid_consent_text_proposals
        SET adopted_by = $3, adopted_at = $4, adopted_text_id = $5
      WHERE organization_id = $1 AND id = $2 AND adopted_at IS NULL AND withdrawn_at IS NULL
      RETURNING id`,
    [i.organizationId, i.proposalId, i.adopterUserId, now, textId],
  )
  if (updated.rows.length !== 1) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the consent wording proposal is already adopted or withdrawn')
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.consent_text_adopt',
    resourceType: 'ue_authority_workaid_consent_text_proposals',
    resourceId: i.proposalId,
    details: { version: String(row.version), textId },
  })
  return { textId, version: String(row.version), bodySha256: String(row.body_sha256) }
}

/** The proposer withdraws an open proposal. It never becomes consent wording. */
export async function withdrawConsentWordingProposal(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; proposerUserId: string; proposalId: string },
): Promise<void> {
  await requireProposalStore(exec)
  requireUuids(i.organizationId, i.proposalId)
  requirePrincipals(i.proposerUserId)
  await bindSessionActor(exec, i.proposerUserId, 'consent wording proposer')
  await requireExecutiveOffice(exec, deps, i.organizationId, i.proposerUserId, 'withdraw')
  const row = (
    await exec.query<Row>(
      `SELECT proposed_by, adopted_at, withdrawn_at FROM ue_authority_workaid_consent_text_proposals WHERE organization_id = $1 AND id = $2`,
      [i.organizationId, i.proposalId],
    )
  ).rows[0]
  if (!row) throw new AuthorityStoreError('NOT_FOUND', 'no consent wording proposal with this id in this organization')
  if (row.adopted_at || row.withdrawn_at) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the consent wording proposal is already adopted or withdrawn')
  if (String(row.proposed_by) !== i.proposerUserId) throw new AuthorityStoreError('DENIED', 'WORDING_WITHDRAWAL_NOT_PROPOSER: only the proposer may withdraw this wording')
  const updated = await exec.query(
    `UPDATE ue_authority_workaid_consent_text_proposals SET withdrawn_at = now(), withdrawn_by = $3
      WHERE organization_id = $1 AND id = $2 AND adopted_at IS NULL AND withdrawn_at IS NULL RETURNING id`,
    [i.organizationId, i.proposalId, i.proposerUserId],
  )
  if (updated.rows.length !== 1) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the consent wording proposal is already adopted or withdrawn')
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'workaid.consent_text_withdraw_proposal', resourceType: 'ue_authority_workaid_consent_text_proposals', resourceId: i.proposalId })
}

// ── Internal loaders ─────────────────────────────────────────────────────────

interface GrantRow {
  grantId: string
  consentId: string
  matterId: string
  caseId: string
  memberUserId: string
  textVersion: string
  categories: WorkAidCategory[]
  purpose: string
  grantedAt: Date
  expiresAt: Date
  revokedAt: Date | null
}

const GRANT_SELECT = `
  SELECT g.id::text AS grant_id, g.consent_id::text AS consent_id, g.matter_id::text AS matter_id, g.case_id::text AS case_id,
         g.member_user_id, g.text_version, c.categories, c.purpose, c.granted_at, c.expires_at, c.revoked_at
    FROM ue_authority_workaid_consent_grants g
    JOIN ue_authority_disclosure_consents c ON c.id = g.consent_id AND c.organization_id = g.organization_id`

function mapGrant(r: Row): GrantRow {
  return {
    grantId: String(r.grant_id),
    consentId: String(r.consent_id),
    matterId: String(r.matter_id),
    caseId: String(r.case_id),
    memberUserId: String(r.member_user_id),
    textVersion: String(r.text_version),
    categories: parsePgTextArray(r.categories) as WorkAidCategory[],
    purpose: String(r.purpose),
    grantedAt: toDate(r.granted_at),
    expiresAt: toDate(r.expires_at),
    revokedAt: r.revoked_at ? toDate(r.revoked_at) : null,
  }
}

const loadGrantByMatter = async (exec: SqlExecutor, organizationId: string, matterId: string): Promise<GrantRow | null> => {
  const r = (await exec.query<Row>(`${GRANT_SELECT} WHERE g.organization_id = $1 AND g.matter_id = $2`, [organizationId, matterId])).rows[0]
  return r ? mapGrant(r) : null
}

const consentLive = (g: GrantRow, now: Date): boolean => g.revokedAt === null && g.grantedAt <= now && g.expiresAt > now

async function requireActiveMember(exec: SqlExecutor, deps: Deps, organizationId: string, userId: string): Promise<void> {
  const m = (await deps.memberships(exec, organizationId, [userId])).filter((x) => x.userId === userId && x.organizationId === organizationId)
  if (m.length !== 1 || m[0].status !== 'active') throw new AuthorityStoreError('DENIED', 'NOT_AN_ACTIVE_MEMBER: only an active member may do this')
}

/** Classifies a document for the consenting member under the policy in force; null when it cannot be shared. */
async function shareableClass(exec: SqlExecutor, deps: Deps, organizationId: string, grant: GrantRow, documentId: string): Promise<DocumentInfoClass | null> {
  const policy = deps.documentPolicy ?? DEFAULT_DOCUMENT_CLASS_POLICY
  const doc = await loadDocument(exec, organizationId, documentId, policy)
  // Exactly one authoritative link, and it is this matter's case: a document attached to several cases carries other matters.
  if (!doc || doc.caseIds.length !== 1 || doc.caseIds[0] !== grant.caseId) return null
  const cls = classifyDocument(
    { uploadedBy: doc.uploadedBy, label: doc.label, containsLegalPrivilege: doc.containsLegalPrivilege || doc.privileged, thirdPartySensitive: doc.thirdPartySensitive },
    grant.memberUserId,
    policy,
  )
  return SHAREABLE_DOCUMENT_CLASSES.includes(cls) ? cls : null
}

// ── Consent capture ──────────────────────────────────────────────────────────

export interface GrantConsentInput {
  organizationId: string
  memberUserId: string
  caseId: string
  categories: readonly string[]
  purpose: string
  /** The wording version the member was shown. */
  textVersion: string
  /** The SHA-256 of the exact wording shown; proves the member acknowledged THIS text, not merely a version label. */
  acknowledgedTextSha256: string
  expiresAt: Date
}

/**
 * Captures explicit, informed, scoped and time-limited member consent for one case. The consent is the member's own
 * act (the issuer is the authenticated session principal, enforced by the database), cites recorded wording by
 * version and hash, and allocates the pseudonymous matter id. It authorises nothing by itself: a
 * referral and per-document authorisations are separate acts.
 */
export async function grantWorkAidConsent(exec: SqlExecutor, deps: Deps, i: GrantConsentInput): Promise<{ consentId: string; matterId: string }> {
  requireUuids(i.organizationId, i.caseId)
  requirePrincipals(i.memberUserId)
  await bindSessionActor(exec, i.memberUserId, 'consenting member')
  const now = clock(deps)
  await requireActiveMember(exec, deps, i.organizationId, i.memberUserId)

  let categories: WorkAidCategory[]
  try {
    categories = normaliseCategories(i.categories)
  } catch (e) {
    throw refuse('CATEGORY_NOT_ALLOWED', e instanceof Error ? e.message : 'invalid categories')
  }
  const purpose = typeof i.purpose === 'string' ? i.purpose.trim() : ''
  if (purpose.length === 0 || purpose.length > MAX_PURPOSE_LENGTH) throw refuse('CONSENT_TERM_INVALID', 'a purpose of 1 to 500 characters is required')
  if (!(i.expiresAt instanceof Date) || Number.isNaN(i.expiresAt.getTime()) || i.expiresAt <= now || i.expiresAt.getTime() > now.getTime() + MAX_CONSENT_TERM_DAYS * DAY_MS) {
    throw refuse('CONSENT_TERM_INVALID', `consent must expire in the future and within ${MAX_CONSENT_TERM_DAYS} days`)
  }

  const text = (
    await exec.query<Row>(
      `SELECT id::text AS id, version, body_sha256, effective_at, retired_at FROM ue_authority_workaid_consent_texts WHERE organization_id = $1 AND version = $2`,
      [i.organizationId, i.textVersion],
    )
  ).rows[0]
  if (!text || text.retired_at || toDate(text.effective_at) > now) throw refuse('CONSENT_TEXT_UNAVAILABLE', 'no current recorded consent wording with this version')
  if (String(text.body_sha256) !== i.acknowledgedTextSha256) throw refuse('CONSENT_TEXT_NOT_ACKNOWLEDGED', 'the acknowledged wording does not match the recorded text')

  // The member must be the case's own creator: consent for someone else's case is not the data subject's consent.
  const loaded = await loadCase(exec, { principalUserId: i.memberUserId, organizationId: i.organizationId, action: 'case:read', resource: { type: 'case', id: i.caseId, organizationId: i.organizationId } }, now)
  if (!loaded || !(loaded.relationships ?? []).some((r) => r.principalUserId === i.memberUserId && r.relation === 'creator')) {
    throw refuse('CASE_NOT_OWNED_BY_MEMBER', 'the member has no creator relationship to this case')
  }
  const busy = await exec.query(
    `SELECT 1 FROM ue_authority_workaid_matters WHERE organization_id = $1 AND case_id = $2 AND withdrawn_at IS NULL
     UNION ALL
     SELECT 1 FROM ue_authority_workaid_consent_grants g JOIN ue_authority_disclosure_consents c ON c.id = g.consent_id
      WHERE g.organization_id = $1 AND g.case_id = $2 AND c.revoked_at IS NULL AND c.expires_at > $3`,
    [i.organizationId, i.caseId, now],
  )
  if (busy.rows.length > 0) throw refuse('CASE_ALREADY_REFERRED', 'this case already has a live referral or a live consent')

  const matterId = randomUUID()
  const consentId = String(
    (
      await exec.query<Row>(
        `INSERT INTO ue_authority_disclosure_consents
           (organization_id, member_user_id, matter_id, direction, issuer, issued_by, categories, recipient_user_id, purpose, granted_at, expires_at)
         VALUES ($1,$2,$3,'union_to_workaid','member',$2,$4::text[],NULL,$5,$6,$7) RETURNING id::text AS id`,
        [i.organizationId, i.memberUserId, matterId, categories, purpose, now, i.expiresAt],
      )
    ).rows[0].id,
  )
  await exec.query(
    `INSERT INTO ue_authority_workaid_consent_grants (organization_id, consent_id, matter_id, case_id, member_user_id, text_id, text_version, text_sha256)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [i.organizationId, consentId, matterId, i.caseId, i.memberUserId, String(text.id), i.textVersion, i.acknowledgedTextSha256],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.consent_grant',
    resourceType: 'ue_authority_disclosure_consents',
    resourceId: consentId,
    details: { matterId, caseId: i.caseId, categories, textVersion: i.textVersion, textSha256: i.acknowledgedTextSha256, expiresAt: i.expiresAt.toISOString() },
  })
  return { consentId, matterId }
}

// ── Referral ─────────────────────────────────────────────────────────────────

/** The kernel's own decision for a referral that has not been recorded yet (no side effects). */
async function referralDecision(exec: SqlExecutor, deps: EnforcementDeps, i: { organizationId: string; actorUserId: string; grant: GrantRow; categories: readonly string[]; now: Date }) {
  const resource = { type: 'workaid_matter' as const, id: i.grant.matterId, organizationId: i.organizationId }
  const facts = await loadAuthorityFacts(exec, deps.memberships, { organizationId: i.organizationId, principalUserId: i.actorUserId, authenticated: true, resource, now: i.now })
  const related = await loadRelationships(exec, i.organizationId, i.actorUserId, 'case', i.grant.caseId)
  const loaded = await loadCase(exec, { principalUserId: i.actorUserId, organizationId: i.organizationId, action: 'case:read', resource: { type: 'case', id: i.grant.caseId, organizationId: i.organizationId } }, i.now)
  const derived = (loaded?.relationships ?? []).filter((r) => r.principalUserId === i.actorUserId)
  const provisional: WorkAidMatterFacts = { kind: 'workaid_matter', id: i.grant.matterId, organizationId: i.organizationId, memberUserId: i.grant.memberUserId, caseId: i.grant.caseId, counselControlled: true }
  const req: AuthorityRequest = { principalUserId: i.actorUserId, organizationId: i.organizationId, action: 'workaid:refer', resource, categories: [...i.categories] }
  return decide(req, { ...facts, relationships: [...facts.relationships, ...related, ...derived] }, provisional, i.now)
}

/**
 * Representatives' view of what they may refer on a case: live, un-referred consents for which the kernel would allow
 * `workaid:refer` for this principal today. Shows no member identity.
 */
export async function listReferableWorkAidConsents(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; actorUserId: string; caseId: string },
): Promise<{ matterId: string; categories: WorkAidCategory[]; purpose: string; expiresAt: Date }[]> {
  requireUuids(i.organizationId, i.caseId)
  requirePrincipals(i.actorUserId)
  await bindSessionActor(exec, i.actorUserId, 'representative')
  const now = clock(deps)
  const rows = (
    await exec.query<Row>(
      `${GRANT_SELECT}
        WHERE g.organization_id = $1 AND g.case_id = $2 AND c.revoked_at IS NULL AND c.expires_at > $3
          AND NOT EXISTS (SELECT 1 FROM ue_authority_workaid_matters m WHERE m.id = g.matter_id)`,
      [i.organizationId, i.caseId, now],
    )
  ).rows.map(mapGrant)
  const out = []
  for (const g of rows) {
    if (!consentLive(g, now)) continue
    const d = await referralDecision(exec, deps, { organizationId: i.organizationId, actorUserId: i.actorUserId, grant: g, categories: g.categories, now })
    if (d.effect === 'allow') out.push({ matterId: g.matterId, categories: g.categories, purpose: g.purpose, expiresAt: g.expiresAt })
  }
  return out
}

/**
 * Records the referral of a consented matter. The member and the case come from the consent record, never from the
 * caller. The kernel decides: an active member who is EITHER a representative with a live owner/assignee relationship
 * to the case OR the member who filed it, not recused from the matter or the case, under live member consent covering
 * every requested category. A recused, removed or unrelated representative is refused.
 *
 * A recorded referral is a UNION-SIDE record. It is not delivery to counsel and not counsel acceptance: counsel's
 * acceptance arrives only through `recordCounselAcceptance` behind the counsel verifier.
 */
export async function referMatterToWorkAid(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; referrerUserId: string; matterId: string; categories?: readonly string[] },
): Promise<{ matterId: string }> {
  requireUuids(i.organizationId, i.matterId)
  requirePrincipals(i.referrerUserId)
  await bindSessionActor(exec, i.referrerUserId, 'referrer')
  const grant = await loadGrantByMatter(exec, i.organizationId, i.matterId)
  if (!grant) throw new AuthorityStoreError('NOT_FOUND', 'no consent is on record for this matter in this organization')
  const exists = (await exec.query(`SELECT 1 FROM ue_authority_workaid_matters WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.matterId])).rows.length > 0
  if (exists) throw new AuthorityStoreError('PRECONDITION', 'CASE_ALREADY_REFERRED: this matter has already been referred')
  let categories: WorkAidCategory[]
  try {
    categories = normaliseCategories(i.categories ?? grant.categories)
  } catch (e) {
    throw refuse('CATEGORY_NOT_ALLOWED', e instanceof Error ? e.message : 'invalid categories')
  }
  await referToWorkAid(exec, deps, { organizationId: i.organizationId, referrerUserId: i.referrerUserId, caseId: grant.caseId, memberUserId: grant.memberUserId, categories, matterId: grant.matterId })
  return { matterId: grant.matterId }
}

// ── Document authorisation ───────────────────────────────────────────────────

/**
 * The consenting member authorises ONE document for disclosure. It must be linked to exactly this matter's case and
 * be of a class the member may themselves release (their own non-privileged submission or a record the institution
 * formally released to them); the union's working file, third-party restricted and privileged material never qualify.
 * The authorisation can never outlive the consent.
 */
export async function authoriseWorkAidDocument(
  exec: SqlExecutor,
  deps: Deps,
  i: { organizationId: string; memberUserId: string; matterId: string; documentId: string; expiresAt?: Date },
): Promise<string> {
  requireUuids(i.organizationId, i.matterId, i.documentId)
  requirePrincipals(i.memberUserId)
  await bindSessionActor(exec, i.memberUserId, 'consenting member')
  const now = clock(deps)
  const grant = await loadGrantByMatter(exec, i.organizationId, i.matterId)
  if (!grant) throw new AuthorityStoreError('NOT_FOUND', 'no consent is on record for this matter in this organization')
  if (grant.memberUserId !== i.memberUserId) throw refuse('NOT_THE_CONSENTING_MEMBER', 'only the consenting member may authorise a document')
  if (!consentLive(grant, now)) throw refuse('CONSENT_NOT_LIVE', 'the consent is revoked, expired or not yet effective')
  if (!grant.categories.includes('documents')) throw refuse('CATEGORY_NOT_ALLOWED', 'the consent does not cover documents')
  const cls = await shareableClass(exec, deps, i.organizationId, grant, i.documentId)
  if (!cls) throw refuse('DOCUMENT_NOT_SHAREABLE', 'the document is unknown, not linked to this matter only, or not of a class the member may release')
  const expiresAt = i.expiresAt ?? grant.expiresAt
  if (expiresAt <= now || expiresAt > grant.expiresAt) throw refuse('CONSENT_TERM_INVALID', 'a document authorisation must end in the future and not after the consent')
  const id = String(
    (
      await exec.query<Row>(
        `INSERT INTO ue_authority_workaid_document_auths (organization_id, matter_id, consent_id, document_id, classification, authorised_by, authorised_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text AS id`,
        [i.organizationId, i.matterId, grant.consentId, i.documentId, cls, i.memberUserId, now, expiresAt],
      )
    ).rows[0].id,
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.document_authorise',
    resourceType: 'ue_authority_workaid_document_auths',
    resourceId: id,
    details: { matterId: i.matterId, documentId: i.documentId, classification: cls, expiresAt: expiresAt.toISOString() },
  })
  return id
}

/** Revokes one document authorisation. It stops the document reaching counsel at once and invalidates its shares. */
export async function revokeWorkAidDocumentAuthorisation(
  exec: SqlExecutor,
  _deps: Deps,
  i: { organizationId: string; revokerUserId: string; authorisationId: string },
): Promise<{ sharesInvalidated: number }> {
  requireUuids(i.organizationId, i.authorisationId)
  requirePrincipals(i.revokerUserId)
  await bindSessionActor(exec, i.revokerUserId, 'consenting member')
  const a = (await exec.query<Row>(`SELECT matter_id::text AS matter_id, authorised_by FROM ue_authority_workaid_document_auths WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.authorisationId])).rows[0]
  if (!a) throw new AuthorityStoreError('NOT_FOUND', 'no document authorisation with this id in this organization')
  if (String(a.authorised_by) !== i.revokerUserId) throw refuse('NOT_THE_CONSENTING_MEMBER', 'only the consenting member may revoke a document authorisation')
  const r = await exec.query(
    `UPDATE ue_authority_workaid_document_auths SET revoked_at = now(), revoked_by = $3 WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [i.organizationId, i.authorisationId, i.revokerUserId],
  )
  if (r.rows.length !== 1) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the document authorisation is already revoked')
  const s = await exec.query(
    `UPDATE ue_authority_workaid_shares SET invalidated_at = now(), invalidated_by = $3, invalidation_reason = 'document_authorisation_revoked'
      WHERE organization_id = $1 AND document_auth_id = $2 AND invalidated_at IS NULL RETURNING id`,
    [i.organizationId, i.authorisationId, i.revokerUserId],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.document_revoke',
    resourceType: 'ue_authority_workaid_document_auths',
    resourceId: i.authorisationId,
    details: { matterId: String(a.matter_id), sharesInvalidated: s.rows.length },
  })
  return { sharesInvalidated: s.rows.length }
}

// ── Shares ───────────────────────────────────────────────────────────────────

/**
 * Releases material toward counsel. The kernel decides `workaid:refer` for exactly the categories requested (so the
 * consent scope, the actor's relationship, recusal and membership all apply); each document must additionally hold a
 * live per-document authorisation and still classify as shareable. Counsel sees nothing that is not a live share.
 */
export async function createWorkAidShare(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; actorUserId: string; matterId: string; categories?: readonly string[]; documentAuthorisationIds?: readonly string[] },
): Promise<string[]> {
  requireUuids(i.organizationId, i.matterId, ...(i.documentAuthorisationIds ?? []))
  requirePrincipals(i.actorUserId)
  await bindSessionActor(exec, i.actorUserId, 'sharer')
  const now = clock(deps)
  const matter = (await exec.query<Row>(`SELECT withdrawn_at FROM ue_authority_workaid_matters WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.matterId])).rows[0]
  if (!matter || matter.withdrawn_at) throw new AuthorityStoreError('NOT_FOUND', 'MATTER_NOT_FOUND: no live referral with this id')
  const grant = await loadGrantByMatter(exec, i.organizationId, i.matterId)
  if (!grant) throw new AuthorityStoreError('NOT_FOUND', 'MATTER_NOT_FOUND: no consent is on record for this matter')
  if (!consentLive(grant, now)) throw refuse('CONSENT_NOT_LIVE', 'the consent is revoked, expired or not yet effective')

  let plain: WorkAidCategory[] = []
  if ((i.categories ?? []).length > 0) {
    try {
      plain = normaliseCategories(i.categories)
    } catch (e) {
      throw refuse('CATEGORY_NOT_ALLOWED', e instanceof Error ? e.message : 'invalid categories')
    }
  }
  if (plain.includes('documents')) throw refuse('CATEGORY_NOT_ALLOWED', 'documents are shared only by naming their authorisations')
  const docIds = [...new Set(i.documentAuthorisationIds ?? [])]
  if (plain.length === 0 && docIds.length === 0) throw refuse('CATEGORY_NOT_ALLOWED', 'nothing to share')
  const effective = docIds.length > 0 ? ([...plain, 'documents'] as WorkAidCategory[]) : plain
  assertAllowed(
    await enforceAuthority(
      exec,
      deps,
      { principalUserId: i.actorUserId, organizationId: i.organizationId, action: 'workaid:refer', resource: { type: 'workaid_matter', id: i.matterId, organizationId: i.organizationId }, categories: effective },
      { authenticated: true },
    ),
  )

  for (const authId of docIds) {
    const a = (
      await exec.query<Row>(
        `SELECT document_id::text AS document_id, expires_at, revoked_at FROM ue_authority_workaid_document_auths WHERE organization_id = $1 AND id = $2 AND matter_id = $3 AND consent_id = $4`,
        [i.organizationId, authId, i.matterId, grant.consentId],
      )
    ).rows[0]
    if (!a || a.revoked_at || toDate(a.expires_at) <= now) throw refuse('DOCUMENT_NOT_AUTHORISED', 'the document has no live authorisation for this matter')
    if (!(await shareableClass(exec, deps, i.organizationId, grant, String(a.document_id)))) {
      throw refuse('DOCUMENT_NOT_AUTHORISED', 'the document no longer classifies as one the member may release')
    }
  }

  const ids: string[] = []
  if (plain.length > 0) {
    ids.push(
      String(
        (
          await exec.query<Row>(
            `INSERT INTO ue_authority_workaid_shares (organization_id, matter_id, consent_id, kind, categories, created_by) VALUES ($1,$2,$3,'categories',$4::text[],$5) RETURNING id::text AS id`,
            [i.organizationId, i.matterId, grant.consentId, plain, i.actorUserId],
          )
        ).rows[0].id,
      ),
    )
  }
  for (const authId of docIds) {
    ids.push(
      String(
        (
          await exec.query<Row>(
            `INSERT INTO ue_authority_workaid_shares (organization_id, matter_id, consent_id, kind, categories, document_auth_id, created_by)
             VALUES ($1,$2,$3,'document',ARRAY['documents']::text[],$4,$5) RETURNING id::text AS id`,
            [i.organizationId, i.matterId, grant.consentId, authId, i.actorUserId],
          )
        ).rows[0].id,
      ),
    )
  }
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.share_create',
    resourceType: 'ue_authority_workaid_shares',
    resourceId: ids[0],
    details: { matterId: i.matterId, categories: effective, shareIds: ids },
  })
  return ids
}

// ── Revocation ───────────────────────────────────────────────────────────────

/**
 * The consenting member withdraws consent. In ONE transaction: the consent is revoked, every document authorisation
 * is revoked, every live share is invalidated, and a referral counsel has not yet accepted is withdrawn (freeing the
 * case). Counsel's read path re-checks the consent on every call, so access stops at once even before the cascade is
 * read. A referral counsel ALREADY accepted stays counsel-controlled (counsel's professional obligations are not the
 * union's to undo); only the union's disclosure authority ends.
 */
export async function revokeWorkAidConsent(
  exec: SqlExecutor,
  _deps: Deps,
  i: { organizationId: string; revokerUserId: string; consentId: string },
): Promise<{ documentAuthorisationsRevoked: number; sharesInvalidated: number; referralWithdrawn: boolean }> {
  requireUuids(i.organizationId, i.consentId)
  requirePrincipals(i.revokerUserId)
  await bindSessionActor(exec, i.revokerUserId, 'consenting member')
  const g = (await exec.query<Row>(`${GRANT_SELECT} WHERE g.organization_id = $1 AND g.consent_id = $2`, [i.organizationId, i.consentId])).rows[0]
  if (!g) throw new AuthorityStoreError('NOT_FOUND', 'no WorkAid consent with this id in this organization')
  const grant = mapGrant(g)
  if (grant.memberUserId !== i.revokerUserId) throw refuse('NOT_THE_CONSENTING_MEMBER', 'only the consenting member may withdraw consent')
  const c = await exec.query(
    `UPDATE ue_authority_disclosure_consents SET revoked_at = now(), revoked_by = $3 WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [i.organizationId, i.consentId, i.revokerUserId],
  )
  if (c.rows.length !== 1) throw new AuthorityStoreError('ALREADY_TERMINAL', 'the consent is already withdrawn')
  const docs = await exec.query(
    `UPDATE ue_authority_workaid_document_auths SET revoked_at = now(), revoked_by = $3 WHERE organization_id = $1 AND consent_id = $2 AND revoked_at IS NULL RETURNING id`,
    [i.organizationId, i.consentId, i.revokerUserId],
  )
  const shares = await exec.query(
    `UPDATE ue_authority_workaid_shares SET invalidated_at = now(), invalidated_by = $3, invalidation_reason = 'consent_revoked'
      WHERE organization_id = $1 AND consent_id = $2 AND invalidated_at IS NULL RETURNING id`,
    [i.organizationId, i.consentId, i.revokerUserId],
  )
  const withdrawn = await exec.query(
    `UPDATE ue_authority_workaid_matters SET withdrawn_at = now()
      WHERE organization_id = $1 AND id = $2 AND counsel_accepted_at IS NULL AND withdrawn_at IS NULL RETURNING id`,
    [i.organizationId, grant.matterId],
  )
  const result = { documentAuthorisationsRevoked: docs.rows.length, sharesInvalidated: shares.rows.length, referralWithdrawn: withdrawn.rows.length === 1 }
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.consent_revoke',
    resourceType: 'ue_authority_disclosure_consents',
    resourceId: i.consentId,
    details: { matterId: grant.matterId, ...result },
  })
  return result
}

// ── Member's own view ────────────────────────────────────────────────────────

export interface MemberWorkAidConsentView {
  consentId: string
  matterId: string
  caseId: string
  categories: WorkAidCategory[]
  purpose: string
  textVersion: string
  expiresAt: Date
  state: 'live' | 'revoked' | 'expired'
  referred: boolean
  referralWithdrawn: boolean
  counselAccepted: boolean
  documentAuthorisations: { id: string; documentId: string; classification: string; expiresAt: Date; revoked: boolean }[]
}

/** The authenticated member's own consents, referral state and document authorisations. Never another member's. */
export async function listMemberWorkAidConsents(exec: SqlExecutor, deps: Deps, i: { organizationId: string; memberUserId: string }): Promise<MemberWorkAidConsentView[]> {
  requireUuids(i.organizationId)
  requirePrincipals(i.memberUserId)
  await bindSessionActor(exec, i.memberUserId, 'member')
  const now = clock(deps)
  const grants = (await exec.query<Row>(`${GRANT_SELECT} WHERE g.organization_id = $1 AND g.member_user_id = $2 ORDER BY g.created_at DESC`, [i.organizationId, i.memberUserId])).rows.map(mapGrant)
  const out: MemberWorkAidConsentView[] = []
  for (const g of grants) {
    const m = (await exec.query<Row>(`SELECT counsel_accepted_at, withdrawn_at FROM ue_authority_workaid_matters WHERE organization_id = $1 AND id = $2`, [i.organizationId, g.matterId])).rows[0]
    const docs = (
      await exec.query<Row>(
        `SELECT id::text AS id, document_id::text AS document_id, classification, expires_at, revoked_at FROM ue_authority_workaid_document_auths WHERE organization_id = $1 AND consent_id = $2 ORDER BY created_at`,
        [i.organizationId, g.consentId],
      )
    ).rows
    out.push({
      consentId: g.consentId,
      matterId: g.matterId,
      caseId: g.caseId,
      categories: g.categories,
      purpose: g.purpose,
      textVersion: g.textVersion,
      expiresAt: g.expiresAt,
      state: g.revokedAt ? 'revoked' : g.expiresAt <= now ? 'expired' : 'live',
      referred: !!m,
      referralWithdrawn: !!m?.withdrawn_at,
      counselAccepted: !!m?.counsel_accepted_at,
      documentAuthorisations: docs.map((d) => ({ id: String(d.id), documentId: String(d.document_id), classification: String(d.classification), expiresAt: toDate(d.expires_at), revoked: !!d.revoked_at })),
    })
  }
  return out
}

// ── Counsel read path (the only one) ─────────────────────────────────────────

/**
 * What counsel may see of a matter, and nothing more. Counsel is identified ONLY through `deps.counsel` (the
 * `CounselIdentityVerifier` port). With no verifier configured this refuses (`COUNSEL_NOT_VERIFIABLE`): the repository
 * ships no counsel-side issuer, so counsel access is fail-closed until the counsel-side gate and key custody
 * (UE-CONV-G-003) are met outside this repository. Counsel is addressed by the pseudonymous matter id; the
 * manifest is built by explicit field copy and is a subset of the live consent at the moment of the call, re-checked
 * on every call (revocation and expiry apply immediately).
 */
export async function readWorkAidCounselManifest(
  exec: SqlExecutor,
  deps: Pick<EnforcementDeps, 'counsel' | 'memberships' | 'now' | 'documentPolicy'>,
  i: { organizationId: string; counselUserId: string; matterId: string },
): Promise<CounselManifest> {
  requireUuids(i.organizationId)
  requirePrincipals(i.counselUserId)
  if (!deps.counsel) throw new AuthorityStoreError('DENIED', 'COUNSEL_NOT_VERIFIABLE: no counsel-side identity verifier is configured')
  if (!isUuid(i.matterId)) throw refuse('COUNSEL_ACCESS_REFUSED', 'unknown matter')
  const row = (await exec.query<Row>(`${GRANT_SELECT} WHERE g.organization_id = $1 AND g.matter_id = $2`, [i.organizationId, i.matterId])).rows[0]
  if (!row) throw refuse('COUNSEL_ACCESS_REFUSED', 'unknown matter')
  const grant = mapGrant(row)
  await requireCounselSession(exec, deps, { organizationId: i.organizationId, matterId: grant.matterId, claimedUserId: i.counselUserId })
  const now = clock(deps)
  const matter = (await exec.query<Row>(`SELECT referred_at, withdrawn_at FROM ue_authority_workaid_matters WHERE organization_id = $1 AND id = $2`, [i.organizationId, grant.matterId])).rows[0]
  if (!matter || matter.withdrawn_at) throw refuse('COUNSEL_ACCESS_REFUSED', 'the matter is not referred or was withdrawn')
  if (!consentLive(grant, now)) throw refuse('CONSENT_NOT_LIVE', 'the member consent is revoked or expired')

  const shares = (
    await exec.query<Row>(
      `SELECT s.id::text AS id, s.kind, s.categories, s.document_auth_id::text AS document_auth_id,
              a.id::text AS auth_id, a.document_id::text AS document_id, a.classification, a.expires_at AS auth_expires_at, a.revoked_at AS auth_revoked_at
         FROM ue_authority_workaid_shares s
         LEFT JOIN ue_authority_workaid_document_auths a ON a.id = s.document_auth_id AND a.organization_id = s.organization_id
        WHERE s.organization_id = $1 AND s.matter_id = $2 AND s.consent_id = $3 AND s.invalidated_at IS NULL
        ORDER BY s.created_at`,
      [i.organizationId, grant.matterId, grant.consentId],
    )
  ).rows

  const released = new Set<WorkAidCategory>()
  const documents: CounselManifest['documents'][number][] = []
  for (const s of shares) {
    const cats = parsePgTextArray(s.categories) as WorkAidCategory[]
    if (!cats.every((c) => grant.categories.includes(c))) continue
    if (String(s.kind) === 'document') {
      if (!s.auth_id || s.auth_revoked_at || toDate(s.auth_expires_at) <= now) continue
      const cls = await shareableClass(exec, deps, i.organizationId, grant, String(s.document_id))
      if (!cls) continue
      documents.push({ itemRef: String(s.auth_id), classification: cls, authorisedUntil: toDate(s.auth_expires_at).toISOString() })
      released.add('documents')
    } else {
      for (const c of cats) released.add(c)
    }
  }

  await exec.query(`INSERT INTO ue_authority_workaid_counsel_access (organization_id, matter_id, counsel_user_id, shares_served) VALUES ($1,$2,$3,$4)`, [i.organizationId, grant.matterId, i.counselUserId, shares.length])
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.counsel_access',
    resourceType: 'ue_authority_workaid_counsel_access',
    resourceId: grant.matterId,
    details: { counsel: i.counselUserId, documentsServed: documents.length, releasedCategories: [...released].sort() },
  })
  return {
    matterId: grant.matterId,
    referredAt: toDate(matter.referred_at).toISOString(),
    consent: { categories: grant.categories, purpose: grant.purpose, expiresAt: grant.expiresAt.toISOString(), textVersion: grant.textVersion },
    releasedCategories: [...released].sort(),
    memberIdentityDisclosure: released.has('member_identity') ? 'authorised' : 'not_authorised',
    documents,
    counselSideState: 'union_record_only',
  }
}
