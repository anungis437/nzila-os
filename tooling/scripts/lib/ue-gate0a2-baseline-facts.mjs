/**
 * Shared vocabulary and source-derived facts for the Gate 0A.2 proposed persona baselines.
 *
 * Nothing here adopts a requirement. The vocabularies fix the labels, authorization bases, audit classes and
 * privacy classes that a proposed contract may name, and the route facts are re-derived from the source tree so a
 * contract cannot claim more implementation than the cited files show.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const BASELINE_DIR = 'docs/union-eyes/persona-baselines'
export const BASELINE_DATA = {
  steward: 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-steward.json',
  representative: 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-representative.json',
  'financial-officer': 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-financial-officer.json',
  decisions: 'docs/union-eyes/convergence/register/ue-persona-proposed-baseline-decisions.json',
}
export const BASELINE_DOCS = {
  steward: `${BASELINE_DIR}/UE-STEWARD-PROPOSED-PERSONA-BASELINE.md`,
  representative: `${BASELINE_DIR}/UE-REPRESENTATIVE-2.2-PROPOSED-PERSONA-BASELINE.md`,
  'financial-officer': `${BASELINE_DIR}/UE-FINANCIAL-OFFICER-2.1-PROPOSED-PERSONA-BASELINE.md`,
  decisions: `${BASELINE_DIR}/UE-PERSONA-BASELINE-DECISION-REGISTER.md`,
}

export const LABELS = ['HISTORICALLY_EVIDENCED', 'PROPOSED_NEW_BASELINE', 'IMPLEMENTED_SOURCE', 'REQUIRES_INSTITUTIONAL_ADOPTION']

export const HISTORICAL_KINDS = ['ROW', 'TITLE', 'STATUS_STATEMENT', 'GROUP_LABEL', 'STATUS_ONLY', 'NAME']

export const IMPLEMENTATION_STATUSES = ['SOURCE_PRESENT', 'PARTIAL_SOURCE', 'NOT_IMPLEMENTED', 'UNAVAILABLE_501']

export const ROUTE_SIGNALS = ['KERNEL_SIGNAL_IN_ROUTE', 'GENERIC_CRUD_ROLE_FLOOR', 'NOT_IMPLEMENTED_501_ONLY', 'NO_KERNEL_SIGNAL_IN_ROUTE', 'FILE_ABSENT']

export const CONTRACT_KINDS = ['NAVIGATION', 'ACTION', 'DOMAIN', 'JOURNEY', 'SCENARIO', 'DENIAL']

export const EVIDENCE_CLASSES = ['SUPPORTED_BY_RECOVERED_EVIDENCE', 'SUPPORTED_BY_EXECUTABLE_CONTRACT', 'DESIGN_ONLY']

const KERNEL_SIGNAL = /\b(decideCase|findReadableCase|requireKernelCaseAction|decideMessage[A-Za-z]*|performFinancialDuty|readFinancialTransaction|requireLiveFinancialMandate|assertPrincipalFinancialAuthority|enforceAuthority|kernelDeps|hasLiveDesignation|liveDesignationExists|caseReadScope|requireCaseFilingCapacity|hasSupervisoryCaseRead|assertFinancialSegregation|issueFinancialMandate)\b/
const RETIRED_SIGNAL = /\b(capabilityNotImplementedResponse|retiredFinancialRoute|retiredFinancialResponse|NOT_IMPLEMENTED)\b/

export function exportedMethods(text) {
  const methods = new Set()
  for (const match of text.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) methods.add(match[1])
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const name of match[1].split(',')) {
      const method = name.trim().split(/\s+as\s+/).pop()
      if (/^(GET|POST|PUT|PATCH|DELETE)$/.test(method)) methods.add(method)
    }
  }
  return [...methods].sort()
}

export function routeSignal(text) {
  if (KERNEL_SIGNAL.test(text)) return 'KERNEL_SIGNAL_IN_ROUTE'
  if (/crudRoutes\(/.test(text)) return 'GENERIC_CRUD_ROLE_FLOOR'
  if (RETIRED_SIGNAL.test(text)) return 'NOT_IMPLEMENTED_501_ONLY'
  return 'NO_KERNEL_SIGNAL_IN_ROUTE'
}

export function deriveFileFacts(root, file, read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null)) {
  const text = read(file)
  if (text === null) return { file, methods: [], signal: 'FILE_ABSENT' }
  return { file, methods: exportedMethods(text), signal: routeSignal(text) }
}

export const AUTHORIZATION_BASES = {
  CASE_OWNER_OR_ASSIGNEE: { domain: 'case', kernelActions: ['case:read', 'case:read_internal', 'case:comment', 'case:write_notes', 'case:draft_action', 'case:upload_evidence', 'case:modify_document', 'case:process_ocr', 'case:transition'], definition: 'A live owner or assignee relationship to this one case, held by a principal whose live membership carries a representation capacity (steward, chief steward or officer). The relationship is a fact about the case; the capacity is eligibility only. Closing, disclosing to the member and exporting sealed evidence are additionally limited to the primary handler.', source: 'apps/union-eyes/lib/authority/policies/case.ts' },
  CASE_PRIMARY_HANDLER_ONLY: { domain: 'case', kernelActions: ['case:close', 'case:disclose_to_member', 'case:export_sealed_evidence', 'case:read_third_party_restricted'], definition: 'The owner or assignee relationship, limited to the primary handler. A collaborator grant can never carry these actions.', source: 'apps/union-eyes/lib/authority/policies/case.ts' },
  CASE_COLLABORATOR_EXPLICIT: { domain: 'case', kernelActions: ['case:read', 'case:read_internal', 'case:comment', 'case:write_notes', 'case:draft_action', 'case:upload_evidence'], definition: 'A live collaborator relationship that was granted explicitly by someone other than its holder, names each permission, carries an expiry, and never reaches privileged matters unless a separate independent privileged grant exists.', source: 'apps/union-eyes/lib/authority/policies/case.ts' },
  CASE_MEMBER_OWN: { domain: 'case', kernelActions: ['case:read', 'case:comment', 'case:read_own_submission'], definition: 'The represented member or creator of this case, as a live derived relationship. It reaches only the member-visible view of the case.', source: 'apps/union-eyes/lib/authority/policies/case.ts' },
  CASE_SUPERVISORY_MANDATE: { domain: 'case', kernelActions: ['case:read', 'case:read_internal', 'case:assign', 'case:transition'], definition: 'A live supervisory mandate whose unit, territory or resource scope covers this case and whose powers name the action. Seniority, role title and platform status are not inputs. Privileged matters are outside every mandate except assignment.', source: 'apps/union-eyes/lib/authority/policies/case.ts', requiresInstitutionalInstrument: true },
  CASE_TRIAGE_DESIGNATION: { domain: 'case', kernelActions: [], definition: 'A live, expiring, revocable triage designation for the cases scope, granted by an organization administrator to an eligible staff member for at most 90 days. It exposes the unassigned queue metadata only and grants no kernel action on any case.', source: 'apps/union-eyes/lib/triage/designations.ts', requiresInstitutionalInstrument: true },
  CASE_FILING_CAPACITY: { domain: 'case', kernelActions: [], definition: 'An active canonical membership whose capacity allows opening a matter in the stated mode (member, handler or bulk). Opening a matter grants no access to anyone else\u2019s case.', source: 'apps/union-eyes/lib/cases/case-authorization.ts' },
  CASE_EMERGENCY_GRANT: { domain: 'case', kernelActions: ['case:read', 'case:read_internal'], definition: 'A live, justified, independently approved, time-boxed, read-only emergency grant that names this case. It never reaches privileged matters.', source: 'apps/union-eyes/lib/authority/policies/case.ts', requiresInstitutionalInstrument: true },
  THREAD_PARTICIPANT: { domain: 'message', kernelActions: ['message:read', 'message:reply', 'message:close', 'message:archive'], definition: 'The member of the conversation, or its assignee when that membership carries an assignee capacity. Participation follows the conversation row; no mandate and no delegation confers it.', source: 'apps/union-eyes/lib/authority/policies/message.ts' },
  THREAD_TRIAGE_DESIGNATION: { domain: 'message', kernelActions: [], definition: 'A live triage designation for the messages scope. It exposes the unassigned conversation queue only and is not a read of any conversation.', source: 'apps/union-eyes/lib/triage/designations.ts', requiresInstitutionalInstrument: true },
  GOVERNANCE_MANDATE_THREAD_HOLD: { domain: 'message', kernelActions: ['message:place_legal_hold', 'message:release_legal_hold', 'message:adopt_retention', 'message:read_retention_policy'], definition: 'A live governance review mandate whose powers name the action and whose scope names the conversation or the organization retention record. It confers no read of the conversation and cannot be delegated.', source: 'apps/union-eyes/lib/authority/policies/message.ts', requiresInstitutionalInstrument: true },
  DOCUMENT_CASE_RELATIONSHIP_AND_CLASS: { domain: 'document', kernelActions: ['case:read', 'case:read_internal', 'case:upload_evidence', 'case:process_ocr', 'case:modify_document'], definition: 'A kernel decision on the linked case together with the document classification. A privileged classification needs an explicit independent privileged-access grant; a role never reaches it.', source: 'apps/union-eyes/lib/authority/document-class.ts' },
  DIRECTORY_SCOPE_BY_CASE_RELATIONSHIP: { domain: 'member', kernelActions: [], definition: 'The member directory policy: a steward sees self and the members of cases assigned to them; supervisory and officer scopes widen the directory without sensitive attributes only through the stated policy; only platform administrators cross organizations.', source: 'apps/union-eyes/lib/members/directory-access.ts' },
  WORKAID_REFERRAL_WITH_CONSENT: { domain: 'workaid', kernelActions: ['workaid:refer', 'workaid:receive_disclosure'], definition: 'The case relationship that permits a referral, plus a live member disclosure consent whose categories, purpose, recipient and expiry cover what moves. A union-authored record can never open counsel material. Consent wording is an institutional instrument that this baseline does not write.', source: 'apps/union-eyes/lib/authority/workaid-disclosure.ts', requiresInstitutionalInstrument: true },
  ORG_ADMIN_OPERATIONS: { domain: 'administration', kernelActions: [], definition: 'Administration of the tenant. The organization administrator title carries no case, money or governance capacity; it may grant a time-boxed triage designation and perform tenant operations only.', source: 'apps/union-eyes/lib/authority/capacity.ts', requiresInstitutionalInstrument: true },
  REPRESENTATION_PROTOCOL_APPROVAL: { domain: 'administration', kernelActions: [], definition: 'A representation protocol approved by an administrator who is not its author. An unapproved, missing or invalid protocol is not executable and fails closed.', source: 'apps/union-eyes/lib/representation/protocol-types.ts', requiresInstitutionalInstrument: true },
  SELF_SCOPED: { domain: 'self', kernelActions: [], definition: 'The signed-in principal\u2019s own preferences and session. No other principal\u2019s resource is touched.', source: 'apps/union-eyes/lib/authority/ontology.ts' },
  ACTIVE_MEMBERSHIP_NAVIGATION: { domain: 'navigation', kernelActions: [], definition: 'A live membership in the active organization. A navigation entry is only an entry point: every resource behind it is decided individually, and an entry is not shown when its destination would resolve to an unavailable state.', source: 'apps/union-eyes/lib/authority/ontology.ts' },
  FINANCIAL_MANDATE_VIEW: { domain: 'finance', kernelActions: ['finance:view'], definition: 'A live financial mandate that names the account and the view duty, held by a principal with a financial capacity. A member may always view their own record. A role title, including the Secretary-Treasurer title, is not a mandate.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_MANDATE_PREPARE: { domain: 'finance', kernelActions: ['finance:prepare'], definition: 'A live financial mandate that names the account and the prepare duty. The implemented software rule SEP-SW-01 stops a preparer approving the same transaction; whether an institution adopts that separation is outstanding.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_MANDATE_APPROVE: { domain: 'finance', kernelActions: ['finance:approve'], definition: 'A live financial mandate that names the account and the approve duty, within its monetary limit and currency. The implemented software rules SEP-SW-01 and SEP-SW-02 refuse an approver who prepared the same transaction or who later executes it. An adverse party is refused. Institutional adoption of the separation is outstanding.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_MANDATE_EXECUTE: { domain: 'finance', kernelActions: ['finance:execute'], definition: 'A live financial mandate that names the account and the execute duty. Execution is the money movement itself and happens only in the route that moves the money. The implemented software rules SEP-SW-02 and SEP-SW-03 refuse an executor who prepared or approved the same transaction, and a reconciler who took part in it. Institutional adoption is outstanding.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_MANDATE_RECONCILE: { domain: 'finance', kernelActions: ['finance:reconcile'], definition: 'A live financial mandate that names the account and the reconcile duty. The implemented software rule SEP-SW-03 refuses a reconciler who took part in the same transaction. Institutional adoption is outstanding.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_MANDATE_AUDIT: { domain: 'finance', kernelActions: ['finance:audit'], definition: 'A live financial mandate that names the account and the audit duty. The implemented software rule SEP-SW-04 refuses an auditor who took part in the same transaction. Institutional adoption is outstanding.', source: 'apps/union-eyes/lib/authority/policies/finance.ts', requiresInstitutionalInstrument: true },
  FINANCIAL_SUBJECT_OWN_RECORD: { domain: 'finance', kernelActions: ['finance:view'], definition: 'The member viewing their own financial record, and nothing else\u2019s.', source: 'apps/union-eyes/lib/authority/policies/finance.ts' },
  FINANCIAL_MANDATE_ADMINISTRATION: { domain: 'finance', kernelActions: [], definition: 'Issuance, acceptance, suspension and revocation of a financial mandate under a live issuance rule. The implemented software rule SEP-SW-07 requires the issuer, the holder and the approver to be three different people, and SEP-SW-08 stops the issuer and approver activating the mandate; that is evidence of a software rule and not proof that an institution adopted it. The holder activates; an expired term is not activated. No mandate is issued from a request body or derived from a role title.', source: 'apps/union-eyes/lib/finance/financial-mandate-lifecycle.ts', requiresInstitutionalInstrument: true },
  TRUSTEE_APPOINTMENT_DUTY: { domain: 'finance', kernelActions: ['finance:view', 'finance:audit'], definition: 'The trustee capacity, which is earned only by a recorded appointment and never by role, together with a live mandate naming the duty.', source: 'apps/union-eyes/lib/authority/capacity.ts', requiresInstitutionalInstrument: true },
  AUDITOR_APPOINTMENT_DUTY: { domain: 'finance', kernelActions: ['finance:view', 'finance:audit'], definition: 'The auditor capacity, which is earned only by a recorded appointment and never by role, together with a live mandate naming the audit duty and the period.', source: 'apps/union-eyes/lib/authority/capacity.ts', requiresInstitutionalInstrument: true },
  UNDECIDED_INSTITUTIONAL_OFFICE: { domain: 'administration', kernelActions: [], definition: 'No source of authority is defined for this action. The institution must name the office, the mandate or the rule that holds it. Until then the action is not offered, and a role floor in the current source is not treated as that authority.', source: 'apps/union-eyes/lib/authority/ontology.ts', requiresInstitutionalInstrument: true },
  ROLE_ELIGIBILITY_ONLY: { domain: 'role', kernelActions: [], definition: 'A role, capacity, title or seniority makes a person eligible to hold an authority. It never is the authority. A denial contract names what a role never grants.', source: 'apps/union-eyes/lib/authority/capacity.ts' },
  PLATFORM_BOUNDARY_NO_AUTHORITY: { domain: 'finance', kernelActions: [], definition: 'Nzila platform billing is not union finance. Platform staff status and SaaS entitlement confer no authority over union financial records.', source: 'apps/union-eyes/lib/authority/capacity.ts' },
}

export const AUDIT_CLASSES = {
  AUDIT_ATOMIC_WITH_MUTATION: 'The audit record is written in the same transaction as the persisted result; a failed audit rolls the mutation back. Required by the contract; atomic evidence is proven by the audit gates, not by this declaration.',
  AUDIT_DENIAL_RECORDED: 'A refusal of an action the actor could otherwise read is recorded as security evidence; the refusal never depends on the record.',
  AUDIT_SENSITIVE_READ_LOGGED: 'A read of confidential, restricted or financial personal data is logged with actor, resource and authority source. Required by the contract; not proven by this declaration.',
  AUDIT_NONE_NONSENSITIVE_VIEW: 'A navigation or listing that exposes only already-authorized, non-sensitive facts. No audit record is required beyond request logging.',
}

export const PRIVACY_CLASSES = {
  PRIV_STAFF_ONLY_INTERNAL: 'Staff-only. The member never sees the content. Member-visible disclosure needs a classification and a separate, server-side, authorized disclosure decision. A client-supplied visibility flag is never enough.',
  PRIV_MEMBER_VISIBLE: 'The member sees the content. It excludes internal notes, assessments and cost reserves.',
  PRIV_MEMBER_PII_MINIMIZED: 'Member identity and contact data appear only where a live relationship to the member\u2019s case exists. Triage views carry minimum metadata only.',
  PRIV_PRIVILEGED_EXCLUDED: 'Privileged and counsel-controlled content is excluded. Only an explicit, independent privileged-access grant reaches it.',
  PRIV_FINANCIAL_PERSONAL: 'Individual member financial data. Visible only to the member and to a live financial mandate that names the account; unknown values stay unknown and are never shown as zero or paid up.',
  PRIV_CONTENT_FREE_NOTICE: 'A notification carries no case, message or financial content.',
  PRIV_NONE: 'No personal or confidential data is processed by the action itself.',
}

export const DENIAL_CLASSES = ['KERNEL_DENY_403', 'NOT_FOUND_404_NO_ORACLE', 'UNAVAILABLE_501', 'FAIL_CLOSED_NO_WRITE', 'VALIDATION_REJECT']

export function loadOntologyActions(root) {
  const text = readFileSync(join(root, 'apps/union-eyes/lib/authority/ontology.ts'), 'utf8')
  const block = text.match(/export const ACTIONS = \[([\s\S]*?)\] as const/)
  if (!block) return []
  return [...block[1].matchAll(/'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1])
}

export const FINANCIAL_DUTIES = ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit']

export const BANNER = [
  'PROPOSED NEW BASELINE. NOT A RECOVERED ORIGINAL. NOT FROZEN. NOT ADOPTED.',
  'The original canonical document for this persona was not recovered. This document is a new design prepared from recovered evidence, existing frozen persona contracts and the executable authority contracts, for product specification review.',
  'It grants no authority. Every institutional authority decision it names is outstanding. Engineering implementation and synthetic authorized-path testing are permitted. Production or institutional activation of the authority a decision governs is prohibited until a duly authorized body adopts the decision.',
]
