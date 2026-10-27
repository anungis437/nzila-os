/**
 * Gate 0B.10 facts: the pension administration routes (pension/*) and the portal document routes (portal/documents,
 * portal/documents/upload). Eleven route files, 23 operations. The nine pension files are hand-written withApi routes
 * over the pension tables: plans, enrolments, contributions, benefit claims, T4A records and trustee meetings. Their
 * own-record reads and their administration writes were hardened by the pension-authority change (own records for a
 * member, the financial role for administration, atomic audit on every write); this tranche records what that change
 * left: the member-floor reads of the enrolment list and the trustee minutes, the typed figures that stand for plan
 * funding, retirement eligibility and the T4A, the unverified member references and the single role-title authority.
 * The two portal files are byte-identical generic CRUD configurations over cms_pages: neither reads a portal principal
 * and the "upload" file receives no file. Every evidence item is produced by `opAuthoring` from the exact handler, the
 * helper or service it calls, or the resolved schema. This tranche records the source; it repairs nothing and adopts
 * no business decision.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const PEN_CAP = 'UE-CAP-D-003'
const CONTENT_CAP = 'UE-OMIT-CONTENT-LIBRARY-EDITORIAL'
const PEN_GATE = 5
const CONTENT_GATE = 14

const D_PENSION = 'UE-INST-PENSION-ADMINISTRATION-AND-TRUSTEE-AUTHORITY'
const D_PORTAL_INTAKE = 'UE-INST-MEMBER-PORTAL-DOCUMENT-INTAKE-AND-PUBLICATION'
const D_KNOWLEDGE = 'UE-INST-KNOWLEDGE-PUBLICATION'

const PENSION_AUTH = `${APP}lib/pension/pension-authority.ts`
const FIN_AUTH = `${APP}lib/finance/financial-authority.ts`
const RATE = `${APP}lib/rate-limiter.ts`
const WITH_API = `${APP}lib/api/with-api.ts`
const CMS_SCHEMA = `${APP}db/schema/cms-website-schema.ts`
const CONTENT_STATUS = `${API}content/templates/[id]/status/route.ts`
const ADMIN_CONSOLE = `${APP}components/pension/pension-admin-console.tsx`

export const ROUTES = new Set([
  'pension/benefits/route.ts',
  'pension/contributions/route.ts',
  'pension/members/route.ts',
  'pension/plans/[id]/route.ts',
  'pension/plans/route.ts',
  'pension/retirement-eligibility/route.ts',
  'pension/t4a/route.ts',
  'pension/trustee-meetings/[id]/route.ts',
  'pension/trustee-meetings/route.ts',
  'portal/documents/route.ts',
  'portal/documents/upload/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  PEN_PLANS_AND_ENROLMENTS: {
    capabilityId: PEN_CAP,
    domain: 'PENSION_PLAN_AND_ENROLMENT_RECORDS',
    actor: 'Secretary-treasurer keeping the pension plans of the organization and enrolling members in them, and members of the organization reading the plans and their own enrolment',
    routes: ['pension/plans/route.ts', 'pension/plans/[id]/route.ts', 'pension/members/route.ts', 'pension/retirement-eligibility/route.ts'],
    evidence: [
      ev(`${APP}db/schema/domains/finance/pension.ts`, "totalAssets: numeric('total_assets', { precision: 15, scale: 2 }).notNull().default('0'),"),
      ev(`${APP}db/schema/domains/finance/pension.ts`, "yearsOfService: numeric('years_of_service', { precision: 5, scale: 1 }).notNull().default('0'),"),
      ev(RATE, '  PENSION_OPERATIONS: {'),
      ev(ADMIN_CONSOLE, 'fetch(`/api/pension/members?planId=${encodeURIComponent(firstPlanId)}&organizationId=${encodeURIComponent(organizationId)}`)'),
      ev(PENSION_AUTH, ' * Pension records are personal and financial: a member\'s benefit claims, contributions and tax slips are theirs, and'),
    ],
  },
  PEN_MEMBER_FINANCIAL_RECORDS: {
    capabilityId: PEN_CAP,
    domain: 'PENSION_CONTRIBUTIONS_BENEFIT_CLAIMS_AND_TAX_RECORDS',
    actor: 'Member reading their own pension contributions, benefit claims and T4A records and filing a benefit claim for themselves; secretary-treasurer recording contributions and T4A records and reading the organization records',
    routes: ['pension/contributions/route.ts', 'pension/benefits/route.ts', 'pension/t4a/route.ts'],
    evidence: [
      ev(`${APP}db/schema/domains/finance/pension.ts`, "pensionIncome: numeric('pension_income', { precision: 12, scale: 2 }).notNull(),"),
      ev(`${APP}db/schema/domains/finance/pension.ts`, "amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),"),
      ev(`${API}pension/t4a/route.ts`, '// Filing or amending a tax record with the tax authority is a separate act that is not implemented; a generated'),
    ],
  },
  PEN_TRUSTEE_MEETINGS: {
    capabilityId: PEN_CAP,
    domain: 'PENSION_TRUSTEE_MEETING_RECORDS',
    actor: 'Secretary-treasurer scheduling pension trustee meetings and keeping their agenda and minutes, and members of the organization reading them',
    routes: ['pension/trustee-meetings/route.ts', 'pension/trustee-meetings/[id]/route.ts'],
    evidence: [
      ev(`${APP}db/schema/domains/finance/pension.ts`, "minutes: text('minutes'),"),
      ev(`${APP}db/schema/domains/finance/pension.ts`, "attendees: jsonb('attendees').default([]),"),
      ev(PENSION_AUTH, ' * steward\'s. Until the trustee-administration authority is implemented (see the trustee routes), the only'),
    ],
  },
  PEN_PORTAL_DOCUMENTS: {
    capabilityId: CONTENT_CAP,
    domain: 'MEMBER_PORTAL_DOCUMENT_LIBRARY',
    actor: 'Member of the organization expecting to list the documents the union publishes to them, and steward expecting to deposit a document for members',
    routes: ['portal/documents/route.ts', 'portal/documents/upload/route.ts'],
    evidence: [
      ev(CMS_SCHEMA, "fileUrl: text('file_url'),"),
      ev(CMS_SCHEMA, "allowedRoles: text('allowed_roles').array(),"),
      ev(`${API}portal/documents/upload/route.ts`, ' * CRUD collection route for cmsPages'),
      ev(CONTENT_STATUS, "review:    { targets: ['published', 'draft'], minRole: 'admin' },"),
    ],
  },
}

const D = (id, ownerCapabilityId, gate, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate, severity, title, ...extra })
const P = (suffix, severity, title, extra) => D(`DEF-0B10-PEN-${suffix}`, PEN_CAP, PEN_GATE, severity, title, extra)
const C = (suffix, severity, title, extra) => D(`DEF-0B10-PEN-${suffix}`, CONTENT_CAP, CONTENT_GATE, severity, title, extra)

export const DECISIONS = [
  {
    id: D_PENSION,
    status: 'OUTSTANDING',
    question: 'Which offices may create, change and wind up a pension plan, enrol a member, record a contribution, issue a tax record and decide a benefit claim, which trustees or administrators hold that fiduciary authority, who may read plan funding figures, the enrolment list, retirement eligibility and the minutes of trustee meetings, and how is a member eligible to retire determined?',
    sourceState: 'The pension routes now hold a member to their own claims, contributions and T4A records and limit administration to the secretary_treasurer role title (FINANCIAL_MEMBER_DATA_ROLES); the pension-authority source states that the trustee-administration authority is not yet implemented and the trustee create, update and delete routes answer 501. Plans, the enrolment list through retirement-eligibility, and trustee minutes remain readable by every member; the figures that stand for plan assets, funding and years of service, and the amount on a T4A record, are typed by the administrator; no route decides a benefit claim; no source names a trustee body or an eligibility rule.',
    softwareOwners: [PEN_CAP],
  },
  {
    id: D_PORTAL_INTAKE,
    status: 'OUTSTANDING',
    question: 'Which documents may the union publish to members through a member portal, which office may deposit or publish one, what file types, size limits, scanning and storage rules apply to a deposited file, which members or roles may read each document, and how long is it retained?',
    sourceState: 'The two portal document routes are the generic CRUD factory over the cms_pages table: members list every page row of the organization, a steward inserts a row with any column including status, a file URL string and the role list, no file is received, stored or scanned by either route, and the allowed-roles and requires-auth columns are never applied; the file-receiving route that stores bytes, scans them and records an intake is /api/documents/upload, which these routes do not call.',
    softwareOwners: [CONTENT_CAP],
  },
]

export const CAPABILITIES = []

const DISPOSITION_ELIGIBILITY = {
  disposition: 'RELEASE_BLOCKING',
  actualExposure: 'Any signed-in member of an organization calls GET /api/pension/retirement-eligibility, optionally with threshold=0, and receives every pension_members row of the organization (name, plan name, enrolment date, membership status, years of service, vesting status, the organization membership id in user_id and the metadata JSON): the route filters only on the organization and the years of service and never relates a row to the caller.',
  potentialImpact: {
    classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
    description: 'Colleagues learn who is enrolled in which pension plan, how many years each has served, whether each is vested, retired, deferred or terminated and how close each is to retirement, which the sibling pension routes now hold to the member own record or to the secretary-treasurer.',
  },
  activationState: 'REACHABLE_ANY_AUTHENTICATED',
  activationEvidence: [{ ref: `${API}pension/retirement-eligibility/route.ts`, quote: "auth: { required: true, minRole: 'member' }," }],
  existingContainment: 'NONE',
  justification: 'The only guards are a session, an organization context and the member floor, the select returns every column of every enrolment row, and the threshold is a query value the caller sets, so a signed-in member reaches the personal pension standing of every enrolled colleague today; the sibling routes close exactly this read, so the route blocks release.',
}

const DISPOSITION_T4A = {
  disposition: 'CONDITIONALLY_BLOCKING',
  actualExposure: 'The secretary-treasurer posts memberId, memberName, taxYear, pensionIncome and optionally status generated and a generated date; the route inserts the row exactly as typed in the tenant transaction, commits the pension.t4a.generate audit row and returns it, and the member reads it from GET /api/pension/t4a as their T4A record. The amount is not computed from any contribution, claim or payment and no slip document or box data exists.',
  potentialImpact: {
    classes: ['FINANCIAL_INTEGRITY', 'FALSE_ATTESTATION_OR_OUTCOME'],
    description: 'A record labelled generated that carries a hand-typed pension income, for a member id nobody verified and with no uniqueness per member and year, reaches the member as their tax record; if members or the organization rely on it for a return, the figure is unsupported by any pension payment record and the member is told a slip was generated when nothing was.',
  },
  activationState: 'REACHABLE_ROLE_RESTRICTED',
  activationEvidence: [{ ref: `${API}pension/t4a/route.ts`, quote: 'auth: { required: true, roles: PENSION_ADMIN_ROLES },' }],
  existingContainment: {
    summary: 'Only the secretary_treasurer role can post, the status can only be draft or generated (never filed or amended), the insert carries the session organization and an atomic audit row commits with it, so a typed figure is attributable to one office and is never marked filed.',
    evidence: [
      { ref: FIN_AUTH, quote: "export const FINANCIAL_MEMBER_DATA_ROLES: UserRole[] = ['secretary_treasurer'];" },
      { ref: `${API}pension/t4a/route.ts`, quote: "status: z.enum(['draft', 'generated']).optional()," },
    ],
  },
  blockingCondition: 'An organization records T4A rows with status generated for members and presents them, or lets members rely on them, as the tax slip of the year; the route then publishes unsupported tax figures as generated records.',
  justification: 'The reach is one named office and the status cannot claim a filing, so the harm needs the office to type a figure and a member to rely on the generated label; once pension payments are made and slips are issued from these rows, the unsourced amount and the absent generation step become a tax-record integrity failure that blocks release.',
}

const DISPOSITION_MEETINGS = {
  disposition: 'CONDITIONALLY_BLOCKING',
  actualExposure: 'Any signed-in member calls GET /api/pension/trustee-meetings or /api/pension/trustee-meetings/<id> and receives every meeting row of the organization including its agenda, minutes and the untyped attendees array; the route filters on the organization only, and the secretary-treasurer writes the rows.',
  potentialImpact: {
    classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
    description: 'The deliberations of the pension trustees (funding decisions, discussion of individual benefit cases and the names of attendees) reach every member of the organization with no decision about which members may read fiduciary minutes.',
  },
  activationState: 'REACHABLE_ANY_AUTHENTICATED',
  activationEvidence: [{ ref: `${API}pension/trustee-meetings/route.ts`, quote: "auth: { required: true, minRole: 'member' }," }],
  existingContainment: 'NONE',
  blockingCondition: 'An organization records agenda items, minutes or an attendee list on a trustee meeting (the secretary-treasurer POST or PATCH); every member can then read that fiduciary record, which the institution has not decided to share.',
  justification: 'Nothing narrows the member-floor read, so the record is exposed to every member the moment it holds content; the harm needs the office to write minutes, which no source in the route prevents, so the defect blocks release for any organization that records trustee minutes.',
}

const DISPOSITION_UPLOAD = {
  disposition: 'CONDITIONALLY_BLOCKING',
  actualExposure: 'A steward posts any JSON body to /api/portal/documents/upload and the generic factory inserts a cms_pages row with the stored fileUrl, contentType, fileSizeMb, status and role columns exactly as sent and returns it; no file is received, typed, sized, scanned or stored under an organization key, so the success reply for an upload describes only a row that points at a string.',
  potentialImpact: {
    classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'UNAUTHORIZED_MUTATION'],
    description: 'A caller or a screen that believes the route stores a member document is told it did, while the row can name any external or internal URL as the document; a published row is then offered to members as a document without a type, size or malware check and with no storage owned by the organization.',
  },
  activationState: 'REACHABLE_ROLE_RESTRICTED',
  activationEvidence: [{ ref: `${API}portal/documents/upload/route.ts`, quote: "writeRole: 'steward'," }],
  existingContainment: {
    summary: 'Only a steward or above can post, the factory sets the session organization and the author on the row, and the insert commits with a crud.cms_pages.create audit record that names the fields written.',
    evidence: [
      { ref: `${API}portal/documents/upload/route.ts`, quote: 'orgScoped: true,' },
      { ref: `${APP}lib/api/crud-factory.ts`, quote: 'action: `crud.${governance.name}.${action}`,' },
    ],
  },
  blockingCondition: 'A client, integration or portal screen submits member documents to /api/portal/documents/upload, or a member screen renders cms_pages file_url values as downloadable documents; the route then reports an upload that never happened and offers unscanned URLs to members.',
  justification: 'The route is reachable by stewards and records an attributable row, so the harm needs something to treat it as the upload endpoint or to render its URL; the real file-receiving route is separate, and once a screen relies on this path the reply is an unsupported success with no file controls, so the condition blocks release.',
}

export const DEFECTS = [
  P('RETIREMENT-ELIGIBILITY-LISTS-EVERY-PENSION-ENROLMENT-OF-THE-ORGANIZATION-TO-ANY-MEMBER', 'HIGH',
    'GET /api/pension/retirement-eligibility is open at the member floor and selects every column of every pension_members row of the organization whose years_of_service is at or above a threshold taken from the query string (default 25, any value including 0 or a negative number is accepted), with no relation between the row and the caller, no administrator test and no pagination: any member receives the name, plan name, enrolment date, membership status, vesting status, years of service, organization membership id and metadata of every enrolled colleague, while the sibling benefits, contributions and T4A routes hold a non-administrator to their own records.',
    { releaseDisposition: DISPOSITION_ELIGIBILITY }),
  P('RETIREMENT-ELIGIBILITY-IS-A-YEARS-OF-SERVICE-COMPARISON-WITH-A-FIXED-DEFAULT-OF-25', 'MEDIUM',
    'The route described as checking retirement eligibility applies no eligibility rule: it compares the administrator-typed years_of_service with a threshold that defaults to the literal 25 or is chosen by the caller, ignores age, plan type, vesting, membership status and plan terms, includes terminated, inactive and retired enrolments, and returns the matching rows as the members meeting eligibility; a NaN threshold is stringified into the comparison.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  P('T4A-POST-STORES-AN-ADMINISTRATOR-TYPED-INCOME-AS-A-GENERATED-TAX-RECORD', 'HIGH',
    'POST /api/pension/t4a is described as generating a T4A record but generates nothing: it inserts the memberId, memberName, taxYear and pensionIncome exactly as typed (pensionIncome is an unvalidated string, negative or non-numeric values reach the database), may store status generated and a caller-written generated date, derives the income from no contribution, benefit claim or payment, checks neither the member reference nor uniqueness per member and tax year, holds no slip number, box data or document, and transmits nothing to the tax authority, so the member reads an unsupported figure labelled generated as their tax record.',
    { releaseDisposition: DISPOSITION_T4A, riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  P('TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER', 'HIGH',
    'GET /api/pension/trustee-meetings and GET /api/pension/trustee-meetings/[id] require only the member floor and return every column of the meeting rows of the organization, including the agenda, the minutes text and the untyped attendees array, to every member: no role, trustee identity or decision names who may read the minutes of the pension trustees, the list is unbounded, and the trustee administration that would define a reader is not implemented.',
    { releaseDisposition: DISPOSITION_MEETINGS }),
  P('TRUSTEE-MEETING-MINUTES-CAN-BE-REWRITTEN-OR-DELETED-WITHOUT-HISTORY', 'MEDIUM',
    'PATCH and DELETE on /api/pension/trustee-meetings/[id] let the secretary_treasurer rewrite the minutes, agenda, attendees, date and status of a meeting that is already completed, or delete it permanently, with no state rule, no approval of the minutes, no version of the previous text and no trustee involvement; the audit row lists only the changed field names and the status or the title, so the previous minutes cannot be recovered or compared, and the attendees and minutes are unbounded untyped input.'),
  P('PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER', 'MEDIUM',
    'The pension plan routes accept activeMembers, totalAssets and fundingStatus as typed values (fundingStatus and totalAssets are unvalidated strings written to numeric columns) and derive none of them from the pension_members, contribution or asset records, while GET /api/pension/plans and GET /api/pension/plans/[id] return every plan column, including those figures, the status and the metadata JSON, to any member of the organization, so a member reads plan assets and funding status that are whatever the administrator last typed, with no as-of date or source.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  P('PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT', 'MEDIUM',
    'DELETE /api/pension/plans/[id] hard-deletes the pension_plans row for the secretary_treasurer with no check for the enrolments, contributions or claims of the plan (pension_members.plan_id has no foreign key, so the delete succeeds and the enrolments keep a plan id that no longer resolves), no state rule such as terminated, and an audit row that keeps only the plan name, so the funding figures and plan description of the deleted plan cannot be recovered from the audit record.'),
  P('PENSION-ADMINISTRATION-WRITES-REST-ON-ONE-ROLE-TITLE-WITH-NO-MANDATE-OR-TRUSTEE-DECISION', 'MEDIUM',
    'Creating, changing and deleting a plan, enrolling a member, recording a contribution, issuing a T4A record and keeping trustee meetings are all authorized by one role-title list (PENSION_ADMIN_ROLES is FINANCIAL_MEMBER_DATA_ROLES, the single role secretary_treasurer): no route requires a live financial mandate as the payroll routes do, none calls the kernel authorization, no second person approves, and the pension-authority source states that the trustee-administration authority is not implemented, so the fiduciary acts are one office acting alone on a role string.'),
  P('PENSION-WRITES-STORE-TYPED-MEMBER-REFERENCES-NAMES-AND-AMOUNTS-UNVERIFIED', 'MEDIUM',
    'The pension write routes store the member and plan references and the money as typed: contributions and T4A rows take memberId as any uuid, with memberName and amount as free strings that are not checked against the organization membership or the enrolment (amount may be negative or non-numeric), enrolment takes planId and userId as any uuid that need not exist or belong to the organization (the table has no foreign key) with yearsOfService, vesting and status typed, and a benefit claim takes memberName, claimType and amount as typed text with no plan, so the rows a member later reads as their own depend on the administrator entering the right identifier.'),
  P('BENEFIT-CLAIMS-CAN-BE-FILED-BUT-NO-ROUTE-CAN-DECIDE-OR-PAY-THEM', 'MEDIUM',
    'POST /api/pension/benefits files a claim as pending for any member who holds an organization membership (the claim is tied to no plan, no eligibility check and no amount limit), but no route in the application sets under_review, approved, denied or paid, no notification reaches a trustee or an administrator, and the route says the decision belongs to trustees that are not implemented, so every claim stays pending with no path to a decision and the member receives a filed claim that nothing will process.'),
  P('PENSION-ROUTES-APPLY-NO-RATE-LIMIT', 'LOW',
    'None of the pension routes passes a rateLimit option to withApi, although lib/rate-limiter.ts defines PENSION_OPERATIONS for GET and POST /api/pension/* and nothing uses it, so the member own-record reads, the organization-wide administrator reads and the administration writes are limited only by whatever default the platform applies outside the route.'),
  P('PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION', 'LOW',
    'The pension list reads (benefits, contributions, T4A, members, plans, retirement eligibility and trustee meetings) return every matching row of the organization with no limit, offset or page, so an administrator read of a large organization, or the member-floor reads of plans, meetings and eligibility, returns the whole table in one response.'),
  P('MEMBERS-GET-IS-HELD-TO-THE-CALLER-OWN-ENROLMENT-AT-EVERY-ROLE', 'LOW',
    'GET /api/pension/members is described as listing the pension members of the organization by plan, but it adds a condition that pension_members.user_id equals the caller organization membership id for every caller including the secretary_treasurer, so the administration console that calls it with a plan id to list that plan members receives only the administrator own enrolment (the member console relies on the same own-enrolment answer to find the member pension id); the description and the administrator use do not match the behaviour.'),
  P('PENSION-READS-USE-THE-SHARED-DB-HANDLE-WITHOUT-AN-EXPLICIT-TENANT-CONTEXT', 'LOW',
    'The member-floor pension reads (members, plans, plan item, retirement eligibility, trustee meetings and the meeting item) query through the shared db import and only the explicit organization predicate scopes them: the row-level-security context is set by withApi only when rlsOrgContext is set or the canonical state context is enabled, so outside that mode the policy that the pension tables carry is not what isolates the tenant and the single where clause is the whole boundary, unlike the own-record reads and the writes that open withRLSContext.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),
  C('PORTAL-DOCUMENT-PATHS-ARE-CMS-PAGE-CRUD-WITH-NO-PORTAL-PRINCIPAL', 'MEDIUM',
    'The /api/portal/documents and /api/portal/documents/upload routes are the same crudRoutes configuration over cms_pages (readRole member, writeRole steward, orgScoped true) with no handler of their own: no portal principal or member identity is read, the list is not scoped to documents addressed to the caller, and the two files are byte-identical, so the upload path lists and creates the same page rows as the collection path.'),
  C('PORTAL-DOCUMENT-LIST-RETURNS-EVERY-PAGE-ROW-AND-IGNORES-ROLE-AND-AUTH-COLUMNS', 'MEDIUM',
    'GET on the portal document routes returns cms_pages rows of every status (draft, review, scheduled, published, archived) and every column to any member, including the author user id, the file URL and the content JSON, and never applies the requires_auth and allowed_roles columns of the row, so a document restricted to officers in its own row is listed to every member; pages hold at most 100 rows.'),
  C('PORTAL-UPLOAD-ROUTE-RECEIVES-NO-FILE-AND-STORES-A-CALLER-WRITTEN-FILE-URL', 'HIGH',
    'POST /api/portal/documents/upload (and POST /api/portal/documents) copies the request body into a cms_pages insert: no multipart file is read, no file type or size is validated, no malware scan runs, no storage key is derived under the organization, and file_url, content_type and file_size_mb are whatever strings and numbers the steward typed (any URL scheme, any size), so the route reports an upload as created while nothing was received or stored and the row can point members at an arbitrary external or script URL; the file-receiving route /api/documents/upload that validates, scans and stores is not called.',
    { releaseDisposition: DISPOSITION_UPLOAD }),
  C('PORTAL-POST-LETS-A-STEWARD-SET-STATUS-PUBLISHED-AND-ACCESS-COLUMNS-AROUND-THE-EDITORIAL-WORKFLOW', 'MEDIUM',
    'The portal document POST inserts any cms_pages column from the body at the steward floor, including status published, published_at, requires_auth, allowed_roles, view_count and download_count, whereas the content status route moves a row from draft to review only for a content_manager and from review to published only for an administrator under a row lock; a steward therefore creates a published document with no review and no administrator step, and the role that publishes through the workflow is not the role that publishes here.'),
]

const adminRoleEv = (a, claim = 'authorization') => [
  a.h(claim, 'auth: { required: true, roles: PENSION_ADMIN_ROLES },'),
  a.imp(claim, 'PENSION_ADMIN_ROLES', 'export const PENSION_ADMIN_ROLES = FINANCIAL_MEMBER_DATA_ROLES;'),
  a.svc(claim, FIN_AUTH, "['secretary_treasurer']", 'FINANCIAL_MEMBER_DATA_ROLES'),
  a.svc(claim, WITH_API, 'if (!allowedRoles.includes(userRole)) {'),
]
const auditEv = (a, action) => [
  a.h('audit', 'await persistAtomicAudit(tx, {'),
  a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
  a.h('audit', `action: '${action}',`),
]
const orgGuardEv = (a) => a.h('tenantScope', 'if (!organizationId || !userId) throw ApiError.badRequest(\'Organization context required\');')

const STATUS = 'PARTIAL'
const READ_AUDIT = 'Audit reads of pension records once the offices that may read the organization records are named; the records are personal and financial.'
const ATOMIC = 'The insert, update or delete and the audit row (persistAtomicAudit with the transaction handle, so a failed audit rolls the change back) commit in one tenant transaction; the audit names the action, the resource and the changed field names or key values.'
const KEEP_AUDIT = 'Keep the in-transaction audit row and add the authority decision, the value before and after the change and the identity of the approver.'

/* ---------- own-record reads: benefits, contributions, T4A ---------- */
const OWN = {
  'pension/benefits/route.ts': {
    table: 'pensionBenefitClaims', sql: 'pension_benefit_claims', noun: 'benefit claims',
    sens: 'Member name, claim type, amount, status, submitted and processed dates and notes of a benefit claim',
    schemaPat: /claimType: varchar\('claim_type'/,
  },
  'pension/contributions/route.ts': {
    table: 'pensionContributions', sql: 'pension_contributions', noun: 'contributions',
    sens: 'Member name, contribution period, amount, payment status and payment date',
    schemaPat: /paymentStatus: varchar\('payment_status'/,
  },
  'pension/t4a/route.ts': {
    table: 'pensionT4aRecords', sql: 'pension_t4a_records', noun: 'T4A records',
    sens: 'Member name, tax year, pension income and the draft or generated status of a T4A tax record',
    schemaPat: /pensionIncome: numeric\('pension_income'/,
  },
}

function ownRead(a) {
  const c = OWN[a.route]
  return mk({
    persona: `Member reading their own ${c.noun}, or secretary-treasurer reading those of the organization`,
    service: `${a.routeFile} (GET: withApi member floor, isPensionAdministrator branch, ownPensionIdentities, withRLSContext read of ${c.sql})`,
    authn: `${SESSION} through withApi (auth required; 400 when the organization or user context is missing).`,
    authz: `withApi minRole member. The secretary_treasurer role (PENSION_ADMIN_ROLES) reads every row of the organization and may filter by memberId; any other caller is held to the rows whose memberId is the caller organization membership id or the id of one of their pension enrolments, and receives an empty list when they have none. A role title decides the administrator branch; authorizeAction is not called and no financial mandate is required.`,
    tenant: `The organization is the session organization: every query carries eq(${c.table}.organizationId, organizationId) inside withRLSContext({ organizationId }); the organization is not read from the query or the body (the consoles send an organizationId query value that the route ignores).`,
    owner: `${c.sql} rows of the organization; memberId is the organization membership id or the id of a pension enrolment, and the row holds the member name typed by the administrator.`,
    sens: c.sens,
    priv: `A non-administrator receives only the rows filed under their own membership or enrolment ids; the secretary_treasurer receives every ${c.noun} row of the organization, unpaged, with no read audit. The tables hold no social insurance number.`,
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: READ_AUDIT,
    does: `Returns every ${c.sql} row of the organization, newest first, optionally filtered by memberId, for the secretary_treasurer; for any other caller returns the rows filed under their own membership or enrolment ids (an empty list without a membership, or when the memberId asked for is not their own).`,
    status: STATUS,
    gate: PEN_GATE,
    deps: [1, 13],
    future: 'Name the offices that may read the pension records of other members, require a financial mandate for the organization-wide read, audit it, and page the list.',
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('authorization', 'if (isPensionAdministrator(user?.role)) {'),
      a.imp('authorization', 'isPensionAdministrator', '(PENSION_ADMIN_ROLES as readonly string[]).includes(role)'),
      a.svc('authorization', FIN_AUTH, "['secretary_treasurer']", 'FINANCIAL_MEMBER_DATA_ROLES'),
      orgGuardEv(a),
      a.h('tenantScope', `const conditions = [eq(${c.table}.organizationId, organizationId)];`),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.imp('privacy', 'ownPensionIdentities', 'eq(organizationMembers.userId, userId)'),
      a.h('privacy', 'if (own.length === 0 || (memberId && !own.includes(memberId))) return [];'),
      a.h('mutation', `return tx.select().from(${c.table}).where(and(...conditions)).orderBy(desc(${c.table}.createdAt));`),
      a.tbl('privacy', c.table, c.schemaPat),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler has no limit, offset or page condition, so the secretary_treasurer branch returns the whole table of the organization; it passes no rateLimit option although lib/rate-limiter.ts defines PENSION_OPERATIONS for /api/pension/*.' },
    ],
    def: ['DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT', 'DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION'],
    corr: [],
  })
}

/* ---------- member-floor reads: plans, plan item, trustee meetings, meeting item ---------- */
const FLOOR = {
  'pension/plans/route.ts': {
    list: true, table: 'pensionPlans', sql: 'pension_plans', noun: 'pension plans', cond: 'eq(pensionPlans.organizationId, organizationId!)',
    sens: 'Plan name, type, status, active member count, total assets, funding status, description and metadata',
    schemaPat: /totalAssets: numeric\('total_assets'/,
    def: ['DEF-0B10-PEN-PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER', 'DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION'],
    priv: 'Every member of the organization receives every plan row, including the total assets, funding status and active member count that the administrator typed, and the metadata JSON.',
  },
  'pension/plans/[id]/route.ts': {
    list: false, table: 'pensionPlans', sql: 'pension_plans', noun: 'pension plan', cond: 'eq(pensionPlans.organizationId, organizationId!)',
    sens: 'Plan name, type, status, active member count, total assets, funding status, description and metadata',
    schemaPat: /totalAssets: numeric\('total_assets'/,
    def: ['DEF-0B10-PEN-PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER'],
    priv: 'Every member of the organization receives the plan row named by the path id, including the total assets, funding status and metadata; a plan that is not in the organization yields a null body rather than an error.',
  },
  'pension/trustee-meetings/route.ts': {
    list: true, table: 'pensionTrusteeMeetings', sql: 'pension_trustee_meetings', noun: 'trustee meetings', cond: 'eq(pensionTrusteeMeetings.organizationId, organizationId!)',
    sens: 'Meeting title, date, location, agenda, minutes, status and the attendees array of the pension trustees',
    schemaPat: /minutes: text\('minutes'\)/,
    def: ['DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER', 'DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION'],
    priv: 'Every member of the organization receives every trustee meeting row with its agenda, minutes text and attendees array.',
  },
  'pension/trustee-meetings/[id]/route.ts': {
    list: false, table: 'pensionTrusteeMeetings', sql: 'pension_trustee_meetings', noun: 'trustee meeting', cond: 'eq(pensionTrusteeMeetings.organizationId, organizationId!)',
    sens: 'Meeting title, date, location, agenda, minutes, status and the attendees array of the pension trustees',
    schemaPat: /minutes: text\('minutes'\)/,
    def: ['DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER'],
    priv: 'Every member of the organization receives the trustee meeting named by the path id with its agenda, minutes text and attendees array; a meeting that is not in the organization yields a null body.',
  },
}

function floorRead(a) {
  const c = FLOOR[a.route]
  const isPlan = a.route.startsWith('pension/plans')
  return mk({
    persona: isPlan
      ? 'Member of the organization reading its pension plans (administrator and trustee consoles read the same route)'
      : 'Member of the organization reading the pension trustee meetings (the trustee portal reads the same route)',
    service: `${a.routeFile} (GET: withApi member floor, shared db select of ${c.sql} by organization${c.list ? '' : ' and path id'})`,
    authn: `${SESSION} through withApi (auth required).`,
    authz: 'withApi minRole member only: any member of the organization in any role reads. No administrator branch, no pension enrolment or trustee test and no financial mandate; authorizeAction is not called.',
    tenant: `The organization is the session organization: the select carries ${c.cond}${c.list ? '' : ' and the path id'}; the read runs through the shared db import with no explicit withRLSContext, so the row-level-security context applies only when withApi establishes it. The query-string organizationId that the consoles send is ignored.`,
    owner: `${c.sql} rows of the organization; the secretary_treasurer writes them.`,
    sens: c.sens,
    priv: c.priv,
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: isPlan ? 'Audit reads of plan funding figures once the offices that may read them are named.' : 'Audit reads of trustee agenda and minutes once the readers of fiduciary minutes are named.',
    does: c.list
      ? `Returns every ${c.sql} row of the organization, newest first, with no limit, to any member.`
      : `Returns the ${c.sql} row whose id is the path id and whose organization is the session organization, or null, to any member.`,
    status: STATUS,
    gate: PEN_GATE,
    deps: [1, 13],
    future: isPlan
      ? 'Decide who may read plan funding figures, derive the figures from the enrolment and asset records with an as-of date, and read through an explicit tenant context.'
      : 'Decide which members or trustees may read the agenda and minutes of the pension trustees, and read through an explicit tenant context.',
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('tenantScope', c.list ? `.where(${c.cond})` : `.where(and(eq(${c.table}.id, id), ${c.cond}))`),
      a.h('mutation', `.from(${c.table})`),
      a.tbl('privacy', c.table, c.schemaPat),
      a.svc('defect', WITH_API, 'if (!getActiveTenantDb()) {'),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler never reads the role of the caller beyond the member floor and selects every column of the table, so the figures or the minutes written by the secretary_treasurer reach every member.' },
    ],
    def: [...c.def, 'DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT', 'DEF-0B10-PEN-PENSION-READS-USE-THE-SHARED-DB-HANDLE-WITHOUT-AN-EXPLICIT-TENANT-CONTEXT'],
    corr: [],
  })
}

/* ---------- pension/members ---------- */
function membersGet(a) {
  return mk({
    persona: 'Member reading their own pension enrolment, and the administration console reading a plan members',
    service: `${a.routeFile} (GET: withApi member floor, shared db select of pension_members scoped to the caller membership id)`,
    authn: `${SESSION} through withApi (auth required).`,
    authz: 'withApi minRole member. Every caller, including the secretary_treasurer, is held to the pension_members rows whose user_id equals the caller organization membership id; there is no administrator branch. authorizeAction is not called.',
    tenant: 'The organization is the session organization: the select carries eq(pensionMembers.organizationId, organizationId!) and a subquery that resolves the caller organization_members id for that organization; the read uses the shared db import with no explicit withRLSContext, and the query-string organizationId the consoles send is ignored.',
    owner: 'pension_members rows of the organization whose user_id is the organization membership id of the caller; the row holds the name and plan name typed by the administrator.',
    sens: 'Pension enrolment name, plan name, enrolment date, membership status, years of service and vesting status',
    priv: 'The caller receives only their own enrolment rows (optionally for one plan); no other member enrolment is returned by this route, in contrast with retirement-eligibility which returns all of them.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Audit reads of pension enrolments once the offices that may read other members enrolments are named.',
    does: 'Returns the pension_members rows of the organization whose user_id is the caller organization membership id, optionally for one plan id, newest first, with no limit; the description says it lists the members of a plan, which it does only for the caller own enrolment.',
    status: STATUS,
    gate: PEN_GATE,
    deps: [1, 13],
    future: 'Add an explicit administrator branch with its own authority and read audit, or correct the description and the console to the own-enrolment behaviour, and read through an explicit tenant context.',
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('tenantScope', 'const conditions = [eq(pensionMembers.organizationId, organizationId!)];'),
      a.h('privacy', 'sql`${pensionMembers.userId} = ('),
      a.h('mutation', '.from(pensionMembers)'),
      a.tbl('privacy', 'pensionMembers', /vestingStatus: varchar\('vesting_status'/),
      a.svc('defect', WITH_API, 'if (!getActiveTenantDb()) {'),
    ],
    inf: [
      { claim: 'defect', statement: 'The only person condition is the userId subquery and it is applied whenever a user id exists, which is every authenticated call, so the route has no branch for the secretary_treasurer; the administration console calls it with a plan id to list the plan members.' },
    ],
    def: [
      'DEF-0B10-PEN-MEMBERS-GET-IS-HELD-TO-THE-CALLER-OWN-ENROLMENT-AT-EVERY-ROLE',
      'DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT',
      'DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION',
      'DEF-0B10-PEN-PENSION-READS-USE-THE-SHARED-DB-HANDLE-WITHOUT-AN-EXPLICIT-TENANT-CONTEXT',
    ],
    corr: [],
  })
}

function eligibilityGet(a) {
  return mk({
    persona: 'Member of the organization asking which enrolled members meet a years-of-service threshold for retirement',
    service: `${a.routeFile} (GET: withApi member floor, shared db select of pension_members by organization and years of service)`,
    authn: `${SESSION} through withApi (auth required).`,
    authz: 'withApi minRole member only. There is no administrator branch, no own-record condition and no financial mandate; authorizeAction is not called.',
    tenant: 'The organization is the session organization: the select carries eq(pensionMembers.organizationId, organizationId!); the read uses the shared db import with no explicit withRLSContext. The threshold is read from the query string.',
    owner: 'pension_members rows of the organization: one row per enrolment with the name and plan name typed by the administrator.',
    sens: 'Name, plan name, enrolment date, membership status, years of service, vesting status, organization membership id and metadata of every enrolled member whose years of service meet the threshold',
    priv: 'Every member of the organization receives the pension standing of every enrolled colleague at or above the threshold (any threshold the caller chooses, including 0), whatever the colleague membership or vesting status.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Audit reads of retirement eligibility once the offices that may read it are named; it identifies members close to retirement.',
    does: 'Parses threshold from the query (default 25, parseInt, no range or NaN check), selects every pension_members row of the organization whose years_of_service is at or above that value, newest first, and returns the rows as the members meeting eligibility; no age, plan rule, vesting or membership status is considered.',
    status: 'PARTIAL',
    gate: PEN_GATE,
    deps: [1, 13],
    future: 'Restrict the read to the administrator authority or the member own row, compute eligibility from the plan rules, age, vesting and status with a stated as-of date, and validate the threshold.',
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('tenantScope', 'eq(pensionMembers.organizationId, organizationId!),'),
      a.h('privacy', ".get('threshold') ?? '25'"),
      a.h('privacy', 'gte(pensionMembers.yearsOfService, String(threshold)),'),
      a.h('mutation', '.from(pensionMembers)'),
      a.tbl('privacy', 'pensionMembers', /yearsOfService: numeric\('years_of_service'/),
      a.tbl('privacy', 'pensionMembers', /membershipStatus: varchar\('membership_status'/),
      a.svc('defect', WITH_API, 'if (!getActiveTenantDb()) {'),
    ],
    inf: [
      { claim: 'defect', statement: 'No statement in the handler compares the row with the caller, reads the role or the user id, or selects fewer than all columns, so a member who sends threshold=0 receives every enrolment; the eligibility is only years_of_service >= threshold.' },
    ],
    def: [
      'DEF-0B10-PEN-RETIREMENT-ELIGIBILITY-LISTS-EVERY-PENSION-ENROLMENT-OF-THE-ORGANIZATION-TO-ANY-MEMBER',
      'DEF-0B10-PEN-RETIREMENT-ELIGIBILITY-IS-A-YEARS-OF-SERVICE-COMPARISON-WITH-A-FIXED-DEFAULT-OF-25',
      'DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT',
      'DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION',
      'DEF-0B10-PEN-PENSION-READS-USE-THE-SHARED-DB-HANDLE-WITHOUT-AN-EXPLICIT-TENANT-CONTEXT',
    ],
    corr: [],
  })
}

/* ---------- administration writes ---------- */
function adminWrite(a, o) {
  return mk({
    persona: o.persona,
    service: `${a.routeFile} (${a.method}: withApi roles PENSION_ADMIN_ROLES, zod body, withRLSContext transaction with persistAtomicAudit)`,
    authn: `${SESSION} through withApi (auth required; 400 when the organization or user context is missing).`,
    authz: 'withApi roles PENSION_ADMIN_ROLES, which is the single role secretary_treasurer (FINANCIAL_MEMBER_DATA_ROLES): the role title is matched exactly. No live financial mandate is required, no second approver exists and authorizeAction is not called; a role title is not a kernel decision.',
    tenant: o.tenant,
    owner: o.owner,
    sens: o.sens,
    priv: o.priv,
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: ATOMIC,
    reqAudit: KEEP_AUDIT,
    does: o.does,
    status: o.status ?? STATUS,
    gate: PEN_GATE,
    deps: [1, 13],
    future: o.future,
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      ...adminRoleEv(a),
      orgGuardEv(a),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      ...o.ev,
      ...auditEv(a, o.action),
    ],
    inf: o.inf ?? [],
    def: [...o.def, 'DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT', 'DEF-0B10-PEN-PENSION-ADMINISTRATION-WRITES-REST-ON-ONE-ROLE-TITLE-WITH-NO-MANDATE-OR-TRUSTEE-DECISION'],
    corr: o.corr ?? [],
  })
}

const REFS_DEF = 'DEF-0B10-PEN-PENSION-WRITES-STORE-TYPED-MEMBER-REFERENCES-NAMES-AND-AMOUNTS-UNVERIFIED'

function contributionsPost(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer recording a pension contribution for a member',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }); the member id in the body is not checked against the organization.',
    owner: 'pension_contributions row of the organization for the member id and name typed by the administrator.',
    sens: 'Member id and name, contribution period, amount, payment status and payment date',
    priv: 'The response returns the stored row; the audit row names the member id, period and amount. A row filed under a member id becomes that member own record whenever it matches their membership or enrolment id.',
    does: 'Parses memberId (uuid), memberName, period, amount (a string), optional paymentStatus (pending, received, overdue or partial) and optional paymentDate with zod, inserts the pension_contributions row for the session organization, commits the pension.contribution.record audit row and returns the row.',
    future: 'Verify the member and plan against the organization records, validate and sign the amount, derive the name, prevent a duplicate period, and require the mandate that records money.',
    action: 'pension.contribution.record',
    ev: [
      a.h('mutation', '.insert(pensionContributions)'),
      a.h('mutation', '.values({ ...parsed, organizationId })'),
      a.local('defect', 'createContributionSchema', 'amount: z.string(),'),
      a.local('defect', 'createContributionSchema', 'memberId: z.guid(),'),
      a.tbl('defect', 'pensionContributions', /memberName: varchar\('member_name'/),
    ],
    inf: [{ claim: 'defect', statement: 'The schema types memberId as a uuid and amount as any string; no statement looks the member up, so the row can name a member and a name that do not agree or exist, and a non-numeric or negative amount is accepted until the numeric column rejects it.' }],
    def: [REFS_DEF],
  })
}

function t4aPost(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer issuing a T4A tax record for a member',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }); the member id in the body is not checked against the organization.',
    owner: 'pension_t4a_records row of the organization for the member id and name typed by the administrator; the member reads it as their own T4A record.',
    sens: 'Member id and name, tax year, pension income and the status of a tax record',
    priv: 'The stored row, including the typed pension income, is returned and later read by the member as their T4A record; the audit row names the member id and tax year but not the amount. No social insurance number is stored.',
    does: 'Parses memberId, memberName, taxYear (1900 to 2100), pensionIncome (a string), optional status (draft or generated) and optional generatedDate with zod, inserts the pension_t4a_records row for the session organization exactly as typed, commits the pension.t4a.generate audit row and returns the row; nothing is computed, rendered or sent to the tax authority.',
    future: 'Derive the slip from the paid benefits of the member and year, check uniqueness per member and year, produce the slip document and reference, keep filing a separate authorized act, and require the mandate that issues tax records.',
    action: 'pension.t4a.generate',
    ev: [
      a.h('mutation', '.insert(pensionT4aRecords)'),
      a.h('mutation', '.values({ ...parsed, organizationId })'),
      a.local('defect', 'createT4aSchema', 'pensionIncome: z.string(),'),
      a.local('defect', 'createT4aSchema', "status: z.enum(['draft', 'generated']).optional(),"),
      a.local('defect', 'createT4aSchema', 'generatedDate: z.coerce.date().optional(),'),
      a.tbl('defect', 'pensionT4aRecords', /status: varchar\('status'/),
    ],
    inf: [{ claim: 'defect', statement: 'The handler has no statement that reads a contribution, claim or payment row or counts rows for the member and tax year; the route summary says Generate T4A record while the body of the handler is one insert of the parsed fields.' }],
    def: ['DEF-0B10-PEN-T4A-POST-STORES-AN-ADMINISTRATOR-TYPED-INCOME-AS-A-GENERATED-TAX-RECORD', REFS_DEF],
    corr: [{ field: 'mutating', manifest: 'mutating true, audit ATOMIC', actual: 'The insert and its audit row are atomic, but the record is the typed fields as sent, with no generation step behind the generated status.' }],
  })
}

function membersPost(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer enrolling a member in a pension plan',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }); planId and userId in the body are not checked to belong to the organization.',
    owner: 'pension_members row of the organization with the name, plan name, years of service, vesting and membership status typed by the administrator; userId links it to an organization membership id.',
    sens: 'Enrolled member name, plan name, enrolment date, membership status, years of service, vesting status and the membership link',
    priv: 'The response returns the stored enrolment; the audit row names the plan id. The enrolment later appears in the retirement-eligibility list to every member and as the member own record when userId matches their membership.',
    does: 'Parses planId, optional userId, name, planName, optional enrolmentDate, membershipStatus, yearsOfService (a string) and vestingStatus with zod, inserts the pension_members row for the session organization, commits the pension.member.enroll audit row and returns the row.',
    future: 'Verify the plan and the membership against the organization, derive the name and plan name, compute years of service from service records, and prevent a duplicate enrolment.',
    action: 'pension.member.enroll',
    ev: [
      a.h('mutation', '.insert(pensionMembers)'),
      a.h('mutation', '.values({ ...parsed, organizationId })'),
      a.local('defect', 'createMemberSchema', 'planId: z.guid(),'),
      a.local('defect', 'createMemberSchema', 'userId: z.guid().optional(),'),
      a.local('defect', 'createMemberSchema', 'yearsOfService: z.string().optional(),'),
      a.tbl('defect', 'pensionMembers', /planId: uuid\('plan_id'\)\.notNull\(\)/),
    ],
    inf: [{ claim: 'defect', statement: 'The pension_members table declares plan_id and user_id as plain uuid columns with no foreign key and the handler reads no plan or membership row, so any uuid is stored; yearsOfService is a typed string that retirement-eligibility later compares.' }],
    def: [REFS_DEF],
  })
}

function plansPost(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer creating a pension plan record for the organization',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }).',
    owner: 'pension_plans row of the organization; the figures are typed by the administrator.',
    sens: 'Plan name, type, status, active member count, total assets, funding status and description',
    priv: 'The response returns the stored plan; the audit row names the plan name and type. Every member can read the plan afterwards.',
    does: 'Parses planName, optional planType, status, activeMembers, totalAssets (a string), fundingStatus (a string) and description with zod, inserts the pension_plans row for the session organization, commits the pension.plan.create audit row and returns the row.',
    future: 'Derive the member count, assets and funding from enrolment and asset records with an as-of date, validate the numeric strings, and name the authority that approves a plan.',
    action: 'pension.plan.create',
    ev: [
      a.h('mutation', '.insert(pensionPlans)'),
      a.h('mutation', '.values({ ...parsed, organizationId })'),
      a.local('defect', 'createPlanSchema', 'totalAssets: z.string().optional(),'),
      a.local('defect', 'createPlanSchema', 'fundingStatus: z.string().optional(),'),
      a.local('defect', 'createPlanSchema', 'activeMembers: z.number().int().min(0).optional(),'),
      a.tbl('defect', 'pensionPlans', /fundingStatus: numeric\('funding_status'/),
    ],
    inf: [{ claim: 'defect', statement: 'The handler reads no pension_members, contribution or asset row, so activeMembers, totalAssets and fundingStatus are exactly the values in the body; the numeric columns reject a non-numeric string at the database.' }],
    def: ['DEF-0B10-PEN-PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER'],
  })
}

function planPatch(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer changing a pension plan record',
    tenant: 'The update is scoped by the path id and eq(pensionPlans.organizationId, organizationId) inside withRLSContext({ organizationId }); a plan of another organization yields 404.',
    owner: 'The pension_plans row of the organization named by the path id.',
    sens: 'Plan name, type, status, active member count, total assets, funding status and description',
    priv: 'The response returns the updated plan; the audit row lists the changed field names and the status.',
    does: 'Parses the optional plan fields with zod (unknown keys are dropped), updates the pension_plans row with the path id in the session organization and sets updatedAt, commits the pension.plan.update audit row with the field names, and returns the row or 404.',
    future: 'Keep the strict body, add a state rule for frozen and terminated plans, derive the figures, and record the value before and after the change.',
    action: 'pension.plan.update',
    ev: [
      a.h('mutation', '.update(pensionPlans)'),
      a.h('tenantScope', '.where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)))'),
      a.local('defect', 'updatePlanSchema', "status: z.enum(['active', 'frozen', 'terminated', 'pending_approval']).optional(),"),
      a.local('defect', 'updatePlanSchema', 'totalAssets: z.string().optional(),'),
      a.h('audit', 'details: { fields: Object.keys(changes), status: changes.status },'),
    ],
    inf: [{ claim: 'defect', statement: 'The update sets whatever optional fields are present, including status and the figures, with no transition table and no read of the previous row, so a plan can move from terminated to active and its funding figures be replaced by typed values.' }],
    def: ['DEF-0B10-PEN-PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER'],
  })
}

function planDelete(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer deleting a pension plan record',
    tenant: 'The delete is scoped by the path id and eq(pensionPlans.organizationId, organizationId) inside withRLSContext({ organizationId }); a plan of another organization yields 404.',
    owner: 'The pension_plans row of the organization named by the path id; enrolments reference it by an unconstrained plan id.',
    sens: 'The deleted plan row (name, type, status, member count, assets, funding status, description); the audit row keeps only the plan name',
    priv: 'The response returns the deleted plan row; the audit row names the plan name only.',
    does: 'Deletes the pension_plans row with the path id in the session organization, returns 404 when none, commits the pension.plan.delete audit row with the plan name and returns the deleted row.',
    future: 'Refuse deletion while enrolments, contributions or claims reference the plan, retain a plan by terminating it, and keep a snapshot of the deleted row in the audit record.',
    action: 'pension.plan.delete',
    ev: [
      a.h('mutation', '.delete(pensionPlans)'),
      a.h('tenantScope', '.where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)))'),
      a.h('audit', 'details: { planName: plan.planName },'),
      a.tbl('defect', 'pensionPlans', /id: uuid\('id'\)\.defaultRandom\(\)\.primaryKey\(\),/),
    ],
    inf: [{ claim: 'defect', statement: 'The handler runs one delete statement and reads no pension_members row; pension_members.plan_id is declared without a foreign key, so the delete is not refused by the database either.' }],
    def: ['DEF-0B10-PEN-PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT'],
  })
}

function meetingPost(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer scheduling a pension trustee meeting',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }).',
    owner: 'pension_trustee_meetings row of the organization; the agenda, minutes and attendees are typed by the administrator, not by the trustees.',
    sens: 'Meeting title, date, location, agenda, minutes, status and attendees',
    priv: 'The response returns the stored meeting; every member can read it afterwards through the member-floor reads.',
    does: 'Parses title, scheduledDate, optional location, agenda, minutes, status (scheduled, completed or cancelled) and an attendees array of unknown values with zod, inserts the row for the session organization, commits the pension.trustee_meeting.schedule audit row and returns the row.',
    future: 'Bind meetings to the trustee body once trustee authority exists, type the attendees, and decide who may read the agenda and minutes.',
    action: 'pension.trustee_meeting.schedule',
    ev: [
      a.h('mutation', '.insert(pensionTrusteeMeetings)'),
      a.h('mutation', '.values({ ...parsed, organizationId })'),
      a.local('defect', 'createMeetingSchema', 'attendees: z.array(z.unknown()).optional(),'),
      a.local('defect', 'createMeetingSchema', 'minutes: z.string().optional(),'),
    ],
    inf: [{ claim: 'defect', statement: 'The schema accepts any array for attendees and an unbounded string for minutes and agenda; no statement ties the meeting to a trustee record, and the member-floor reads return the row to every member.' }],
    def: ['DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER'],
  })
}

function meetingPatch(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer changing a pension trustee meeting, including its minutes',
    tenant: 'The update is scoped by the path id and eq(pensionTrusteeMeetings.organizationId, organizationId) inside withRLSContext({ organizationId }); a meeting of another organization yields 404.',
    owner: 'The pension_trustee_meetings row of the organization named by the path id.',
    sens: 'Meeting title, date, location, agenda, minutes, status and attendees',
    priv: 'The response returns the updated meeting; the audit row lists the changed field names and the status, not the previous minutes.',
    does: 'Parses the optional meeting fields with zod, updates the row with the path id in the session organization (including minutes and status of a completed meeting) and sets updatedAt, commits the pension.trustee_meeting.update audit row with the field names, and returns the row or 404.',
    future: 'Freeze approved minutes, keep a version of each change, and require the trustee body to approve the minutes.',
    action: 'pension.trustee_meeting.update',
    ev: [
      a.h('mutation', '.update(pensionTrusteeMeetings)'),
      a.h('tenantScope', '.where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId)))'),
      a.local('defect', 'updateMeetingSchema', 'minutes: z.string().optional(),'),
      a.local('defect', 'updateMeetingSchema', "status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),"),
      a.h('audit', 'details: { fields: Object.keys(changes), status: changes.status },'),
    ],
    inf: [{ claim: 'defect', statement: 'The update reads no previous row and applies no condition on status, so minutes of a completed meeting are replaced in place; the audit details are the field names and the status.' }],
    def: ['DEF-0B10-PEN-TRUSTEE-MEETING-MINUTES-CAN-BE-REWRITTEN-OR-DELETED-WITHOUT-HISTORY'],
  })
}

function meetingDelete(a) {
  return adminWrite(a, {
    persona: 'Secretary-treasurer deleting a pension trustee meeting',
    tenant: 'The delete is scoped by the path id and eq(pensionTrusteeMeetings.organizationId, organizationId) inside withRLSContext({ organizationId }); a meeting of another organization yields 404.',
    owner: 'The pension_trustee_meetings row of the organization named by the path id.',
    sens: 'The deleted meeting row (title, date, agenda, minutes, attendees); the audit row keeps only the title',
    priv: 'The response returns the deleted meeting row including its minutes; the audit row names only the title.',
    does: 'Deletes the row with the path id in the session organization, returns 404 when none, commits the pension.trustee_meeting.delete audit row with the title and returns the deleted row.',
    future: 'Retain trustee minutes (cancel rather than delete), keep a snapshot of the deleted row in the audit record, and require trustee approval for the removal of minutes.',
    action: 'pension.trustee_meeting.delete',
    ev: [
      a.h('mutation', '.delete(pensionTrusteeMeetings)'),
      a.h('tenantScope', '.where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId)))'),
      a.h('audit', 'details: { title: meeting.title },'),
    ],
    inf: [{ claim: 'defect', statement: 'The handler runs one delete and keeps only the meeting title in the audit details, so the deleted minutes and attendees are not recoverable from the audit record.' }],
    def: ['DEF-0B10-PEN-TRUSTEE-MEETING-MINUTES-CAN-BE-REWRITTEN-OR-DELETED-WITHOUT-HISTORY'],
  })
}

function benefitsPost(a) {
  return mk({
    persona: 'Member filing a pension benefit claim for themselves',
    service: `${a.routeFile} (POST: withApi member floor, zod body, ownPensionIdentities check, withRLSContext transaction with persistAtomicAudit)`,
    authn: `${SESSION} through withApi (auth required; 400 when the organization or user context is missing).`,
    authz: 'withApi minRole member plus a self test: the memberId in the body must be among the caller own identities (their organization membership id or the id of one of their pension enrolments), otherwise 403. There is no eligibility, plan or enrolment requirement and no role beyond member; authorizeAction is not called.',
    tenant: 'The insert carries organizationId from the session inside withRLSContext({ organizationId }); the own-identity lookup reads organization_members and pension_members of that organization only.',
    owner: 'pension_benefit_claims row of the organization filed under the caller own member identity; the member name, claim type, amount and notes are typed by the caller.',
    sens: 'Member name, claim type, amount and notes of a pension benefit claim',
    priv: 'The response returns the stored claim to the member who filed it; the audit row names the claim type but not the amount. Only the member and the secretary_treasurer read the claim afterwards.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: ATOMIC,
    reqAudit: KEEP_AUDIT,
    does: 'Parses memberId, memberName, claimType, amount (a string) and optional notes with zod, refuses with 403 unless memberId is one of the caller own identities, inserts the claim with status pending and the submission date set by the server, commits the pension.benefit_claim.submit audit row and returns the claim; no plan, eligibility check, notification or decision step follows.',
    status: STATUS,
    gate: PEN_GATE,
    deps: [1, 13],
    future: 'Tie the claim to a plan and enrolment, validate the amount and claim type, derive the name, notify the deciding authority once it exists, and give the member a way to withdraw or follow the claim.',
    dec: [D_PENSION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('authorization', 'if (!own.includes(parsed.memberId)) {'),
      a.imp('authorization', 'ownPensionIdentities', 'eq(organizationMembers.userId, userId)'),
      orgGuardEv(a),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('mutation', '.insert(pensionBenefitClaims)'),
      a.h('mutation', ".values({ ...parsed, organizationId, status: 'pending', submittedDate: new Date() })"),
      ...auditEv(a, 'pension.benefit_claim.submit'),
      a.local('defect', 'createBenefitClaimSchema', 'amount: z.string(),'),
      a.local('defect', 'createBenefitClaimSchema', 'memberName: z.string().max(255),'),
      a.tbl('defect', 'pensionBenefitClaims', /status: varchar\('status'/),
    ],
    inf: [
      { claim: 'defect', statement: 'The only writer of pension_benefit_claims in the application is this insert; the status is fixed to pending and no route, service or job sets under_review, approved, denied or paid.' },
    ],
    def: [
      'DEF-0B10-PEN-BENEFIT-CLAIMS-CAN-BE-FILED-BUT-NO-ROUTE-CAN-DECIDE-OR-PAY-THEM',
      REFS_DEF,
      'DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT',
    ],
    corr: [],
  })
}

/* ---------- portal documents (cms_pages CRUD) ---------- */
const portalProfile = {
  persona: 'Member listing, and steward depositing, documents of the organization through a route named for the member portal',
  owner: 'cms_pages rows of the organization; createdBy records the author user id the factory sets from the session. The table holds page content JSON, a status, a file URL, a size, access columns (requires_auth, allowed_roles) and view and download counters.',
  sens: 'Page title, slug, content JSON, status, file URL, file size, access-role list, author user id, view and download counts and publication dates',
  priv: (method) => (method === 'GET'
    ? 'Any member of the organization reads every cms_pages row of the organization, 100 at a time, in every status and with the author user id, the file URL and the content JSON; the row access columns are not applied.'
    : 'Any body field is stored on a cms_pages row for the organization, including status, publication dates, the file URL, size, access columns and counters; the response returns the stored row.'),
  does: (method, _model, floor, upload) => (method === 'GET'
    ? `Returns cms_pages rows of the session organization, newest first, at most 100 per page, at a role floor of ${floor}; the path says portal documents${upload ? ' and upload' : ''} but the rows are pages of every status, and no portal principal or recipient is considered.`
    : `Inserts a cms_pages row for the session organization from the request body at a role floor of ${floor}; ${upload ? 'the path says upload but ' : ''}no file is read, validated, scanned or stored, and the file_url, content_type and file_size_mb columns are whatever the body states.`),
  future: 'Decide the member document intake and publication authority, receive files through the scanned intake route with an organization-owned storage key, apply the access columns on read, and retire the facade paths until then.',
  gate: CONTENT_GATE,
  deps: [6, 13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [D_PORTAL_INTAKE, D_KNOWLEDGE],
  def: (method) => (method === 'GET'
    ? [
      'DEF-0B10-PEN-PORTAL-DOCUMENT-PATHS-ARE-CMS-PAGE-CRUD-WITH-NO-PORTAL-PRINCIPAL',
      'DEF-0B10-PEN-PORTAL-DOCUMENT-LIST-RETURNS-EVERY-PAGE-ROW-AND-IGNORES-ROLE-AND-AUTH-COLUMNS',
      'DEF-0B6-EDU-CONTENT-DRAFTS-AND-ARCHIVED-READABLE-BY-MEMBER',
    ]
    : ['DEF-0B10-PEN-PORTAL-DOCUMENT-PATHS-ARE-CMS-PAGE-CRUD-WITH-NO-PORTAL-PRINCIPAL']),
  extraEv: (b, model) => [
    b.tbl('privacy', model.tableName, /fileUrl: text\('file_url'\)/),
    b.tbl('privacy', model.tableName, /allowedRoles: text\('allowed_roles'\)/),
    ...(b.method === 'GET'
      ? [b.tbl('privacy', model.tableName, /createdBy: text\('created_by'\)/)]
      : [
        b.tbl('defect', model.tableName, /status: text\('status'\)\.notNull\(\)\.default\('draft'\)/),
        b.tbl('defect', model.tableName, /viewCount: integer\('view_count'\)/),
      ]),
  ],
  inferences: (method) => (method === 'GET'
    ? [{ claim: 'defect', statement: 'The factory conditions are the organization and the low-role scope; cms_pages has no owner column, so no condition on status, requires_auth or allowed_roles exists and every row of the organization is listed to a member.' }]
    : [{ claim: 'defect', statement: 'The route configures no beforeCreate hook and no blocked fields; the factory copies the body into the insert, so file_url, content_type, file_size_mb, status, requires_auth, allowed_roles and the counters are stored as sent; no handler in the route file or the factory reads a multipart body or calls the blob or malware-scan helpers.' }]),
  reqRead: 'Audit reads of the document library once the readers of drafts and restricted documents are named.',
}

function portalFacts(a, readText) {
  const upload = a.route === 'portal/documents/upload/route.ts'
  const profile = {
    ...portalProfile,
    does: (method, model, floor) => portalProfile.does(method, model, floor, upload),
    def: (method) => [
      ...portalProfile.def(method),
      ...(method === 'POST'
        ? [
          'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT',
          'DEF-0B10-PEN-PORTAL-POST-LETS-A-STEWARD-SET-STATUS-PUBLISHED-AND-ACCESS-COLUMNS-AROUND-THE-EDITORIAL-WORKFLOW',
          'DEF-0B10-PEN-PORTAL-UPLOAD-ROUTE-RECEIVES-NO-FILE-AND-STORES-A-CALLER-WRITTEN-FILE-URL',
        ]
        : []),
    ],
  }
  const record = crudRecord(a, readText, profile)
  record.dependencyGates = record.dependencyGates ?? []
  if (upload) record.implementedBehavior = `${record.implementedBehavior} The file is byte-identical to the collection route file.`
  return record
}

export const RISK_SCREENS = {}

export function facts(a, readText) {
  const { route, method } = a
  let record
  switch (route) {
    case 'pension/benefits/route.ts': record = method === 'GET' ? ownRead(a) : benefitsPost(a); break
    case 'pension/contributions/route.ts': record = method === 'GET' ? ownRead(a) : contributionsPost(a); break
    case 'pension/t4a/route.ts': record = method === 'GET' ? ownRead(a) : t4aPost(a); break
    case 'pension/members/route.ts': record = method === 'GET' ? membersGet(a) : membersPost(a); break
    case 'pension/plans/route.ts': record = method === 'GET' ? floorRead(a) : plansPost(a); break
    case 'pension/plans/[id]/route.ts': record = method === 'GET' ? floorRead(a) : method === 'PATCH' ? planPatch(a) : planDelete(a); break
    case 'pension/retirement-eligibility/route.ts': record = eligibilityGet(a); break
    case 'pension/trustee-meetings/route.ts': record = method === 'GET' ? floorRead(a) : meetingPost(a); break
    case 'pension/trustee-meetings/[id]/route.ts': record = method === 'GET' ? floorRead(a) : method === 'PATCH' ? meetingPatch(a) : meetingDelete(a); break
    case 'portal/documents/route.ts':
    case 'portal/documents/upload/route.ts': record = portalFacts(a, readText); break
    default: throw new Error(`no pension-portal facts for ${route}`)
  }
  record = applyCrossTenantExposure(record, DEFECTS)
  record.riskScreen = RISK_SCREENS[`${route}|${method}`] ?? {}
  return record
}

