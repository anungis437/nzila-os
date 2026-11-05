/**
 * Gate 0B.6 facts: employer execution (timesheet ingest, payroll runs, remittance runs, replay, compliance events), the
 * employer registry (generic CRUD over employers) and employer communications (contacts and the communications log).
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the
 * resolved schema, and is proved again by the validator. This tranche records the source; it repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const FIN_GATE = 5
const REL_GATE = 14
const CAP_PAYROLL = 'UE-CAP-D-002'
const CAP_ROLE_GATES = 'UE-CAP-D-003'
const CAP_EMPLOYER = 'UE-OMIT-EMPLOYER-RELATIONS-RECORDS'

const EXEC = `${APP}app/api/employer-execution/`
const TRANSITIONS = `${APP}lib/employer-execution/payroll-run-transitions.ts`
const PFA = `${APP}lib/finance/principal-financial-authority.ts`
const FIN_ROLES = `${APP}lib/finance/financial-authority.ts`
const EXEC_LAYOUT = `${APP}app/[locale]/dashboard/employer-execution/layout.tsx`
const EXEC_LIB = `${EXEC}_lib.ts`
const SCHEMA = `${APP}db/schema/domains/employer-execution/`
const COMMS_SCHEMA = `${APP}db/schema/domains/communications/employer-communications.ts`

export const ROUTES = new Set([
  'employer-execution/compliance/route.ts',
  'employer-execution/payroll-runs/[id]/route.ts',
  'employer-execution/payroll-runs/route.ts',
  'employer-execution/remittance-runs/[id]/route.ts',
  'employer-execution/remittance-runs/route.ts',
  'employer-execution/replay/[runId]/route.ts',
  'employer-execution/timesheets/route.ts',
  'employers/[id]/route.ts',
  'employers/communications/contacts/route.ts',
  'employers/communications/route.ts',
  'employers/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  EMPLOYER_EXECUTION_PAYROLL_RUNS: {
    capabilityId: CAP_PAYROLL,
    domain: 'EMPLOYER_PAYROLL_RUNS',
    actor: 'Secretary-treasurer preparing, and a distinct approver and executor taking through their lifecycle, the payroll runs that calculate dues, benefit and pension amounts from employer timesheets',
    routes: ['employer-execution/payroll-runs/route.ts', 'employer-execution/payroll-runs/[id]/route.ts'],
    evidence: [
      ev(`${SCHEMA}employer-payroll-runs.ts`, 'export const employerPayrollRuns = pgTable('),
      ev(`${SCHEMA}employer-payroll-runs.ts`, 'totalDues: numeric("total_dues", { precision: 14, scale: 2 }).notNull().default("0"),'),
      ev(`${APP}lib/employer-execution/run-duties.ts`, "export type RunDuty = 'prepare' | 'approve' | 'execute' | 'reconcile'"),
    ],
  },
  EMPLOYER_EXECUTION_REMITTANCE_RUNS: {
    capabilityId: CAP_PAYROLL,
    domain: 'EMPLOYER_REMITTANCE_RUNS',
    actor: 'Secretary-treasurer holding the execute duty generating, and reading, the remittance package of dues, benefits and pension that an approved payroll run produces',
    routes: ['employer-execution/remittance-runs/route.ts', 'employer-execution/remittance-runs/[id]/route.ts'],
    evidence: [
      ev(`${SCHEMA}employer-remittance-runs.ts`, 'export const employerRemittanceRuns = pgTable('),
      ev(`${SCHEMA}employer-remittance-runs.ts`, 'totalDue: numeric("total_due", { precision: 14, scale: 2 }).notNull().default("0"),'),
      ev(`${SCHEMA}employer-remittance-runs.ts`, 'onePerPayrollRunIdx: uniqueIndex("employer_remittance_runs_one_per_payroll_run_uidx").on(table.payrollRunId),'),
    ],
  },
  EMPLOYER_EXECUTION_REPLAY: {
    capabilityId: CAP_PAYROLL,
    domain: 'EMPLOYER_PAYROLL_REPLAY',
    actor: 'Secretary-treasurer re-running a recorded payroll run under the same, a new engine or a new rule version to explain a variance',
    routes: ['employer-execution/replay/[runId]/route.ts'],
    evidence: [
      ev(`${SCHEMA}employer-artifacts.ts`, 'export const employerExecutionReplays = pgTable('),
      ev(`${SCHEMA}employer-artifacts.ts`, 'diffHash: varchar("diff_hash", { length: 64 }).notNull(),'),
    ],
  },
  EMPLOYER_EXECUTION_INPUTS: {
    capabilityId: CAP_ROLE_GATES,
    domain: 'EMPLOYER_PAYROLL_INPUTS',
    actor: 'Steward uploading employer timesheets and raising compliance events that feed and gate the payroll and remittance runs, and any reader of those finance-adjacent records',
    routes: ['employer-execution/timesheets/route.ts', 'employer-execution/compliance/route.ts'],
    evidence: [
      ev(`${SCHEMA}employer-timesheets.ts`, 'export const employerTimesheetBatches = pgTable('),
      ev(`${SCHEMA}employer-compliance.ts`, 'export const employerExecutionComplianceEvents = pgTable('),
      ev(EXEC_LAYOUT, 'Restricts /dashboard/employer-execution/* to Admin (140) and above.'),
    ],
  },
  EMPLOYER_REGISTRY: {
    capabilityId: CAP_EMPLOYER,
    domain: 'EMPLOYER_REGISTRY',
    actor: 'Steward and officer maintaining the register of employers an organization bargains with, including their corporate identifiers and contacts',
    routes: ['employers/route.ts', 'employers/[id]/route.ts'],
    evidence: [
      ev(`${APP}db/schema/union-structure-schema.ts`, "export const employers = pgTable("),
      ev(`${APP}db/schema/union-structure-schema.ts`, "businessNumber: varchar('business_number', { length: 50 }), // CRA BN"),
      ev(`${APP}components/union-structure/EmployerManagement.tsx`, 'const response = await fetch(`/api/employers?organizationId=${organizationId}`);'),
    ],
  },
  EMPLOYER_COMMUNICATIONS: {
    capabilityId: CAP_EMPLOYER,
    domain: 'EMPLOYER_COMMUNICATIONS',
    actor: 'Steward keeping the employer contact directory and the log of letters, e-mails, calls and meetings with the employer, optionally linked to a grievance',
    routes: ['employers/communications/route.ts', 'employers/communications/contacts/route.ts'],
    evidence: [
      ev(COMMS_SCHEMA, 'export const employerContacts = pgTable('),
      ev(COMMS_SCHEMA, 'export const employerCommunications = pgTable('),
      ev(COMMS_SCHEMA, 'grievanceId: uuid("grievance_id").references(() => grievances.id),'),
    ],
  },
}

const D = (id, ownerCapabilityId, gate, severity, title) => ({ id, ownerCapabilityId, gate, severity, title })

export const DEFECTS = [
  D('DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ', CAP_PAYROLL, FIN_GATE, 'HIGH', 'The remittance run detail route is open to any member of the organization, takes no financial mandate and reads through the shared db import instead of an explicit withRLSContext call, and returns the run, its items and every artifact of the run, including the stored remittance CSV and JSON whose content holds the external employee id with gross pay, dues, benefit, pension and net pay of every employee; the payroll run detail beside it requires the secretary_treasurer role and a live view mandate, and the dashboard layout restricts the whole area to administrators.'),
  D('DEF-0B6-EMP-REPLAY-NO-FINANCIAL-MANDATE', CAP_PAYROLL, FIN_GATE, 'HIGH', 'The replay route checks the secretary_treasurer role and the replay entitlement only and never calls requireLiveFinancialMandate, so it neither requires a live financial mandate nor limits the run to the records a view grant names, yet it reads every payroll item of any run of the organization, returns per-employee gross, net, dues, benefit and pension differences, and appends evidence artifacts; prepare, approve, execute, view and remittance all require a mandate.'),
  D('DEF-0B6-EMP-REPLAY-NOT-IDEMPOTENT-GATES-APPROVAL', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'Every replay request inserts a new replay row, three evidence artifacts attached to the source run, an evidence link and, when the replay differs, an open error-severity inconsistent_replay_results event against the source run, with no idempotency key and no unique replay key; approveRun counts open error events for the run and refuses approval until each is acknowledged, so repeated or deliberately different replays, which any caller of the replay route can request at any run status, add approval blockers and evidence rows to the run they only read.'),
  D('DEF-0B6-EMP-REPLAY-MODE-MISRECORDED', CAP_PAYROLL, FIN_GATE, 'LOW', 'The replay mode enum holds only exact and simulated, and the route stores simulated for new_rule and exact for both exact and new_engine, so a replay under a different engine version is recorded as an exact replay and the stored mode cannot tell an engine change from a faithful re-run.'),
  D('DEF-0B6-EMP-PAYROLL-POSTED-IS-STATUS-ONLY', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'The seal action of the payroll run PATCH route, named execute in its mandate action and in its audit and compliance record ("Official payroll run executed (posted)"), only sets status posted, executor and timestamp on the run: no ledger entry, payment, deduction or remittance is written, and the remittance route refuses a run that is no longer approved, so a posted run reads as executed while nothing was done with its amounts.'),
  D('DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'Timesheet ingest never writes member_employment_id or job_classification_id on an entry, payroll preparation therefore opens a blocking critical missing_employment_mapping event for every official run, approveRun refuses approval while a critical blocking event is open, and no route of the employer execution API sets the mapping or resolves a critical event, so an official payroll run cannot reach approval through this API.'),
  D('DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'The evidence seal of payroll, remittance and replay evidence is sha256 of the entity type, run id and manifest hash with no key, signature or external anchor, stored as an artifact named evidence-seal.sig beside the manifest it covers, and the chain verification compares stored parent seal hashes and depths only and never recomputes a manifest or seal hash, so anyone able to write the artifact rows can rewrite a chain that still verifies.'),
  D('DEF-0B6-EMP-PAYROLL-PREPARE-NOT-BOUND-AND-RACY', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'Payroll preparation stores the period from the request body instead of the period of the validated timesheet batch, derives the rule version from the first entry shift date, reads the batch and the already-approved check through the shared connection outside the transaction that inserts the run, takes no lock, and names the run with a millisecond timestamp under a non-unique run code index, so two concurrent requests both pass the check and both create official runs for one batch.'),
  D('DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE', CAP_PAYROLL, FIN_GATE, 'MEDIUM', 'The remittance CSV writes the external employee id taken from the uploaded timesheet file into the first column with no quoting and no neutralisation of a leading formula character, and the three remittance items (dues, benefits, pension) each report the number of payroll items as their member count, even when the amount of the group is zero, so the package can carry spreadsheet formulas and member counts the data does not support.'),
  D('DEF-0B6-EMP-TIMESHEET-INGEST-STEWARD-FLOOR-UNBOUNDED', CAP_ROLE_GATES, FIN_GATE, 'MEDIUM', 'Any steward can ingest the timesheet file whose rows become the dues, benefit and pension amounts of a payroll run, with no financial mandate and a role floor below the secretary_treasurer role the later duties need; the csv content and the employee external ids are unbounded free text that is never matched to a member or employment record, and the parser splits on commas without quoting.'),
  D('DEF-0B6-EMP-COMPLIANCE-EVENT-FORGEABLE-BY-STEWARD', CAP_ROLE_GATES, FIN_GATE, 'MEDIUM', 'A steward can persist a compliance event with any event code, severity, summary, details and blocking flag against any payroll or remittance run of the organization, with no financial mandate; the codes are free text, so an event can imitate one the system raises, and an open critical blocking event or an open error event stops approveRun, while no route in this API resolves a critical event.'),
  D('DEF-0B6-EMP-EXECUTION-READS-AT-MEMBER-FLOOR', CAP_ROLE_GATES, FIN_GATE, 'MEDIUM', 'The compliance event list and the timesheet batch list are open to any member of the organization, unbounded and unpaged, without a financial mandate: they return every compliance event with its details JSON and every batch with the uploader id, file name and validation summary, although the dashboard layout restricts the area to administrators and the payroll run reads require a mandate.'),
  D('DEF-0B6-EMP-CONTACT-PII-READ-AT-STEWARD-UNAUDITED', CAP_EMPLOYER, REL_GATE, 'LOW', 'Any steward reads, unbounded and without a read audit record, the names, e-mail addresses, telephone numbers, notes and custom fields of every employer representative in the organization, through the employer rows (primary and labour-relations contacts, business numbers, notes, customFields) and the employer contacts list.'),
  D('DEF-0B6-EMP-REGISTRY-PARENT-COMPANY-CROSS-ORG-LINK', CAP_EMPLOYER, REL_GATE, 'LOW', 'The employer create and update accept parentCompanyId from the body through the generic factory, and the column is a foreign key to employers.id with no organization condition, so an employer of one organization can name an employer of another organization as its parent company, and the foreign key outcome tells the caller whether that id exists.'),
  D('DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS', CAP_EMPLOYER, REL_GATE, 'LOW', 'The employer delete sets status archived only: archivedAt stays empty and nothing checks the employer for open timesheet batches, contacts or communications, and the timesheet ingest looks the employer up by id and organization without testing its status, so an archived employer keeps receiving payroll input.'),
  D('DEF-0B6-EMP-COMMUNICATION-NOT-DELIVERED', CAP_EMPLOYER, REL_GATE, 'MEDIUM', 'The communications POST route only inserts a row: it imports and calls no mail, SMS, letter or notification provider, takes the status from the caller, stamps sentAt when the caller says sent, hard-codes the sender name System, and then emits the employer.communication_sent audit event, so a record of type email with status sent reads as a delivered message although nothing was sent.'),
  D('DEF-0B6-EMP-COMMUNICATION-REFERENCES-UNVERIFIED', CAP_EMPLOYER, REL_GATE, 'MEDIUM', 'The communications POST route stores employerId, grievanceId, recipientContactId and templateId from the body without checking that any of them belongs to the organization, although the contacts route verifies its employer; employer_id has no foreign key, grievance_id and recipient_contact_id are foreign keys with no organization condition, so a communication can be attached to another organization grievance or contact, or to an employer that does not exist.'),
  D('DEF-0B6-EMP-COMMUNICATION-GRIEVANCE-CORRESPONDENCE-STEWARD-READ', CAP_EMPLOYER, REL_GATE, 'MEDIUM', 'Any steward of the organization lists every employer communication, subject and body included, with the grievance each is linked to, unbounded and without holding the grievance or a case office, so grievance correspondence is readable beyond the stewards who represent the member.'),
  D('DEF-0B6-EMP-CAPE-AUDIT-EVENT-AFTER-COMMIT', CAP_EMPLOYER, REL_GATE, 'LOW', 'After the transaction that commits the row and its atomic audit record, the contacts and communications POST routes emit a second audit event through auditLog; in the canonical state that write appends the audit chain row through its own withRLSContext call and does not swallow a failure, so the route catches it and returns a 500 although the row is already committed, and the contacts event carries the contact name in its details.'),
  D('DEF-0B6-EMP-CONTACT-PRIMARY-NOT-EXCLUSIVE', CAP_EMPLOYER, REL_GATE, 'LOW', 'The contacts POST route stores isPrimary from the body and clears no other contact of the employer, and the table has no unique primary-contact rule, so an employer can hold many primary contacts and a consumer cannot tell which one is current.'),
]

export const CAPABILITIES = [
  {
    id: CAP_EMPLOYER,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-I-002'],
    obligationKey: 'employer-registry-and-communications',
    primaryGate: REL_GATE,
    dependencyGates: [6, 11, 13],
    actor: 'Steward and officer maintaining the register of employers, the employer contact directory and the log of communications with the employer',
    businessOutcome: 'An employer, its representatives and the communications with it belong to one organization, are changed only by the offices the institution names, every id a record references is verified to belong to the same organization, contact details of employer representatives are readable only by the offices that need them with an audit record, grievance correspondence is readable only by those who hold the grievance, a communication reads as sent only when a delivery path sent it, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/employers, app/api/employers/communications',
    service: COMMS_SCHEMA,
    sourceFiles: [`${API}employers/route.ts`, `${API}employers/communications/route.ts`, COMMS_SCHEMA],
    proof: [{ type: 'path', ref: COMMS_SCHEMA }],
    auditEvidence: 'The employer rows are the generic CRUD factory, which commits persistAtomicAudit with the row. The contact and communication creates commit persistAtomicAudit with the row and then emit a second audit event after the commit. Reads are not audited.',
    privacyClassification: 'Employer identifiers, names, e-mail addresses and telephone numbers of employer representatives, and the subject and body of correspondence that may describe a grievance and a member.',
    gap: 'No capability named the employer registry or employer communications before Gate 0B.6; the nearest, UE-OMIT-COMMUNICATIONS-*, owns union to member campaign, SMS and tracking delivery, and the finance capabilities own payroll runs, not the employer record. The employer routes are the generic CRUD factory over employers, whose parentCompanyId is an unscoped foreign key and whose archive leaves archivedAt empty; any steward reads employer representative contact details; the communications POST route stores a row, takes the status from the caller and calls no delivery provider, so a record of status sent is not a delivered message, and it verifies none of the ids it stores, so a communication can be attached to another organization grievance or contact; any steward lists every communication with its grievance link; and a second audit event is written after the commit and can report failure for a committed row. This record closes none of them and names no office that holds employer correspondence authority, which no source states.',
  },
]

const GET_ONLY_NOTE = 'A read: the route selects rows and writes no row and no audit record.'

function apiGuard(a, { floorQuote, entitlementQuote, claimFloor }) {
  const items = [
    ...guardEv(a, 'withApi').filter((item) => item.claim !== 'authorization'),
    a.h('authorization', floorQuote),
    a.imp('authorization', 'withApi', claimFloor),
  ]
  if (entitlementQuote) {
    items.push(a.h('authorization', entitlementQuote), a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'))
  }
  return items
}

const rolesGuard = (a, entitlementQuote) => apiGuard(a, {
  floorQuote: 'auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },',
  entitlementQuote,
  claimFloor: 'const allowedRoles = options.auth?.roles ?? null;',
})

const minRoleGuard = (a, role, entitlementQuote) => apiGuard(a, {
  floorQuote: `auth: { minRole: "${role}" },`,
  entitlementQuote,
  claimFloor: 'const minRoleLevel = options.auth?.minRole',
})

const rolesEv = (a) => a.svc('authorization', FIN_ROLES, "export const FINANCIAL_MEMBER_DATA_ROLES: UserRole[] = ['secretary_treasurer'];")

const mandateEv = (a, actionQuote) => [
  a.h('authorization', actionQuote),
  a.imp('authorization', 'requireLiveFinancialMandate', 'return await assertPrincipalFinancialAuthority(drizzleExecutor(tx), input)'),
  a.svc('authorization', PFA, 'await assertLiveFinancialMandate(exec, input.organizationId)', 'assertPrincipalFinancialAuthority'),
  a.svc('authorization', PFA, "if (input.resourceId && !resources.includes(input.resourceId) && !resources.includes(input.organizationId)) return false", 'covers'),
]

const MANDATE_AUTHZ = 'The mandate decision is a financial-mandate lookup in the authority store, not an authorizeAction kernel decision, so kernelAuthorization stays false; until a live financial mandate is issued (no HTTP route issues one) the guard refuses every caller with FINANCIAL_MANDATES_NOT_ISSUED.'

const payrollBase = {
  service: `${API}employer-execution/payroll-runs/route.ts (withApi over employer_payroll_runs, employer_payroll_run_items and the employer-execution calculation helpers)`,
  authn: `${SESSION} (withApi auth.roles FINANCIAL_MEMBER_DATA_ROLES).`,
  owner: 'employer_payroll_runs and employer_payroll_run_items rows of the organization; the preparer is recorded in the input snapshot, the approver and executor on the run, and the amounts are derived from the timesheet batch the employer supplied.',
  sens: 'Payroll run totals (gross, net, dues, benefits, pension), per-employee external id with gross, net, dues, benefit and pension amounts, the calculation trace and the input snapshot with the preparer user id',
  gate: FIN_GATE,
  deps: [2, 13],
}

const payrollFuture = 'Decide with the institution which finance offices prepare, approve and execute an employer payroll run, bind each duty to a kernel financial mandate on the run, record a ledger or payment effect for execution, and key the evidence seal.'

function payrollFacts(a) {
  const { method } = a
  const route = a.route
  if (route === 'employer-execution/payroll-runs/route.ts' && method === 'GET') {
    return mk({
      ...payrollBase,
      persona: 'Secretary-treasurer holding a live financial view mandate listing the payroll runs it names',
      authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_payroll_preview entitlement and requireLiveFinancialMandate for finance:view; the rows are narrowed by rowsVisibleToGrant to the records the mandate names unless it is ledger-wide. ${MANDATE_AUTHZ}`,
      tenant: 'The organization comes from the session and rowsVisibleToGrant always adds the organization predicate on employer_payroll_runs.',
      priv: 'Totals, the calculation trace and the input snapshot of every visible run, including the preparer user id and the request body that created the run, reach the secretary-treasurer holding the mandate.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of payroll runs once the finance offices that may read them are named; they hold per-employer dues and pension totals.',
      does: 'Returns every employer_payroll_runs row the caller mandate can see, newest first, whole rows included, with no limit.',
      future: payrollFuture,
      ev: [
        ...rolesGuard(a, 'entitlement: "employer_payroll_preview",'),
        rolesEv(a),
        ...mandateEv(a, 'const grant = await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:view" });'),
        a.h('tenantScope', 'rowsVisibleToGrant(grant, organizationId, employerPayrollRuns.organizationId, employerPayrollRuns.id)'),
        a.imp('tenantScope', 'rowsVisibleToGrant', 'const organization = eq(organizationColumn, organizationId)'),
        a.h('mutation', '.select()'),
      ],
      def: [],
    })
  }
  if (route === 'employer-execution/payroll-runs/route.ts') {
    return mk({
      ...payrollBase,
      persona: 'Secretary-treasurer holding a ledger-wide prepare mandate creating a preview or official payroll run from a validated timesheet batch',
      authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_payroll_preview entitlement, the employer_payroll_official entitlement for official runs, and requireLiveFinancialMandate for finance:prepare with requiresLedger. ${MANDATE_AUTHZ}`,
      tenant: 'The organization comes from the session; the batch, timesheet entries, rule version and rule items are each read with an organization predicate and the run is inserted with the session organization.',
      priv: 'The response returns the created run, whose input snapshot carries the request and the preparer user id, and the calculated totals.',
      mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
      auditDetail: 'The run, its items, any compliance events and persistAtomicAudit (employer_execution.payroll_run.prepare, with the recorded amounts) commit in one withRLSContext transaction. The mandate check runs in a separate earlier transaction and the batch reads run outside the transaction.',
      reqAudit: 'Keep the in-transaction audit record and bind the batch and approved-run checks to the same transaction as the insert.',
      does: 'Calculates dues, benefit and pension amounts for a validated timesheet batch under the active CBA rule version, stores the run as calculated with its items and compliance events, and returns the run and totals. An official run is refused when the batch already has an approved official run.',
      status: 'PARTIAL',
      future: payrollFuture,
      ev: [
        ...rolesGuard(a, 'entitlement: "employer_payroll_preview",'),
        rolesEv(a),
        ...mandateEv(a, 'await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:prepare", requiresLedger: true });'),
        a.h('authorization', 'await requireEntitlement(organizationId, PLATFORM_MODULES.EMPLOYER_PAYROLL_OFFICIAL, userId ?? undefined);'),
        a.h('tenantScope', 'eq(employerTimesheetBatches.organizationId, organizationId),'),
        a.h('tenantScope', 'organizationId,'),
        a.h('mutation', '.insert(employerPayrollRuns)'),
        a.h('mutation', 'status: "calculated",'),
        a.h('audit', 'await persistAtomicAudit(tx, {'),
        a.h('defect', 'periodStart: body.periodStart,'),
        a.h('defect', 'runCode: `pr-${Date.now()}`,'),
        a.h('defect', 'const [existingApproved] = await db'),
        a.h('defect', 'const [sourceBatch] = await db'),
        a.sch('defect', `${SCHEMA}employer-payroll-runs.ts`, 'runCodeIdx: index("employer_payroll_runs_run_code_idx").on(table.runCode),', { symbol: 'employerPayrollRuns' }),
        a.h('defect', 'const missingEmploymentMappingCount = timesheetEntries.filter((entry) => !entry.memberEmploymentId).length;'),
        a.h('defect', 'blocking: "yes",'),
      ],
      inf: [
        { claim: 'defect', statement: 'approveRun in payroll-run-transitions.ts selects open events of the run with blocking yes and severity critical and refuses approval while any exists, so the event this handler opens for entries without an employment mapping stops an official run from being approved.' },
        { claim: 'defect', statement: 'No statement of the handler takes a lock on the batch or on existing runs, and the employer_payroll_runs table lists only plain indexes, so nothing serialises two concurrent official prepare requests for one batch.' },
        { claim: 'defect', statement: 'The timesheet ingest route inserts entries without memberEmploymentId or jobClassificationId and no other source file sets them, so every entry carries no mapping and each official run opens the blocking critical event.' },
      ],
      def: ['DEF-0B6-EMP-PAYROLL-PREPARE-NOT-BOUND-AND-RACY', 'DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE'],
    })
  }
  if (method === 'GET') {
    return mk({
      ...payrollBase,
      persona: 'Secretary-treasurer holding a live financial view mandate reading one payroll run with its items and evidence chain',
      authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_payroll_preview entitlement and requireLiveFinancialMandate for finance:view on this run id. ${MANDATE_AUTHZ}`,
      tenant: 'The run, its items and its evidence manifests are read inside withRLSContext with the session organization predicate on each query.',
      priv: 'Per-employee external id with gross, net, dues, benefit and pension amounts, the whole run row with its input snapshot, and the evidence chain links reach the caller holding the mandate.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of a payroll run with its per-employee items once the finance offices that may read them are named.',
      does: 'Returns the run, its payroll items and the evidence chain links rebuilt from the run evidence manifests together with a chain verification result that compares stored parent seal hashes and depths.',
      future: payrollFuture,
      ev: [
        ...rolesGuard(a, 'entitlement: "employer_payroll_preview",'),
        rolesEv(a),
        ...mandateEv(a, 'await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:view", resourceId: id });'),
        a.h('tenantScope', 'eq(employerPayrollRuns.organizationId, organizationId)'),
        a.h('tenantScope', 'eq(employerPayrollRunItems.organizationId, organizationId)'),
        a.h('mutation', '.select()'),
        a.imp('behavior', 'verifyEvidenceChainFromLinks', 'if (link.parentSealHash !== parent.sealHash) {'),
        a.imp('defect', 'verifyEvidenceChainFromLinks', 'const byId = new Map(chain.map((link) => [link.linkId, link]));'),
        a.svc('defect', EXEC_LIB, 'const seal = sha256(`${input.entityType}:${input.runRefId}:${manifestHash}`);', 'createEvidencePack'),
      ],
      inf: [{ claim: 'defect', statement: 'verifyEvidenceChainFromLinks builds a lookup of the stored links and compares stored hashes and depths and calls no hash function, so it cannot detect a manifest or link rewritten consistently with its own stored hashes.' }],
      def: ['DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH'],
    })
  }
  return mk({
    ...payrollBase,
    persona: 'Secretary-treasurer holding the approve or the execute duty on one official payroll run, who is not the preparer of the run',
    authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_payroll_official entitlement, requireLiveFinancialMandate for finance:approve (approve) or finance:execute (seal) on this run id, the official run type, and the run duty rules that keep preparer, approver and executor apart. ${MANDATE_AUTHZ}`,
    tenant: 'The run is read FOR UPDATE with the session organization predicate and every update, event and evidence write carries the session organization.',
    priv: 'The response returns the updated run row, whose input snapshot holds the preparer and approver user ids, or the pending first approval.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'approveRun and executeRun run on the route withRLSContext transaction: the status-guarded update, evidence artifacts and links, compliance event and persistAtomicAudit (employer_execution.payroll_run.approve, approval_recorded or execute) commit together.',
    reqAudit: 'Keep the in-transaction audit record; add the mandate id that authorised the duty to it.',
    does: 'Approves an official calculated run (after a second distinct approver when the profile requires dual approval) and seals the evidence, or sets an approved run to status posted, each guarded by the run status, a row lock and segregation of duties. Posting writes no ledger, payment or remittance effect.',
    status: 'PARTIAL',
    future: payrollFuture,
    ev: [
      ...rolesGuard(a, 'entitlement: "employer_payroll_official",'),
      rolesEv(a),
      ...mandateEv(a, 'action: body.action === "approve" ? "finance:approve" : "finance:execute",'),
      a.h('authorization', 'if (run.runType !== "official") throw ApiError.badRequest("Lifecycle transitions are only allowed for official runs");'),
      a.svc('authorization', `${EXEC}_guard.ts`, 'assertRunDuty(duty, actorId, participants);', 'enforceRunDuty'),
      a.h('tenantScope', 'eq(employerPayrollRuns.organizationId, organizationId)'),
      a.h('mutation', 'return executeRun(tx, { organizationId, userId, run });'),
      a.svc('mutation', TRANSITIONS, '.update(employerPayrollRuns)', 'executeRun'),
      a.svc('behavior', TRANSITIONS, 'status: "posted",', 'executeRun'),
      a.svc('audit', TRANSITIONS, 'await persistAtomicAudit(tx, {', 'executeRun'),
      a.svc('audit', TRANSITIONS, 'await persistAtomicAudit(tx, {', 'approveRun'),
      a.svc('defect', TRANSITIONS, 'summary: "Official payroll run executed (posted)",', 'executeRun'),
      a.svc('defect', TRANSITIONS, 'eq(employerExecutionComplianceEvents.blocking, "yes"),', 'approveRun'),
      a.svc('defect', TRANSITIONS, 'artifactName: "evidence-seal.sig",', 'approveRun'),
      a.svc('defect', EXEC_LIB, 'const seal = sha256(`${input.entityType}:${input.runRefId}:${manifestHash}`);', 'createEvidencePack'),
    ],
    inf: [
      { claim: 'defect', statement: 'executeRun updates the run and inserts a compliance event and an audit record; it imports no ledger, payment or remittance writer and writes no table other than the run, the event and the audit trail, so the posted status has no financial effect of its own.' },
      { claim: 'defect', statement: 'No handler of the employer execution API updates a compliance event to resolved for a critical blocking event; approveRun only acknowledges open error-severity events, so a critical blocking event opened at preparation stays open.' },
    ],
    def: ['DEF-0B6-EMP-PAYROLL-POSTED-IS-STATUS-ONLY', 'DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE', 'DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH'],
  })
}

const remittanceBase = {
  service: `${API}employer-execution/remittance-runs/route.ts (withApi over employer_remittance_runs, employer_remittance_run_items and employer_execution_artifacts)`,
  owner: 'employer_remittance_runs, employer_remittance_run_items and employer_execution_artifacts rows of the organization; generatedBy records the executor and the amounts are summed from the payroll items of an approved run.',
  sens: 'Remittance totals of dues, benefits and pension, the due date, and the stored remittance CSV and JSON listing each employee external id with gross, dues, benefit, pension and net pay',
  gate: FIN_GATE,
  deps: [2, 13],
}

const remittanceFuture = 'Decide with the institution who generates and who may read a remittance package, require a kernel financial mandate on the run for every read and write of the package, transmit or hand over the package through a recorded delivery path, and escape the CSV.'

function remittanceFacts(a) {
  const { method, route } = a
  if (route === 'employer-execution/remittance-runs/route.ts' && method === 'GET') {
    return mk({
      ...remittanceBase,
      persona: 'Secretary-treasurer holding a live financial view mandate listing remittance runs',
      authn: `${SESSION} (withApi auth.roles FINANCIAL_MEMBER_DATA_ROLES).`,
      authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_remittance_generation entitlement and requireLiveFinancialMandate for finance:view; rows narrowed by rowsVisibleToGrant. ${MANDATE_AUTHZ}`,
      tenant: 'The organization comes from the session and rowsVisibleToGrant always adds the organization predicate on employer_remittance_runs.',
      priv: 'Totals, due dates and the package summary of every visible remittance run reach the secretary-treasurer holding the mandate.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of remittance runs once the finance offices that may read them are named.',
      does: 'Returns every employer_remittance_runs row the caller mandate can see, newest first, with no limit.',
      future: remittanceFuture,
      ev: [
        ...rolesGuard(a, 'entitlement: "employer_remittance_generation",'),
        rolesEv(a),
        ...mandateEv(a, 'const grant = await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:view" });'),
        a.h('tenantScope', 'rowsVisibleToGrant(grant, organizationId, employerRemittanceRuns.organizationId, employerRemittanceRuns.id)'),
        a.imp('tenantScope', 'rowsVisibleToGrant', 'const organization = eq(organizationColumn, organizationId)'),
        a.h('mutation', '.select()'),
      ],
      def: [],
    })
  }
  if (route === 'employer-execution/remittance-runs/route.ts') {
    return mk({
      ...remittanceBase,
      persona: 'Secretary-treasurer holding the execute duty on an approved payroll run, who is neither its preparer nor its approver, generating the remittance package',
      authn: `${SESSION} (withApi auth.roles FINANCIAL_MEMBER_DATA_ROLES).`,
      authz: `withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer), the employer_remittance_generation entitlement, requireLiveFinancialMandate for finance:execute on the payroll run id, an approved run status and the run duty rules (execute is refused to the preparer and the approvers). ${MANDATE_AUTHZ}`,
      tenant: 'The payroll run is locked FOR UPDATE with the session organization predicate and every item, artifact and evidence link is read and written with the session organization.',
      priv: 'The response returns the remittance run row; the package it stores holds employee-level pay in the CSV and JSON artifacts.',
      mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
      auditDetail: 'The remittance run, its items, five artifacts, the evidence link and persistAtomicAudit (employer_execution.remittance_run.generate, with totals and hashes) commit in one withRLSContext transaction under a row lock on the payroll run; a second request meets either the conflict check or the unique index on payroll_run_id.',
      reqAudit: 'Keep the in-transaction audit record and add the mandate id that authorised the duty to it.',
      does: 'Sums dues, benefits and pension in integer cents from the items of an approved payroll run, stores a generated remittance run with three items, a CSV, a JSON, a summary and a hash-chained evidence manifest as inline artifacts, and returns the run. Nothing is transmitted to an employer, bank or union office; the package is stored.',
      status: 'PARTIAL',
      future: remittanceFuture,
      ev: [
        ...rolesGuard(a, 'entitlement: "employer_remittance_generation",'),
        rolesEv(a),
        ...mandateEv(a, 'await requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:execute", resourceId: body.payrollRunId });'),
        a.h('authorization', 'if (payrollRun.status !== "approved") throw ApiError.badRequest("Only approved payroll runs can generate remittance");'),
        a.h('authorization', 'enforceRunDuty("execute", userId, participants);'),
        a.h('tenantScope', 'eq(employerPayrollRuns.organizationId, organizationId)'),
        a.h('tenantScope', 'eq(employerPayrollRunItems.organizationId, organizationId)'),
        a.h('mutation', '.insert(employerRemittanceRuns)'),
        a.h('mutation', 'status: "generated",'),
        a.h('audit', 'await persistAtomicAudit(tx, {'),
        a.h('behavior', '.for("update");'),
        a.h('behavior', 'throw ApiError.conflict("A remittance has already been generated for this payroll run", {'),
        a.h('behavior', 'storageRef: `inline://employer-execution/${remittanceRun.id}/remittance.csv`,'),
        a.h('defect', 'memberCount: items.length.toString(),'),
        a.local('defect', 'defaultFormatter', 'row.employeeExternalId,'),
        a.imp('defect', 'createEvidencePack', 'const seal = sha256(`${input.entityType}:${input.runRefId}:${manifestHash}`);'),
        a.h('defect', 'artifactName: "evidence-seal.sig",'),
        a.svc('defect', EXEC_LIB, 'if (!employeeExternalId) validationErrors.push("missing_employee_external_id");', 'normalizeCsv'),
      ],
      inf: [{ claim: 'defect', statement: 'defaultFormatter.buildCsv joins the employee external id with the numeric columns and applies no quoting or formula-character handling, and normalizeCsv accepts any non-empty text as an external id, so the id typed into the uploaded file reaches the stored CSV unchanged.' }],
      def: ['DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE', 'DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH'],
    })
  }
  return mk({
    ...remittanceBase,
    persona: 'Member of the organization opening a remittance run detail page',
    authn: `${SESSION} (withApi auth.minRole member).`,
    authz: 'withApi minRole member plus the employer_remittance_generation entitlement. A role floor of member is not a financial mandate, a role allow-list or a kernel decision; the route calls none of them.',
    tenant: 'The run, its items and its artifacts are each selected with the session organization predicate, through the shared db import rather than an explicit withRLSContext call.',
    priv: 'Any member receives the run, its items and every artifact of the run: the stored remittance CSV and JSON list the external employee id with gross, dues, benefit, pension and net pay of every employee.',
    mut: 'NOT_MUTATING',
    auditDetail: GET_ONLY_NOTE,
    reqAudit: 'Audit reads of a remittance package once the finance offices that may read it are named; it holds employee-level pay.',
    does: 'Returns the remittance run, all of its items and all artifacts of the run, including the stored remittance CSV and JSON content, to any member of the organization at the entitled module.',
    status: 'PARTIAL',
    future: remittanceFuture,
    ev: [
      ...minRoleGuard(a, 'member', 'entitlement: "employer_remittance_generation",'),
      a.h('tenantScope', 'eq(employerRemittanceRuns.organizationId, organizationId)'),
      a.h('tenantScope', 'eq(employerExecutionArtifacts.organizationId, organizationId)'),
      a.h('mutation', '.select()'),
      a.h('defect', '.from(employerExecutionArtifacts)'),
    ],
    inf: [
      { claim: 'defect', statement: 'The artifact query filters on the organization and the remittance run id only, with no artifact type condition, so the remittance_csv and remittance_json rows whose manifestJson holds the content are returned with the evidence rows.' },
      { claim: 'defect', statement: 'The remittance generation route stores the CSV and JSON text in manifestJson of those artifact rows, the payroll run detail route requires the secretary_treasurer role and a finance view mandate, and the dashboard employer-execution layout restricts the area to administrators; this route applies none of them.' },
    ],
    def: ['DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ'],
  })
}

function replayFacts(a) {
  return mk({
    persona: 'Secretary-treasurer re-running an existing payroll run under the same, a new engine or a new rule version to explain a variance',
    service: `${API}employer-execution/replay/[runId]/route.ts (withApi over employer_payroll_runs, employer_timesheet_entries, cba_rule_versions and the replay and evidence tables)`,
    authn: `${SESSION} (withApi auth.roles FINANCIAL_MEMBER_DATA_ROLES).`,
    authz: 'withApi roles FINANCIAL_MEMBER_DATA_ROLES (secretary_treasurer) and the employer_execution_replay entitlement. The route calls no requireLiveFinancialMandate, so no financial mandate, no duty and no view grant is checked. A role allow-list is not a kernel decision.',
    tenant: 'The source run, its items, manifests, timesheet entries, rule version and rule items are each read with the session organization predicate, and the replay, artifacts, evidence link and event are written with the session organization.',
    owner: 'employer_execution_replays, employer_execution_artifacts and employer_execution_evidence_links rows of the organization, written beside the source payroll run; the replay records createdBy.',
    sens: 'Per-employee gross, net, dues, benefit and pension amounts of the source run and the replay, differences between them, and the replayed totals',
    priv: 'The response returns the replayed totals and a diff with per-employee amount differences, and the same diff is stored in the replay and artifact rows.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The replay row, three artifacts, the evidence link, any inconsistent_replay_results event and persistAtomicAudit (employer_execution.replay.create, with the source amounts) commit in one withRLSContext transaction. The calculation and diff are computed outside it.',
    reqAudit: 'Keep the in-transaction audit record; require the same mandate as the payroll run read and record it.',
    does: 'Recalculates the payroll of a run from its valid timesheet entries under its own or a requested rule version and engine version, diffs the result against the stored totals and item traces, stores the diff as a replay with sealed evidence artifacts beside the source run, opens an error event when the replay differs, and returns the diff. The run itself is not changed.',
    status: 'PARTIAL',
    gate: FIN_GATE,
    deps: [2, 13],
    future: 'Require a kernel financial mandate on the run for a replay, key an idempotent replay by run, mode and versions, record the engine change as its own mode, and keep a replay from creating approval blockers on the run it reads.',
    ev: [
      ...rolesGuard(a, 'entitlement: "employer_execution_replay",'),
      rolesEv(a),
      a.h('tenantScope', 'eq(employerPayrollRuns.organizationId, organizationId)'),
      a.h('tenantScope', 'eq(employerPayrollRunItems.organizationId, organizationId)'),
      a.h('mutation', '.insert(employerExecutionReplays)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'const [sourceRun] = await db'),
      a.h('defect', 'const sourceItems = await db'),
      a.h('behavior', 'replayPayrollRunId: null,'),
      a.h('defect', 'mode: body.mode === "new_rule" ? "simulated" : "exact",'),
      a.sch('defect', `${SCHEMA}employer-artifacts.ts`, '"simulated",', { symbol: 'employerExecutionReplayModeEnum' }),
      a.tbl('defect', 'employerExecutionReplays', 'diffHash: varchar("diff_hash", { length: 64 }).notNull(),'),
      a.h('defect', 'eventCode: "inconsistent_replay_results",'),
      a.h('defect', 'severity: "error",'),
      a.imp('defect', 'createEvidencePack', 'const seal = sha256(`${input.entityType}:${input.runRefId}:${manifestHash}`);'),
    ],
    inf: [
      { claim: 'defect', statement: 'approveRun in payroll-run-transitions.ts selects open events of the run with severity error and refuses approval unless each is acknowledged, so the open inconsistent_replay_results event this handler inserts against the source run becomes an approval blocker.' },
      { claim: 'defect', statement: 'The handler never imports or calls requireLiveFinancialMandate, and its only authorization lines are the secretary_treasurer role list and the entitlement, so the payroll items of any run of the organization are readable through the replay response even where the run view would be refused.' },
      { claim: 'defect', statement: 'The replay insert carries no idempotency key and the replays table lists no unique index over the source run, mode or versions, so each request adds another replay, artifact set and event for the same source run.' },
    ],
    def: [
      'DEF-0B6-EMP-REPLAY-NO-FINANCIAL-MANDATE',
      'DEF-0B6-EMP-REPLAY-NOT-IDEMPOTENT-GATES-APPROVAL',
      'DEF-0B6-EMP-REPLAY-MODE-MISRECORDED',
      'DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH',
    ],
  })
}

const inputsBase = {
  owner: 'employer_timesheet_batches, employer_timesheet_entries and employer_execution_compliance_events rows of the organization; the uploader is recorded on the batch and the raiser in the event details.',
  gate: FIN_GATE,
  deps: [2, 13],
  future: 'Decide with the institution which offices upload employer timesheets and raise compliance events, bind those duties to kernel financial mandates, restrict reads to the offices that may see payroll inputs, bound and validate the uploaded content, and map entries to member employment.',
}

function inputsFacts(a) {
  const { method, route } = a
  if (route === 'employer-execution/timesheets/route.ts' && method === 'GET') {
    return mk({
      ...inputsBase,
      persona: 'Member of the organization listing employer timesheet batches',
      service: `${API}employer-execution/timesheets/route.ts (withApi over employer_timesheet_batches)`,
      authn: `${SESSION} (withApi auth.minRole member).`,
      authz: 'withApi minRole member plus the employer_timesheet_ingest entitlement. A role floor of member is not a financial mandate or a kernel decision.',
      tenant: 'The batches are selected with the session organization predicate.',
      sens: 'Timesheet batch codes, source file names and hashes, pay periods, uploader user ids and validation summaries per employer',
      priv: 'Any member receives every batch row of the organization, including the uploader user id and the file name.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of timesheet batches once the offices that may read payroll inputs are named.',
      does: 'Returns every employer_timesheet_batches row of the organization, newest first, with no limit, to any member at the entitled module.',
      status: 'PARTIAL',
      ev: [
        ...minRoleGuard(a, 'member', 'entitlement: "employer_timesheet_ingest",'),
        a.h('tenantScope', '.where(eq(employerTimesheetBatches.organizationId, organizationId))'),
        a.h('mutation', '.select()'),
        a.h('defect', '.orderBy(desc(employerTimesheetBatches.createdAt));'),
      ],
      inf: [
        { claim: 'defect', statement: 'The handler selects whole rows with an organization predicate and an order and no limit or offset, so the list is unbounded and carries the uploadedBy column.' },
        { claim: 'defect', statement: 'The employer-execution dashboard layout redirects callers below the admin role, while this route is open to the member role and requires no financial mandate.' },
      ],
      def: ['DEF-0B6-EMP-EXECUTION-READS-AT-MEMBER-FLOOR'],
    })
  }
  if (route === 'employer-execution/timesheets/route.ts') {
    return mk({
      ...inputsBase,
      persona: 'Steward uploading an employer timesheet CSV that feeds payroll calculation',
      service: `${API}employer-execution/timesheets/route.ts (withApi over employer_timesheet_batches and employer_timesheet_entries with the normalizeCsv parser)`,
      authn: `${SESSION} (withApi auth.minRole steward).`,
      authz: 'withApi minRole steward plus the employer_timesheet_ingest entitlement. A role floor of steward is not a financial mandate or a kernel decision.',
      tenant: 'The employer, worksite and bargaining unit named by the body are each verified with the session organization predicate before the batch is written with the session organization.',
      sens: 'Employee external ids with shift dates and regular, overtime, double-time and travel hours, the source file name and hash',
      priv: 'The response returns the created batch and the validation summary; the entries hold employee-level hours.',
      mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
      auditDetail: 'The batch, its entries and persistAtomicAudit (employer_execution.timesheet_batch.ingest, with the file hash and summary) commit in one withRLSContext transaction.',
      reqAudit: 'Keep the in-transaction audit record and add the authority that allowed the upload to it.',
      does: 'Parses the uploaded CSV text, refuses a repeat of the same file for the same employer and period, and stores a batch (validated when no row is invalid, rejected otherwise) with one entry per row. The employee ids and hours are stored as the file gives them.',
      status: 'PARTIAL',
      ev: [
        ...minRoleGuard(a, 'steward', 'entitlement: "employer_timesheet_ingest",'),
        a.h('tenantScope', '.where(and(eq(employers.organizationId, organizationId), eq(employers.id, body.employerId)))'),
        a.h('tenantScope', 'organizationId,'),
        a.h('mutation', '.insert(employerTimesheetBatches)'),
        a.h('audit', 'await persistAtomicAudit(tx, {'),
        a.h('behavior', 'ne(employerTimesheetBatches.status, "rejected"),'),
        a.h('defect', 'const normalized = normalizeCsv(body.csvContent);'),
        a.h('defect', 'validationErrors: entry.validationErrors,'),
        a.imp('defect', 'normalizeCsv', 'const row = line.split(",");'),
        a.imp('defect', 'normalizeCsv', 'if (!employeeExternalId) validationErrors.push("missing_employee_external_id");'),
        a.tbl('defect', 'employerTimesheetEntries', 'memberEmploymentId: uuid("member_employment_id").references(() => memberEmployment.id, {'),
        a.h('defect', 'const [employer] = await tx'),
      ],
      inf: [
        { claim: 'defect', statement: 'The payroll preparation route counts entries without memberEmploymentId and opens a blocking critical event when any exists, and approveRun refuses approval while one is open, so entries this handler leaves unmapped stop an official run.' },
        { claim: 'defect', statement: 'The handler looks the employer up by id and organization and never reads its status, so an employer the registry has archived still receives timesheet batches.' },
        { claim: 'defect', statement: 'The entry insert lists organization, batch, external id, date, the four hour columns, premium code, row number, row hash, validation errors and status, and names neither memberEmploymentId nor jobClassificationId, so the entry columns that map an employee to a member stay empty.' },
        { claim: 'defect', statement: 'The body schema types csvContent as an unbounded string and the parser takes the external id as any non-empty text; no source in the handler matches the id to a member or employment record.' },
      ],
      def: ['DEF-0B6-EMP-TIMESHEET-INGEST-STEWARD-FLOOR-UNBOUNDED', 'DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE', 'DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS'],
    })
  }
  if (method === 'GET') {
    return mk({
      ...inputsBase,
      persona: 'Member of the organization listing payroll and remittance compliance events',
      service: `${API}employer-execution/compliance/route.ts (withApi over employer_execution_compliance_events)`,
      authn: `${SESSION} (withApi auth.minRole member).`,
      authz: 'withApi minRole member plus the employer_execution_compliance entitlement. A role floor of member is not a financial mandate or a kernel decision.',
      tenant: 'The events are selected with the session organization predicate.',
      sens: 'Compliance event codes, severities, summaries and details JSON about payroll and remittance runs, including the user who raised the event',
      priv: 'Any member receives every compliance event of the organization with its details JSON, which carries counts and the raiser user id.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of compliance events once the offices that may read payroll compliance are named.',
      does: 'Returns every employer_execution_compliance_events row of the organization, newest first, with no limit and no filter by run, to any member at the entitled module.',
      status: 'PARTIAL',
      ev: [
        ...minRoleGuard(a, 'member', 'entitlement: "employer_execution_compliance",'),
        a.h('tenantScope', '.where(eq(employerExecutionComplianceEvents.organizationId, organizationId))'),
        a.h('mutation', '.select()'),
        a.h('defect', '.orderBy(desc(employerExecutionComplianceEvents.detectedAt));'),
      ],
      inf: [
        { claim: 'defect', statement: 'The handler selects whole rows with an organization predicate and an order and no limit, so the list is unbounded and carries the details JSON of every event.' },
        { claim: 'defect', statement: 'The employer-execution dashboard layout redirects callers below the admin role, while this route is open to the member role and requires no financial mandate.' },
      ],
      def: ['DEF-0B6-EMP-EXECUTION-READS-AT-MEMBER-FLOOR'],
    })
  }
  return mk({
    ...inputsBase,
    persona: 'Steward persisting a compliance event against a payroll or remittance run',
    service: `${API}employer-execution/compliance/route.ts (withApi over employer_execution_compliance_events)`,
    authn: `${SESSION} (withApi auth.minRole steward).`,
    authz: 'withApi minRole steward plus the employer_execution_compliance entitlement. A role floor of steward is not a financial mandate or a kernel decision.',
    tenant: 'A named payroll or remittance run is verified with the session organization predicate before the event is inserted with the session organization.',
    sens: 'Compliance event code, severity, summary and free-form details about a payroll or remittance run',
    priv: 'The response returns the stored event; the details JSON also records the raiser user id.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The event and persistAtomicAudit (employer_execution.compliance_event.create) commit in one withRLSContext transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Inserts an open compliance event with the caller event code, severity, summary, details and blocking flag, optionally pointing at a payroll or remittance run of the organization.',
    status: 'PARTIAL',
    ev: [
      ...minRoleGuard(a, 'steward', 'entitlement: "employer_execution_compliance",'),
      a.h('tenantScope', '.where(and(eq(employerPayrollRuns.organizationId, organizationId), eq(employerPayrollRuns.id, body.payrollRunId)))'),
      a.h('tenantScope', 'organizationId,'),
      a.h('mutation', '.insert(employerExecutionComplianceEvents)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'eventCode: body.eventCode,'),
      a.h('defect', 'severity: body.severity,'),
      a.h('defect', 'blocking: body.blocking,'),
    ],
    inf: [
      { claim: 'defect', statement: 'The insert takes eventCode, severity, summary, details and blocking from the body and sets only status open and the raiser in details; no handler of the employer execution API resolves a critical blocking event, so one a steward raises stays open.' },
      { claim: 'defect', statement: 'approveRun in payroll-run-transitions.ts selects open events of the run with blocking yes and severity critical and refuses approval, and selects open error-severity events and requires each to be acknowledged, so an event raised through this route changes whether a run can be approved.' },
    ],
    def: ['DEF-0B6-EMP-COMPLIANCE-EVENT-FORGEABLE-BY-STEWARD'],
  })
}

const registryProfile = {
  persona: 'Steward and officer maintaining the employer register through the generic CRUD factory',
  owner: 'employers rows of the organization, including the identifiers, representatives and notes of each employer; createdBy and updatedBy columns exist and the factory does not set them.',
  sens: 'Employer legal name, CRA business number, corporation numbers, e-mail, telephone, address, primary and labour-relations representative names, e-mails and telephone numbers, notes and custom fields',
  priv: (method) => (method === 'GET'
    ? 'Callers below steward are refused by the low-role guard (the table has email and phone columns); a steward or above reads the whole employer row, including representative contact details, notes and custom fields, with no read audit.'
    : method === 'DELETE'
      ? 'The row is archived (status archived) by the fixed administrator delete; archivedAt stays empty and only the audit record of the delete remains.'
      : 'Any body field is stored, including representative contact details, parentCompanyId, status and custom fields.'),
  does: (method, _model, floor) => ({
    GET: `Returns employers rows of the organization at a configured role floor of ${floor}; the low-role guard refuses callers below steward because the table holds personal contact columns.`,
    POST: `Inserts an employers row from the body at a role floor of ${floor}.`,
    PATCH: `Updates an employers row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Sets status archived on an employers row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Name the offices that maintain the employer register, restrict representative contact details to the offices that need them with a read audit, verify parentCompanyId inside the organization, and set archivedAt and check dependents when an employer is archived.',
  gate: REL_GATE,
  deps: [13, 6],
  status: () => 'PARTIAL',
  def: (method) => [
    ...(method === 'GET' ? ['DEF-0B6-EMP-CONTACT-PII-READ-AT-STEWARD-UNAUDITED'] : []),
    ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B6-EMP-REGISTRY-PARENT-COMPANY-CROSS-ORG-LINK'] : []),
    ...(method === 'DELETE' ? ['DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS'] : []),
  ],
  extraEv: (a, model) => [
    a.tbl('privacy', 'employers', /primaryContactEmail: varchar\('primary_contact_email'/),
    a.tbl('privacy', 'employers', /labourRelationsContactPhone: varchar\('labour_relations_contact_phone'/),
    ...(a.method === 'GET' && !model.explicitOwner ? [a.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }")] : []),
    ...(a.method === 'POST' || a.method === 'PATCH' ? [a.tbl('defect', 'employers', /parentCompanyId: uuid\('parent_company_id'\)\.references/)] : []),
    ...(a.method === 'DELETE' ? [
      a.tbl('defect', 'employers', /archivedAt: timestamp\('archived_at'/),
    ] : []),
  ],
  reqRead: 'Audit reads of the employer register once the readers are named: it holds the contact details of employer representatives.',
}

function commsGuard(a, role = 'steward') {
  return [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', `const canAccess = await hasMinRole('${role}')`),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
  ]
}

const commsAuthz = `withOrganizationAuth (session and canonical organization) plus an in-handler hasMinRole('steward') check. A role floor of steward is not a kernel decision and names no grievance, case or employer office.`

const commsFuture = 'Name the offices that hold employer correspondence authority, verify every referenced id inside the organization, deliver or hand over a communication through a recorded delivery path before it reads as sent, restrict grievance correspondence to the stewards who hold the grievance, audit reads of contact details, and keep one audit write for each change.'

function commsFacts(a) {
  const { method, route } = a
  const isContacts = route === 'employers/communications/contacts/route.ts'
  if (isContacts && method === 'GET') {
    return mk({
      persona: 'Steward listing the contact directory of employer representatives',
      service: `${API}employers/communications/contacts/route.ts (withOrganizationAuth over employer_contacts)`,
      authn: `${SESSION} (withOrganizationAuth).`,
      authz: commsAuthz,
      tenant: 'The list is selected with the session organization predicate and an optional employerId filter taken from the query string.',
      owner: 'employer_contacts rows of the organization; createdBy records who added the contact.',
      sens: 'Names, titles, e-mail addresses, telephone numbers and notes of employer representatives',
      priv: 'Any steward receives the name, e-mail address, telephone number and notes of every employer contact of the organization, or of the employer named in the query, with no limit and no read audit.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of employer contact details once the offices that may read them are named.',
      does: 'Returns every employer_contacts row of the organization, optionally for one employer id from the query string, newest first, with no limit.',
      status: 'PARTIAL',
      gate: REL_GATE,
      deps: [6, 13],
      future: commsFuture,
      ev: [
        ...commsGuard(a),
        a.h('tenantScope', 'const conditions = [eq(employerContacts.organizationId, organizationId)]'),
        a.h('mutation', '.select()'),
        a.h('defect', '.orderBy(desc(employerContacts.createdAt))'),
        a.tbl('defect', 'employerContacts', /email: varchar\("email", \{ length: 320 \}\),/),
      ],
      inf: [{ claim: 'defect', statement: 'The handler applies the organization predicate and an optional employer filter and no limit or offset, and no audit call appears in it, so every contact is returned unbounded and the read leaves no record.' }],
      def: ['DEF-0B6-EMP-CONTACT-PII-READ-AT-STEWARD-UNAUDITED'],
    })
  }
  if (isContacts) {
    return mk({
      persona: 'Steward adding an employer representative to the contact directory',
      service: `${API}employers/communications/contacts/route.ts (withOrganizationAuth over employer_contacts)`,
      authn: `${SESSION} (withOrganizationAuth).`,
      authz: commsAuthz,
      tenant: 'The employer named in the body is verified against employers with the session organization predicate before the contact is inserted with the session organization.',
      owner: 'employer_contacts rows of the organization; createdBy records who added the contact.',
      sens: 'Name, title, e-mail address, telephone number, preferred contact method and notes of an employer representative',
      priv: 'The response returns the stored contact; the second audit event carries the contact name.',
      mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
      auditDetail: 'The contact and persistAtomicAudit (employer_contact.create) commit in one withRLSContext transaction; emitCapeAuditEvent then writes a second event after the commit.',
      reqAudit: 'Keep the in-transaction audit record and drop the second post-commit write or fold it into the transaction.',
      does: 'Inserts an employer_contacts row for an employer of the organization with the supplied name, role, e-mail, phone, preferred method, primary flag and notes, and returns it. No other contact is changed.',
      status: 'PARTIAL',
      gate: REL_GATE,
      deps: [6, 13],
      future: commsFuture,
      ev: [
        ...commsGuard(a),
        a.h('tenantScope', '.where(and(eq(employers.id, data.employerId), eq(employers.organizationId, organizationId)))'),
        a.h('tenantScope', 'organizationId,'),
        a.h('mutation', '.insert(employerContacts)'),
        a.h('audit', 'await persistAtomicAudit(tx, {'),
        a.h('defect', 'isPrimary: data.isPrimary,'),
        a.h('defect', 'await emitCapeAuditEvent({'),
        a.h('defect', 'contactName: data.name,'),
        a.h('defect', "return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to add employer contact')"),
        a.imp('defect', 'emitCapeAuditEvent', 'await auditLog({'),
        a.tbl('defect', 'employerContacts', /isPrimary: boolean\("is_primary"\)\.default\(false\),/),
      ],
      inf: [{ claim: 'defect', statement: 'The insert stores isPrimary as given and no statement of the handler updates other contacts of the employer, and the table lists no unique primary-contact rule, so several contacts of one employer can be primary.' }],
      def: ['DEF-0B6-EMP-CAPE-AUDIT-EVENT-AFTER-COMMIT', 'DEF-0B6-EMP-CONTACT-PRIMARY-NOT-EXCLUSIVE'],
    })
  }
  if (method === 'GET') {
    return mk({
      persona: 'Steward listing the log of communications with employers',
      service: `${API}employers/communications/route.ts (withOrganizationAuth over employer_communications)`,
      authn: `${SESSION} (withOrganizationAuth).`,
      authz: commsAuthz,
      tenant: 'The list is selected with the session organization predicate and an optional employerId filter taken from the query string.',
      owner: 'employer_communications rows of the organization; senderUserId and createdBy record the logging user and grievanceId links the grievance.',
      sens: 'Subject and body of correspondence with employers, recipient names and the grievance each is linked to',
      priv: 'Any steward receives the subject and body of every communication of the organization, with its grievance link, without holding the grievance.',
      mut: 'NOT_MUTATING',
      auditDetail: GET_ONLY_NOTE,
      reqAudit: 'Audit reads of grievance-linked employer correspondence once the offices that may read it are named.',
      does: 'Returns every employer_communications row of the organization, optionally for one employer id from the query string, newest first, with no limit.',
      status: 'PARTIAL',
      gate: REL_GATE,
      deps: [6, 13],
      future: commsFuture,
      ev: [
        ...commsGuard(a),
        a.h('tenantScope', 'const conditions = [eq(employerCommunications.organizationId, organizationId)]'),
        a.h('mutation', '.select()'),
        a.h('defect', '.orderBy(desc(employerCommunications.createdAt))'),
        a.tbl('defect', 'employerCommunications', 'grievanceId: uuid("grievance_id").references(() => grievances.id),'),
        a.tbl('defect', 'employerCommunications', 'body: text("body").notNull(),'),
      ],
      inf: [{ claim: 'defect', statement: 'The handler applies the organization predicate and an optional employer filter and consults no grievance, case or assignment table, and it has no limit, so every logged communication is returned to any steward.' }],
      def: ['DEF-0B6-EMP-COMMUNICATION-GRIEVANCE-CORRESPONDENCE-STEWARD-READ'],
    })
  }
  return mk({
    persona: 'Steward logging a communication with an employer, optionally linked to a grievance',
    service: `${API}employers/communications/route.ts (withOrganizationAuth over employer_communications)`,
    authn: `${SESSION} (withOrganizationAuth).`,
    authz: commsAuthz,
    tenant: 'The row is inserted with the session organization, but employerId, grievanceId, recipientContactId and templateId are stored from the body without any organization check.',
    owner: 'employer_communications rows of the organization; senderUserId and createdBy record the logging user and grievanceId links the grievance.',
    sens: 'Subject and body of correspondence with an employer, recipient name and the grievance the correspondence concerns',
    priv: 'The response returns the stored row; the post-commit audit event carries the subject.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The communication row and persistAtomicAudit (employer_communication.create) commit in one withRLSContext transaction; emitCapeAuditEvent then writes a second event, employer.communication_sent or employer.communication_logged, after the commit.',
    reqAudit: 'Keep the in-transaction audit record and drop the second post-commit write or fold it into the transaction.',
    does: 'Stores a log row for a communication of type email, phone, meeting, letter or other, with the status the caller gives (draft, sent, received or acknowledged), sets sentAt when the caller says sent and names the sender System. It calls no mail, SMS or letter provider and sends nothing.',
    status: 'PARTIAL',
    gate: REL_GATE,
    deps: [6, 11],
    future: commsFuture,
    ev: [
      ...commsGuard(a),
      a.h('tenantScope', 'const { organizationId, userId } = context'),
      a.h('mutation', '.insert(employerCommunications)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('behavior', "senderName: 'System',"),
      a.h('behavior', "sentAt: data.status === 'sent' ? new Date() : undefined,"),
      a.h('behavior', 'CAPE_AUDIT_EVENTS.EMPLOYER_COMMUNICATION_SENT'),
      a.h('defect', 'employerId: data.employerId,'),
      a.h('defect', 'grievanceId: data.grievanceId,'),
      a.h('defect', 'recipientContactId: data.recipientContactId,'),
      a.h('defect', 'templateId: data.templateId,'),
      a.h('defect', 'await emitCapeAuditEvent({'),
      a.h('defect', "return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to log communication')"),
      a.imp('defect', 'emitCapeAuditEvent', 'await auditLog({'),
      a.tbl('defect', 'employerCommunications', 'employerId: uuid("employer_id").notNull(),'),
      a.tbl('defect', 'employerCommunications', 'grievanceId: uuid("grievance_id").references(() => grievances.id),'),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler only inserts the row and writes audit records; it contains no call to a mail, SMS, letter or notification function, so a row with type email and status sent is a record the caller declared sent.' },
      { claim: 'defect', statement: 'Unlike the contacts route, the handler never selects from employers, grievances or employer_contacts before the insert, so the four ids it stores are not checked against the organization.' },
    ],
    def: ['DEF-0B6-EMP-COMMUNICATION-NOT-DELIVERED', 'DEF-0B6-EMP-COMMUNICATION-REFERENCES-UNVERIFIED', 'DEF-0B6-EMP-CAPE-AUDIT-EVENT-AFTER-COMMIT'],
  })
}

export function facts(a, readText) {
  const { route } = a
  if (route.startsWith('employer-execution/payroll-runs/')) return payrollFacts(a)
  if (route.startsWith('employer-execution/remittance-runs/')) return remittanceFacts(a)
  if (route.startsWith('employer-execution/replay/')) return replayFacts(a)
  if (route === 'employer-execution/timesheets/route.ts' || route === 'employer-execution/compliance/route.ts') return inputsFacts(a)
  if (route.startsWith('employers/communications')) return commsFacts(a)
  if (route === 'employers/route.ts' || route === 'employers/[id]/route.ts') {
    const record = crudRecord(a, readText, registryProfile)
    return record
  }
  throw new Error(`no employer facts for ${a.route}`)
}
