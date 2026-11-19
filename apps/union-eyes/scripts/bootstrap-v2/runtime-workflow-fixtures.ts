/** Source-workflow qualification of the institutional authority kernel and member-conversation tables.
 * These relations are written only by their audited workflows: an actor column must be the session
 * principal, every kernel row needs a canonical audit record in the same transaction, grants need an
 * active institutional rule, and conversation history must match the live thread. A raw synthetic
 * INSERT can never pass those guards and must not. Every positive row below is therefore produced by
 * the real store or messaging service, in the original production-issued canonical session of the
 * person who performs it, continuing from the parties the guarded case fixture installed. No
 * released SQL, role grant, trigger, policy, CHECK or caller verdict is substituted or relaxed.
 *
 * Not qualified here, because the base release has no reachable workflow for them:
 *   ue_authority_counsel_nonces and ue_authority_workaid_counsel_access are written only inside a
 *   counsel-assertion verification (lib/authority/store/counsel.ts createAssertionBackedCounselVerifier,
 *   lib/authority/store/workaid-disclosure.ts readWorkAidCounselManifest), which needs a
 *   deployment-supplied CounselAssertionVerifier. None ships (lib/authority/store/enforce.ts
 *   EnforcementDeps.counsel; capability UE-WORKAID-UNION-SIDE-DISCLOSURE), so every counsel act
 *   fails closed with COUNSEL_NOT_VERIFIABLE and no such row can be produced honestly.
 */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { DEFAULT_ISSUANCE_TEMPLATES } from '../../lib/authority/issuance'
import { activeMembershipSource } from '../../lib/authority/store/active-membership-source'
import { recordCounselEngagement } from '../../lib/authority/store/counsel'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { isUuid } from '../../lib/authority/store/executor'
import {
  acceptInstrument,
  declareOwnRecusal,
  issueDelegation,
  issueMandate,
  requestIssuanceApproval,
} from '../../lib/authority/store/lifecycle'
import { openMemberReview } from '../../lib/authority/store/review-intake'
import {
  authoriseWorkAidDocument,
  createWorkAidShare,
  grantWorkAidConsent,
  recordConsentText,
  referMatterToWorkAid,
} from '../../lib/authority/store/workaid-disclosure'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../db/auth/authority-physical-guards'
import type { V2Plan } from './source'
import type { RuntimeSessionFactory } from './runtime-column-fixtures'
import type { ColumnTableReport } from './runtime-column-security'
import { assertRestrictedRuntimeTransaction } from './runtime-session-proof'
import {
  GUARDED_CASE_ACTOR_CLASSES,
  GUARDED_CASE_PARTIES,
  adoptGuardedIssuanceRule,
  assertFixtureHistory,
  createGuardedActor,
  exactDenied,
  failureSummary,
  openGuardedSessionHarness,
  readFixtureHistory,
  voteGuardedApproval,
  type GuardedActor,
  type GuardedCaseParty,
  type GuardedCaseRuntimeResult,
  type GuardedWithin,
  type HistorySnapshot,
} from './runtime-guarded-case-fixtures'

export const WORKFLOW_RUNTIME_TABLES = [
  'message_thread_assignments',
  'message_thread_lifecycle',
  'ue_authority_acceptances',
  'ue_authority_approval_decisions',
  'ue_authority_approval_requests',
  'ue_authority_counsel_engagements',
  'ue_authority_delegations',
  'ue_authority_disclosure_consents',
  'ue_authority_events',
  'ue_authority_issuance_rules',
  'ue_authority_mandates',
  'ue_authority_recusals',
  'ue_authority_resource_relationships',
  'ue_authority_reviews',
  'ue_authority_workaid_consent_grants',
  'ue_authority_workaid_consent_texts',
  'ue_authority_workaid_document_auths',
  'ue_authority_workaid_matters',
  'ue_authority_workaid_shares',
] as const
export type WorkflowTable = (typeof WORKFLOW_RUNTIME_TABLES)[number]
export const isWorkflowRuntimeTable = (name: string): name is WorkflowTable =>
  WORKFLOW_RUNTIME_TABLES.some((table) => table === name)

export const WORKFLOW_ACTOR_WITNESSES = [
  'LIVE_SOURCE_CLASS_VERIFIED',
  'OWN_TENANT_READ_OBSERVED',
  'FOREIGN_TENANT_READ_DENIED',
  'MISSING_USER_READ_DENIED',
  'MISSING_ORG_READ_DENIED',
  'MISSING_BEARER_READ_DENIED',
  'FOREIGN_ORG_CONTEXT_READ_DENIED',
  'RAW_WORKFLOW_BYPASS_REFUSED',
  'DENIED_WRITE_HISTORY_UNCHANGED',
] as const
export const WORKFLOW_REQUIRED_CASES = [
  'OWN_WORKFLOW_OPERATION_ROWS_VERIFIED',
  'BIDIRECTIONAL_TENANT_READ_ISOLATION',
  'MISSING_AND_FOREIGN_CONTEXT_DENIED',
  'WORKFLOW_BYPASS_DENIED_FOR_EVERY_ACTOR_CLASS',
  'FAILED_MUTATION_HISTORY_UNCHANGED',
  'ORIGINAL_WORKFLOW_ROWS_PRESERVED',
  'SOURCE_SYSTEM_BOUNDARY_VERIFIED',
] as const

/**
 * The exact refusal (SQLSTATE:guard) each table's physical protection raises when a lower-capacity
 * session writes the row directly, bypassing its workflow. 23514 AUDIT_LINK_MISSING is the deferred
 * canonical-audit link: the row is otherwise well formed, so only the missing workflow refuses it.
 */
export const WORKFLOW_RAW_BYPASS_REFUSALS: Readonly<Record<WorkflowTable, string>> = {
  message_thread_assignments: '23001:ASSIGNMENT_NOT_THREAD_STATE',
  message_thread_lifecycle: '23001:LIFECYCLE_NOT_THREAD_STATE',
  ue_authority_acceptances: '42501:ONLY_THE_HOLDER_MAY_ACCEPT',
  ue_authority_approval_decisions: '42501:ALREADY_DECIDED',
  ue_authority_approval_requests: '23514:AUDIT_LINK_MISSING',
  ue_authority_counsel_engagements: '23514:AUDIT_LINK_MISSING',
  ue_authority_delegations: '42501:ISSUER_AUTHORITY_REQUIRED',
  ue_authority_disclosure_consents: '23514:AUDIT_LINK_MISSING',
  ue_authority_events: '42501:EVENT_RECORDING_TRIGGER_ONLY',
  ue_authority_issuance_rules: '42501:ISSUANCE_RULE_MUST_START_DRAFT',
  ue_authority_mandates: '42501:APPROVAL_NOT_SATISFIED',
  ue_authority_recusals: '23514:AUDIT_LINK_MISSING',
  ue_authority_resource_relationships: '42501:NO_ACTIVE_ISSUANCE_RULE',
  ue_authority_reviews: '23514:AUDIT_LINK_MISSING',
  ue_authority_workaid_consent_grants: '23514:WORKAID_GRANT_INVALID',
  ue_authority_workaid_consent_texts: '23514:AUDIT_LINK_MISSING',
  ue_authority_workaid_document_auths: '23514:WORKAID_DOCAUTH_INVALID',
  ue_authority_workaid_matters: '23514:AUDIT_LINK_MISSING',
  ue_authority_workaid_shares: '23514:AUDIT_LINK_MISSING',
}

const actorCaseNames = (table: string) =>
  GUARDED_CASE_ACTOR_CLASSES.flatMap((actor) =>
    GUARDED_CASE_PARTIES.flatMap((party) =>
      WORKFLOW_ACTOR_WITNESSES.map((witness) => `${table}:${actor}:${party}:${witness}`),
    ),
  )

/** Every report must carry its own observed workflow, isolation and refusal evidence, exactly once. */
export function workflowReportComplete(report: ColumnTableReport): boolean {
  if (
    !isWorkflowRuntimeTable(report.table) ||
    report.status !== 'PASS' ||
    Object.hasOwn(report, 'failure') ||
    Object.hasOwn(report, 'failedProof')
  )
    return false
  const refusal = `${report.table}:RAW_BYPASS_REFUSAL:${WORKFLOW_RAW_BYPASS_REFUSALS[report.table]}`
  const required = [
    ...WORKFLOW_REQUIRED_CASES.map((name) => `${report.table}:${name}`),
    refusal,
    ...actorCaseNames(report.table),
  ]
  return (
    report.cases.length === required.length &&
    required.every((name) => report.cases.filter((value) => value === name).length === 1)
  )
}

type PartyIds = Record<WorkflowTable, string[]>
interface WorkflowParty extends GuardedCaseParty {
  admin: GuardedActor
  counselUserId: string
  officeRuleId: string
  delegationRuleId: string
  officeApprovalRequestId: string
  officeMandateId: string
  grievanceId: string
  documentId: string
  textId: string
  textVersion: string
  textSha256: string
  consentId: string
  matterId: string
  threadId: string
  ids: PartyIds
}
export interface WorkflowRuntimeInput {
  operator: pg.Client
  runtime: pg.Client
  system: pg.Client
  sessions: RuntimeSessionFactory
  plan: V2Plan
  guarded: GuardedCaseRuntimeResult
}
export interface WorkflowRuntimeQualification {
  qualifyTable(table: WorkflowTable): Promise<ColumnTableReport>
}

const deps = { memberships: activeMembershipSource }
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
const KERNEL_TABLES = WORKFLOW_RUNTIME_TABLES.filter(
  (table) => table.startsWith('ue_authority_') && table !== 'ue_authority_events',
)
const WORKFLOW_HISTORY_TABLES = [
  ...new Set([
    ...AUTHORITY_PHYSICAL_GUARDS.tables,
    ...WORKFLOW_RUNTIME_TABLES,
    'message_threads',
    'messages',
    'triage_designations',
    'grievances',
    'grievance_events',
    'documents',
    'document_links',
    'document_versions',
    'audit_logs',
    'in_app_notifications',
    'notification_queue',
    'notification_delivery_log',
  ]),
]
const WORKFLOW_MARKERS = [
  'AUDIT_LINK_MISSING',
  'ISSUER_AUTHORITY_REQUIRED',
  'NO_ACTIVE_ISSUANCE_RULE',
  'APPROVAL_NOT_SATISFIED',
  'CONSENT_TEXT_NOT_AUTHORIZED',
  'CONSENT_TEXT_UNAVAILABLE',
  'CASE_NOT_OWNED_BY_MEMBER',
  'CAPACITY_NOT_ELIGIBLE',
  'DOCUMENT_NOT_SHAREABLE',
  'ENGAGEMENT_RECORDER_NOT_AUTHORIZED',
  'ENGAGEMENT_PARTY_CONFLICT',
  'WORKAID_GRANT_INVALID',
  'WORKAID_DOCAUTH_INVALID',
  'WORKAID_SHARE_INVALID',
]
/** Known guard messages that carry no leading marker, named by the guard that raises them. */
const REFUSAL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /^ue_authority_events can only be written by the authority recording trigger/,
    'EVENT_RECORDING_TRIGGER_ONLY',
  ],
  [
    /^message_thread_assignments: record does not match the thread tenant or its resulting assignee/,
    'ASSIGNMENT_NOT_THREAD_STATE',
  ],
  [/^message_thread_lifecycle: the conversation is not archived/, 'LIFECYCLE_NOT_THREAD_STATE'],
  [/^new row violates row-level security policy/, 'ROW_LEVEL_SECURITY'],
  [/^permission denied/, 'PERMISSION_DENIED'],
]
/** SQLSTATE and guard of the database refusal that rejected a write (never its free text). */
export function databaseRefusal(error: unknown): string {
  let value = error as { cause?: unknown; code?: unknown; message?: unknown } | undefined
  while (value && typeof value === 'object' && value.cause && typeof value.cause === 'object')
    value = value.cause as typeof value
  const code =
    typeof value?.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code) ? value.code : 'NOCODE'
  const message = typeof value?.message === 'string' ? value.message : ''
  const marker =
    /^([A-Z][A-Z0-9_]{3,})(?::|$)/.exec(message)?.[1] ??
    REFUSAL_PATTERNS.find(([pattern]) => pattern.test(message))?.[1] ??
    'UNMARKED'
  return `${code}:${marker}`
}
const summary = (stage: string, error: unknown): string => {
  const message = (error as { message?: unknown } | undefined)?.message
  // Fixture-owned assertion text is identifiers only (tables, SQLSTATEs, guard markers); the
  // runtime may append an actual/expected diff after it, which is never reported.
  const first = typeof message === 'string' ? message.split('\n', 1)[0] : ''
  if (/^WORKFLOW_[A-Z_]+(?::[A-Za-z0-9_]+)*$/.test(first)) return `${stage}:${first}`
  return `${stage}:${failureSummary(error, WORKFLOW_MARKERS)}`
}
const emptyIds = (): PartyIds =>
  Object.fromEntries(WORKFLOW_RUNTIME_TABLES.map((table) => [table, [] as string[]])) as PartyIds
const now = () => Date.now()

/**
 * Produces every positive row through its workflow, then returns a per-table qualification that
 * reuses those rows. Any setup failure is reported, unchanged, as the failure of every table.
 */
export async function prepareWorkflowRuntimeSecurity(
  input: WorkflowRuntimeInput,
): Promise<WorkflowRuntimeQualification> {
  let stage = 'SETUP'
  try {
    const parties = await produceWorkflowRows(input, (next) => (stage = next))
    stage = 'ORIGINAL_ROWS'
    const original = new Map<WorkflowTable, string>()
    for (const table of WORKFLOW_RUNTIME_TABLES)
      original.set(table, await producedDigest(input.operator, table, parties))
    return {
      qualifyTable: (table) => qualifyWorkflowTable(input, parties, original, table),
    }
  } catch (error) {
    const failure = summary(stage, error)
    return {
      qualifyTable: async (table) => ({ table, status: 'FAIL', cases: [], failure }),
    }
  }
}

async function producedDigest(
  operator: pg.Client,
  table: WorkflowTable,
  parties: readonly WorkflowParty[],
): Promise<string> {
  const ids = parties.flatMap((party) => party.ids[table])
  const rows = (
    await operator.query<{ id: string; row: string }>(
      `SELECT id::text AS id,to_jsonb(t)::text AS row FROM public.${quote(table)} t WHERE id=ANY($1::uuid[]) ORDER BY id`,
      [ids],
    )
  ).rows
  assert.equal(rows.length, ids.length, `WORKFLOW_PRODUCED_ROWS_MISSING:${table}`)
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

async function produceWorkflowRows(
  input: WorkflowRuntimeInput,
  setStage: (stage: string) => void,
): Promise<[WorkflowParty, WorkflowParty]> {
  assert(input.plan.authExecution, 'WORKFLOW_CANONICAL_AUTH_REQUIRED')
  for (const table of WORKFLOW_RUNTIME_TABLES) {
    const source = input.plan.tables.find((entry) => entry.name === table)
    assert.equal(
      source?.source,
      table.startsWith('message_')
        ? 'apps/union-eyes/db/schema/messages-schema.ts'
        : 'apps/union-eyes/db/schema/domains/ml/authority-kernel.ts',
      `WORKFLOW_SOURCE_REQUIRED:${table}`,
    )
    assert.equal(source.authority?.classification, 'TENANT_RLS_REQUIRED')
  }
  const guardedParties = input.guarded.parties
  assert(guardedParties, 'WORKFLOW_GUARDED_PARTIES_REQUIRED')
  assert.notEqual(
    guardedParties[0].party.organizationId,
    guardedParties[1].party.organizationId,
    'WORKFLOW_TWO_ORGANIZATIONS_REQUIRED',
  )
  const harness = openGuardedSessionHarness(input)
  const within = harness.within
  try {
    const produced: WorkflowParty[] = []
    for (const guarded of guardedParties) {
      const { party } = guarded
      const org = party.organizationId
      const [president, vicePresident, treasurer] = party.executives
      const ids = emptyIds()
      ids.ue_authority_resource_relationships.push(guarded.assignmentRelationshipId)
      setStage('ACTORS')
      // An organization administrator grants the messages designation; counsel is an external principal.
      const admin = await createGuardedActor(input.operator, org, 'admin')
      const counselUserId = randomUUID()
      await input.operator.query(
        "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin,email_verified) VALUES($1,$2,true,'active',false,true)",
        [counselUserId, `workflow-counsel-${counselUserId}@example.invalid`],
      )
      setStage('ADOPT_RULES')
      const rules: Record<'executive_office' | 'delegation', string> = {
        executive_office: '',
        delegation: '',
      }
      for (const domain of ['executive_office', 'delegation'] as const) {
        const template = DEFAULT_ISSUANCE_TEMPLATES.find(
          (entry) => entry.domain === domain && entry.operation === 'issue',
        )
        assert(template, 'WORKFLOW_EXISTING_ISSUANCE_TEMPLATE_REQUIRED')
        const { rationale: _rationale, ...source } = template
        const adopted = await adoptGuardedIssuanceRule(within, party, source)
        rules[domain] = adopted.ruleId
        ids.ue_authority_issuance_rules.push(adopted.ruleId)
        ids.ue_authority_approval_requests.push(adopted.approvalRequestId)
        ids.ue_authority_approval_decisions.push(...adopted.decisionIds)
      }
      setStage('OFFICE_MANDATE')
      // The president installs the vice-president's office under independent approval; the holder accepts.
      const officeMandateId = randomUUID()
      const office = {
        organizationId: org,
        issuerUserId: president.userId,
        holderUserId: vicePresident.userId,
        kind: 'executive_office' as const,
        powers: ['approve'],
        sourceInstrument: `Disposable office qualification only ${officeMandateId}`,
        effectiveAt: new Date(now() - 60_000),
        expiresAt: new Date(now() + 30 * 86_400_000),
      }
      const officeApprovalRequestId = await within(president, (_tx, exec) =>
        requestIssuanceApproval(exec, deps, {
          ...office,
          instrumentId: officeMandateId,
          namedApproverIds: [treasurer.userId],
        }),
      )
      ids.ue_authority_approval_requests.push(officeApprovalRequestId)
      ids.ue_authority_approval_decisions.push(
        ...(await voteGuardedApproval(within, party, officeApprovalRequestId, [treasurer])),
      )
      const issued = await within(president, (_tx, exec) =>
        issueMandate(exec, deps, {
          ...office,
          id: officeMandateId,
          approvalRequestId: officeApprovalRequestId,
        }),
      )
      assert.equal(issued.mandateId, officeMandateId)
      ids.ue_authority_mandates.push(officeMandateId)
      ids.ue_authority_acceptances.push(
        await within(vicePresident, (_tx, exec) =>
          acceptInstrument(exec, {
            organizationId: org,
            instrumentType: 'mandate',
            instrumentId: officeMandateId,
            holderUserId: vicePresident.userId,
          }),
        ),
      )
      setStage('DELEGATION')
      // The office holder delegates one expiring action to the officer, who accepts it.
      const { delegationId } = await within(vicePresident, (_tx, exec) =>
        issueDelegation(exec, deps, {
          organizationId: org,
          delegatorUserId: vicePresident.userId,
          delegateUserId: party.officer.userId,
          office: 'Disposable qualification office',
          actions: ['case:read'],
          resourceTypes: ['case'],
          effectiveAt: new Date(now() - 60_000),
          expiresAt: new Date(now() + 30 * 86_400_000),
        }),
      )
      ids.ue_authority_delegations.push(delegationId)
      ids.ue_authority_acceptances.push(
        await within(party.officer, (_tx, exec) =>
          acceptInstrument(exec, {
            organizationId: org,
            instrumentType: 'delegation',
            instrumentId: delegationId,
            holderUserId: party.officer.userId,
          }),
        ),
      )
      setStage('RECUSAL')
      ids.ue_authority_recusals.push(
        await within(treasurer, (_tx, exec) =>
          declareOwnRecusal(exec, {
            organizationId: org,
            principalUserId: treasurer.userId,
            resourceType: 'case',
            resourceId: randomUUID(),
            reason: 'Disposable qualification recusal',
          }),
        ),
      )
      setStage('REVIEW')
      const review = await within(party.member, (_tx, exec) =>
        openMemberReview(exec, deps, {
          organizationId: org,
          actorUserId: party.member.userId,
          reviewType: 'complaint',
        }),
      )
      assert.equal(review.created, true, 'WORKFLOW_REVIEW_CREATED_REQUIRED')
      ids.ue_authority_reviews.push(review.id)
      setStage('GRIEVANCE')
      // The member's own intake and document, exactly as the intake and upload routes write them.
      const grievanceId = await within(party.member, async (tx) => {
        const { requireCaseFilingCapacity } = await import('../../lib/cases/case-authorization')
        const { grievances } = await import('../../db/schema/domains/claims/grievances')
        const { grievanceEvents } =
          await import('../../db/schema/domains/claims/grievance-lifecycle')
        const { persistAtomicAudit } = await import('../../lib/audit/atomic-audit')
        await requireCaseFilingCapacity(tx, party.member, 'member')
        const [row] = await tx
          .insert(grievances)
          .values({
            grievanceNumber: `GRV-WF-${randomUUID().slice(0, 18)}`,
            type: 'individual',
            title: 'Disposable workflow qualification intake',
            description: 'Disposable workflow qualification intake',
            priority: 'low',
            status: 'draft',
            organizationId: org,
            createdBy: party.member.userId,
            representedMemberUserId: party.member.userId,
            isGroupGrievance: false,
            isConfidential: false,
          })
          .returning()
        assert(row, 'WORKFLOW_GRIEVANCE_ROW_REQUIRED')
        await tx.insert(grievanceEvents).values({
          grievanceId: row.id,
          eventType: 'intake_submitted',
          actorUserId: party.member.userId,
          notes: 'Disposable workflow qualification intake',
        })
        await persistAtomicAudit(tx, {
          organizationId: org,
          userId: party.member.userId,
          action: 'grievance.submit_intake',
          resourceType: 'grievances',
          resourceId: row.id,
          details: { qualification: 'disposable workflow fixture' },
        })
        return row.id
      })
      const documentId = await within(party.member, async (tx) => {
        const { documents, documentVersions, documentLinks } =
          await import('../../db/schema/documents-schema')
        const { grievanceEvents } =
          await import('../../db/schema/domains/claims/grievance-lifecycle')
        const { persistAtomicAudit } = await import('../../lib/audit/atomic-audit')
        const [doc] = await tx
          .insert(documents)
          .values({
            organizationId: org,
            title: 'Disposable qualification statement',
            filename: 'statement.pdf',
            name: 'Disposable qualification statement',
            fileUrl: 'https://example.invalid/statement.pdf',
            fileType: 'evidence',
            documentType: 'evidence',
            mimeType: 'application/pdf',
            fileSize: 1,
            uploadedBy: party.member.userId,
            privacyLabel: 'team_confidential',
            containsPii: false,
            containsMedicalSensitive: false,
            containsLegalPrivilege: false,
            memberPii: false,
            medicalSensitive: false,
            disciplinarySensitive: false,
          })
          .returning()
        assert(doc, 'WORKFLOW_DOCUMENT_ROW_REQUIRED')
        await tx.insert(documentVersions).values({
          organizationId: org,
          documentId: doc.id,
          versionNo: 1,
          storageKey: 'https://example.invalid/statement.pdf',
          contentHash: `unverified:${doc.id}`,
          uploadedBy: party.member.userId,
        })
        await tx.insert(documentLinks).values({
          organizationId: org,
          documentId: doc.id,
          linkedEntityType: 'grievance',
          linkedEntityId: grievanceId,
          linkedBy: party.member.userId,
        })
        await tx.insert(grievanceEvents).values({
          grievanceId,
          eventType: 'document_uploaded',
          actorUserId: party.member.userId,
          notes: 'Document uploaded: evidence',
        })
        await persistAtomicAudit(tx, {
          organizationId: org,
          userId: party.member.userId,
          action: 'grievance.document_upload',
          resourceType: 'grievance_documents',
          resourceId: doc.id,
          details: { grievanceId, privacyLabel: doc.privacyLabel, documentType: doc.documentType },
        })
        return doc.id
      })
      setStage('CONSENT_TEXT')
      // Wording is recorded by the live office holder; it is fixture wording, not approved legal text.
      const textVersion = `qual-${randomUUID().slice(0, 8)}`
      const body = `DISPOSABLE QUALIFICATION WORDING ONLY (${textVersion}): not approved legal text.`
      const textSha256 = createHash('sha256').update(body, 'utf8').digest('hex')
      const textId = await within(vicePresident, (_tx, exec) =>
        recordConsentText(exec, deps, {
          organizationId: org,
          recorderUserId: vicePresident.userId,
          version: textVersion,
          body,
          effectiveAt: new Date(now() - 60_000),
        }),
      )
      ids.ue_authority_workaid_consent_texts.push(textId)
      setStage('CONSENT')
      const { consentId, matterId } = await within(party.member, (_tx, exec) =>
        grantWorkAidConsent(exec, deps, {
          organizationId: org,
          memberUserId: party.member.userId,
          caseId: grievanceId,
          categories: ['case_summary', 'documents'],
          purpose: 'Disposable qualification purpose',
          textVersion,
          acknowledgedTextSha256: textSha256,
          expiresAt: new Date(now() + 30 * 86_400_000),
        }),
      )
      ids.ue_authority_disclosure_consents.push(consentId)
      setStage('REFERRAL')
      const referred = await within(party.member, (_tx, exec) =>
        referMatterToWorkAid(exec, deps, {
          organizationId: org,
          referrerUserId: party.member.userId,
          matterId,
        }),
      )
      assert.equal(referred.matterId, matterId)
      ids.ue_authority_workaid_matters.push(matterId)
      setStage('DOCUMENT_AUTHORISATION')
      const documentAuthId = await within(party.member, (_tx, exec) =>
        authoriseWorkAidDocument(exec, deps, {
          organizationId: org,
          memberUserId: party.member.userId,
          matterId,
          documentId,
        }),
      )
      ids.ue_authority_workaid_document_auths.push(documentAuthId)
      setStage('SHARE')
      ids.ue_authority_workaid_shares.push(
        ...(await within(party.member, (_tx, exec) =>
          createWorkAidShare(exec, deps, {
            organizationId: org,
            actorUserId: party.member.userId,
            matterId,
            categories: ['case_summary'],
            documentAuthorisationIds: [documentAuthId],
            confirm: true,
          }),
        )),
      )
      setStage('COUNSEL_ENGAGEMENT')
      ids.ue_authority_counsel_engagements.push(
        await within(vicePresident, (_tx, exec) =>
          recordCounselEngagement(exec, deps, {
            organizationId: org,
            recorderUserId: vicePresident.userId,
            matterId,
            counselUserId,
            capacity: 'external_counsel',
            informationBarrier: false,
            effectiveAt: new Date(now() - 60_000),
            expiresAt: new Date(now() + 90 * 86_400_000),
          }),
        ),
      )
      setStage('MESSAGING')
      // Administrator designates the steward to triage; the member writes; the steward assigns the
      // officer; the member closes their own conversation.
      const { conversationAssigneeEligible, grantDesignation } =
        await import('../../lib/triage/designations')
      const { createMemberThread } = await import('../../lib/messaging/thread-access')
      const { assignThread } = await import('../../lib/messaging/thread-assignment')
      const { changeThreadLifecycle } = await import('../../lib/messaging/thread-lifecycle')
      const designation = await within(admin, (tx) =>
        grantDesignation(
          tx,
          admin,
          {
            scope: 'messages',
            userId: party.handler.userId,
            expiresAt: new Date(now() + 30 * 86_400_000),
          },
          { assigneeEligible: (userId) => conversationAssigneeEligible(tx, org, userId) },
        ),
      )
      assert.equal(designation.kind, 'ok', `WORKFLOW_DESIGNATION_${designation.kind.toUpperCase()}`)
      const thread = await within(party.member, (tx) =>
        createMemberThread(tx, party.member, {
          subject: 'Disposable qualification conversation',
          body: 'Disposable qualification message',
        }),
      )
      const threadId = String(thread.id)
      const assigned = await within(party.handler, (tx) =>
        assignThread(
          tx,
          party.handler,
          { threadId, action: 'assign', toStaffId: party.officer.userId },
          { assigneeEligible: (userId) => conversationAssigneeEligible(tx, org, userId) },
        ),
      )
      assert.equal(assigned.kind, 'ok', `WORKFLOW_ASSIGNMENT_${assigned.kind.toUpperCase()}`)
      const closed = await within(party.member, (tx) =>
        changeThreadLifecycle(tx, party.member, threadId, 'close'),
      )
      assert.equal(closed.kind, 'ok', `WORKFLOW_LIFECYCLE_${closed.kind.toUpperCase()}`)
      setStage('OBSERVE')
      const observed = await within(party.member, async (_tx, exec) => {
        const select = (sql: string, params: unknown[]) =>
          exec.query<{ id: string }>(sql, params).then((result) => result.rows.map((row) => row.id))
        return {
          grants: await select(
            'SELECT id::text AS id FROM public.ue_authority_workaid_consent_grants WHERE consent_id=$1',
            [consentId],
          ),
          assignments: await select(
            "SELECT id::text AS id FROM public.message_thread_assignments WHERE thread_id=$1 AND action='assign' AND acted_by=$2 AND to_staff_id=$3",
            [threadId, party.handler.userId, party.officer.userId],
          ),
          lifecycle: await select(
            "SELECT id::text AS id FROM public.message_thread_lifecycle WHERE thread_id=$1 AND action='close' AND acted_by=$2 AND acted_via='thread_member'",
            [threadId, party.member.userId],
          ),
        }
      })
      assert.equal(observed.grants.length, 1, 'WORKFLOW_CONSENT_GRANT_REQUIRED')
      assert.equal(observed.assignments.length, 1, 'WORKFLOW_THREAD_ASSIGNMENT_REQUIRED')
      assert.equal(observed.lifecycle.length, 1, 'WORKFLOW_THREAD_LIFECYCLE_REQUIRED')
      ids.ue_authority_workaid_consent_grants.push(...observed.grants)
      ids.message_thread_assignments.push(...observed.assignments)
      ids.message_thread_lifecycle.push(...observed.lifecycle)
      produced.push({
        ...guarded,
        admin,
        counselUserId,
        officeRuleId: rules.executive_office,
        delegationRuleId: rules.delegation,
        officeApprovalRequestId,
        officeMandateId,
        grievanceId,
        documentId,
        textId,
        textVersion,
        textSha256,
        consentId,
        matterId,
        threadId,
        ids,
      })
    }
    setStage('PROVENANCE')
    for (const party of produced) await verifyProvenance(input.operator, within, party)
    const [first, second] = produced
    assert(first && second && produced.length === 2, 'WORKFLOW_TWO_PARTIES_REQUIRED')
    return [first, second]
  } finally {
    await harness.end()
  }
}

/**
 * Each produced kernel row has its INSERT event, recorded by the trigger in the acting session and
 * named by a canonical audit record; each conversation record has the audit its service writes. The
 * events are collected only after this check, so they too are rows the workflows produced.
 */
async function verifyProvenance(
  operator: pg.Client,
  within: GuardedWithin,
  party: WorkflowParty,
): Promise<void> {
  const org = party.party.organizationId
  for (const table of WORKFLOW_RUNTIME_TABLES.filter((name) => name !== 'ue_authority_events')) {
    const ids = party.ids[table]
    assert(ids.length > 0 && ids.every(isUuid), `WORKFLOW_PRODUCED_IDS_REQUIRED:${table}`)
    assert.equal(new Set(ids).size, ids.length, `WORKFLOW_DISTINCT_IDS_REQUIRED:${table}`)
    const rows = (
      await operator.query<{ organization_id: string }>(
        `SELECT organization_id::text AS organization_id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
        [ids],
      )
    ).rows
    assert.equal(rows.length, ids.length, `WORKFLOW_PRODUCED_ROWS_REQUIRED:${table}`)
    assert(
      rows.every((row) => row.organization_id === org),
      `WORKFLOW_ROW_ORGANIZATION_REQUIRED:${table}`,
    )
  }
  for (const table of KERNEL_TABLES) {
    const audited = (
      await operator.query<{ source_id: string }>(
        `SELECT DISTINCT e.source_id::text AS source_id FROM public.ue_authority_events e
          WHERE e.organization_id=$1 AND e.source_table=$2 AND e.operation='INSERT' AND e.source_id=ANY($3::uuid[])
            AND e.actor_user_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.organization_id=e.organization_id
              AND a.action LIKE 'authority.%' AND (a.details->'authorityEventIds') ? e.id::text)`,
        [org, table, party.ids[table]],
      )
    ).rows
    assert.equal(
      audited.length,
      party.ids[table].length,
      `WORKFLOW_AUDITED_EVENT_REQUIRED:${table}`,
    )
  }
  for (const [action, ids] of [
    ['messages.thread.assign', party.ids.message_thread_assignments],
    ['messages.thread.close', party.ids.message_thread_lifecycle],
  ] as const) {
    const audits = (
      await operator.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM public.audit_logs WHERE organization_id=$1 AND action=$2 AND resource_id::text=$3',
        [org, action, party.threadId],
      )
    ).rows[0].count
    assert.equal(Number(audits), ids.length, `WORKFLOW_CONVERSATION_AUDIT_REQUIRED:${action}`)
  }
  const kernelIds = KERNEL_TABLES.flatMap((table) => party.ids[table])
  party.ids.ue_authority_events.push(
    ...(await within(party.party.member, async (_tx, exec) =>
      (
        await exec.query<{ id: string }>(
          'SELECT id::text AS id FROM public.ue_authority_events WHERE organization_id=$1 AND source_id=ANY($2::uuid[]) ORDER BY event_seq',
          [org, kernelIds],
        )
      ).rows.map((row) => row.id),
    )),
  )
  assert(
    party.ids.ue_authority_events.length >= kernelIds.length,
    'WORKFLOW_RECORDED_EVENTS_REQUIRED',
  )
}

/** A direct write of the row its workflow owns, by the session principal itself, in its own tenant. */
function rawBypass(
  table: WorkflowTable,
  actor: GuardedActor,
  party: WorkflowParty,
): { sql: string; params: unknown[] } {
  const org = party.party.organizationId
  const user = actor.userId
  switch (table) {
    case 'message_thread_assignments':
      return {
        sql: "INSERT INTO public.message_thread_assignments(organization_id,thread_id,action,from_staff_id,to_staff_id,acted_by,acted_via) VALUES($1,$2,'reassign',$3,$4,$4,'current_assignee')",
        params: [org, party.threadId, party.party.officer.userId, user],
      }
    case 'message_thread_lifecycle':
      return {
        sql: "INSERT INTO public.message_thread_lifecycle(organization_id,thread_id,action,acted_by,acted_via) VALUES($1,$2,'archive',$3,'thread_member')",
        params: [org, party.threadId, user],
      }
    case 'ue_authority_acceptances':
      return {
        sql: "INSERT INTO public.ue_authority_acceptances(organization_id,instrument_type,instrument_id,accepted_by) VALUES($1,'mandate',$2,$3)",
        params: [org, party.officeMandateId, user],
      }
    case 'ue_authority_approval_decisions':
      return {
        sql: "INSERT INTO public.ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')",
        params: [org, party.officeApprovalRequestId, user],
      }
    case 'ue_authority_approval_requests':
      return {
        sql: "INSERT INTO public.ue_authority_approval_requests(organization_id,subject_type,subject_id,proposed_by,required_approvals,risk_class) VALUES($1,'issuance:delegation',$2,$3,1,'low')",
        params: [org, randomUUID(), user],
      }
    case 'ue_authority_counsel_engagements':
      return {
        sql: "INSERT INTO public.ue_authority_counsel_engagements(organization_id,matter_id,counsel_user_id,capacity,information_barrier,recorded_by,effective_at,expires_at) VALUES($1,$2,$3,'external_counsel',false,$4,now(),now()+interval '1 day')",
        params: [org, party.matterId, randomUUID(), user],
      }
    case 'ue_authority_delegations':
      return {
        sql: "INSERT INTO public.ue_authority_delegations(organization_id,delegator_user_id,delegate_user_id,office,actions,resource_types,effective_at,expires_at,issuance_rule_id) VALUES($1,$2,$3,'Disposable bypass',ARRAY['case:read'],ARRAY['case'],now()-interval '1 minute',now()+interval '1 day',$4)",
        params: [org, user, party.party.officer.userId, party.delegationRuleId],
      }
    case 'ue_authority_disclosure_consents':
      return {
        sql: "INSERT INTO public.ue_authority_disclosure_consents(organization_id,member_user_id,matter_id,direction,issuer,issued_by,categories,purpose,granted_at,expires_at) VALUES($1,$2,$3,'union_to_workaid','member',$2,ARRAY['case_summary'],'Disposable bypass',now(),now()+interval '1 day')",
        params: [org, user, randomUUID()],
      }
    case 'ue_authority_events':
      return {
        sql: "INSERT INTO public.ue_authority_events(organization_id,source_table,source_id,operation,actor_user_id,row_after) VALUES($1,'ue_authority_recusals',$2,'INSERT',$3,'{}'::jsonb)",
        params: [org, randomUUID(), user],
      }
    case 'ue_authority_issuance_rules':
      return {
        sql: "INSERT INTO public.ue_authority_issuance_rules(organization_id,domain,operation,version,status,source_instrument,drafted_by) VALUES($1,'delegation','revoke',1,'active','Disposable bypass',$2)",
        params: [org, user],
      }
    case 'ue_authority_mandates':
      return {
        sql: "INSERT INTO public.ue_authority_mandates(organization_id,principal_user_id,kind,powers,source_instrument,granted_by,effective_at,expires_at,issuance_rule_id) VALUES($1,$2,'executive_office',ARRAY['approve'],'Disposable bypass',$3,now()-interval '1 minute',now()+interval '1 day',$4)",
        params: [org, party.party.executives[2].userId, user, party.officeRuleId],
      }
    case 'ue_authority_recusals':
      return {
        sql: "INSERT INTO public.ue_authority_recusals(organization_id,principal_user_id,resource_type,resource_id,reason) VALUES($1,$2,'case',$3,'Disposable bypass')",
        params: [org, user, randomUUID()],
      }
    case 'ue_authority_resource_relationships':
      return {
        sql: "INSERT INTO public.ue_authority_resource_relationships(organization_id,principal_user_id,resource_type,resource_id,relation,origin,granted_by,effective_at) VALUES($1,$2,'case',$3,'collaborator','explicit',$4,now())",
        params: [org, party.party.handler.userId, party.caseId, user],
      }
    case 'ue_authority_reviews':
      return {
        sql: "INSERT INTO public.ue_authority_reviews(organization_id,review_type,complainant_user_id,opened_by) VALUES($1,'complaint',$2,$2)",
        params: [org, user],
      }
    case 'ue_authority_workaid_consent_grants':
      return {
        sql: 'INSERT INTO public.ue_authority_workaid_consent_grants(organization_id,consent_id,matter_id,case_id,member_user_id,text_id,text_version,text_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        params: [
          org,
          party.consentId,
          party.matterId,
          party.grievanceId,
          user,
          party.textId,
          party.textVersion,
          party.textSha256,
        ],
      }
    case 'ue_authority_workaid_consent_texts':
      return {
        sql: "INSERT INTO public.ue_authority_workaid_consent_texts(organization_id,version,body,body_sha256,recorded_by,effective_at) VALUES($1,$2,'Disposable bypass wording',encode(sha256(convert_to('Disposable bypass wording','UTF8')),'hex'),$3,now())",
        params: [org, `bypass-${randomUUID().slice(0, 8)}`, user],
      }
    case 'ue_authority_workaid_document_auths':
      return {
        sql: "INSERT INTO public.ue_authority_workaid_document_auths(organization_id,matter_id,consent_id,document_id,classification,authorised_by,expires_at) VALUES($1,$2,$3,$4,'member_submission',$5,now()+interval '1 day')",
        params: [org, party.matterId, party.consentId, party.documentId, user],
      }
    case 'ue_authority_workaid_matters':
      return {
        sql: "INSERT INTO public.ue_authority_workaid_matters(organization_id,member_user_id,case_id,referred_by,referred_categories) VALUES($1,$2,$3,$2,ARRAY['case_summary'])",
        params: [org, user, randomUUID()],
      }
    case 'ue_authority_workaid_shares':
      return {
        sql: "INSERT INTO public.ue_authority_workaid_shares(organization_id,matter_id,consent_id,kind,categories,created_by) VALUES($1,$2,$3,'categories',ARRAY['case_summary'],$4)",
        params: [org, party.matterId, party.consentId, user],
      }
  }
}

async function qualifyWorkflowTable(
  input: WorkflowRuntimeInput,
  parties: readonly [WorkflowParty, WorkflowParty],
  original: ReadonlyMap<WorkflowTable, string>,
  table: WorkflowTable,
): Promise<ColumnTableReport> {
  const cases: string[] = []
  const mark = (name: string) => {
    const key = `${table}:${name}`
    assert(!cases.includes(key), `WORKFLOW_DUPLICATE_OBSERVATION:${table}`)
    cases.push(key)
  }
  let stage = 'QUALIFY'
  const harness = openGuardedSessionHarness(input)
  const within = harness.within
  const history = () => readFixtureHistory(input.operator, WORKFLOW_HISTORY_TABLES)
  const unchanged = (before: HistorySnapshot) =>
    assertFixtureHistory(
      input.operator,
      WORKFLOW_HISTORY_TABLES,
      before,
      'WORKFLOW_HISTORY_CHANGED',
    )
  const visibleIds = (exec: SqlExecutor, ids: readonly string[]) =>
    exec
      .query<{ id: string }>(
        `SELECT id::text AS id FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`,
        [ids],
      )
      .then((result) => result.rows.map((row) => row.id))
  try {
    for (const party of parties)
      assert(party.ids[table].length > 0, `WORKFLOW_BOTH_POSITIVE_ROWS_REQUIRED:${table}`)
    mark('OWN_WORKFLOW_OPERATION_ROWS_VERIFIED')
    stage = 'MEMBER_ISOLATION'
    for (const [index, party] of parties.entries()) {
      const expected = party.ids[table],
        foreign = parties[1 - index].ids[table]
      await within(party.party.member, async (_tx, exec) => {
        const visible = await visibleIds(exec, [...expected, ...foreign])
        assert(
          expected.every((id) => visible.includes(id)),
          `WORKFLOW_OWN_ROWS_NOT_VISIBLE:${table}`,
        )
        assert(
          !foreign.some((id) => visible.includes(id)),
          `WORKFLOW_FOREIGN_ROWS_VISIBLE:${table}`,
        )
      })
      for (const options of [
        { missing: 'bearer' as const },
        { foreignOrg: parties[1 - index].party.organizationId },
      ])
        await within(
          party.party.member,
          async (_tx, exec) =>
            assert.equal(
              (await visibleIds(exec, expected)).length,
              0,
              `WORKFLOW_INVALID_CONTEXT_VISIBLE:${table}`,
            ),
          options,
        )
    }
    mark('BIDIRECTIONAL_TENANT_READ_ISOLATION')
    mark('MISSING_AND_FOREIGN_CONTEXT_DENIED')
    stage = 'ACTOR_CLASSES'
    const expectedRefusal = WORKFLOW_RAW_BYPASS_REFUSALS[table]
    for (const [partyIndex, party] of parties.entries()) {
      const expected = party.ids[table]
      const foreign = parties[1 - partyIndex].ids[table]
      const ids = [...expected, ...foreign]
      const partyName = GUARDED_CASE_PARTIES[partyIndex]
      for (const [classIndex, actor] of party.party.classes.entries()) {
        const actorClass = GUARDED_CASE_ACTOR_CLASSES[classIndex]
        stage = `ACTOR_CLASSES:${actorClass}:${partyName}`
        const classMark = (witness: (typeof WORKFLOW_ACTOR_WITNESSES)[number]) =>
          mark(`${actorClass}:${partyName}:${witness}`)
        const before = await history()
        await within(
          actor,
          async (_tx, exec) => {
            const visible = await visibleIds(exec, ids)
            assert(
              expected.every((id) => visible.includes(id)),
              `WORKFLOW_CLASS_OWN_ROWS_NOT_VISIBLE:${table}`,
            )
            assert(
              !foreign.some((id) => visible.includes(id)),
              `WORKFLOW_CLASS_FOREIGN_ROWS_VISIBLE:${table}`,
            )
          },
          { actorClass },
        )
        classMark('LIVE_SOURCE_CLASS_VERIFIED')
        classMark('OWN_TENANT_READ_OBSERVED')
        classMark('FOREIGN_TENANT_READ_DENIED')
        for (const [missing, witness] of [
          ['user', 'MISSING_USER_READ_DENIED'],
          ['org', 'MISSING_ORG_READ_DENIED'],
          ['bearer', 'MISSING_BEARER_READ_DENIED'],
        ] as const) {
          await within(
            actor,
            async (_tx, exec) =>
              assert.equal(
                (await visibleIds(exec, ids)).length,
                0,
                `WORKFLOW_CLASS_MISSING_CONTEXT_VISIBLE:${table}`,
              ),
            { actorClass, missing },
          )
          classMark(witness)
        }
        await within(
          actor,
          async (_tx, exec) =>
            assert.equal(
              (await visibleIds(exec, ids)).length,
              0,
              `WORKFLOW_CLASS_FOREIGN_CONTEXT_VISIBLE:${table}`,
            ),
          { actorClass, foreignOrg: parties[1 - partyIndex].party.organizationId },
        )
        classMark('FOREIGN_ORG_CONTEXT_READ_DENIED')
        await unchanged(before)
        const bypass = rawBypass(table, actor, party)
        let refusal: string | undefined
        try {
          await within(actor, (_tx, exec) => exec.query(bypass.sql, bypass.params), { actorClass })
        } catch (error) {
          refusal = databaseRefusal(error)
        }
        assert(refusal !== undefined, `WORKFLOW_RAW_BYPASS_ACCEPTED:${table}`)
        assert.equal(
          refusal,
          expectedRefusal,
          `WORKFLOW_RAW_BYPASS_REFUSAL_MISMATCH:${table}:${refusal.replace(':', '_')}`,
        )
        await unchanged(before)
        classMark('RAW_WORKFLOW_BYPASS_REFUSED')
        classMark('DENIED_WRITE_HISTORY_UNCHANGED')
      }
    }
    mark(`RAW_BYPASS_REFUSAL:${expectedRefusal}`)
    mark('WORKFLOW_BYPASS_DENIED_FOR_EVERY_ACTOR_CLASS')
    mark('FAILED_MUTATION_HISTORY_UNCHANGED')
    stage = 'ORIGINAL_ROWS'
    assert.equal(
      await producedDigest(input.operator, table, parties),
      original.get(table),
      `WORKFLOW_ORIGINAL_ROWS_CHANGED:${table}`,
    )
    mark('ORIGINAL_WORKFLOW_ROWS_PRESERVED')
    stage = 'SYSTEM_BOUNDARY'
    // SYSTEM is the separate restricted LOGIN; no source grants it any power over these relations.
    await input.system.query('BEGIN')
    try {
      await input.system.query('SET LOCAL search_path = pg_catalog, public, pg_temp')
      await input.system.query('SET LOCAL ROLE union_eyes_system')
      await assertRestrictedRuntimeTransaction(
        input.system,
        'union_eyes_system',
        harness.databaseName,
      )
      await assert.rejects(
        input.system.query(`SELECT id::text FROM public.${quote(table)} WHERE id=ANY($1::uuid[])`, [
          parties.flatMap((party) => party.ids[table]),
        ]),
        exactDenied,
      )
    } finally {
      await input.system.query('ROLLBACK')
    }
    mark('SOURCE_SYSTEM_BOUNDARY_VERIFIED')
    const report: ColumnTableReport = { table, status: 'PASS', cases }
    assert(workflowReportComplete(report), `WORKFLOW_INCOMPLETE_REPORT:${table}`)
    return report
  } catch (error) {
    return { table, status: 'FAIL', cases, failure: summary(stage, error) }
  } finally {
    await harness.end()
  }
}
