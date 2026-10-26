/**
 * Authority store — authoritative resource-fact loaders.
 *
 * Every fact comes from a current, server-side, organization-scoped record. No
 * client claim, role seniority or token content contributes. Where the source
 * schema cannot truthfully supply a fact, the loader does NOT guess: it omits the
 * fact (so a scoped authority cannot match) or returns null / throws, which the
 * enforcement wrapper turns into a denial.
 *
 * Source coverage (see docs/union-eyes/convergence for the full matrix):
 *   case          public.grievances, else public.claims (creator, classification) + ue_authority_resource_relationships
 *                 (governed assignments) + ue_authority_workaid_matters (counsel control)
 *   document      public.documents + public.document_links (grievance links only)
 *   financial     public.payments (amount, currency) + ue_authority_financial_steps
 *   review        ue_authority_reviews
 *   workaid       ue_authority_workaid_matters (union-side references only)
 *   message       message_threads (identity of the conversation only; never its subject or body)
 * No authoritative source exists for: case unit/territory, case respondents,
 * member financial records keyed to a principal, or WorkAid counsel content.
 */
import { createHash } from 'node:crypto'
import type {
  AuthorityRequest,
  CaseFacts,
  FinancialTransactionFacts,
  GovernanceReviewFacts,
  MessageThreadFacts,
  ResourceFacts,
  ResourceRelationship,
  WorkAidMatterFacts,
} from '../ontology'
import { DEFAULT_DOCUMENT_CLASS_POLICY, type DocumentClassPolicy } from '../document-class'
import { isPrincipalId, isUuid, parsePgTextArray, type SqlExecutor } from './executor'

type Row = Record<string, unknown>

export interface LoadedResource {
  resource: ResourceFacts
  /** Relationships DERIVED from source records (origin 'derived' or explicit rows owned elsewhere). */
  relationships?: ResourceRelationship[]
}

export type ResourceLoader = (exec: SqlExecutor, req: AuthorityRequest, now: Date) => Promise<LoadedResource | null>

/** Deterministic uuid-shaped id for a derived row, so facts stay stable across loads. */
export function derivedId(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const toDate = (v: unknown): Date => {
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new Error(`unmappable timestamp: ${String(v)}`)
  return d
}

/** Exact decimal-string -> integer minor units. Never goes through floating point. */
export function decimalToMinor(value: unknown): number {
  const text = String(value).trim()
  const m = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(text)
  if (!m) throw new Error(`amount is not a non-negative decimal with at most 2 places: ${text}`)
  const minor = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(minor)) throw new Error('amount exceeds the safe integer range')
  return minor
}

// ── Case ─────────────────────────────────────────────────────────────────────

export async function loadCase(exec: SqlExecutor, req: AuthorityRequest, now: Date, policy: DocumentClassPolicy = DEFAULT_DOCUMENT_CLASS_POLICY): Promise<LoadedResource | null> {
  const org = req.resource.organizationId
  if (!isUuid(org) || !isUuid(req.resource.id)) return null
  let row = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, created_by, created_at,
              COALESCE(is_confidential, false) AS is_confidential,
              COALESCE(has_legal_implications, false) AS has_legal_implications
         FROM public.grievances WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [org, req.resource.id],
    )
  ).rows[0]
  // A claim is a case too: its kernel id is its public claim_id, and the member who filed it is its creator. A claim
  // carries no confidentiality or legal-implications column, so it is a standard, non-confidential case until a
  // governed source says otherwise. The two id spaces are both uuids; a grievance match always wins.
  if (!row) {
    row = (
      await exec.query<Row>(
        `SELECT claim_id::text AS id, organization_id::text AS organization_id, member_id AS created_by, created_at,
                false AS is_confidential, false AS has_legal_implications
           FROM public.claims WHERE organization_id = $1::uuid AND claim_id = $2::uuid`,
        [org, req.resource.id],
      )
    ).rows[0]
  }
  if (!row) return null

  // Counsel control comes only from an accepted, unwithdrawn WorkAid referral.
  const counsel = (
    await exec.query<Row>(
      `SELECT 1 FROM ue_authority_workaid_matters
        WHERE organization_id = $1::uuid AND case_id = $2::uuid AND counsel_accepted_at IS NOT NULL AND withdrawn_at IS NULL`,
      [org, req.resource.id],
    )
  ).rows.length > 0

  const facts: CaseFacts = {
    kind: 'case',
    id: String(row.id),
    organizationId: String(row.organization_id),
    // No source column for unit, territory or respondents: they stay absent and scoped authority cannot match.
    unitId: null,
    territoryId: null,
    // Legal implications are the only privilege signal; confidentiality is carried separately.
    classification: row.has_legal_implications === true ? 'privileged' : 'standard',
    confidential: row.is_confidential === true,
    counselControlled: counsel,
    adverseUserIds: [],
  }
  if (req.action === 'case:read_own_submission' && isUuid(req.documentId)) {
    const doc = await loadDocument(exec, org, req.documentId, policy)
    facts.requestedDocumentIsPrincipalsOwnSubmission =
      !!doc && !doc.privileged && doc.uploadedBy === req.principalUserId && doc.caseIds.length === 1 && doc.caseIds[0] === facts.id
  }

  const relationships: ResourceRelationship[] = []
  const creator = row.created_by as string | null
  if (isPrincipalId(creator)) {
    relationships.push({
      id: derivedId('creator', facts.id, creator),
      organizationId: org,
      principalUserId: creator,
      resource: { type: 'case', id: facts.id, organizationId: org },
      relation: 'creator',
      permissions: [],
      privilegedAccess: false,
      origin: 'derived',
      grantedBy: null,
      status: 'active',
      effectiveAt: toDate(row.created_at),
      expiresAt: null,
      revokedAt: null,
    })
  }

  // Only the creator relationship is derived from the case row. Every assignment, ownership and collaborator
  // relationship is an explicit, governed kernel record loaded with the principal's facts (ue_authority_resource_relationships).
  // The pre-kernel collaborator table is deliberately not read: it carried flags, not governed grants.
  return { resource: facts, relationships }
}

// ── Document ─────────────────────────────────────────────────────────────────

export interface DocumentFacts {
  id: string
  organizationId: string
  uploadedBy: string | null
  /** Legal privilege flag or a privileged label under the policy in force. */
  privileged: boolean
  containsLegalPrivilege: boolean
  /** Medical, disciplinary or member-PII flags: information that may concern someone other than the reader. */
  thirdPartySensitive: boolean
  /** documents.privacy_label; null when absent. Anything unrecognised is treated as the union's working file. */
  label: string | null
  /** Grievance ids this document is linked to. Exactly one is required to derive access. */
  caseIds: string[]
}

export async function loadDocument(
  exec: SqlExecutor,
  organizationId: string,
  documentId: string,
  policy: DocumentClassPolicy = DEFAULT_DOCUMENT_CLASS_POLICY,
): Promise<DocumentFacts | null> {
  if (!isUuid(organizationId) || !isUuid(documentId)) return null
  const doc = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, uploaded_by,
              privacy_label::text AS privacy_label, COALESCE(contains_legal_privilege, false) AS contains_legal_privilege,
              (COALESCE(contains_medical_sensitive, false) OR COALESCE(medical_sensitive, false)
               OR COALESCE(disciplinary_sensitive, false) OR COALESCE(member_pii, false)) AS third_party_sensitive
         FROM public.documents WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [organizationId, documentId],
    )
  ).rows[0]
  if (!doc) return null
  // Only grievance links are authoritative. A bare 'case' link may refer to the legacy claims model.
  const links = (
    await exec.query<Row>(
      `SELECT DISTINCT linked_entity_id::text AS id FROM public.document_links
        WHERE document_id = $1::uuid AND linked_entity_type::text = 'grievance'`,
      [documentId],
    )
  ).rows
  return {
    id: String(doc.id),
    organizationId: String(doc.organization_id),
    uploadedBy: (doc.uploaded_by as string | null) ?? null,
    privileged: doc.contains_legal_privilege === true || policy.privilegedLabels.includes(String(doc.privacy_label)),
    containsLegalPrivilege: doc.contains_legal_privilege === true,
    thirdPartySensitive: doc.third_party_sensitive === true,
    label: doc.privacy_label ? String(doc.privacy_label) : null,
    caseIds: links.map((l) => String(l.id)),
  }
}

// ── Financial transaction ────────────────────────────────────────────────────

/**
 * Whether the deployed public.payments relation can serve as an authoritative transaction source at all. Under the
 * Django-first lineage it is a four-column stub (id, created_at, updated_at, organization_id); the Drizzle shape the
 * kernel's finance policy needs adds amount, currency and the payer. Routes use this to keep finance actions
 * UNAVAILABLE rather than simulating them, and registration refuses with the exact missing columns.
 */
export const PAYMENT_SOURCE_COLUMNS = ['id', 'organization_id', 'amount', 'currency', 'member_id'] as const

export interface FinanceSourceReadiness {
  ready: boolean
  missingColumns: string[]
}

export async function financeSourceReadiness(exec: SqlExecutor): Promise<FinanceSourceReadiness> {
  const rows = (
    await exec.query<Row>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments'`,
    )
  ).rows
  const present = new Set(rows.map((r) => String(r.column_name)))
  const missingColumns = PAYMENT_SOURCE_COLUMNS.filter((c) => !present.has(c))
  return { ready: missingColumns.length === 0, missingColumns }
}

export async function loadFinancialTransaction(exec: SqlExecutor, req: AuthorityRequest): Promise<LoadedResource | null> {
  const org = req.resource.organizationId
  if (!isUuid(org) || !isUuid(req.resource.id)) return null
  const steps = (
    await exec.query<Row>(
      `SELECT step, actor, account_id::text AS account_id, required_approvals, amount_minor::text AS amount_minor, currency, at
         FROM ue_authority_financial_steps
        WHERE organization_id = $1::uuid AND subject_type = 'payment' AND subject_id = $2::uuid ORDER BY at, id`,
      [org, req.resource.id],
    )
  ).rows
  const registered = steps.find((s) => s.step === 'registered')
  if (!registered) return null
  const payment = (
    await exec.query<Row>(
      `SELECT amount::text AS amount, currency, member_id FROM public.payments WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [org, req.resource.id],
    )
  ).rows[0]
  if (!payment) return null
  const amountMinor = decimalToMinor(payment.amount)
  const currency = String(payment.currency ?? '')
  // The registration is a snapshot. If the source amount or currency moved since, the record is contradictory.
  if (String(registered.amount_minor) !== String(amountMinor) || registered.currency !== currency) {
    throw new Error('payment amount or currency changed after registration')
  }
  const by = (step: string) => steps.find((s) => s.step === step)
  const approvals = steps.filter((s) => s.step === 'approved').map((s) => ({ userId: String(s.actor), at: toDate(s.at) }))
  const required = Number(registered.required_approvals)
  const state: FinancialTransactionFacts['state'] = by('voided')
    ? 'void'
    : by('reconciled')
      ? 'reconciled'
      : by('executed')
        ? 'executed'
        : by('prepared') && approvals.length >= required
          ? 'approved'
          : by('prepared')
            ? 'prepared'
            : 'draft'
  const payee = payment.member_id as string | null
  const facts: FinancialTransactionFacts = {
    kind: 'financial_transaction',
    id: req.resource.id,
    organizationId: org,
    accountId: String(registered.account_id),
    amountMinor,
    currency,
    state,
    preparedBy: by('prepared') ? String(by('prepared')!.actor) : null,
    approvals,
    requiredApprovals: required,
    executedBy: by('executed') ? String(by('executed')!.actor) : null,
    reconciledBy: by('reconciled') ? String(by('reconciled')!.actor) : null,
    // A payee can never act on their own payment.
    adverseUserIds: isPrincipalId(payee) ? [payee] : [],
  }
  return { resource: facts }
}

// ── Governance review ────────────────────────────────────────────────────────

export async function loadReview(exec: SqlExecutor, req: AuthorityRequest): Promise<LoadedResource | null> {
  const org = req.resource.organizationId
  if (!isUuid(org) || !isUuid(req.resource.id)) return null
  const r = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, complainant_user_id, adverse_user_ids,
              classification, remediation_owner_user_id
         FROM ue_authority_reviews WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [org, req.resource.id],
    )
  ).rows[0]
  if (!r) return null
  const facts: GovernanceReviewFacts = {
    kind: 'governance_review',
    id: String(r.id),
    organizationId: String(r.organization_id),
    adverseUserIds: parsePgTextArray(r.adverse_user_ids),
    complainantUserId: (r.complainant_user_id as string | null) ?? null,
    classification: r.classification === 'privileged' ? 'privileged' : 'standard',
    remediationOwnerUserId: (r.remediation_owner_user_id as string | null) ?? null,
  }
  return { resource: facts }
}

// ── WorkAid (union side only) ────────────────────────────────────────────────

export async function loadWorkAidMatter(exec: SqlExecutor, req: AuthorityRequest): Promise<LoadedResource | null> {
  const org = req.resource.organizationId
  if (!isUuid(org) || !isUuid(req.resource.id)) return null
  const r = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, member_user_id, case_id::text AS case_id
         FROM ue_authority_workaid_matters WHERE organization_id = $1::uuid AND id = $2::uuid AND withdrawn_at IS NULL`,
      [org, req.resource.id],
    )
  ).rows[0]
  if (!r) return null
  const facts: WorkAidMatterFacts = {
    kind: 'workaid_matter',
    id: String(r.id),
    organizationId: String(r.organization_id),
    memberUserId: String(r.member_user_id),
    caseId: String(r.case_id),
    counselControlled: true,
  }
  return { resource: facts }
}

export async function loadMessageThread(exec: SqlExecutor, req: AuthorityRequest): Promise<LoadedResource | null> {
  const org = req.resource.organizationId
  if (!isUuid(org) || !isUuid(req.resource.id)) return null
  const r = (
    await exec.query<Row>(
      `SELECT id::text AS id, organization_id::text AS organization_id, member_id, staff_id, status
         FROM message_threads WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [org, req.resource.id],
    )
  ).rows[0]
  if (!r) return null
  const facts: MessageThreadFacts = {
    kind: 'message_thread',
    id: String(r.id),
    organizationId: String(r.organization_id),
    memberUserId: String(r.member_id),
    assigneeUserId: r.staff_id == null ? null : String(r.staff_id),
    status: r.status === 'closed' ? 'closed' : 'open',
  }
  return { resource: facts }
}

/** The canonical loaders under the document classification policy in force (provisional default unless an institution supplies one). */
export const createCanonicalResourceLoader = (policy: DocumentClassPolicy = DEFAULT_DOCUMENT_CLASS_POLICY): ResourceLoader => async (exec, req, now) => {
  switch (req.resource.type) {
    case 'case':
      return loadCase(exec, req, now, policy)
    case 'financial_transaction':
      return loadFinancialTransaction(exec, req)
    case 'governance_review':
      return loadReview(exec, req)
    case 'workaid_matter':
      return loadWorkAidMatter(exec, req)
    case 'message_thread':
      return loadMessageThread(exec, req)
    default:
      // member_financial_record has no authoritative principal-keyed source; approval_request is loaded by the store.
      return null
  }
}

export const canonicalResourceLoader: ResourceLoader = createCanonicalResourceLoader()
