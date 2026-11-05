/**
 * Gate 0B.12 facts: the generic CRUD factory routes of the final tranche. Forty-five operations over nine route
 * families, every one a `crudRoutes` configuration over one table: the support ticket, assignment and comment paths and
 * the SLA POST (in_app_notifications), the upload path (cms_media_library), the four tax paths (per_capita_remittances),
 * the testimonial item route (testimonials), the bargaining unit and worksite routes (bargaining_units, worksites) and the
 * WCB claim and assessment routes (wcb_claims, wcb_employer_assessments). The table, the governance class, the role
 * floors and the factory behaviour are read from source by `crudRecord`; this module supplies the business meaning of the
 * table and the defects it carries. This tranche records the source; it repairs nothing and approves no route.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { APP, API, CRUD_FACTORY } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const NOTIFY_CAP = 'UE-OMIT-MOBILE-DEVICES-AND-IN-APP-NOTIFICATIONS'
const MEDIA_CAP = 'UE-OMIT-CONTENT-LIBRARY-EDITORIAL'
const FINANCE_CAP = 'UE-OMIT-FINANCE-UNAVAILABLE'
const UNIT_CAP = 'UE-OMIT-BARGAINING-UNIT-AND-WORKSITE-REGISTER'
const WCB_CAP = 'UE-OMIT-WCB-CLAIMS-AND-EMPLOYER-ASSESSMENTS'
const MARKETING_CAP = 'UE-OMIT-PLATFORM-MARKETING-TESTIMONIALS'

const GATE = {
  [NOTIFY_CAP]: 11,
  [MEDIA_CAP]: 14,
  [FINANCE_CAP]: 5,
  [UNIT_CAP]: 14,
  [WCB_CAP]: 6,
  [MARKETING_CAP]: 14,
}

const D_SUPPORT = 'UE-INST-SUPPORT-AND-STORAGE-FIGURES-OWNER'
const D_NOTIFY = 'UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES'
const D_TAX = 'UE-INST-TAX-SLIP-AND-RECEIPT-ISSUER-AND-SOURCE-RECORDS'
const D_UNITS = 'UE-INST-BARGAINING-UNIT-AND-WORKSITE-RECORD-AUTHORITY'
const D_WCB = 'UE-INST-WCB-CLAIM-AND-ASSESSMENT-READERS-AND-WRITERS'
const D_MARKETING = 'UE-INST-PLATFORM-MARKETING-CONTENT-OWNER-AND-APPROVAL'

const SUPPORT_SCHEMA = `${APP}db/schema/domains/infrastructure/support.ts`
const SUPPORT_SERVICE = `${APP}lib/services/support-service.ts`
const NOTIFICATION_SCHEMA = `${APP}db/schema/notifications-schema.ts`
const MEDIA_SCHEMA = `${APP}db/schema/cms-website-schema.ts`
const REMITTANCE_SCHEMA = `${APP}db/schema/clc-per-capita-schema.ts`
const MARKETING_SCHEMA = `${APP}db/schema/domains/marketing.ts`
const STRUCTURE_SCHEMA = `${APP}db/schema/union-structure-schema.ts`
const WCB_SCHEMA = `${APP}db/schema/domains/health-safety/provincial-wcb-schema.ts`
const REFERENCE_LATENT = `${APP}db/rls-storage-authority/reference-latent.ts`
const APPROVAL_ACTIONS = `${APP}components/admin/testimonial-approval-actions.tsx`
const TAX_DASHBOARD = `${APP}components/tax/T4AGenerationDashboard.tsx`
const JOB_APPLICATION = `${APP}components/public/job-application-page.tsx`
const CRUD_GOVERNANCE_FILE = `${APP}lib/api/crud-governance.ts`

export const ROUTES = new Set([
  'support/tickets/route.ts',
  'support/tickets/[id]/route.ts',
  'support/tickets/[id]/assign/route.ts',
  'support/tickets/[id]/comments/route.ts',
  'support/sla/route.ts',
  'upload/route.ts',
  'tax/cope/receipts/route.ts',
  'tax/rl-1/generate/route.ts',
  'tax/slips/route.ts',
  'tax/t106/route.ts',
  'testimonials/[id]/route.ts',
  'units/route.ts',
  'units/[id]/route.ts',
  'worksites/route.ts',
  'worksites/[id]/route.ts',
  'wcb/claims/route.ts',
  'wcb/claims/[id]/route.ts',
  'wcb/assessments/route.ts',
  'wcb/assessments/[id]/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  CRUD_SUPPORT_TICKET_PATHS: {
    capabilityId: NOTIFY_CAP,
    domain: 'SUPPORT_TICKET_PATHS_OVER_IN_APP_NOTIFICATIONS',
    actor: 'Member opening or following a support ticket, and support or union staff assigning, answering and closing tickets, served the in-app notification rows of the organization',
    routes: ['support/tickets/route.ts', 'support/tickets/[id]/route.ts', 'support/tickets/[id]/assign/route.ts', 'support/tickets/[id]/comments/route.ts'],
    evidence: [
      ev(SUPPORT_SCHEMA, "assignedToUserId: text('assigned_to_user_id'),"),
      ev(SUPPORT_SERVICE, 'export async function assignTicket('),
      ev(SUPPORT_SERVICE, 'export async function addComment('),
      ev(NOTIFICATION_SCHEMA, "message: text('message').notNull(),"),
    ],
  },
  CRUD_SUPPORT_SLA_POST: {
    capabilityId: NOTIFY_CAP,
    domain: 'SUPPORT_METRICS_AND_SLA_OVER_IN_APP_NOTIFICATIONS',
    actor: 'Support or union staff expecting to record a service-level figure, served the in-app notification rows of the organization',
    routes: ['support/sla/route.ts'],
    methods: ['POST'],
    evidence: [
      ev(NOTIFICATION_SCHEMA, "actionUrl: text('action_url'),"),
      ev(NOTIFICATION_SCHEMA, "message: text('message').notNull(),"),
      ev(SUPPORT_SERVICE, 'export async function getSLAMetrics('),
    ],
  },
  CRUD_UPLOAD_MEDIA_LIBRARY: {
    capabilityId: MEDIA_CAP,
    domain: 'UPLOAD_PATH_OVER_MEDIA_LIBRARY_ROWS',
    actor: 'Person uploading a file (a job applicant sending a resume, a steward adding a library image) who expects the file to be stored and a file address returned, served the media library rows of the organization',
    routes: ['upload/route.ts'],
    evidence: [
      ev(MEDIA_SCHEMA, "fileUrl: text('file_url').notNull(),"),
      ev(MEDIA_SCHEMA, "fileSize: integer('file_size').notNull(),"),
      ev(JOB_APPLICATION, "formData.append('folder', 'resumes');"),
    ],
  },
  CRUD_TAX_PATHS: {
    capabilityId: FINANCE_CAP,
    domain: 'TAX_SLIP_AND_RECEIPT_PATHS_OVER_PER_CAPITA_REMITTANCES',
    actor: 'Treasurer or officer expecting to generate tax slips, an RL-1 slip, a T106 information return or a political contribution receipt, served the per-capita remittance ledger of the organization',
    routes: ['tax/slips/route.ts', 'tax/t106/route.ts', 'tax/rl-1/generate/route.ts', 'tax/cope/receipts/route.ts'],
    evidence: [
      ev(REMITTANCE_SCHEMA, "totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),"),
      ev(REMITTANCE_SCHEMA, "receiptFileUrl: text('receipt_file_url'),"),
      ev(TAX_DASHBOARD, 'window.open(`/api/tax/cope/receipts?memberId=${memberId}&taxYear=${taxYear}`, \'_blank\');'),
    ],
  },
  CRUD_TESTIMONIAL_ITEM: {
    capabilityId: MARKETING_CAP,
    domain: 'PLATFORM_TESTIMONIAL_ITEM_RECORDS',
    actor: 'Platform marketing staff approving or removing a testimonial shown on the public proof page, and any signed-in member reading one',
    routes: ['testimonials/[id]/route.ts'],
    evidence: [
      ev(MARKETING_SCHEMA, "visibility: text('visibility').notNull().default('public'),"),
      ev(MARKETING_SCHEMA, "approvedAt: timestamp('approved_at'),"),
      ev(APPROVAL_ACTIONS, "const response = await fetch(`/api/testimonials/${testimonial.id}`, {"),
    ],
  },
  CRUD_BARGAINING_UNITS: {
    capabilityId: UNIT_CAP,
    domain: 'BARGAINING_UNIT_REGISTER_ROWS',
    actor: 'Steward or officer maintaining the register of bargaining units of the organization, and member reading it',
    routes: ['units/route.ts', 'units/[id]/route.ts'],
    evidence: [
      ev(STRUCTURE_SCHEMA, "certificationNumber: varchar('certification_number', { length: 100 }),"),
      ev(STRUCTURE_SCHEMA, "chiefStewardId: text('chief_steward_id').references(() => profiles.userId),"),
      ev(STRUCTURE_SCHEMA, "customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),"),
    ],
  },
  CRUD_WORKSITES: {
    capabilityId: UNIT_CAP,
    domain: 'WORKSITE_REGISTER_ROWS',
    actor: 'Steward or officer maintaining the register of worksites of the organization, and member reading it',
    routes: ['worksites/route.ts', 'worksites/[id]/route.ts'],
    evidence: [
      ev(STRUCTURE_SCHEMA, "siteManagerName: varchar('site_manager_name', { length: 255 }),"),
      ev(STRUCTURE_SCHEMA, "siteManagerEmail: varchar('site_manager_email', { length: 255 }),"),
      ev(STRUCTURE_SCHEMA, "customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),"),
    ],
  },
  CRUD_WCB_CLAIMS: {
    capabilityId: WCB_CAP,
    domain: 'WCB_CLAIM_ROWS',
    actor: 'Steward recording and following the workers compensation claim of an injured worker, and officer reading the claims of the organization',
    routes: ['wcb/claims/route.ts', 'wcb/claims/[id]/route.ts'],
    evidence: [
      ev(WCB_SCHEMA, "initialPrognosis: text('initial_prognosis'),"),
      ev(WCB_SCHEMA, "treatingPhysician: varchar('treating_physician', { length: 255 }),"),
      ev(WCB_SCHEMA, "totalBenefitsPaid: numeric('total_benefits_paid', { precision: 12, scale: 2 }),"),
    ],
  },
  CRUD_WCB_ASSESSMENTS: {
    capabilityId: WCB_CAP,
    domain: 'WCB_EMPLOYER_ASSESSMENT_ROWS',
    actor: 'Officer recording, and steward reading, the workers compensation premium assessments of the organization',
    routes: ['wcb/assessments/route.ts', 'wcb/assessments/[id]/route.ts'],
    evidence: [
      ev(WCB_SCHEMA, "premiumDue: numeric('premium_due', { precision: 12, scale: 2 }),"),
      ev(WCB_SCHEMA, "assessablePayroll: numeric('assessable_payroll', { precision: 14, scale: 2 }),"),
      ev(WCB_SCHEMA, "surchargeOrRefund: numeric('surcharge_or_refund', { precision: 12, scale: 2 }),"),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_TAX,
    status: 'OUTSTANDING',
    question: 'Which office issues the tax documents an organization or a member relies on (the T4A and CRA export, the RL-1 slip, the T106 information return of related-party transactions, the receipt for a political contribution), from which stored records is each document computed, which readers may see the remittance ledger a document is drawn from, and may a member who is not an officer read the amounts the organization remits to its parent body?',
    sourceState: 'The four tax paths read per_capita_remittances rows at the member floor and refuse every write because the table is READ_ONLY in the CRUD governance list; no route under these paths computes a slip, a return or a receipt, and the dashboard that links to the COPE receipt path expects a receipt for one member and year. The member floor, the ledger columns a member may read and the issuing office are named by no source.',
    softwareOwners: [FINANCE_CAP],
  },
  {
    id: D_UNITS,
    status: 'OUTSTANDING',
    question: 'Which office holds the register of bargaining units and worksites (certification number, body and dates, chief steward, bargaining chair, composition, site manager contact), which of those fields may a member who is not a steward or officer read, who may create, change and archive a register row, and must every employer, worksite and steward identifier a row names be verified as belonging to the same organization?',
    sourceState: 'The unit and worksite routes serve bargaining_units and worksites at the member read floor and the steward write floor with every column and no field projection; the identifiers they accept in a body (employer, worksite, chief steward, bargaining chair) are foreign keys with no check that the target belongs to the caller organization. No source names the register owner, the readable fields or the writers.',
    softwareOwners: [UNIT_CAP],
  },
  {
    id: D_WCB,
    status: 'OUTSTANDING',
    question: 'Which offices may read and change the workers compensation claim of a member (injury, medical and prognosis detail, benefits paid, appeal dates, the union representative) and the premium assessment the organization receives from the board, does the representative who holds the member case decide who sees a claim, may a steward read the organization premium and payroll figures, and which board filings must the software itself submit?',
    sourceState: 'The claim routes are configured at the steward floor and refused for every caller because wcb_claims is DENIED in the CRUD governance list; the assessment routes are served at the steward read and officer write floors with every premium, payroll and surcharge column. No source names the readers, the writers or the representative relation.',
    softwareOwners: [WCB_CAP],
  },
  {
    id: D_MARKETING,
    status: 'OUTSTANDING',
    question: 'Which office owns the testimonials and case studies shown on the public proof page, who approves a testimonial for publication and with what evidence of the speaker consent, may an administrator of one organization edit or delete content that every visitor sees, and may a signed-in member read a testimonial that is not approved or not public?',
    sourceState: 'The testimonial item route is the generic CRUD factory over a table with no organization column, with orgScoped false, a member read floor and an administrator write floor, so the role is checked inside the caller own organization and the row is not; the table holds visibility and approvedAt columns that no read of the route consults, and the proof page describes its content as anonymized composites. No source names the owner, the approver or the consent evidence.',
    softwareOwners: [MARKETING_CAP],
  },
]

const capabilityFields = {
  parentRegisterId: 'UE-CONV-K-006',
  relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
  sourceStatus: 'PARTIAL',
}

export const CAPABILITIES = [
  {
    id: UNIT_CAP,
    ...capabilityFields,
    obligationKey: 'bargaining-unit-and-worksite-register',
    primaryGate: 14,
    dependencyGates: [6, 10, 13],
    actor: 'Steward or officer maintaining the register of bargaining units and worksites of the organization, and member reading the parts of it the institution allows a member to read',
    businessOutcome: 'A bargaining unit and a worksite belong to one organization and one employer, every employer, worksite and steward identifier a row names is verified to belong to the same organization, the certification and contact fields are readable only by the offices the institution names, a register row is created, changed and archived only by the office the institution names and every change commits with its audit record.',
    apiRoute: 'app/api/units, app/api/worksites',
    service: `${APP}lib/api/crud-factory.ts`,
    sourceFiles: [
      `${APP}app/api/units/route.ts`,
      `${APP}app/api/units/[id]/route.ts`,
      `${APP}app/api/worksites/route.ts`,
      `${APP}app/api/worksites/[id]/route.ts`,
      `${APP}db/schema/union-structure-schema.ts`,
      `${APP}components/union-structure/WorksiteManagement.tsx`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/units/route.ts` }],
    auditEvidence: 'The unit and worksite routes are the generic CRUD factory over OPERATIONAL tables, which commits a crud.<table>.<action> audit row in the same tenant transaction for each create, update and archive and lists the field names changed, not the values; reads are not audited.',
    privacyClassification: 'Unit name and number, certification number, body and dates, contract and next bargaining dates, member count, classifications, chief steward and bargaining chair user ids, notes and custom fields; worksite name, code, address and coordinates, employee and shift counts, site manager name, e-mail address and telephone number, notes and custom fields.',
    gap: 'UE-OMIT-EMPLOYER-RELATIONS-RECORDS owns the employer register, the employer contact directory and the log of communications with the employer, not the bargaining unit or the worksite rows; UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER owns collective agreements and UE-OMIT-BARGAINING-RECORDS owns negotiations, proposals and tentative agreements, neither names the register of units; UE-OMIT-ORGANIZATION-ADMINISTRATION owns the organization record and the roster of organization_members, and UE-OMIT-FEDERATION-LOCAL-HIERARCHY owns the hierarchy of organizations, not the units inside one; UE-CAP-K-007 owns the generic CRUD factory as a mechanism, not the domain meaning of a table it is configured over; UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Four route files read and write bargaining_units and worksites at the member read floor and the steward write floor and no existing capability names those rows. This record closes none of the gaps and names no register owner, which no source states.',
  },
  {
    id: WCB_CAP,
    ...capabilityFields,
    obligationKey: 'wcb-claims-and-employer-assessments',
    primaryGate: 6,
    dependencyGates: [2, 10, 13],
    actor: 'Steward recording the workers compensation claim of an injured worker, officer reading and recording the premium assessments of the organization, and the injured member whose claim it is',
    businessOutcome: 'A workers compensation claim is readable and changeable only by the representative who holds the member case and the offices the institution names, the medical and prognosis detail of a claim is not readable by any other steward, the premium assessment of the organization is readable only by the officers who manage it, every board identifier and date is validated, and every change commits with its audit record.',
    apiRoute: 'app/api/wcb',
    service: `${APP}lib/api/crud-factory.ts`,
    sourceFiles: [
      `${APP}app/api/wcb/claims/route.ts`,
      `${APP}app/api/wcb/claims/[id]/route.ts`,
      `${APP}app/api/wcb/assessments/route.ts`,
      `${APP}app/api/wcb/assessments/[id]/route.ts`,
      `${APP}db/schema/domains/health-safety/provincial-wcb-schema.ts`,
      `${APP}lib/api/crud-governance.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/wcb/claims/route.ts` }],
    auditEvidence: 'The claim routes write nothing: wcb_claims is DENIED in the CRUD governance list, so the factory refuses every read and write before a query or an audit row exists. The assessment routes are the generic CRUD factory over an OPERATIONAL table, which commits a crud.wcb_employer_assessments.<action> audit row in the same tenant transaction and lists the field names changed, not the values; reads are not audited.',
    privacyClassification: 'Worker id, jurisdiction, claim type and status, board claim number, incident date and description, body part and nature of injury, hospital, treating physician, prognosis, days lost, return-to-work status and modified duties, wage replacement rate, benefits paid, union representative, grievance link, appeal dates and outcome, witness names and notes; for an assessment, the premium rate, assessable payroll, premium due, experience rating, surcharge or refund and payment dates of the organization.',
    gap: 'UE-OMIT-OHS-REGULATORY-RECORDS (gate 6) owns CNESST filings, anti-scab violation reports and joint health and safety committee records, which are regulatory filings of a particular province and a particular board; the wcb tables are a separate model (a claim of a worker with a compensation board, and the premium assessment an employer receives from that board) with no route, service or schema in common with them. UE-OMIT-PRIVACY-RIGHTS owns member privacy requests, UE-OMIT-FINANCE-UNAVAILABLE owns the union budgets, expenses and affiliate remittances and not a board premium the organization is assessed, and UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Four route files serve wcb_claims and wcb_employer_assessments and no existing capability names those rows. This record closes none of the gaps and names no claim reader or writer, which no source states.',
  },
  {
    id: MARKETING_CAP,
    ...capabilityFields,
    obligationKey: 'platform-marketing-testimonials',
    primaryGate: 14,
    dependencyGates: [8, 13],
    actor: 'Platform marketing staff approving or removing a testimonial shown on the public proof page, and the visitor or member reading approved testimonials',
    businessOutcome: 'A testimonial is published only after the platform office that owns marketing content has approved it with the evidence of the speaker consent, only that office can change or remove it (not the administrator of a customer organization), a reader who is not that office receives only approved public testimonials, and every change commits with its audit record.',
    apiRoute: 'app/api/testimonials',
    service: `${APP}lib/api/crud-factory.ts`,
    sourceFiles: [
      `${APP}app/api/testimonials/[id]/route.ts`,
      `${APP}db/schema/domains/marketing.ts`,
      `${APP}components/admin/testimonial-approval-actions.tsx`,
      `${APP}app/[locale]/(marketing)/proof/page.tsx`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/testimonials/[id]/route.ts` }],
    auditEvidence: 'The testimonial item route is the generic CRUD factory over an OPERATIONAL table, which commits a crud.testimonials.<action> audit row in the same transaction; the transaction is opened with the organization of the caller, and the table has no organization column, so the audit row names the organization of the administrator who changed platform-wide content.',
    privacyClassification: 'Testimonial quote, author name, role, organization name and type, photo address, featured flag, visibility, creation and approval times: personal statements attributed to a named person.',
    gap: 'UE-OMIT-PILOT-APPLICATION-COMMERCIALIZATION owns the pre-account sales pipeline of a prospective union (the pilot application, its verification and its commercial state sequence), UE-OMIT-PILOT-PROGRAM-OPERATIONS owns usage telemetry and feedback of an enrolled organization, and UE-OMIT-CONTENT-LIBRARY-EDITORIAL owns the editorial media library of one organization; none names the platform-wide marketing proof content that every visitor sees, which belongs to no tenant. db/rls-storage-authority/reference-latent.ts already records that any tenant own org-admin can edit or delete this platform-wide content and tracks it for follow-up. UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. One route file serves testimonials and no existing capability names the rows. This record closes none of the gaps and names no marketing owner or approver, which no source states.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE[ownerCapabilityId], severity, title, ...extra })

const FACTORY_TENANT = 'conditions.push(eq(orgCol, organizationId));'
const FACTORY_ID_ONLY = 'const conditions: SQL[] = [eq(pkCol, id)];'

const SUPPORT_FACADE_0B11 = 'DEF-0B11-IDS-SUPPORT-METRICS-AND-SLA-ROUTES-SERVE-NOTIFICATION-ROWS-NOT-SUPPORT-FIGURES'
const SUPPORT_READ = 'DEF-0B11-IDS-SUPPORT-READ-GIVES-EVERY-STEWARD-THE-NOTIFICATIONS-OF-EVERY-MEMBER'
const SUPPORT_POST = 'DEF-0B11-IDS-SUPPORT-METRICS-POST-LETS-A-STEWARD-STORE-A-NOTIFICATION-FOR-ANY-USER-ID-WITH-A-LINK-AND-NO-SENDER'
const STORAGE_POST = 'DEF-0B11-IDS-STORAGE-POST-INSERTS-A-CALLER-WRITTEN-MEDIA-ROW-WITH-ANY-FILE-URL-SIZE-AND-UPLOADER'

const TKT_FACADE = 'DEF-0B12-CRUD-SUPPORT-TICKET-PATHS-SERVE-NOTIFICATION-ROWS-AND-ASSIGN-AND-COMMENTS-ARE-THE-SAME-ITEM-ROUTE'
const TKT_ITEM_WRITE = 'DEF-0B12-CRUD-SUPPORT-TICKET-ITEM-ROUTES-LET-A-STEWARD-REWRITE-AND-AN-ADMIN-DELETE-ANY-USER-NOTIFICATION'
const UPLOAD_FACADE = 'DEF-0B12-CRUD-UPLOAD-PATH-IS-A-JSON-MEDIA-ROW-INSERT-AND-RECEIVES-NO-FILE-WHILE-THE-JOB-FORM-POSTS-ONE'
const TAX_READ = 'DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER'
const TAX_FACADE = 'DEF-0B12-CRUD-TAX-SLIP-RL1-T106-AND-COPE-RECEIPT-PATHS-ISSUE-NOTHING-AND-REFUSE-EVERY-WRITE'
const TESTIMONIAL_WRITE = 'DEF-0B12-CRUD-TESTIMONIAL-ITEM-WRITES-ARE-CONDITIONED-ON-THE-ID-ALONE-FOR-AN-ADMIN-OF-ANY-ORGANIZATION'
const TESTIMONIAL_READ = 'DEF-0B12-CRUD-TESTIMONIAL-ITEM-READ-IGNORES-VISIBILITY-AND-APPROVAL'
const TESTIMONIAL_APPROVE = 'DEF-0B12-CRUD-TESTIMONIAL-APPROVAL-COMPONENT-SENDS-FIELDS-THE-TABLE-DOES-NOT-HAVE'
const UNITS_READ = 'DEF-0B12-CRUD-BARGAINING-UNIT-ROWS-READABLE-BY-ANY-MEMBER-WITH-CERTIFICATION-NOTES-AND-CUSTOM-FIELDS'
const UNITS_WRITE = 'DEF-0B12-CRUD-BARGAINING-UNIT-CERTIFICATION-AND-REPRESENTATION-FIELDS-WRITABLE-BY-ANY-STEWARD'
const WORKSITES_READ = 'DEF-0B12-CRUD-WORKSITE-ROWS-READABLE-BY-ANY-MEMBER-WITH-SITE-MANAGER-CONTACT-AND-NOTES'
const REFS_UNVERIFIED = 'DEF-0B12-CRUD-UNIT-AND-WORKSITE-FOREIGN-KEYS-ARE-TAKEN-FROM-THE-BODY-WITHOUT-AN-ORGANIZATION-CHECK'
const WCB_CLAIMS_DENIED = 'DEF-0B12-CRUD-WCB-CLAIM-ROUTES-ARE-CONFIGURED-FOR-STEWARDS-AND-DENIED-FOR-EVERY-CALLER'
const WCB_ASSESS_READ = 'DEF-0B12-CRUD-WCB-ASSESSMENT-PREMIUM-AND-PAYROLL-READABLE-BY-ANY-STEWARD'

export const DEFECTS = [
  D(TKT_FACADE, NOTIFY_CAP, 'MEDIUM',
    'The four support/tickets route files (the collection, tickets/[id], tickets/[id]/assign and tickets/[id]/comments) are crudRoutes over in_app_notifications: GET lists notification rows (user id, title, message, type, action label and url, data, read flag), POST inserts one, and GET, PATCH and DELETE of tickets/[id] read, rewrite and hard delete a notification, while tickets/[id]/assign and tickets/[id]/comments are configured identically to tickets/[id] so the path suffix changes nothing: assigning a ticket or posting a comment is a PATCH of the notification row with that id, and no route creates a ticket, assigns an agent, records a comment or a history entry, although supportTickets, ticketComments and ticketHistory tables and createTicket, assignTicket and addComment in the support service exist and no route calls that service.'),
  D(TKT_ITEM_WRITE, NOTIFY_CAP, 'MEDIUM',
    'The item routes under support/tickets configure writeRole steward and export PATCH and DELETE over in_app_notifications with the factory organization predicate and no owner condition for a caller at the steward floor, so a steward rewrites the title, message, action url, data, read flag and user id of any notification of any user of the organization (the body is applied through the blocked-field filter only) and an administrator permanently removes it, with no relation between the caller and the recipient and no record of the previous value.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(UPLOAD_FACADE, MEDIA_CAP, 'MEDIUM',
    'POST /api/upload is the generic crudRoutes POST over cms_media_library at the steward write floor: it reads a JSON body into a media library row (file name, file url, size, mime type, folder) and receives and stores no file, while the public job application page posts a multipart form (the file and the folder resumes) to the path and reads the url of the response as the resume address; the route requires a signed-in steward, answers a JSON object whose row is under data (never a url), and GET on the same path lists the media library rows at the member floor, so an applicant sends a file and nothing is stored or addressed.'),
  D(TAX_READ, FINANCE_CAP, 'HIGH',
    'The four tax route files (tax/slips, tax/t106, tax/rl-1/generate and tax/cope/receipts) are crudRoutes over per_capita_remittances configured at readRole member, and the table has no user, member, e-mail or phone column by the names the low-role guard looks for, so any member of the organization, not only an officer, receives the whole per-capita remittance ledger of the organization (remittance month and year, member counts, per-capita rate, total amount, GL and CLC account codes, approver and rejecter user ids, rejection reason, payment method and reference, remittance and receipt file urls and notes), 50 rows per page by default and 100 at most, whatever tax document the path names, with no field projection and no read audit; the query parameters the COPE receipt viewer sends (memberId, taxYear) are not read.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any member of an organization, whatever their role, calls GET /api/tax/slips, /api/tax/t106, /api/tax/rl-1/generate or /api/tax/cope/receipts: readRole is member, the generic factory scopes the rows to the session organization and, because per_capita_remittances has none of the owner or personal column names the low-role guard looks for, applies no owner condition, and it returns whole rows including total_amount, approved_by, rejected_by, rejection_reason, payment_reference and the remittance and receipt file urls.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'A member reads the amounts the organization owes and has paid to its parent body, the identity of the officers who approved and rejected each remittance, the reasons for a rejection and the stored remittance and receipt documents, financial records that the remittance run detail route of Gate 0B.6 (DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ) and the health and welfare path of Gate 0B.8 (DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR) also place in front of every member.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: `${API}tax/slips/route.ts`, quote: "readRole: 'member'," }],
        existingContainment: {
          summary: 'The factory adds an organization predicate from the session organization, so only the rows of the caller own organization are read; nothing narrows them to an officer, a treasurer or a set of permitted fields, so the exposure is every remittance row of the organization to every member.',
          evidence: [{ ref: CRUD_FACTORY, quote: FACTORY_TENANT }],
        },
        justification: 'The routes serve the financial ledger a union owes its parent body to every authenticated member at the lowest role floor with no field projection and no audit; the tenant predicate keeps other organizations out but does not limit a same-organization reader, no source establishes that members are the intended audience of the amounts, the approvers or the stored documents, and the same exposure through the other two per-capita routes was recorded with a lower severity, which this record does not follow because the disclosure is identical and the read blocks release until the institution names the readers.',
      },
    }),
  D(TAX_FACADE, FINANCE_CAP, 'MEDIUM',
    'The tax/slips, tax/t106, tax/rl-1/generate and tax/cope/receipts routes are the same crudRoutes configuration over per_capita_remittances and differ only in their path: GET returns remittance rows, and POST is refused with 403 because per_capita_remittances is READ_ONLY in the CRUD governance table, so no route issues, computes or stores a tax slip, a Quebec RL-1, a T106 return or a political contribution receipt although the path names promise each, and the one client that calls a path (the tax dashboard opens the COPE receipt path for a member and a tax year) receives a page of remittance rows in which neither parameter is read.'),
  D(TESTIMONIAL_WRITE, MARKETING_CAP, 'HIGH',
    'PATCH and DELETE /api/testimonials/<id> are crudRoutes over the testimonials table with orgScoped false and writeRole admin: the table has no organization column, the role floor is resolved inside the caller own organization, and the update and the hard delete are conditioned on the primary key alone, so an administrator of any organization rewrites (quote, author, role, organization, photo, featured flag, visibility, approval time) or permanently deletes any testimonial the platform shows on its public proof page, and the audit row commits under the organization of that administrator; the storage authority reference already records that any tenant own org-admin can edit or delete this platform-wide content and leaves it for follow-up.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'An administrator of any organization calls PATCH /api/testimonials/<id> with a new quote, author or visibility, or DELETE /api/testimonials/<id>: the factory checks that the caller holds the admin role in the caller own organization, builds the where clause from the primary key alone because orgScoped is false and the table has no organization column, and updates or removes the platform testimonial row in a transaction that audits under the caller organization.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'AVAILABILITY_OR_DATA_LOSS', 'FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'The administrator of one customer organization can replace a named person quote or attribution on the public proof page, mark a testimonial public or featured, or delete the platform testimonials of every other organization, and nothing in the row records which organization or person changed it other than an audit row under the changing administrator own organization.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: `${API}testimonials/[id]/route.ts`, quote: "writeRole: 'admin'," }],
        existingContainment: {
          summary: 'The caller must hold the administrator role of some organization and the delete is a hard delete with an audit row, so the removal is attributable to an organization; nothing limits the change to platform marketing staff, and the reference record that notes the exposure leaves it for follow-up.',
          evidence: [{ ref: REFERENCE_LATENT, quote: 'any tenant\'s own org-admin can create/edit/delete this platform-wide content' }],
        },
        justification: 'The write floor is an administrator title of any customer organization, and the content it changes is shown to every visitor under a named person and organization, so one customer can alter or destroy what the platform attributes to others; the repository already records the exposure and tracks it for follow-up, which establishes that it is known and not that it is contained, and no source names a platform marketing office that should hold the write.',
      },
    }),
  D(TESTIMONIAL_READ, MARKETING_CAP, 'MEDIUM',
    'GET /api/testimonials/<id> selects the row by primary key at the member read floor and returns every column, whatever the row visibility (the column defaults to public and holds other values) and whatever its approval time (null until approved), so any signed-in member of any organization reads a testimonial that has not been approved or is not public, with its quote, author, role, organization and photo; the public proof page does not read this route and describes its content as anonymized composites.'),
  D(TESTIMONIAL_APPROVE, MARKETING_CAP, 'MEDIUM',
    'The testimonial approval component sends PATCH /api/testimonials/<id> with status, reviewedAt and reviewedBy (approved or rejected) and reports success, and the testimonials table has no status, reviewedAt or reviewedBy column and carries approvedAt, which the component never sends, so an approval or a rejection records no decision in any column the table has and the route answers success for it.'),
  D(UNITS_READ, UNIT_CAP, 'MEDIUM',
    'GET /api/units and GET /api/units/<id> are crudRoutes over bargaining_units at the member read floor and the table has none of the user, member, e-mail or phone column names the low-role guard looks for, so any member of the organization receives every register row with its certification number, body and dates, contract expiry and next bargaining date, chief steward and bargaining chair user ids, classifications, free-text notes and custom fields object, with no field projection and no read audit.'),
  D(UNITS_WRITE, UNIT_CAP, 'MEDIUM',
    'POST /api/units and PATCH /api/units/<id> are configured at writeRole steward with the whole body copied into the row, so any steward of the organization creates a bargaining unit or rewrites its certification number, certification body and dates, current collective agreement id, contract and bargaining dates, member count, chief steward and bargaining chair, and an administrator archives it, with no check that the caller represents the unit and with the audit row listing field names and no values.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(WORKSITES_READ, UNIT_CAP, 'MEDIUM',
    'GET /api/worksites and GET /api/worksites/<id> are crudRoutes over worksites at the member read floor, so any member of the organization receives every worksite row with the site manager name, e-mail address and telephone number, the address and coordinates, the employee and shift counts, free-text notes and the custom fields object, with no field projection and no read audit, and the worksite management screen and the unit and committee screens load the whole list from the route.'),
  D(REFS_UNVERIFIED, UNIT_CAP, 'LOW',
    'POST and PATCH on the unit and worksite routes copy the body into the row, and employer_id, worksite_id, chief_steward_id and bargaining_chair_id are foreign keys to the employers, worksites and profiles tables that carry no organization condition, so the row can name an employer, a worksite or a person of another organization (the foreign key check passes for any existing id) and the register then joins organizations that have nothing to do with each other.'),
  D(WCB_CLAIMS_DENIED, WCB_CAP, 'MEDIUM',
    'The wcb/claims and wcb/claims/[id] routes are crudRoutes over wcb_claims configured at the steward floor for reads and writes (the collection declares an owner column workerId, the item route none), and wcb_claims is DENIED in the CRUD governance table, so assertCrudRead and assertCrudWrite refuse every call with 403 before a query or an audit row, for stewards and administrators alike; the route header describes a claim collection a steward lists and creates, the claim holds the medical and prognosis detail of an injured worker, and if the governance entry is ever lifted every steward of the organization would read and rewrite every claim (the item route has no owner condition), with no relation to the representative who holds the member case.'),
  D(WCB_ASSESS_READ, WCB_CAP, 'MEDIUM',
    'GET /api/wcb/assessments and GET /api/wcb/assessments/<id> are crudRoutes over wcb_employer_assessments at the steward read floor, so any steward of the organization (not only the officers who record the assessments) receives every assessment row with the premium rate, assessable payroll, premium due, experience rating, surcharge or refund, due and paid dates, status, document ids and the metadata object, with no field projection and no read audit.'),
]

const future = {
  ticket: 'Either build the ticket, assignment and comment routes over the support tables under an owner the institution names, with a recipient and requester check and an audit record, or answer 501 and remove the paths; keep notifications on the notification routes.',
  upload: 'Either receive the multipart file, store it with a type and size check under an authority the institution names and return its address, or answer 501; never insert a library row from a client-written body.',
  tax: 'Decide which office issues each tax document and from which records it is computed, serve the remittance ledger only to the readers the institution names through a projection, and either build the slip, return and receipt computation behind an audited route or answer 501 for each path.',
  testimonial: 'Name the platform office that owns marketing content, move the write to a platform mandate that no customer administrator holds, return only approved public rows to other readers, record the approval and the consent evidence and audit each change; or answer 501.',
  units: 'Name the register owner, project a member-safe read (name, number, type and status) and keep certification detail, notes and custom fields to the offices that need them, verify every referenced employer, worksite and person belongs to the same organization, and restrict writes to the named office.',
  wcb: 'Decide who reads and changes a claim and a premium assessment, tie a claim to the representative who holds the member case, project the medical detail away from other stewards, validate board identifiers and dates, and either build a dedicated audited route or answer 501.',
}

const rowsOf = (m, isItem) => (m === 'GET' ? (isItem ? 'row of the path id' : 'rows') : 'row')

/* ------------------------------------------------------------------------------------------------------------ */
/* profiles                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

function ticketProfile(a) {
  const isRead = a.method === 'GET'
  const isItem = a.route !== 'support/tickets/route.ts' && a.route !== 'support/sla/route.ts'
  const part = a.route.includes('/assign/') ? 'assign' : a.route.includes('/comments/') ? 'comments' : a.route === 'support/sla/route.ts' ? 'sla' : isItem ? 'ticket' : 'tickets'
  const persona = {
    tickets: isRead ? 'Member reading their support tickets, and steward or support staff working the ticket queue' : 'Steward or support staff expecting to open a support ticket',
    ticket: isRead ? 'Member or staff opening one support ticket' : 'Steward or administrator expecting to update or close one support ticket',
    assign: isRead ? 'Support staff opening the assignment of one ticket' : 'Support staff expecting to assign a ticket to an agent or remove the assignment',
    comments: isRead ? 'Member or staff reading the comments on one ticket' : 'Support staff expecting to edit or remove a comment on a ticket',
    sla: 'Steward who expects to record a service-level figure and instead addresses an in-app notification to a user',
  }[part]
  const defects = () => {
    if (part === 'sla') return [SUPPORT_FACADE_0B11, SUPPORT_POST]
    if (isRead) return [TKT_FACADE, SUPPORT_READ]
    if (a.method === 'POST') return [TKT_FACADE, SUPPORT_POST]
    return [TKT_FACADE, TKT_ITEM_WRITE]
  }
  return {
    persona,
    owner: `in_app_notifications rows of the organization (the ${part === 'sla' ? 'support SLA' : 'support ticket'} path is not a table of its own: the route serves the notification inbox).`,
    sens: 'User id, title, message, type, action label and url, data object, read flag and times of each in-app notification',
    priv: (m) => {
      if (m === 'GET') {
        return `A caller below steward receives only the notification ${isItem ? 'row of the path id when it is addressed to their own user id' : 'rows addressed to their own user id'}; a steward or above receives the title, message, action url and data of ${isItem ? 'the notification of the path id whoever it was addressed to' : 'every user notification of the organization'}; no row of another organization is reachable and no ticket, assignment or comment is read.`
      }
      if (m === 'POST') return 'The notification row stored from the body is returned in full; the user id, title, message, action url and data are whatever the caller wrote.'
      if (m === 'PATCH') return 'The updated notification row is returned in full; any of its columns, including the user id it is addressed to, may be rewritten by the body.'
      return 'The notification row is removed or archived for the path id; the response confirms the deletion and no copy or previous value is kept.'
    },
    does: (m, _model, floor) => {
      if (m === 'GET') return `Returns the in_app_notifications ${rowsOf(m, isItem)} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated'}; it reads no ticket, assignment or comment, whatever the path says.`
      if (m === 'POST') return `Inserts an in_app_notifications row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; no ticket is created and no recipient is checked.`
      if (m === 'PATCH') return `Applies the body to the in_app_notifications row of the path id at a role floor of ${floor}, whatever the suffix ${part === 'assign' ? 'assign' : part === 'comments' ? 'comments' : ''} says, and commits the factory audit record with it; no ticket is assigned or commented.`.replace('  ', ' ')
      return `Removes the in_app_notifications row of the path id at an administrator floor and commits the factory audit record with it; no ticket or comment is deleted.`
    },
    future: future.ticket,
    gate: GATE[NOTIFY_CAP],
    deps: [9, 13],
    decisions: [D_SUPPORT, D_NOTIFY],
    def: defects,
    extraEv: (b) => [
      b.tbl('privacy', 'inAppNotifications', /actionUrl: text\('action_url'\)/),
      b.tbl('privacy', 'inAppNotifications', /message: text\('message'\)\.notNull\(\)/),
      ...(isRead ? [] : [b.tbl('defect', 'inAppNotifications', /userId: text\('user_id'\)\.notNull\(\)/)]),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over inAppNotifications with orgScoped, readRole member and writeRole steward and nothing else; no module under app/api imports the support service whose createTicket, assignTicket and addComment write supportTickets, ticketComments and ticketHistory, and the assign and comments route files differ from the ticket item route in their path only.' },
    ],
    reqRead: 'Audit reads of notification rows that name a member, case or grievance once the readers are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

function uploadProfile(a) {
  const isRead = a.method === 'GET'
  return {
    persona: isRead
      ? 'Member of the organization (any role) listing the media library of the organization'
      : 'Job applicant sending a resume, or steward adding a library image, who expects the file to be stored and its address returned',
    owner: 'cms_media_library rows of the organization (the upload path is not a file store: the route serves the media library rows).',
    sens: 'File name, file url, file type, mime type, file size, width, height, alt text, caption, tags, folder and uploader of each media library entry',
    priv: (m) => (m === 'GET'
      ? 'Any member of the organization reads the media library rows of the organization with file urls, names, captions, folders and uploader ids; no row of another organization is reachable.'
      : 'The media row stored from the JSON body is returned under data; the file url, size, mime type, folder and uploader are whatever the caller wrote and no file address is created.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the cms_media_library rows of the session organization at a role floor of ${floor}, newest first and paginated.`
      : `Inserts a cms_media_library row from the whole JSON body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; no multipart file is read, stored or checked.`),
    future: future.upload,
    gate: GATE[MEDIA_CAP],
    deps: [6, 13],
    decisions: [D_SUPPORT],
    def: () => (isRead ? [UPLOAD_FACADE] : [UPLOAD_FACADE, STORAGE_POST]),
    extraEv: (b) => [
      b.tbl('privacy', 'cmsMediaLibrary', /fileUrl: text\('file_url'\)\.notNull\(\)/),
      b.tbl('privacy', 'cmsMediaLibrary', /fileSize: integer\('file_size'\)\.notNull\(\)/),
      ...(isRead ? [] : [b.tbl('defect', 'cmsMediaLibrary', /uploadedBy: text\('uploaded_by'\)/)]),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over cmsMediaLibrary and nothing else, and the factory answers a created row as { data: row }, so a caller that reads url from the response body finds nothing; no code under app/api stores a file on behalf of this path; the job application page posts a FormData holding the file and the folder resumes to the path and reads uploadData.url as the resume address.' },
    ],
    reqRead: 'Audit reads of the media library once the readers of private files are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

function taxProfile(a) {
  const isRead = a.method === 'GET'
  const label = a.route.startsWith('tax/slips') ? 'tax slips' : a.route.startsWith('tax/t106') ? 'the T106 information return' : a.route.startsWith('tax/rl-1') ? 'an RL-1 slip' : 'political contribution receipts'
  return {
    persona: isRead
      ? `Member of the organization (any role), and treasurer or officer who expects ${label}`
      : `Treasurer or officer expecting to generate ${label}`,
    owner: `per_capita_remittances rows of the organization (${label} is not a table of its own: the route serves the per-capita remittance ledger that the organization owes its parent body).`,
    sens: 'Remittance month and year, due date, member counts (total, good standing, remittable), per-capita rate, total amount, currency, CLC account code, GL account, status, approver and rejecter user ids, rejection reason, payment method and reference, remittance and receipt file urls, notes',
    priv: (m) => (m === 'GET'
      ? 'Any member of the organization reads the per_capita_remittances rows of the organization, 50 per page by default and 100 at most, with the amounts, account codes, approver and rejecter ids, rejection reason, payment reference and stored document urls; no row of another organization is reachable, nothing narrows the fields or the readers and no read is audited.'
      : 'Nothing is stored: per_capita_remittances is READ_ONLY in the CRUD governance table, so the write is refused with 403 before any row or audit record exists.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the per_capita_remittances rows of the session organization at a role floor of ${floor}, newest first and paginated, with every column; it computes no slip, return or receipt and reads no memberId or taxYear parameter.`
      : `Authenticates a caller at the ${floor} floor, then refuses the ${m} with 403 because the table is read-only in the governance list, before any row or audit record.`),
    future: future.tax,
    gate: GATE[FINANCE_CAP],
    deps: [13],
    decisions: [D_TAX],
    def: () => (isRead ? [TAX_READ, TAX_FACADE] : [TAX_FACADE]),
    extraEv: (b) => [
      b.tbl('privacy', 'perCapitaRemittances', /totalAmount: numeric\('total_amount'/),
      b.tbl('privacy', 'perCapitaRemittances', /approvedBy: varchar\('approved_by'/),
      b.tbl('privacy', 'perCapitaRemittances', /receiptFileUrl: text\('receipt_file_url'\)/),
      ...(isRead ? [b.sch('privacy', `${APP}lib/api/crud-low-role-guard.ts`, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }")] : []),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over perCapitaRemittances with orgScoped, readRole member and writeRole steward and nothing else, and the four tax route files differ only in their path; the factory reads the page and limit query parameters and no other parameter, so memberId and taxYear select nothing; the tax dashboard opens the COPE receipt path with memberId and taxYear in the query string.' },
    ],
    reqRead: 'Audit reads of the remittance ledger once the readers are named.',
    status: (m) => (m === 'GET' ? 'FACADE_OVER_GENERIC_TABLE' : 'LATENT_NOT_OPERATIONAL'),
  }
}

function testimonialProfile(a) {
  const m0 = a.method
  return {
    persona: m0 === 'GET'
      ? 'Member of any organization reading one testimonial of the platform'
      : m0 === 'PATCH' ? 'Administrator of an organization approving or editing a platform testimonial' : 'Administrator of an organization removing a platform testimonial',
    owner: 'testimonials rows: platform-wide marketing content with no organization column (quote, author, role, organization name and type, photo, featured flag, visibility, approval time); no tenant owns a row.',
    sens: 'Quote, author name, role, organization name and type, photo address, featured flag, visibility and approval time of a named person testimonial',
    priv: (m) => {
      if (m === 'GET') return 'Any signed-in member of any organization reads the testimonial of the path id with its quote, author, role, organization and photo, whatever its visibility or approval; nothing narrows the row and no read is audited.'
      if (m === 'PATCH') return 'The updated testimonial row is returned in full; any column the body names (quote, author, visibility, featured, approval time) is rewritten for every visitor of the public page.'
      return 'The testimonial row is permanently removed for every organization and every visitor; nothing keeps a copy or records the previous content beyond the audit row of the deleting organization.'
    },
    does: (m, _model, floor) => {
      if (m === 'GET') return `Returns the testimonials row of the path id at a role floor of ${floor} with no organization predicate and no visibility or approval condition.`
      if (m === 'PATCH') return `Applies the body to the testimonials row of the path id at a role floor of ${floor}, conditioned on the primary key alone, and commits the factory audit record under the organization of the caller.`
      return 'Hard-deletes the testimonials row of the path id (the table has no status column to archive) at an administrator floor, conditioned on the primary key alone, and commits the factory audit record under the organization of the caller.'
    },
    future: future.testimonial,
    gate: GATE[MARKETING_CAP],
    deps: [8, 13],
    decisions: [D_MARKETING],
    def: () => (m0 === 'GET' ? [TESTIMONIAL_READ] : m0 === 'PATCH' ? [TESTIMONIAL_WRITE, TESTIMONIAL_APPROVE] : [TESTIMONIAL_WRITE]),
    extraEv: (b) => [
      b.tbl('privacy', 'testimonials', /visibility: text\('visibility'\)\.notNull\(\)\.default\('public'\)/),
      b.tbl('privacy', 'testimonials', /approvedAt: timestamp\('approved_at'\)/),
      ...(m0 === 'GET' ? [] : [b.imp('defect', 'crudRoutes', FACTORY_ID_ONLY), b.sch('defect', REFERENCE_LATENT, "any tenant's own org-admin can create/edit/delete this platform-wide content")]),
      ...(m0 === 'PATCH' ? [b.tbl('defect', 'testimonials', /pgTable\(/, { absentColumns: ['status', 'reviewedAt', 'reviewedBy'] })] : []),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'No module under app/api other than this route reads or writes the testimonials table, and the public proof page renders its own text and does not fetch this route; the table has no status column, so the soft-delete branch of the factory does not apply and the delete is a hard delete; the approval component sends status, reviewedAt and reviewedBy to PATCH /api/testimonials/<id> and never sends approvedAt.' },
    ],
    reqRead: 'Reads of platform testimonials need no audit record once only approved public rows are returned.',
    status: () => 'PARTIAL',
  }
}

function unitsProfile(a) {
  const isRead = a.method === 'GET'
  const isItem = a.route === 'units/[id]/route.ts'
  const m0 = a.method
  return {
    persona: isRead
      ? 'Member of the organization (any role) reading the register of bargaining units, and steward or officer maintaining it'
      : m0 === 'POST' ? 'Steward expecting to register a bargaining unit' : m0 === 'PATCH' ? 'Steward expecting to update the certification or representation of a bargaining unit' : 'Administrator expecting to archive a bargaining unit',
    owner: 'bargaining_units rows of the organization: the register of units (employer, worksite, certification, contract and bargaining dates, composition, chief steward and bargaining chair, notes and custom fields).',
    sens: 'Unit name and number, type, status, certification number, body and dates, contract expiry and next bargaining date, member count, classifications, chief steward and bargaining chair user ids, description, notes and custom fields',
    priv: (m) => (m === 'GET'
      ? `Any member of the organization reads the bargaining unit ${isItem ? 'row of the path id' : 'rows of the organization, 50 per page by default and 100 at most,'} with the certification detail, representation ids, notes and custom fields; no row of another organization is reachable, nothing narrows the fields and no read is audited.`
      : m === 'POST' ? 'The stored unit row is returned in full; whatever the body wrote (certification, dates, representation, notes, custom fields, employer and worksite ids) is stored under the session organization.'
        : m === 'PATCH' ? 'The updated unit row is returned in full; the body may rewrite any column other than the blocked identity and tenant fields.'
          : 'The unit is archived (status archived); the response confirms it and the row, with its certification detail, stays in the table.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the bargaining_units ${isItem ? 'row of the path id' : 'rows'} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated,'} with every column and no field projection.`
      : m === 'POST' ? `Inserts a bargaining_units row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it.`
        : m === 'PATCH' ? `Applies the body to the bargaining_units row of the path id and the session organization at a role floor of ${floor} and commits the factory audit record with it.`
          : 'Soft-deletes the bargaining_units row of the path id and the session organization (status archived) at an administrator floor and commits the factory audit record with it.'),
    future: future.units,
    gate: GATE[UNIT_CAP],
    deps: [6, 10, 13],
    decisions: [D_UNITS],
    def: () => (isRead ? [UNITS_READ] : m0 === 'DELETE' ? [] : [UNITS_WRITE, REFS_UNVERIFIED]),
    extraEv: (b) => [
      b.tbl('privacy', 'bargainingUnits', /certificationNumber: varchar\('certification_number'/),
      b.tbl('privacy', 'bargainingUnits', /customFields: jsonb\('custom_fields'\)/),
      b.tbl('privacy', 'bargainingUnits', /chiefStewardId: text\('chief_steward_id'\)/),
      ...(!isRead && m0 !== 'DELETE' ? [b.tbl('defect', 'bargainingUnits', /employerId: uuid\('employer_id'\)/), b.tbl('defect', 'bargainingUnits', /\.references\(\(\) => employers\.id/)] : []),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over bargainingUnits with orgScoped, readRole member and writeRole steward and nothing else; the foreign keys of employerId and worksiteId point at the primary key of employers and worksites, which carry their own organization column, and nothing in the factory compares the organization of the referenced row with the session organization.' },
    ],
    reqRead: 'Audit reads of the register once the readers of certification detail are named.',
    status: () => 'PARTIAL',
  }
}

function worksitesProfile(a) {
  const isRead = a.method === 'GET'
  const isItem = a.route === 'worksites/[id]/route.ts'
  const m0 = a.method
  return {
    persona: isRead
      ? 'Member of the organization (any role) reading the register of worksites, and steward or officer maintaining it'
      : m0 === 'POST' ? 'Steward expecting to register a worksite' : m0 === 'PATCH' ? 'Steward expecting to update a worksite or its site manager' : 'Administrator expecting to archive a worksite',
    owner: 'worksites rows of the organization: the register of worksites (employer, address, operating pattern, site manager contact, notes and custom fields).',
    sens: 'Worksite name, code, status, address and coordinates, employee and shift counts, weekend and 24-hour flags, site manager name, e-mail address and telephone number, description, notes and custom fields',
    priv: (m) => (m === 'GET'
      ? `Any member of the organization reads the worksite ${isItem ? 'row of the path id' : 'rows of the organization, 50 per page by default and 100 at most,'} with the site manager contact, address, notes and custom fields; no row of another organization is reachable, nothing narrows the fields and no read is audited.`
      : m === 'POST' ? 'The stored worksite row is returned in full; whatever the body wrote (site manager contact, address, notes, custom fields, employer id) is stored under the session organization.'
        : m === 'PATCH' ? 'The updated worksite row is returned in full; the body may rewrite any column other than the blocked identity and tenant fields.'
          : 'The worksite is archived (status archived); the response confirms it and the row, with its contact detail, stays in the table.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the worksites ${isItem ? 'row of the path id' : 'rows'} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated,'} with every column and no field projection.`
      : m === 'POST' ? `Inserts a worksites row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it.`
        : m === 'PATCH' ? `Applies the body to the worksites row of the path id and the session organization at a role floor of ${floor} and commits the factory audit record with it.`
          : 'Soft-deletes the worksites row of the path id and the session organization (status archived) at an administrator floor and commits the factory audit record with it.'),
    future: future.units,
    gate: GATE[UNIT_CAP],
    deps: [6, 10, 13],
    decisions: [D_UNITS],
    def: () => (isRead ? [WORKSITES_READ] : m0 === 'DELETE' ? [] : [REFS_UNVERIFIED]),
    extraEv: (b) => [
      b.tbl('privacy', 'worksites', /siteManagerEmail: varchar\('site_manager_email'/),
      b.tbl('privacy', 'worksites', /siteManagerPhone: varchar\('site_manager_phone'/),
      b.tbl('privacy', 'worksites', /customFields: jsonb\('custom_fields'\)/),
      ...(!isRead && m0 !== 'DELETE' ? [b.tbl('defect', 'worksites', /employerId: uuid\('employer_id'\)/), b.tbl('defect', 'worksites', /\.references\(\(\) => employers\.id/)] : []),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over worksites with orgScoped, readRole member and writeRole steward and nothing else; the employer foreign key points at the primary key of employers, which carries its own organization column, and nothing in the factory compares the organization of the referenced row with the session organization.' },
    ],
    reqRead: 'Audit reads of the register once the readers of site manager contact detail are named.',
    status: () => 'PARTIAL',
  }
}

function wcbClaimProfile(a) {
  const isRead = a.method === 'GET'
  return {
    persona: isRead
      ? 'Steward or officer expecting to read the workers compensation claims of the organization or of one injured worker'
      : 'Steward expecting to record, update or remove the workers compensation claim of an injured worker',
    owner: 'wcb_claims rows of the organization: one workers compensation claim per injured worker (injury, medical, prognosis, return to work, benefits, representation, appeal and notes); the generic factory serves none of them because the table is denied.',
    sens: 'Worker id, jurisdiction, claim type and status, board claim number, incident date and description, body part and nature of injury, hospital, treating physician, prognosis, days lost, return-to-work status, benefits paid, union representative, grievance link, appeal dates, witness names and notes',
    priv: (m) => (m === 'GET'
      ? 'Nothing is returned: wcb_claims is DENIED in the CRUD governance table, so the read is refused with 403 for every caller, including an administrator.'
      : 'Nothing is stored or removed: wcb_claims is DENIED in the CRUD governance table, so the write is refused with 403 for every caller, including an administrator.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Authenticates a caller at the ${floor} floor, then refuses the read with 403 because the table is denied, before any query.`
      : `Authenticates a caller at the ${floor} floor, then refuses the ${m} with 403 because the table is denied, before any insert, update, delete or audit row.`),
    future: future.wcb,
    gate: GATE[WCB_CAP],
    deps: [2, 10, 13],
    decisions: [D_WCB],
    def: () => [WCB_CLAIMS_DENIED],
    extraEv: (b) => [
      b.tbl('privacy', 'wcbClaims', /initialPrognosis: text\('initial_prognosis'\)/),
      b.tbl('privacy', 'wcbClaims', /treatingPhysician: varchar\('treating_physician'/),
      b.sch('defect', CRUD_GOVERNANCE_FILE, "'wcb_claims'"),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The collection route declares ownerColumn workerId, a uuid worker identifier that is not the session user id, and the item route declares no owner column; no application code other than these two routes and the governance list names wcbClaims, so the routes are the only access path and both are refused.' },
    ],
    reqRead: 'No audit record is needed for a refused read; a dedicated, authority-checked route must decide who may read a claim and audit each read.',
    status: () => 'LATENT_NOT_OPERATIONAL',
  }
}

function wcbAssessmentProfile(a) {
  const isRead = a.method === 'GET'
  const isItem = a.route === 'wcb/assessments/[id]/route.ts'
  const m0 = a.method
  return {
    persona: isRead
      ? 'Steward or officer reading the workers compensation premium assessments of the organization'
      : m0 === 'POST' ? 'Officer recording a workers compensation premium assessment' : m0 === 'PATCH' ? 'Officer updating a premium assessment' : 'Administrator removing a premium assessment',
    owner: 'wcb_employer_assessments rows of the organization: the premium assessment the organization receives from a compensation board for an assessment year (rate group, premium rate, assessable payroll, premium due, experience rating, surcharge or refund, due and paid dates).',
    sens: 'Jurisdiction, assessment year, rate group, premium rate, assessable payroll, premium due, experience rating, rating program, surcharge or refund, due and paid dates, status, document ids and metadata',
    priv: (m) => (m === 'GET'
      ? `Any steward of the organization reads the assessment ${isItem ? 'row of the path id' : 'rows of the organization, 50 per page by default and 100 at most,'} with the premium, payroll, surcharge and payment dates; no row of another organization is reachable, nothing narrows the fields and no read is audited.`
      : m === 'POST' ? 'The stored assessment row is returned in full; whatever the body wrote (premium, payroll, dates, status, metadata) is stored under the session organization.'
        : m === 'PATCH' ? 'The updated assessment row is returned in full; the body may rewrite any column other than the blocked identity and tenant fields.'
          : 'The assessment is archived (status archived) or removed, as the factory decides; the response confirms it.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the wcb_employer_assessments ${isItem ? 'row of the path id' : 'rows'} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated,'} with every column and no field projection.`
      : m === 'POST' ? `Inserts a wcb_employer_assessments row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it.`
        : m === 'PATCH' ? `Applies the body to the wcb_employer_assessments row of the path id and the session organization at a role floor of ${floor} and commits the factory audit record with it.`
          : 'Deletes or archives the wcb_employer_assessments row of the path id and the session organization at an administrator floor and commits the factory audit record with it.'),
    future: future.wcb,
    gate: GATE[WCB_CAP],
    deps: [5, 10, 13],
    decisions: [D_WCB],
    def: () => (isRead ? [WCB_ASSESS_READ] : []),
    extraEv: (b) => [
      b.tbl('privacy', 'wcbEmployerAssessments', /premiumDue: numeric\('premium_due'/),
      b.tbl('privacy', 'wcbEmployerAssessments', /assessablePayroll: numeric\('assessable_payroll'/),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over wcbEmployerAssessments with orgScoped, readRole steward and writeRole officer and nothing else; the table has no owner or personal column, so the low-role guard applies no condition, and no application code other than these two routes and the governance list names wcbEmployerAssessments.' },
    ],
    reqRead: 'Audit reads of the premium and payroll figures once the readers are named.',
    status: () => 'PARTIAL',
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

export const RISK_SCREENS = {}

const pinRemittanceTable = (record) => ({
  ...record,
  evidence: (record.evidence ?? []).map((item) => {
    if (item.resolvesExport !== 'perCapitaRemittances') return item
    const { resolvesExport, ...rest } = item
    return { ...rest, symbol: resolvesExport }
  }),
})

export function facts(a, readText) {
  const record = applyCrossTenantExposure(pinRemittanceTable(build(a, readText)), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a, readText) {
  switch (a.route) {
    case 'support/tickets/route.ts':
    case 'support/tickets/[id]/route.ts':
    case 'support/tickets/[id]/assign/route.ts':
    case 'support/tickets/[id]/comments/route.ts':
    case 'support/sla/route.ts': return crudRecord(a, readText, ticketProfile(a))
    case 'upload/route.ts': return crudRecord(a, readText, uploadProfile(a))
    case 'tax/slips/route.ts':
    case 'tax/t106/route.ts':
    case 'tax/rl-1/generate/route.ts':
    case 'tax/cope/receipts/route.ts': return crudRecord(a, readText, taxProfile(a))
    case 'testimonials/[id]/route.ts': return crudRecord(a, readText, testimonialProfile(a))
    case 'units/route.ts':
    case 'units/[id]/route.ts': return crudRecord(a, readText, unitsProfile(a))
    case 'worksites/route.ts':
    case 'worksites/[id]/route.ts': return crudRecord(a, readText, worksitesProfile(a))
    case 'wcb/claims/route.ts':
    case 'wcb/claims/[id]/route.ts': return crudRecord(a, readText, wcbClaimProfile(a))
    case 'wcb/assessments/route.ts':
    case 'wcb/assessments/[id]/route.ts': return crudRecord(a, readText, wcbAssessmentProfile(a))
    default: throw new Error(`no CRUD facts for ${a.route}`)
  }
}

