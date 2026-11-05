/**
 * Gate 0B.6 facts for the compliance, contracts, dashboard, dispatch, enterprise, COPE and debug route files. Every
 * quote is read from the exact handler, an import it uses or the service and schema definition it reaches. A
 * capability is created only where no earlier capability can own the obligation and a table, service or interface
 * shows that the domain exists. Nothing here claims delivery or adopts an institutional decision.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { APP, CRUD_GOVERNANCE, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const AUDIT_CAP = 'UE-OMIT-AUDIT-LOG-VISIBILITY'
const BILLING_CAP = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
const ANALYTICS_CAP = 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION'
const PRIVACY_CAP = 'UE-OMIT-PRIVACY-RIGHTS'
const PROVIDER_CAP = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const MEMBERSHIP_CAP = 'UE-CAP-A-005'
export const COMPLIANCE_CAP = 'UE-OMIT-COMPLIANCE-ASSURANCE'
export const COPE_CAP = 'UE-OMIT-COPE-POLITICAL-ACTION'
export const DISPATCH_CAP = 'UE-OMIT-DISPATCH-HALL'

const D_DISPATCH = 'UE-INST-DISPATCH-AUTHORITY'
const D_COMPLIANCE = 'UE-INST-COMPLIANCE-DETERMINATION-AUTHORITY'
const D_POLITICAL = 'UE-INST-POLITICAL-DATA-HANDLING'
const D_AUDIT = 'UE-INST-AUDIT-HISTORY-READERS'
const D_CONTRACT = 'UE-INST-PLATFORM-CONTRACT-AUTHORITY'

const SCHEMA = `${APP}db/schema/`
const COMPLIANCE_SCHEMA = `${SCHEMA}domains/compliance/employer-compliance.ts`
const DISPATCH_SCHEMA = `${SCHEMA}domains/dispatch/dispatch.ts`
const DISPATCH_ENGINE = `${APP}lib/services/dispatch-engine.ts`
const KPI_SERVICE = `${APP}lib/services/dashboard-kpi-service.ts`
const CSV_EXPORT = `${APP}lib/csv-export.ts`
const CONTRACT_SERVICE = `${APP}services/platform-economics/contract-service.ts`
const AUDIT_LOGGER = `${APP}lib/audit-logger.ts`
const FINANCIAL_SCHEMA = `${APP}services/financial-service/src/db/schema.ts`
const ev = (ref, quote) => ({ kind: 'file', ref, quote })

const D = (id, gate, severity, title, ownerCapabilityId) => ({ id, gate, severity, title, ownerCapabilityId })

export const ROUTES = new Set([
  'compliance/alerts/route.ts', 'compliance/audit-logs/route.ts', 'compliance/data-classification-policy/route.ts',
  'compliance/reports/route.ts', 'compliance/validate/route.ts', 'contracts/[id]/clauses/route.ts', 'contracts/route.ts',
  'cope/campaigns/route.ts', 'cope/canvassing/route.ts', 'cope/officials/route.ts', 'dashboard/export-csv/route.ts',
  'dashboard/leadership/route.ts', 'dashboard/stats/route.ts', 'debug/user-role/route.ts', 'dispatch/assign/route.ts',
  'dispatch/queue/route.ts', 'dispatch/requests/route.ts', 'enterprise/dsr/requests/route.ts', 'enterprise/integrations/route.ts',
])

export const GROUPS = {
  AUDIT_LOG_ACCESS: {
    capabilityId: AUDIT_CAP,
    domain: 'AUDIT_LOG_ACCESS',
    actor: 'Officer reading, and administrator writing manual entries into, the organization audit trail',
    routes: ['compliance/audit-logs/route.ts'],
    evidence: [
      ev(`${SCHEMA}audit-security-schema.ts`, 'export const auditLogs = auditSecuritySchema.table("audit_logs", {'),
      ev(`${APP}app/[locale]/dashboard/compliance-admin/page.tsx`, '/api/compliance/audit-logs?limit=20'),
    ],
  },
  COMMERCIAL_CONTRACTS: {
    capabilityId: BILLING_CAP,
    domain: 'PLATFORM_COMMERCIAL_CONTRACTS',
    actor: 'Organization representative reading, and administrator creating, the commercial contract that binds the organization to platform modules, licensing terms and service levels',
    routes: ['contracts/[id]/clauses/route.ts', 'contracts/route.ts'],
    evidence: [
      ev(`${SCHEMA}domains/finance/contracts.ts`, "export const commercialContracts = pgTable('commercial_contracts', {"),
      ev(`${SCHEMA}domains/finance/contracts.ts`, ' * Binds organizations to specific feature sets, licensing terms, SLAs,'),
      ev(CONTRACT_SERVICE, 'export async function createContract('),
    ],
  },
  DASHBOARD_METRICS: {
    capabilityId: ANALYTICS_CAP,
    domain: 'DASHBOARD_METRICS_AND_EXPORT',
    actor: 'Member reading dashboard counts, officer reading the leadership dashboard and anyone exporting dashboard data as CSV',
    routes: ['dashboard/export-csv/route.ts', 'dashboard/leadership/route.ts', 'dashboard/stats/route.ts'],
    evidence: [
      ev(KPI_SERVICE, 'export async function getLeadershipDashboardMetrics(args: {'),
      ev(CSV_EXPORT, 'export const CASE_COLUMNS: CSVColumn<CaseRow>[] = ['),
      ev(`${APP}app/[locale]/dashboard/leadership/page.tsx`, '/api/dashboard/leadership?timeframe='),
    ],
  },
  PRIVACY_DSR_INTAKE: {
    capabilityId: PRIVACY_CAP,
    domain: 'DATA_SUBJECT_REQUEST_INTAKE',
    actor: 'Data subject filing, and staff answering, an access, rectification, erasure, portability or restriction request',
    routes: ['enterprise/dsr/requests/route.ts'],
    evidence: [
      ev(`${SCHEMA}provincial-privacy-schema.ts`, 'export const dataSubjectAccessRequests = pgTable("data_subject_access_requests", {'),
      ev(`${SCHEMA}provincial-privacy-schema.ts`, 'responseDeadline: timestamp("response_deadline").notNull(), // requestedAt + 30 days'),
      ev(`${APP}app/api/privacy/dsar/route.ts`, ' * Capability: UE-PRIVACY-DSAR-WORKFLOW (state: NOT_IMPLEMENTED)'),
    ],
  },
  PROVIDER_INTEGRATIONS: {
    capabilityId: PROVIDER_CAP,
    domain: 'PROVIDER_ACCOUNT_LINKS',
    actor: 'User whose external provider account and access tokens are linked to the application',
    routes: ['enterprise/integrations/route.ts'],
    methods: ['GET'],
    evidence: [
      ev(`${SCHEMA}user-management-schema.ts`, 'export const oauthProviders = userManagementSchema.table("oauth_providers", {'),
      ev(`${SCHEMA}user-management-schema.ts`, 'accessToken: text("access_token"),'),
    ],
  },
  MEMBERSHIP_PROJECTION_DEBUG: {
    capabilityId: MEMBERSHIP_CAP,
    domain: 'MEMBERSHIP_PROJECTION_READ',
    actor: 'Member reading their own membership row, and steward or above reading the organization member roster, through a debug path',
    routes: ['debug/user-role/route.ts'],
    evidence: [
      ev(`${APP}db/schema-organizations.ts`, 'export const organizationMembers = pgTable('),
      ev(`${APP}db/schema-organizations.ts`, "role: text('role').notNull(),"),
    ],
  },
  COMPLIANCE_ALERTS_REPORTS: {
    capabilityId: COMPLIANCE_CAP,
    domain: 'EMPLOYER_COMPLIANCE_ALERTS_AND_REPORTS',
    actor: 'Steward or above reading the compliance alerts and compliance reports raised against the employers of the organization',
    routes: ['compliance/alerts/route.ts', 'compliance/reports/route.ts'],
    evidence: [
      ev(COMPLIANCE_SCHEMA, 'export const complianceAlerts = pgTable('),
      ev(COMPLIANCE_SCHEMA, 'export const employerReports = pgTable('),
      ev(`${APP}app/[locale]/dashboard/compliance/page.tsx`, 'fetch("/api/compliance/alerts"),'),
    ],
  },
  COMPLIANCE_STATUTORY_CHECKS: {
    capabilityId: COMPLIANCE_CAP,
    domain: 'STATUTORY_COMPLIANCE_CHECKS',
    actor: 'Officer or steward checking an arbitration deadline, a strike vote quorum or a certification card count against a jurisdiction rule',
    routes: ['compliance/validate/route.ts'],
    evidence: [
      ev(`${APP}components/jurisdiction/compliance-checker.tsx`, "const response = await fetch('/api/compliance/validate', {"),
      ev(`${APP}app/api/jurisdiction-rules/route.ts`, 'function buildRulesForJurisdiction(jur: CanadianJurisdiction) {'),
    ],
  },
  COMPLIANCE_DATA_FIREWALL_POLICY: {
    capabilityId: COMPLIANCE_CAP,
    domain: 'EMPLOYER_DATA_FIREWALL_POLICY',
    actor: 'Member reading, and compliance manager maintaining, the employer data firewall classification policy',
    routes: ['compliance/data-classification-policy/route.ts'],
    evidence: [
      ev(`${SCHEMA}domains/compliance/employer-interference.ts`, 'export const dataClassificationPolicy = pgTable("data_classification_policy", {'),
      ev(`${SCHEMA}domains/compliance/employer-interference.ts`, 'blockStrikePlans: boolean("block_strike_plans").notNull().default(true), // Employer never sees strike planning'),
    ],
  },
  COPE_POLITICAL_ACTION: {
    capabilityId: COPE_CAP,
    domain: 'COPE_POLITICAL_CAMPAIGNS',
    actor: 'Steward running political action campaigns, canvassing and elected-official contacts, and member reading them',
    routes: ['cope/campaigns/route.ts', 'cope/canvassing/route.ts', 'cope/officials/route.ts'],
    evidence: [
      ev(FINANCIAL_SCHEMA, 'export const politicalCampaigns = pgTable("political_campaigns", {'),
      ev(FINANCIAL_SCHEMA, 'export const electedOfficials = pgTable("elected_officials", {'),
      ev(`${APP}components/cope/CanvassingInterface.tsx`, 'interface CanvassingActivity {'),
      ev(`${APP}components/cope/PoliticalCampaignDashboard.tsx`, 'interface PoliticalCampaign {'),
    ],
  },
  DISPATCH_HALL: {
    capabilityId: DISPATCH_CAP,
    domain: 'HIRING_HALL_DISPATCH',
    actor: 'Steward opening an employer request for workers, and officer assigning members to it',
    routes: ['dispatch/assign/route.ts', 'dispatch/queue/route.ts', 'dispatch/requests/route.ts'],
    evidence: [
      ev(DISPATCH_SCHEMA, ' * Dispatch-hall model: employers request workers, the system'),
      ev(DISPATCH_SCHEMA, 'export const dispatchRequests = pgTable('),
      ev(`${APP}app/[locale]/dashboard/dispatch/page.tsx`, 'const res = await fetch("/api/dispatch/assign", {'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_DISPATCH,
    status: 'OUTSTANDING',
    question: 'Which office may open an employer request for workers and assign members to it, and which rules (seniority, rotation, availability, skills) bind the assignment?',
    sourceState: 'A steward opens a request and an officer assigns any member ids from the body; the dispatch rules table has no write route and the ranking function is called by no route. No adopted decision names the dispatch office or the rule order.',
    softwareOwners: [DISPATCH_CAP],
  },
  {
    id: D_COMPLIANCE,
    status: 'OUTSTANDING',
    question: 'Which office may state that a deadline, quorum or certification threshold is met, and from which governed source of statutory parameters?',
    sourceState: 'The validate route returns compliant and violation verdicts from numbers in the request body against thresholds written as literals in the handler; no adopted decision names the office or the parameter source.',
    softwareOwners: [COMPLIANCE_CAP],
  },
  {
    id: D_POLITICAL,
    status: 'OUTSTANDING',
    question: 'Does the union hold voter support levels, canvassing notes and elected-official contact records, who may read them, and under which privacy and political-finance rules?',
    sourceState: 'Political campaign, canvassing and official tables exist only in the financial-service schema and the interfaces expect voter support fields; the application routes are the generic factory over donation campaigns. No adopted decision names the holder or the readers.',
    softwareOwners: [COPE_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: COMPLIANCE_CAP,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-005', 'UE-CONV-F-003'],
    obligationKey: 'employer-compliance-assurance',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Steward or officer reading employer compliance alerts and reports, checking statutory thresholds, and member reading the employer data firewall policy',
    businessOutcome: 'A compliance alert or report exists only because a governed process raised it, a compliance verdict is computed from records of the organization against statutory parameters held in a governed source and names the office that determined it, a failed read is reported as a failure and not as an empty list, and the data firewall policy has a governed writer and is read by the code that withholds union data from employers.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/compliance',
    service: `${APP}app/api/compliance/validate/route.ts`,
    sourceFiles: [`${APP}app/api/compliance/alerts/route.ts`, `${APP}app/api/compliance/reports/route.ts`, `${APP}app/api/compliance/validate/route.ts`, `${APP}app/api/compliance/data-classification-policy/route.ts`, COMPLIANCE_SCHEMA],
    proof: [{ type: 'path', ref: `${APP}app/api/compliance/validate/route.ts` }],
    auditEvidence: 'The alert, report, validate and firewall policy reads write no audit record. The firewall policy writes are refused by the CRUD governance table. The validate route persists nothing.',
    privacyClassification: 'Employer compliance alert text, compliance report documents held as free JSON, the organization compliance verdicts computed from caller-supplied numbers, and the employer data firewall policy.',
    gap: 'No capability named employer compliance before Gate 0B.6. The alert and report tables are read by two routes and by the leadership dashboard and no source inserts into either, so the lists are empty and the leadership compliance metrics read 100 percent; both list routes answer success with an empty list when the query fails; the validate route returns compliant and violation verdicts, with severity and a recommendation, from numbers the caller types in, against thresholds written as literals, and swallows the failure of its own rules lookup; and the firewall policy table has no writer and no code reads its block flags. This record closes none of them. Which office may declare a compliance verdict and where the statutory parameters live are institutional matters no source states.',
  },
  {
    id: COPE_CAP,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-005', 'UE-CONV-F-003'],
    obligationKey: 'cope-political-action',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Steward running political action campaigns, canvassing and elected-official contacts, and member reading the campaigns',
    businessOutcome: 'A political campaign, a canvassing activity and an elected-official contact are held in tables built for them, voter support levels and canvassing notes are readable only by the offices the union names, funds raised come from recorded contributions and not from a caller, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/cope',
    service: `${APP}app/api/cope/campaigns/route.ts`,
    sourceFiles: [`${APP}app/api/cope/campaigns/route.ts`, `${APP}app/api/cope/canvassing/route.ts`, `${APP}app/api/cope/officials/route.ts`, `${APP}components/cope/PoliticalCampaignDashboard.tsx`, FINANCIAL_SCHEMA],
    proof: [{ type: 'path', ref: `${APP}app/api/cope/campaigns/route.ts` }],
    auditEvidence: 'Writes through the generic CRUD factory over donation_campaigns commit persistAtomicAudit with the row. Reads are not audited.',
    privacyClassification: 'Political campaign goals, electoral districts, endorsed candidates, canvassing voter support levels and notes, and elected-official contact records.',
    gap: 'No capability named political action before Gate 0B.6. The campaign, canvassing and officials routes are the same generic CRUD factory over donation_campaigns, a public donation campaign table; the political campaign, elected official and member political participation tables exist only in the financial-service schema, which the application schema does not export, and the two interfaces expect fields (electoral district, voter response, support level) that donation_campaigns does not have. A steward can set funds raised and payment product identifiers through the body. This record closes none of them and names no holder or reader of political data, which no source states.',
  },
  {
    id: DISPATCH_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-005', 'UE-CONV-K-007'],
    obligationKey: 'hiring-hall-dispatch',
    primaryGate: GATE,
    dependencyGates: [2, 13],
    actor: 'Steward opening an employer request for workers, officer assigning members to it, and member offered the work',
    businessOutcome: 'A dispatch request names an employer of the organization, a member is assigned only when the member belongs to the organization and the organization rules (seniority, rotation, availability, skills) rank the member for the request, a closed or filled request accepts no further assignment, the fill count comes from all assignments and not from one call, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/dispatch',
    service: DISPATCH_ENGINE,
    sourceFiles: [`${APP}app/api/dispatch/requests/route.ts`, `${APP}app/api/dispatch/assign/route.ts`, `${APP}app/api/dispatch/queue/route.ts`, DISPATCH_ENGINE, DISPATCH_SCHEMA],
    proof: [{ type: 'path', ref: DISPATCH_ENGINE }],
    auditEvidence: 'The request create and the assignment run in withRLSContext and commit persistAtomicAudit with the rows. The queue read is not audited.',
    privacyClassification: 'Member identifiers offered work, the employer and job title of each request, and assignment status.',
    gap: 'No capability named dispatch before Gate 0B.6. The request create, the queue and the assignment are implemented and audited atomically with an organization predicate on the request. The assignment inserts whatever member identifiers the officer posts without checking that they belong to the organization, ignores the status of the request and the assignments it already has, derives filled from the one call, and never applies the dispatch rules: the ranking function is called by no route and no route writes the rules table. The employer identifier of a request is not verified. This record closes none of them and names no dispatch office, which no source states.',
  },
]

export const DEFECTS = [
  D('DEF-0B6-CMP-AUDIT-LOG-FULL-ROW-READ-BY-OFFICER', GATE, 'MEDIUM', 'The audit log read returns every column of the latest hundred audit rows of the organization (IP address, user agent, session and correlation ids, old and new values, error text and metadata) to any officer, ignores the limit the page sends, offers no filter or page and is itself not audited.', AUDIT_CAP),
  D('DEF-0B6-CMP-AUDIT-MANUAL-ENTRY-FREE-REFERENCE', GATE, 'LOW', 'An administrator writes entries into the audit trail with a free resource type, a resource id and metadata keys that are not checked against any record of the organization; the entry is marked compliance.manual_entry but shares the trail and the table with system-recorded actions.', AUDIT_CAP),
  D('DEF-0B6-CMP-CONTRACT-READ-AT-MEMBER-FLOOR', GATE, 'MEDIUM', 'Any member of the organization reads every commercial contract of the organization (value, signer, billing account and subscription ids, renewal and termination terms) and the priced line items of any contract through an unbounded full-row select, behind a module entitlement and a member role floor; no office is named for contract terms.', BILLING_CAP),
  D('DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED', GATE, 'HIGH', 'The contract create takes billingAccountId and subscriptionId from the body and inserts them without checking that they belong to the organization, so a contract can be bound to another tenant billing account or subscription; the contract and line items also accept caller-set prices and a total contract value as free text.', BILLING_CAP),
  D('DEF-0B6-CMP-CONTRACT-AUDIT-NOT-ATOMIC', GATE, 'MEDIUM', 'createContract calls auditLog inside its transaction, but auditLog writes through its own connection and logs a failed write without throwing, so the contract and its line items can commit with no audit record, or the audit record can remain after a rollback.', BILLING_CAP),
  D('DEF-0B6-CMP-READ-FAILURE-RETURNS-EMPTY-SUCCESS', GATE, 'MEDIUM', 'The compliance alert and report reads catch every error and answer success with an empty list, so a failed query is reported to the steward as no alerts and no reports.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-ALERT-AND-REPORT-TABLES-HAVE-NO-WRITER', GATE, 'MEDIUM', 'No route, service or job inserts into compliance_alerts or employer_reports, so the alert and report reads, and the compliance metrics the leadership dashboard computes from the alerts, are over tables that nothing populates.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED', GATE, 'LOW', 'The alert and report lists have no limit or page, and the report list returns the whole free-form JSON document of every report of every employer of the organization.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA', GATE, 'HIGH', 'The validate route returns compliant, warning and violation verdicts with a severity and a recommendation computed only from dates and counts the caller sends in the body; nothing is checked against a grievance, vote or certification record, nothing is persisted or audited, and any authenticated user with an organization may obtain a verdict.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-VALIDATE-LITERAL-THRESHOLDS-AND-SWALLOWED-LOOKUP', GATE, 'MEDIUM', 'The arbitration deadline falls back to a literal thirty days when its rules lookup returns nothing, the lookup is an unauthenticated self-call whose failure is swallowed by an empty catch, the strike vote quorum is a literal fifty percent without a legal reference and the certification card thresholds are literals for three jurisdictions, with no check at all for any other.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-VALIDATE-INPUT-NOT-VALIDATED', GATE, 'LOW', 'The validate body is cast to an interface and never parsed: a schema is declared in the file and is not used, dates are passed to Date without a validity check, and an unknown jurisdiction or check name yields no check and no error.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-FIREWALL-POLICY-NO-WRITER-OR-ENFORCER', GATE, 'MEDIUM', 'The employer data firewall policy table is readable by every member and has no write path (the CRUD governance table refuses writes), and no service reads its block flags to withhold strike plans, membership lists or internal discussions from employer-facing paths.', COMPLIANCE_CAP),
  D('DEF-0B6-CMP-COPE-ROUTES-ARE-DONATION-CAMPAIGN-FACADE', GATE, 'MEDIUM', 'The COPE campaign, canvassing and officials routes are one generic CRUD factory over donation_campaigns under three political names; no political campaign, canvassing or official table is reachable from the application schema, so the interfaces that call the routes receive donation rows without the fields they render.', COPE_CAP),
  D('DEF-0B6-CMP-COPE-FUNDRAISING-TOTALS-WRITABLE-BY-STEWARD', GATE, 'MEDIUM', 'A steward creates a campaign row through the generic factory with any body field, including currentAmount (funds raised), status and the payment product and price identifiers, and any member reads those rows.', COPE_CAP),
  D('DEF-0B6-CMP-DISPATCH-REFERENCED-IDS-NOT-VERIFIED', GATE, 'HIGH', 'The assignment inserts any member uuid from the body without checking that it belongs to the organization or is eligible, into a table with no organization column that cannot be scoped to a tenant afterwards, and the request create stores any employer uuid without checking it is an employer of the organization.', DISPATCH_CAP),
  D('DEF-0B6-CMP-DISPATCH-ASSIGN-NO-STATE-OR-FILL-CHECK', GATE, 'MEDIUM', 'The assignment ignores the status of the request and the assignments it already has: a cancelled, expired or filled request accepts more assignments and has its status rewritten, the same member can be offered twice, and filled is derived from the length of the one posted list.', DISPATCH_CAP),
  D('DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED', GATE, 'MEDIUM', 'The seniority, rotation, availability and skills ranking and the organization rules table exist, but no route calls the ranking and no route writes a rule, so the assignment is whatever member list the officer posts and the fairness the hall model describes is not applied.', DISPATCH_CAP),
  D('DEF-0B6-CMP-DASHBOARD-STATS-FAILURE-RETURNS-ZEROS', GATE, 'MEDIUM', 'When the stats query fails the route logs the error and answers 200 with every count at zero, so a database failure reads on the dashboard as an organization with no claims and no members.', ANALYTICS_CAP),
  D('DEF-0B6-CMP-LEADERSHIP-COMPLIANCE-DEFAULTS-TO-100-AND-TRUNCATES', GATE, 'MEDIUM', 'The leadership compliance metrics report deadline adherence and documentation rate as 100 when there are no alerts, and nothing writes alerts; the grievance aggregates silently stop at the first five thousand rows and the alerts at one thousand; the figures are cached per organization.', ANALYTICS_CAP),
  D('DEF-0B6-CMP-EXPORT-CSV-AUTHENTICATION-ONLY-AND-EMPTY-200-OUTSIDE-PRODUCTION', GATE, 'MEDIUM', 'The CSV export is guarded by authentication alone, with no organization, role or entitlement, and its data source is not wired: production answers 501, every other environment answers 200 with an empty file; once wired the case export would carry case ids, assignees and worksites with no organization predicate in the route.', ANALYTICS_CAP),
  D('DEF-0B6-CMP-DSR-GENERIC-ROUTE-REFUSES-WITH-MISLEADING-403', 6, 'LOW', 'The enterprise data subject request route is the generic factory over a subject-owned table with no owner column, so every read and write is refused with a 403 that names a dedicated route, and the dedicated privacy route answers 501; no request can be received, and the table has no organization column to scope a request to the institution that must answer it.', PRIVACY_CAP),
  D('DEF-0B6-CMP-INTEGRATIONS-ROUTE-OVER-USER-TOKEN-TABLE', GATE, 'LOW', 'The enterprise integrations route is the generic factory over oauth_providers, a per-user table of provider account ids and access and refresh tokens with no organization column, under a name that advertises an organization integration list; the governance table denies it, so it serves nothing, and lifting that denial would expose tokens at the member floor.', PROVIDER_CAP),
  D('DEF-0B6-CMP-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN', 13, 'MEDIUM', 'The generic CRUD route declares orgScoped true over a table that has no organization column, so the factory adds no tenant predicate and every row of the table is visible to every organization once the read is allowed; the declared scope is a no-op.', 'UE-CAP-K-007'),
  D('DEF-0B6-CMP-DEBUG-ROUTE-REACHABLE-IN-PRODUCTION', 1, 'MEDIUM', 'The debug user-role route has no environment guard: it is the generic factory over organization_members, so it returns the roster rows of the organization (name, e-mail, phone, role, hire date, membership number, exemption reason) to a steward or above, and the caller own full row to a member, instead of a role check.', MEMBERSHIP_CAP),
]

const ORG_SCOPE_NO_OP = 'DEF-0B6-CMP-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN'
const ROLE_FLOOR_AUTHN = 'Authenticated session resolved by withOrganizationAuth.'

const floorOrg = (a, role) => [
  ...guardEv(a, 'withOrganizationAuth'),
  a.h('authorization', `hasMinRole("${role}")`),
  a.imp('authorization', 'hasMinRole', 'const resolvedOrgId = await getOrganizationIdForUser(userId);'),
]

const floorText = (role) => `withOrganizationAuth then hasMinRole("${role}"): a role floor of ${role}; hasMinRole resolves the role through getOrganizationIdForUser, a lookup of its own, and not through the organization the request is scoped to. A role title is not a kernel decision.`

const withApiText = (role) => `withApi with minRole ${role}: a role floor of ${role} for the session organization. A role title is not a kernel decision.`

const ORG_NOT_WRITTEN = 'A read: the handler writes no row and records no audit event.'

const FACTS = {
  'compliance/alerts/route.ts|GET': (a) => mk({
    persona: 'Steward or above reading the compliance alerts raised against the employers of the organization',
    service: `${APP}app/api/compliance/alerts/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('steward'),
    tenant: 'The alert rows are selected with an organization predicate on orgId equal to the session organization, joined to employers by id only.',
    owner: 'compliance_alerts rows of the organization; each names the employer it concerns and carries no author, and no source writes them.',
    sens: 'Alert type, severity, message text and resolution time of an employer compliance matter, with the employer name',
    priv: 'Any steward reads the message text of every alert of the organization, including alerts about dues non-remittance or grievance spikes of named employers, without holding a case.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'Audit reads of compliance alerts once the readers are named, and record the alert source that raised each alert.',
    does: 'Lists every compliance alert of the session organization, newest first, with the employer name, at a steward floor; a failed query is answered as success with an empty list.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Populate alerts only from a governed raising process, return a real failure when the read fails, bound and page the list, and name who may read alerts about an employer.',
    dec: [D_COMPLIANCE],
    ev: [
      ...floorOrg(a, 'steward'),
      a.h('tenantScope', '.where(eq(complianceAlerts.orgId, organizationId))'),
      a.h('mutation', '.from(complianceAlerts)'),
      a.sch('tenantScope', COMPLIANCE_SCHEMA, /orgId: uuid\("org_id"\)\.notNull\(\),/, { symbol: 'complianceAlerts' }),
      a.h('defect', 'return standardSuccessResponse([]);'),
      a.h('defect', '.orderBy(desc(complianceAlerts.createdAt));'),
    ],
    inf: [{ claim: 'defect', statement: 'A search of apps/union-eyes for inserts into complianceAlerts finds none: the table is read by this route, by the leadership dashboard service and by the employer risk code, and no route, service or job writes it.' }],
    def: ['DEF-0B6-CMP-READ-FAILURE-RETURNS-EMPTY-SUCCESS', 'DEF-0B6-CMP-ALERT-AND-REPORT-TABLES-HAVE-NO-WRITER', 'DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED'],
  }),

  'compliance/reports/route.ts|GET': (a) => mk({
    persona: 'Steward or above reading the compliance reports filed for the employers of the organization',
    service: `${APP}app/api/compliance/reports/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('steward'),
    tenant: 'The route first selects the ids of the employers of the session organization, then reads the reports of those employer ids; employer_reports has no organization column, so the tenant condition is carried by the employer id list.',
    owner: 'employer_reports rows of the employers of the organization; the table has no organization column and no author, and no source writes it.',
    sens: 'Report type and the full free-form JSON document of each quarterly review, annual audit, incident, dispatch fulfillment, grievance summary or safety inspection report of an employer',
    priv: 'Any steward reads the whole JSON document of every compliance report of every employer of the organization, which can hold incident and grievance detail, without holding a case.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'Audit reads of compliance reports once the readers are named, and record who filed each report.',
    does: 'Lists every compliance report of every employer of the session organization, newest first, with the employer name and the raw report JSON; an organization with no employers, or a failed query, is answered as success with an empty list.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Add an organization column to the reports, populate them from a governed filing process, return a real failure when the read fails, and bound and page the list.',
    dec: [D_COMPLIANCE],
    ev: [
      ...floorOrg(a, 'steward'),
      a.h('tenantScope', '.where(eq(employers.organizationId, organizationId));'),
      a.h('tenantScope', '.where(inArray(employerReports.employerId, employerIds))'),
      a.h('mutation', '.from(employerReports)'),
      a.sch('tenantScope', COMPLIANCE_SCHEMA, /pgTable\(/, { symbol: 'employerReports', absentColumns: ['organizationId', 'orgId'] }),
      a.sch('privacy', COMPLIANCE_SCHEMA, /dataJson: jsonb\("data_json"\)/, { symbol: 'employerReports' }),
      a.h('defect', 'return standardSuccessResponse([]);'),
    ],
    inf: [{ claim: 'defect', statement: 'A search of apps/union-eyes for inserts into employerReports finds none: the only references are this route and the schema, so no route, service or job writes a report.' }],
    def: ['DEF-0B6-CMP-READ-FAILURE-RETURNS-EMPTY-SUCCESS', 'DEF-0B6-CMP-ALERT-AND-REPORT-TABLES-HAVE-NO-WRITER', 'DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED'],
  }),

  'compliance/audit-logs/route.ts|GET': (a) => mk({
    persona: 'Officer or above reading the audit trail of the organization',
    service: `${APP}app/api/compliance/audit-logs/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: withApiText('officer'),
    tenant: 'The audit rows are selected with an organization predicate on audit_logs.organization_id equal to the session organization.',
    owner: 'audit_security.audit_logs rows of the organization; each row names the acting user, the action and the resource it concerns.',
    sens: 'Action, resource, acting user id, IP address, user agent, session and correlation ids, old and new values, error text and metadata of every recorded action of the organization',
    priv: 'Any officer reads the IP address, user agent and old and new values of every audit row of the organization, including rows about members and cases the officer does not hold.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'Audit the read of the audit trail itself, name the roles that may read it and the fields each role may see.',
    does: 'Returns the latest hundred audit rows of the session organization with every column, newest first, at an officer floor; it accepts no filter, page or limit.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: 'Name the readers of the audit history, project only the fields each reader may see, support a filter and a page, and audit the read.',
    dec: [D_AUDIT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'officer'"),
      a.h('tenantScope', '.where(eq(auditLogs.organizationId, organizationId!))'),
      a.h('mutation', '.from(auditLogs)'),
      a.h('privacy', '.select()'),
      a.h('defect', '.limit(100)'),
      a.sch('privacy', `${SCHEMA}audit-security-schema.ts`, /ipAddress: varchar\("ip_address"/, { symbol: 'auditLogs' }),
      a.sch('privacy', `${SCHEMA}audit-security-schema.ts`, /oldValues: jsonb\("old_values"\)/, { symbol: 'auditLogs' }),
    ],
    inf: [{ claim: 'defect', statement: 'The compliance administration page requests the route with a limit of twenty, the handler declares no query parsing, and the select ends with a fixed limit of one hundred, so the caller limit is ignored.' }],
    def: ['DEF-0B6-CMP-AUDIT-LOG-FULL-ROW-READ-BY-OFFICER'],
  }),

  'compliance/audit-logs/route.ts|POST': (a) => mk({
    persona: 'Administrator recording a manual entry in the audit trail of the organization',
    service: `${APP}app/api/compliance/audit-logs/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: withApiText('admin'),
    tenant: 'The entry is written in withRLSContext for the session organization, and the organization id of the entry is the session organization, never a body field.',
    owner: 'A compliance.manual_entry audit row of the organization attributed to the administrator who wrote it, with the declared action, severity and outcome kept as details.',
    sens: 'The declared action, resource type, resource id, severity, outcome and free metadata an administrator chooses to record',
    priv: 'Free metadata is stored without a size or content check and the resource reference is not verified against any record of the organization.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The handler writes the entry itself with persistAtomicAudit inside the tenant transaction; the entry is the audit record, so there is no separate record of who wrote it beyond the user id on the row.',
    reqAudit: 'Keep the in-transaction write, bound the metadata, verify the resource reference belongs to the organization and record the authorization decision.',
    does: 'Appends one audit entry with the action fixed to compliance.manual_entry, the administrator as the actor and the declared fields kept as details, for the session organization.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [1, 13],
    future: 'Decide whether a human may write into the audit trail at all, keep manual notes in a separate table, and verify and bound the resource reference and the metadata.',
    dec: [D_AUDIT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'admin'"),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('mutation', 'await persistAtomicAudit(tx, {'),
      a.h('audit', "action: 'compliance.manual_entry',"),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'metadata: z.record(z.string(), z.unknown()).optional(),'),
      a.h('defect', 'resourceId: z.guid().optional(),'),
    ],
    def: ['DEF-0B6-CMP-AUDIT-MANUAL-ENTRY-FREE-REFERENCE'],
  }),

  'compliance/validate/route.ts|POST': (a) => mk({
    persona: 'Authenticated user with an organization checking an arbitration deadline, strike vote quorum or certification card count',
    service: `${APP}app/api/compliance/validate/route.ts`,
    authn: 'Authenticated session resolved by withApiAuth and re-read with getCurrentUser inside the handler.',
    authz: 'withApiAuth and a check that the user and the organization exist: any authenticated user with an organization passes; no role is checked. A session is not a kernel decision.',
    cat: 'SESSION_ONLY',
    tenant: 'The handler requires the user to have an organization and then reads and writes no organization data; the verdicts come from the request body alone.',
    owner: 'No record: the route returns a list of check results computed in the handler and persists nothing.',
    sens: 'Dates and counts of a grievance, a strike vote or a certification drive that the caller supplies, and the verdict computed from them',
    priv: 'The caller supplies the figures, so no stored personal data is read, and a verdict is not tied to any record of the organization.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST computes check results from the request body and returns them; it writes no row, calls no write service and records no audit event.',
    auditDetail: 'The route computes and returns the checks; nothing is written, and the verdict, who asked for it and the figures it used are not audited.',
    reqAudit: 'If a verdict may ever be relied on, record who asked for it, the figures and the rule version used, and the office that determined it.',
    does: 'Returns compliant, warning or violation checks, with a severity and a recommendation, for an arbitration deadline, a strike vote quorum and a certification card count computed from dates and numbers in the body against literal thresholds.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Compute a verdict only from records of the organization against statutory parameters held in a governed source, name the office that determined it, mark any caller-supplied figure as an illustration and never as an attestation, and validate the body.',
    dec: [D_COMPLIANCE],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.local('authentication', 'handler', 'const user = await getCurrentUser();'),
      a.local('authorization', 'handler', 'if (!user || !user.organizationId) {'),
      a.local('tenantScope', 'handler', 'if (!user || !user.organizationId) {'),
      a.local('mutation', 'handler', 'return NextResponse.json({ checks });'),
      a.local('audit', 'handler', 'return NextResponse.json({ checks });'),
      a.local('defect', 'handler', "const body = (await request.json().catch(() => ({}))) as ComplianceRequestBody;"),
      a.local('defect', 'handler', "const arbitrationDate = typeof data.arbitrationDate === 'string' ? data.arbitrationDate : null;"),
      a.local('defect', 'handler', "status: turnout >= 50 ? 'compliant' : 'violation',"),
      a.local('defect', 'handler', 'let maxDays = 30;'),
      a.local('defect', 'handler', 'const deadlineRule = await fetch(rulesUrl.toString()).then((r) => r.json());'),
      a.local('defect', 'handler', '} catch (_error) {'),
      a.local('defect', 'handler', 'thresholds = { vote: 35, automatic: 50 };'),
    ],
    inf: [
      { claim: 'defect', statement: 'The rules lookup is a fetch with no headers, so it carries neither the session cookie nor an authorization header; when the lookup yields no rule the literal thirty days stays and the arbitration check is still reported as compliant or violation.' },
      { claim: 'defect', statement: 'The file declares a zod schema for the body and never parses with it, and the declared jurisdiction type (boolean) does not match the string the handler reads, so the body is validated by a cast only.' },
    ],
    def: ['DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA', 'DEF-0B6-CMP-VALIDATE-LITERAL-THRESHOLDS-AND-SWALLOWED-LOOKUP', 'DEF-0B6-CMP-VALIDATE-INPUT-NOT-VALIDATED'],
    corr: [{ field: 'mutating', manifest: 'mutating true, audit declared', actual: 'The POST returns a computed result and writes no row.' }],
  }),

  'contracts/route.ts|GET': (a) => mk({
    persona: 'Member of the organization reading the commercial contracts that bind the organization to platform modules and service levels',
    service: `${APP}app/api/contracts/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: `${withApiText('member')} The route also declares the commercial_reporting entitlement, which withApi checks against the organization.`,
    tenant: 'The contracts are selected with an organization predicate on commercial_contracts.organization_id equal to the session organization.',
    owner: 'commercial_contracts rows of the organization: the platform commercial contract between the organization and the platform operator, not a collective agreement.',
    sens: 'Contract number, name, status, effective and expiration dates, renewal and termination terms, total contract value, currency, signer, and billing account and subscription ids',
    priv: 'Any member of the organization reads the commercial value, signer and renewal terms of every platform contract of the organization.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'Audit reads of commercial contracts once the office that holds contract authority is named.',
    does: 'Returns every commercial contract row of the session organization, newest first, with every column and no limit, at a member floor behind the commercial_reporting entitlement.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [5, 13],
    future: 'Name the office that may read and sign the platform contract, return only the fields that office needs, and bound the list.',
    dec: [D_CONTRACT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'member'"),
      a.h('authorization', "entitlement: 'commercial_reporting',"),
      a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
      a.h('tenantScope', '.where(eq(commercialContracts.organizationId, organizationId))'),
      a.h('mutation', '.from(commercialContracts)'),
      a.h('privacy', '.select()'),
      a.tbl('privacy', 'commercialContracts', /totalContractValue: decimal\('total_contract_value'/),
      a.tbl('behavior', 'commercialContracts', /billingAccountId: uuid\('billing_account_id'\)/),
    ],
    def: ['DEF-0B6-CMP-CONTRACT-READ-AT-MEMBER-FLOOR'],
  }),

  'contracts/route.ts|POST': (a) => mk({
    persona: 'Administrator creating a commercial contract and its line items for the organization',
    service: `${APP}app/api/contracts/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: `${withApiText('admin')} The route also declares the commercial_reporting entitlement.`,
    tenant: 'The contract row is created for the session organization id; the billing account and subscription ids it references come from the body and are not checked against the organization.',
    owner: 'A commercial_contracts row and its contract_line_items for the organization, in draft status, created by the administrator.',
    sens: 'Contract name, dates, renewal and termination terms, total contract value, billing account and subscription ids, and priced line items with feature keys and service level targets',
    priv: 'Prices and the contract value are stored from the body as free text and the referenced billing account and subscription are not verified to be the organization own.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'createContract inserts the contract and its line items in db.transaction and then calls auditLog, which writes through its own connection and logs without throwing when its insert fails; the audit event is not committed with the rows.',
    reqAudit: 'Commit a persistAtomicAudit record in the same tenant transaction as the contract and its line items, with the authorization decision.',
    does: 'Creates a draft contract and its line items for the session organization from the body, generates a contract number and returns them with a 201.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [5, 13],
    future: 'Verify that the billing account and subscription belong to the organization, take prices and totals from a governed price list, name the office that may create a contract, and audit atomically.',
    dec: [D_CONTRACT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'admin'"),
      a.h('authorization', "entitlement: 'commercial_reporting',"),
      a.h('tenantScope', 'organizationId,'),
      a.h('mutation', 'const result = await createContract({'),
      a.imp('mutation', 'createContract', '.insert(commercialContracts)'),
      a.imp('audit', 'createContract', 'await auditLog({'),
      a.svc('audit', AUDIT_LOGGER, "logger.error('Failed to store audit log in database', dbError as Error, {", 'auditLog'),
      a.local('defect', 'createContractSchema', 'billingAccountId: z.guid(),'),
      a.imp('defect', 'createContract', 'billingAccountId: input.billingAccountId,'),
      a.imp('defect', 'createContract', 'totalContractValue: input.totalContractValue,'),
    ],
    inf: [{ claim: 'defect', statement: 'The create statement inserts input.billingAccountId and input.subscriptionId exactly as the body gave them and no query reads billing_accounts or org_subscriptions for the organization first; only a foreign key on the identifier existing constrains them.' }],
    def: ['DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED', 'DEF-0B6-CMP-CONTRACT-AUDIT-NOT-ATOMIC'],
    corr: [{ field: 'audit', manifest: 'audit atomic', actual: 'createContract audits through auditLog on its own connection, so the audit record is not committed with the contract.' }],
  }),

  'contracts/[id]/clauses/route.ts|GET': (a) => mk({
    persona: 'Member of the organization reading the priced line items of a commercial contract of the organization',
    service: `${APP}app/api/contracts/[id]/clauses/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: `${withApiText('member')} The route also declares the commercial_reporting entitlement.`,
    tenant: 'The service first reads the contract with its id and the session organization id and returns an empty list when the contract is not the organization own; only then are the line items read.',
    owner: 'contract_line_items rows of one commercial contract of the organization; the line items carry no organization column and are scoped through the contract.',
    sens: 'Module and feature licences, quantities, unit and total prices, usage limits and service level targets of a platform contract',
    priv: 'Any member of the organization reads the prices and service level commitments of any contract line of the organization; a contract of another organization answers an empty list, not a refusal.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'Audit reads of contract line items once the office that holds contract authority is named.',
    does: 'Returns the line items of the contract in the path when that contract belongs to the session organization, and an empty list otherwise.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [5, 13],
    future: 'Name the office that may read contract terms, return not found for a contract outside the organization, and bound the list.',
    dec: [D_CONTRACT],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'member'"),
      a.h('authorization', "entitlement: 'commercial_reporting',"),
      a.h('tenantScope', 'const lineItems = await getContractLineItems(id, organizationId);'),
      a.imp('tenantScope', 'getContractLineItems', 'eq(commercialContracts.organizationId, organizationId),'),
      a.imp('mutation', 'getContractLineItems', '.from(contractLineItems)'),
      a.imp('privacy', 'getContractLineItems', '.where(eq(contractLineItems.contractId, contractId));'),
      a.imp('behavior', 'getContractLineItems', 'return [];'),
    ],
    def: ['DEF-0B6-CMP-CONTRACT-READ-AT-MEMBER-FLOOR'],
  }),

  'dashboard/leadership/route.ts|GET': (a) => mk({
    persona: 'Officer or above reading the leadership dashboard of grievance load, employer hotspots, steward capacity and compliance',
    service: `${APP}app/api/dashboard/leadership/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('officer'),
    tenant: 'The grievances and the compliance alerts are selected with an organization predicate on the session organization, and the cache key carries the organization id.',
    owner: 'A computed payload with no row of its own; the grievances and compliance_alerts rows of the organization it summarizes belong to the organization.',
    sens: 'Grievance counts, resolution times, employer hotspots, steward workload, category shares and compliance metrics of the organization',
    priv: 'An officer reads the grievance load per employer and per steward of the whole organization without holding the cases.',
    mut: 'NOT_MUTATING',
    auditDetail: 'The handler records a LEADERSHIP_REPORT_VIEWED event through emitCapeAuditEvent, which calls auditLog on its own connection, and writes the computed payload to a cache; no case or member row is written.',
    reqAudit: 'Keep the view event and name the offices that may see steward workload and employer hotspots.',
    does: 'Computes the leadership payload for the session organization from at most five thousand grievances and one thousand alerts, serves it from a per-organization cache and records a view event; compliance metrics read 100 when there are no alerts.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13],
    future: 'Compute the metrics from complete data, show unavailable and not 100 where no alerts exist, name the readers of steward workload, and audit the view in the transaction that reads.',
    dec: [],
    ev: [
      ...floorOrg(a, 'officer'),
      a.h('mutation', 'const metrics = await getLeadershipDashboardMetrics({'),
      a.imp('tenantScope', 'getLeadershipDashboardMetrics', 'db.select().from(grievances).where(eq(grievances.organizationId, organizationId)).limit(5000),'),
      a.imp('tenantScope', 'getLeadershipDashboardMetrics', 'db.select().from(complianceAlerts).where(eq(complianceAlerts.orgId, organizationId)).limit(1000),'),
      a.h('audit', 'await emitCapeAuditEvent({'),
      a.imp('audit', 'emitCapeAuditEvent', 'await auditLog({'),
      a.svc('defect', KPI_SERVICE, /deadlineAdherence: resolvedAlerts\.length > 0 \? .* : 100,/, 'buildLeadershipDashboard'),
      a.svc('defect', KPI_SERVICE, /documentationRate: alertRows\.length > 0 \? .* : 100,/, 'buildLeadershipDashboard'),
    ],
    inf: [{ claim: 'defect', statement: 'The compliance metrics read compliance_alerts, which no route or service inserts into, so the 100 percent values come from the empty-list default and not from any measured adherence.' }],
    def: ['DEF-0B6-CMP-LEADERSHIP-COMPLIANCE-DEFAULTS-TO-100-AND-TRUNCATES'],
  }),

  'dashboard/stats/route.ts|GET': (a) => mk({
    persona: 'Member reading the claim and membership counts on the organization dashboard',
    service: `${APP}app/api/dashboard/stats/route.ts`,
    authn: 'Authenticated session resolved by withApi.',
    authz: withApiText('member'),
    tenant: 'Both counts run in withRLSContext for the session organization and carry an organization predicate in the statement.',
    owner: 'A computed payload with no row of its own; the claims and organization_members rows it counts belong to the organization.',
    sens: 'Counts of active, pending, resolved and high-priority claims and of active members of the organization',
    priv: 'Aggregate counts only; no row or personal identifier is returned.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'No audit record is needed for aggregate counts; audit only if a count could identify a small group.',
    does: 'Returns five counts for the session organization from two aggregate statements; when either fails it logs the error and answers 200 with every count at zero.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [13],
    future: 'Return a real error when the counts cannot be read, so that zero means zero.',
    dec: [],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "minRole: 'member'"),
      a.h('tenantScope', 'WHERE organization_id = ${organizationId}'),
      a.h('tenantScope', 'async (rlsDb) => Promise.all(['),
      a.h('mutation', 'FROM claims'),
      a.h('privacy', 'FROM organization_members'),
      a.h('defect', 'activeClaims: 0,'),
    ],
    def: ['DEF-0B6-CMP-DASHBOARD-STATS-FAILURE-RETURNS-ZEROS'],
  }),

  'dashboard/export-csv/route.ts|GET': (a) => mk({
    persona: 'Any authenticated user requesting a CSV export of dashboard cases, KPIs, aging, categories, worksites, assignees or trends',
    service: `${APP}app/api/dashboard/export-csv/route.ts`,
    authn: 'Authenticated session resolved by withApiAuth.',
    authz: 'withApiAuth only: it requires a session and names no role, organization or entitlement. A session is not a kernel decision.',
    cat: 'SESSION_ONLY',
    tenant: 'The route reads no organization id and no table: the case list is an empty array literal, so there is no tenant predicate and no data.',
    owner: 'No record: the route builds a CSV file from an empty in-memory list.',
    sens: 'None today; the case column set names the case id, assignee, worksite and dates that a wired export would carry',
    priv: 'The case columns include the assignee and the worksite; formula characters are neutralized by escapeCSVValue before a cell is written, so the export carries no formula injection.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'When the source is wired, record who exported which report for which organization.',
    does: 'Refuses with 501 in production because the data source is not wired; in every other environment it filters an empty case list and answers 200 with a header-only CSV file.',
    status: 'HONEST_501',
    gate: GATE,
    deps: [6, 13],
    future: 'Wire the export to organization-scoped case data behind an organization, role and entitlement check and audit each export, and answer 501 in every environment until then.',
    dec: [],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.h('authorization', "if (!VALID_REPORTS.has(report)) {"),
      a.h('tenantScope', 'const cases: CaseRow[] = [];'),
      a.h('mutation', 'const filtered = filterCases(cases, filter);'),
      a.h('behavior', "if (process.env.NODE_ENV === 'production') {"),
      a.h('behavior', '{ status: 501 },'),
      a.h('privacy', 'logger.warn('),
      a.svc('privacy', CSV_EXPORT, /const dangerousChars = /, 'escapeCSVValue'),
      a.svc('privacy', CSV_EXPORT, "{ header: 'Assignee', accessor: (r) => r.assignee },"),
    ],
    inf: [{ claim: 'defect', statement: 'Outside production the handler logs a warning and returns a 200 CSV built from the empty case list, which reads as an export of zero rows for work that is not wired.' }],
    def: ['DEF-0B6-CMP-EXPORT-CSV-AUTHENTICATION-ONLY-AND-EMPTY-200-OUTSIDE-PRODUCTION'],
  }),

  'dispatch/queue/route.ts|GET': (a) => mk({
    persona: 'Steward or above reading the open employer requests for workers in the dispatch queue',
    service: `${APP}app/api/dispatch/queue/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('steward'),
    tenant: 'The service selects dispatch_requests with an organization predicate on org_id equal to the session organization and status open.',
    owner: 'dispatch_requests rows of the organization; each names the employer and the job title and carries no author.',
    sens: 'Employer id, job title, required skills, number of workers requested and requested date of each open request',
    priv: 'No member identifier is returned; the queue shows what employers asked for.',
    mut: 'NOT_MUTATING',
    auditDetail: ORG_NOT_WRITTEN,
    reqAudit: 'No audit record is needed for the open queue unless it begins to list members.',
    does: 'Lists the open dispatch requests of the session organization ordered by requested date, with every column and no limit, at a steward floor.',
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [2, 13],
    future: 'Bound the queue and show the assignments already made against each request.',
    dec: [D_DISPATCH],
    ev: [
      ...floorOrg(a, 'steward'),
      a.h('mutation', 'const queue = await listDispatchQueue(organizationId);'),
      a.imp('tenantScope', 'listDispatchQueue', 'eq(dispatchRequests.orgId, orgId),'),
      a.imp('mutation', 'listDispatchQueue', '.from(dispatchRequests)'),
      a.sch('tenantScope', DISPATCH_SCHEMA, /orgId: uuid\("org_id"\)\.notNull\(\),/, { symbol: 'dispatchRequests' }),
    ],
  }),

  'dispatch/requests/route.ts|POST': (a) => mk({
    persona: 'Steward or above opening an employer request for workers',
    service: `${APP}app/api/dispatch/requests/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('steward'),
    tenant: 'The request is created for the session organization id, and the employer id comes from the body and is not checked against the employers of the organization.',
    owner: 'A dispatch_requests row of the organization; it names the employer and the job title and carries no author column.',
    sens: 'Employer id, job title, required skills, number of workers requested and requested date',
    priv: 'No member data is stored; the audit record lists the employer id, job title and number of workers.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The request insert and persistAtomicAudit run in one withRLSContext transaction, so the request and its audit record commit or roll back together.',
    reqAudit: 'Keep the in-transaction audit record and add the authorization decision and the office that opened the request.',
    does: 'Validates the body, inserts an open dispatch request for the session organization and audits it atomically, at a steward floor.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [2, 13],
    future: 'Verify the employer belongs to the organization and has a recognized relationship, and name the office that may open a request.',
    dec: [D_DISPATCH],
    ev: [
      ...floorOrg(a, 'steward'),
      a.h('tenantScope', 'orgId: organizationId,'),
      a.h('mutation', 'const created = await createDispatchRequest('),
      a.imp('mutation', 'createDispatchRequest', '.insert(dispatchRequests)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'employerId: parsed.data.employerId,'),
      a.h('defect', 'const parsed = requestSchema.safeParse(body);'),
    ],
    inf: [{ claim: 'defect', statement: 'The create statement inserts parsed.data.employerId as given and no query reads employers for the organization first, so any employer uuid is accepted.' }],
    def: ['DEF-0B6-CMP-DISPATCH-REFERENCED-IDS-NOT-VERIFIED'],
  }),

  'dispatch/assign/route.ts|POST': (a) => mk({
    persona: 'Officer or above assigning members to an employer dispatch request',
    service: `${APP}app/api/dispatch/assign/route.ts`,
    authn: ROLE_FLOOR_AUTHN,
    authz: floorText('officer'),
    tenant: 'The request is read with its id and the session organization id and refused as not found when it is another organization; the member ids from the body are inserted without any organization check, into a table with no organization column.',
    owner: 'dispatch_assignments rows that offer work to a member for one request of the organization; the assignment row has no organization column and no author.',
    sens: 'Member identifiers offered work for an employer, and the request status that records how filled it is',
    priv: 'A member id of any organization is accepted and recorded as offered work; the audit record lists the assigned member ids.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The assignments, the request status change and persistAtomicAudit run in one withRLSContext transaction, so they commit or roll back together.',
    reqAudit: 'Keep the in-transaction audit record and add the authorization decision, the rule or seniority basis for each assignment and the member consent to be offered the work.',
    does: 'Inserts an offered assignment for each member id in the body against one request of the session organization, sets the request to filled or partially_filled from the length of that list and audits the batch atomically, at an officer floor.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [2, 13],
    future: 'Verify each member is an active member of the organization, eligible and ranked for the request under the organization rules, refuse a request that is not open, count all existing assignments, and name the dispatch office.',
    dec: [D_DISPATCH],
    ev: [
      ...floorOrg(a, 'officer'),
      a.h('mutation', 'const rows = await assignWorkersToDispatch('),
      a.imp('tenantScope', 'assignWorkersToDispatch', 'and(eq(dispatchRequests.id, requestId), eq(dispatchRequests.orgId, orgId))'),
      a.imp('mutation', 'assignWorkersToDispatch', '.insert(dispatchAssignments)'),
      a.imp('mutation', 'assignWorkersToDispatch', '.update(dispatchRequests)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('defect', 'assignWorkersToDispatch', 'memberIds.map((memberId) => ({'),
      a.imp('defect', 'assignWorkersToDispatch', 'const filled = memberIds.length >= request.requestedWorkers;'),
      a.sch('defect', DISPATCH_SCHEMA, /memberId: uuid\("member_id"\)\.notNull\(\),/, { symbol: 'dispatchAssignments' }),
      a.sch('tenantScope', DISPATCH_SCHEMA, /pgTable\(/, { symbol: 'dispatchAssignments', absentColumns: ['orgId', 'organizationId'] }),
    ],
    inf: [
      { claim: 'defect', statement: 'The service selects the request by id and organization only and never reads its status or its existing assignments before inserting, so a cancelled, expired or filled request accepts further assignments and has its status overwritten.' },
      { claim: 'defect', statement: 'A search of apps/union-eyes finds rankCandidates and loadDispatchRules referenced by no route or page, and finds no route that inserts into dispatch_rules, so the assignment applies no rule.' },
    ],
    def: ['DEF-0B6-CMP-DISPATCH-REFERENCED-IDS-NOT-VERIFIED', 'DEF-0B6-CMP-DISPATCH-ASSIGN-NO-STATE-OR-FILL-CHECK', 'DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED'],
  }),
}

const COPE_PROFILE = {
  persona: 'Member reading, and steward creating, the political action campaign, canvassing and elected-official records of the organization through the generic CRUD factory',
  owner: 'donation_campaigns rows of the organization, which the political action routes read and write under political names; the political campaign, canvassing and official tables are not reachable from the application schema.',
  sens: 'Donation campaign title, type, goal and funds raised, status, payment product and price identifiers, page content and the author id; none of the political fields the interfaces expect',
  priv: (method) => (method === 'GET'
    ? 'Any member of the organization reads every donation campaign row, including the payment product and price identifiers, through a route named for political action.'
    : 'Any body field is stored, including currentAmount (funds raised), status, the payment product and price identifiers and the page content; the interfaces expect political and voter fields that this table does not hold.'),
  does: (method, _model, floor) => ({
    GET: `Returns donation_campaigns rows of the organization at a role floor of ${floor}, under a political action route name.`,
    POST: `Inserts a donation_campaigns row from the body at a role floor of ${floor}, under a political action route name.`,
  })[method],
  future: 'Decide whether the union holds political campaign data, build tables for it with their own readers, move funds raised to recorded contributions, and answer 501 until then.',
  gate: GATE,
  deps: [6, 13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [D_POLITICAL],
  def: (method) => ['DEF-0B6-CMP-COPE-ROUTES-ARE-DONATION-CAMPAIGN-FACADE', ...(method === 'POST' ? ['DEF-0B6-CMP-COPE-FUNDRAISING-TOTALS-WRITABLE-BY-STEWARD'] : [])],
  extraEv: (a) => [
    a.tbl('defect', 'donationCampaigns', /currentAmount: decimal\('current_amount'/),
    a.tbl('privacy', 'donationCampaigns', /stripeProductId: text\('stripe_product_id'\),/),
    a.sch('defect', FINANCIAL_SCHEMA, /campaignName: varchar\("campaign_name"/, { symbol: 'politicalCampaigns' }),
  ],
  inferences: () => [{ claim: 'defect', statement: 'The application schema index resolves donationCampaigns for the route and exports no political_campaigns, elected_officials or canvassing table, which exist only in the financial-service schema file.' }],
  reqRead: 'Audit reads of political campaign rows once the political data the union holds and its readers are named.',
}

const POLICY_PROFILE = {
  persona: 'Member reading the employer data firewall classification policy through the generic CRUD factory',
  owner: 'data_classification_policy rows, a platform-wide doctrine with an approver but no organization column; the route comment names it the Employer Data Firewall classification policy.',
  sens: 'The firewall flags (strict separation, bargaining unit roster, grievance participation, strike plan, membership list and internal discussion blocks) with the policy name, dates and approver',
  priv: (method) => (method === 'GET'
    ? 'Every member of any organization reads the platform-wide doctrine rows, including the approver; the table holds no member data.'
    : 'The write is refused by the CRUD governance table, so no policy row can be created through the route.'),
  does: (method, _model, floor) => ({
    GET: `Returns every data_classification_policy row at a role floor of ${floor}; orgScoped is a no-op because the table has no organization column.`,
    POST: `Refuses to insert a data_classification_policy row: the route declares writeRole ${floor}, and the CRUD governance table classifies the table READ_ONLY, so the write is refused with 403.`,
  })[method],
  future: 'Give the firewall policy a governed writer and an approver check, and make the code that withholds strike plans, membership lists and internal discussions from employers read its flags.',
  gate: GATE,
  deps: [6, 13],
  status: () => 'PARTIAL',
  decisions: [],
  def: () => ['DEF-0B6-CMP-FIREWALL-POLICY-NO-WRITER-OR-ENFORCER'],
  extraEv: (a) => [
    a.tbl('privacy', 'dataClassificationPolicy', /blockMembershipLists: boolean\("block_membership_lists"\)/),
    a.tbl('behavior', 'dataClassificationPolicy', /approvedBy: text\("approved_by"\)\.notNull\(\),/),
  ],
  inferences: () => [{ claim: 'defect', statement: 'A search of apps/union-eyes for dataClassificationPolicy finds the schema declarations, this route and comments in the arbitration routes; no service reads the block flags and no route writes the table.' }],
  reqRead: 'No audit record is needed for a policy that holds no member data; audit changes once a writer exists.',
}

const DEBUG_PROFILE = {
  persona: 'Member reading their own membership row, and steward or above reading the member roster, through a route named debug user-role',
  owner: 'organization_members rows of the organization, the compatibility membership projection; a member row names the user, the role and the personal contact details.',
  sens: 'Member name, e-mail, phone, role, status, department, hire date, membership number, seniority, exemption reason and metadata',
  priv: (method) => (method === 'GET'
    ? 'A steward or above reads the e-mail, phone, role, hire date and membership number of every member of the organization; a member reads their own full row, including the exemption reason, through a route that is not a role check.'
    : 'The write is refused by the CRUD governance table, so no membership row or role can be created or changed through the route.'),
  does: (method, _model, floor) => ({
    GET: `Returns organization_members rows of the organization at a role floor of ${floor}, narrowed to the caller own row below steward; it is the member roster under the name debug user-role and returns no role check.`,
    POST: `Refuses to insert an organization_members row: the route declares writeRole ${floor}, and the CRUD governance table classifies organization_members READ_ONLY, so the write is refused with 403 and no role state changes.`,
  })[method],
  future: 'Remove the debug route from the production build or guard it by environment, serve the caller own role through a dedicated session route and move the roster read to the membership authority readers.',
  gate: 1,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [],
  def: (method) => (method === 'GET' ? ['DEF-0B1-CRUD-FACADE-ORG-MEMBERS', 'DEF-0B6-CMP-DEBUG-ROUTE-REACHABLE-IN-PRODUCTION'] : ['DEF-0B6-CMP-DEBUG-ROUTE-REACHABLE-IN-PRODUCTION']),
  extraEv: (a) => [
    a.tbl('privacy', 'organizationMembers', /email: text\('email'\)\.notNull\(\),/),
    a.tbl('privacy', 'organizationMembers', /exemptionReason: text\('exemption_reason'\),/),
  ],
  inferences: () => [{ claim: 'defect', statement: 'The route file holds the generic factory configuration only and no branch on NODE_ENV or a deployment flag, and the path debug/user-role is served like every other route of the application.' }],
  reqRead: 'Audit reads of the member roster once the readers are named; it holds e-mail and phone numbers.',
}

const crudFacts = (a, readText) => {
  const profile = a.route.startsWith('cope/') ? COPE_PROFILE : a.route.startsWith('compliance/data-classification-policy') ? POLICY_PROFILE : DEBUG_PROFILE
  const record = crudRecord(a, readText, profile)
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? ORG_SCOPE_NO_OP : id)))]
  return record
}

const refusedCrud = (a, spec) => {
  const read = a.method === 'GET'
  const evidence = [
    a.h('authorization', read ? "readRole: 'member'," : `writeRole: '${spec.writeRole}',`),
    ...guardEv(a, 'crud'),
    a.h('tenantScope', 'orgScoped: true,'),
    a.tbl('tenantScope', spec.exportName, /pgTable\(|\.table\(/, { absentColumns: ['organizationId'] }),
    a.sch('scope', CRUD_GOVERNANCE, `'${spec.sql}'`),
    a.tbl('privacy', spec.exportName, spec.privacyPattern),
    ...(spec.extra?.(a) ?? []),
  ]
  const corr = []
  if (read) {
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudRead(governance);'),
      a.sch('behavior', CRUD_GOVERNANCE, 'export function assertCrudRead'),
    )
  } else {
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudWrite(governance);'),
      a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
    )
    corr.push({ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: `${spec.sql} is ${spec.governance} in the CRUD governance table, so the write is refused before any row or audit record is written.` })
  }
  if (spec.governance === 'SUBJECT_OWNED') {
    evidence.push(
      a.imp('behavior', 'crudRoutes', 'hasOwnerColumn: Boolean(opts.ownerColumn)'),
      a.sch('behavior', CRUD_GOVERNANCE, "gate.class === 'SUBJECT_OWNED'", { symbol: 'assertCrudRead' }),
      a.sch('behavior', CRUD_GOVERNANCE, "const REFUSAL = 'This record type is governed by a dedicated, authority-checked route"),
    )
  }
  return mk({
    persona: spec.persona,
    service: `${APP}lib/api/crud-factory.ts (crudRoutes over ${spec.sql})`,
    authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
    authz: `Generic CRUD role floor: ${a.method} declares ${read ? 'a member read floor' : `a ${spec.writeRole} write floor`}; the factory then refuses the ${read ? 'read' : 'write'} because ${spec.sql} is ${spec.governance} in the CRUD governance table${spec.governance === 'SUBJECT_OWNED' ? ' and the route declares no owner column' : ''}. A role title is not a kernel decision.`,
    tenant: `orgScoped: true is a no-op here: the table has no organization column, so the query would carry no tenant predicate; the factory refuses before any query runs.`,
    owner: spec.owner,
    sens: spec.sens,
    priv: read ? spec.privRead : spec.privWrite,
    mut: read ? 'NOT_MUTATING' : 'WRITE_REFUSED_BY_GOVERNANCE',
    auditDetail: read
      ? `${spec.sql} is ${spec.governance} in the CRUD governance table, so assertCrudRead refuses the read with 403 before any query; nothing is read, written or audited.`
      : `${spec.sql} is ${spec.governance} in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.`,
    reqAudit: read
      ? 'No audit record is needed for a refused read; a dedicated, authority-checked route must decide who may read and audit the reads that return personal data.'
      : 'No audit record is required for a refused write; a dedicated route that enables it must commit its audit record in the same transaction as the row.',
    does: read ? spec.doesRead : spec.doesWrite,
    status: spec.status,
    gate: spec.gate,
    deps: spec.deps,
    future: spec.future,
    dec: spec.dec ?? [],
    ev: evidence,
    inf: spec.inf ?? [],
    def: [ORG_SCOPE_NO_OP, ...spec.def],
    corr,
    crudTable: spec.sql,
    crudClass: spec.governance,
  })
}

const DSR_SPEC = {
  sql: 'data_subject_access_requests',
  exportName: 'dataSubjectAccessRequests',
  governance: 'SUBJECT_OWNED',
  writeRole: 'steward',
  persona: 'Member or steward attempting to read or file a data subject request through the generic CRUD factory',
  owner: 'data_subject_access_requests rows, each belonging to the data subject user id; the table has no organization column, a response deadline and an assignee.',
  sens: 'Request type, province, description, requested data categories, identity verification, response deadline, denial reason and legal basis of a data subject',
  privacyPattern: /requestedDataTypes: jsonb\("requested_data_types"\)/,
  privRead: 'Nothing is read: the factory refuses every read of this subject-owned table because the route declares no owner column.',
  privWrite: 'Nothing is written: the factory refuses every write to this subject-owned table because the route declares no owner column.',
  doesRead: 'Refuses with 403 before any query: data_subject_access_requests is SUBJECT_OWNED and the route declares no owner column, so no request is listed to the subject or to staff.',
  doesWrite: 'Refuses with 403 before any insert: data_subject_access_requests is SUBJECT_OWNED and the route declares no owner column, so no request can be filed or recorded.',
  status: 'LATENT_NOT_OPERATIONAL',
  gate: 6,
  deps: [2, 13],
  future: 'Build the intake, identity verification, scope, exemption, authorization and delivery steps behind a dedicated route with a data subject owner column and an organization, answer 501 until it exists, and audit each step in the transaction that makes it.',
  dec: [],
  def: ['DEF-0B6-CMP-DSR-GENERIC-ROUTE-REFUSES-WITH-MISLEADING-403'],
  inf: [{ claim: 'defect', statement: 'The dedicated privacy route that the refusal text points to, app/api/privacy/dsar, is itself a handler that throws not implemented (HTTP 501), so no route in the application receives a data subject request.' }],
}

const INTEGRATIONS_SPEC = {
  sql: 'oauth_providers',
  exportName: 'oauthProviders',
  governance: 'DENIED',
  writeRole: 'admin',
  persona: 'Member attempting to list organization integrations through the generic CRUD factory',
  owner: 'oauth_providers rows, each belonging to one user: provider name, provider account id, provider data and the access and refresh tokens; the table has no organization column.',
  sens: 'Provider account ids, provider data and the OAuth access and refresh tokens of a user',
  privacyPattern: /accessToken: text\("access_token"\),/,
  privRead: 'Nothing is read: the factory refuses every read of this denied table, so no token is returned; were the denial lifted the route would read the provider tokens at a member floor.',
  doesRead: 'Refuses with 403 before any query: oauth_providers is DENIED in the CRUD governance table, so the route lists no integration.',
  status: 'LATENT_NOT_OPERATIONAL',
  gate: GATE,
  deps: [1, 13],
  future: 'Decide whether organization integrations exist, give them an organization-scoped table with a connection authority that never returns tokens, and answer 501 until then.',
  dec: [],
  def: ['DEF-0B6-CMP-INTEGRATIONS-ROUTE-OVER-USER-TOKEN-TABLE'],
  inf: [{ claim: 'defect', statement: 'The route configuration names providerId as the primary key and declares no ownerColumn, so were the denial lifted the factory would address provider rows by id with no owner condition.' }],
}

export function facts(a, readText) {
  const key = `${a.route}|${a.method}`
  if (FACTS[key]) return FACTS[key](a)
  if (a.route === 'enterprise/dsr/requests/route.ts') return refusedCrud(a, DSR_SPEC)
  if (a.route === 'enterprise/integrations/route.ts') return refusedCrud(a, INTEGRATIONS_SPEC)
  if (ROUTES.has(a.route)) return crudFacts(a, readText)
  throw new Error(`no Gate 0B.6 compliance facts for ${key}`)
}
