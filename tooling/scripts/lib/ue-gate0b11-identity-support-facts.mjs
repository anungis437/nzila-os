/**
 * Gate 0B.11 facts: the identity and support surface. Thirteen route files, 24 operations: the satisfaction survey
 * collection, item, representative-performance and ranking routes, the SCIM users route, the security events route, the
 * organization settings route, the steward assignment collection and item routes, the storage cleanup and usage routes and
 * the support metrics and SLA routes. Four of the routes are hand-written (satisfaction, SCIM, settings); the rest are the
 * generic CRUD factory configured over one table each (security_events, steward_assignments, cms_media_library,
 * in_app_notifications). Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it
 * calls, or the resolved schema, and is proved again by the validator. This tranche records the source; it repairs nothing
 * and approves no route.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, LOW_ROLE, CRUD_GOVERNANCE, CRUD_FACTORY, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const SURVEY_CAP = 'UE-OMIT-MEMBER-POLLS-AND-SURVEYS'
const SCIM_CAP = 'UE-OMIT-ENTERPRISE-SSO-IDENTITY-PROVIDERS'
const AUDIT_CAP = 'UE-OMIT-AUDIT-LOG-VISIBILITY'
const ORG_CAP = 'UE-OMIT-ORGANIZATION-ADMINISTRATION'
const MEDIA_CAP = 'UE-OMIT-CONTENT-LIBRARY-EDITORIAL'
const NOTIFY_CAP = 'UE-OMIT-MOBILE-DEVICES-AND-IN-APP-NOTIFICATIONS'
const STEWARD_CAP = 'UE-OMIT-STEWARD-ASSIGNMENT-DIRECTORY'

const GATE = {
  [SURVEY_CAP]: 14,
  [SCIM_CAP]: 14,
  [AUDIT_CAP]: 14,
  [ORG_CAP]: 14,
  [MEDIA_CAP]: 14,
  [NOTIFY_CAP]: 11,
  [STEWARD_CAP]: 14,
}

const D_STEWARD = 'UE-INST-STEWARD-DIRECTORY-AND-APPOINTMENT-AUTHORITY'
const D_SATISFACTION = 'UE-INST-SATISFACTION-RATING-READERS-AND-RESPONDENT-ANONYMITY'
const D_SCIM = 'UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY'
const D_SETTINGS = 'UE-INST-ORGANIZATION-BILLING-AND-REMITTANCE-SETTINGS-AUTHORITY'
const D_SECURITY = 'UE-INST-SECURITY-EVENT-READERS-AND-AUTHORSHIP'
const D_SUPPORT = 'UE-INST-SUPPORT-AND-STORAGE-FIGURES-OWNER'
const D_AUDIT_READERS = 'UE-INST-AUDIT-HISTORY-READERS'
const D_FEDERATION = 'UE-INST-IDENTITY-FEDERATION-ADMINISTRATOR'
const D_ROSTER = 'UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY'
const D_ORG_RECORD = 'UE-INST-ORGANIZATION-RECORD-AUTHORITY'
const D_NOTIFY = 'UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES'
const D_REPRESENTATION = 'UE-INST-REPRESENTATION-AUTHORITY-SOURCE'

const SATISFACTION_SCHEMA = `${APP}db/schema/domains/claims/satisfaction.ts`
const SATISFACTION_SERVICE = `${APP}lib/services/satisfaction-service.ts`
const SATISFACTION_FORM = `${APP}components/satisfaction/satisfaction-survey.tsx`
const RATINGS_PAGE = `${APP}app/[locale]/dashboard/stewards/ratings/page.tsx`
const WORKFLOW_ENGINE = `${APP}lib/workflow-engine.ts`
const SCIM_SCHEMA = `${APP}db/schema/sso-scim-schema.ts`
const ORG_SCHEMA = `${APP}db/schema-organizations.ts`
const ORG_UTILS = `${APP}lib/organization-utils.ts`
const STEWARD_SCHEMA = `${APP}db/schema/union-structure-schema.ts`
const STEWARD_SERVICE = `${APP}lib/services/steward-assignment.ts`
const SECURITY_SCHEMA = `${APP}db/schema/audit-security-schema.ts`
const SECURITY_PAGE = `${APP}app/[locale]/dashboard/security/page.tsx`
const MEDIA_SCHEMA = `${APP}db/schema/cms-website-schema.ts`
const NOTIFICATION_SCHEMA = `${APP}db/schema/notifications-schema.ts`
const CRUD_FACTORY_FILE = `${APP}lib/api/crud-factory.ts`
const ENTITLEMENTS = `${APP}lib/services/entitlements.ts`
const PER_CAPITA = `${APP}services/clc/per-capita-calculator.ts`
const TWILIO = `${APP}services/twilio-sms-service.ts`
const SETTINGS_PLATFORM_UI = `${APP}app/[locale]/dashboard/settings/_components/platform-settings-content.tsx`
const SETTINGS_PAGE = `${APP}app/[locale]/dashboard/settings/page.tsx`

const SAT_ROUTE = `${API}satisfaction/route.ts`
const SAT_ID_ROUTE = `${API}satisfaction/[id]/route.ts`
const SCIM_ROUTE = `${API}scim/v2/[organizationId]/Users/route.ts`
const SETTINGS_ROUTE = `${API}settings/organization/route.ts`
const STEWARDS_ROUTE = `${API}stewards/route.ts`
const SUPPORT_METRICS_ROUTE = `${API}support/metrics/route.ts`
const STORAGE_USAGE_ROUTE = `${API}storage/usage/route.ts`
const SECURITY_ROUTE = `${API}security/events/route.ts`

export const ROUTES = new Set([
  'satisfaction/route.ts',
  'satisfaction/[id]/route.ts',
  'satisfaction/lro/[lroId]/route.ts',
  'satisfaction/rankings/route.ts',
  'scim/v2/[organizationId]/Users/route.ts',
  'security/events/route.ts',
  'settings/organization/route.ts',
  'stewards/route.ts',
  'stewards/[id]/route.ts',
  'storage/cleanup/route.ts',
  'storage/usage/route.ts',
  'support/metrics/route.ts',
  'support/sla/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  IDS_SATISFACTION_SURVEY_LIFECYCLE: {
    capabilityId: SURVEY_CAP,
    domain: 'LRO_SATISFACTION_SURVEY_LIFECYCLE',
    actor: 'Steward creating a satisfaction survey for a claim, and the member who was represented listing, reading, submitting or declining the survey about their representative',
    routes: ['satisfaction/route.ts', 'satisfaction/[id]/route.ts'],
    evidence: [
      ev(SATISFACTION_SCHEMA, "lroId: varchar('lro_id', { length: 255 }).notNull(), // LRO being rated (assignedTo)"),
      ev(SATISFACTION_SCHEMA, "isAnonymous: boolean('is_anonymous').notNull().default(false),"),
      ev(SATISFACTION_FORM, 'Your name will not be visible to your representative'),
      ev(WORKFLOW_ENGINE, '// When a claim is resolved or closed with an assigned LRO, send'),
    ],
  },
  IDS_SATISFACTION_LRO_PERFORMANCE: {
    capabilityId: SURVEY_CAP,
    domain: 'LRO_SATISFACTION_PERFORMANCE_FIGURES',
    actor: 'Steward reading the aggregated satisfaction ratings of one representative or the ranking of every representative of the organization',
    routes: ['satisfaction/lro/[lroId]/route.ts', 'satisfaction/rankings/route.ts'],
    evidence: [
      ev(SATISFACTION_SERVICE, '// Sort by overall average descending'),
      ev(SATISFACTION_SCHEMA, "overallScore: decimal('overall_score', { precision: 3, scale: 2 }),"),
      ev(RATINGS_PAGE, ' * Steward-facing dashboard for viewing LRO performance metrics'),
    ],
  },
  IDS_SCIM_USER_PROVISIONING: {
    capabilityId: SCIM_CAP,
    domain: 'SCIM_USER_LIST_AND_PROVISIONING',
    actor: 'Organization administrator, or the identity provider of the organization, listing the members of the organization in SCIM form and provisioning a new member',
    routes: ['scim/v2/[organizationId]/Users/route.ts'],
    evidence: [
      ev(SCIM_SCHEMA, 'bearerToken: text("bearer_token").notNull(), // Long-lived token for IdP'),
      ev(SCIM_SCHEMA, "deprovisionAction: varchar(\"deprovision_action\", { length: 50 }).default('suspend'), "),
      ev(SCIM_ROUTE, ' * SCIM 2.0 Users endpoint'),
    ],
  },
  IDS_SECURITY_EVENTS: {
    capabilityId: AUDIT_CAP,
    domain: 'SECURITY_EVENT_RECORDS',
    actor: 'Security manager reading the security events of the organization, and the process or person recording a security event',
    routes: ['security/events/route.ts'],
    evidence: [
      ev(SECURITY_SCHEMA, 'severity: varchar("severity", { length: 20 }).notNull(),'),
      ev(SECURITY_SCHEMA, 'additionalData: jsonb("additional_data").default(sql`\'{}\'::jsonb`),'),
      ev(SECURITY_PAGE, '  const hasAccess = await hasMinRole(\'security_manager\');'),
    ],
  },
  IDS_ORGANIZATION_SETTINGS: {
    capabilityId: ORG_CAP,
    domain: 'ORGANIZATION_SETTINGS_PROFILE_AND_JSON',
    actor: 'Organization administrator loading and saving the organization profile (name, short name, region) and the settings JSON on the organization settings and platform settings pages',
    routes: ['settings/organization/route.ts'],
    evidence: [
      ev(PER_CAPITA, "const perCapitaRate = parseFloat(String(orgSettings.perCapitaRate ?? '1.0'));"),
      ev(ENTITLEMENTS, 'const credits = (settings.credits as number) ?? TIER_CREDITS[tier];'),
      ev(SETTINGS_PLATFORM_UI, "// Platform settings are env/config-driven — this persists the"),
    ],
  },
  IDS_STEWARD_ASSIGNMENTS: {
    capabilityId: STEWARD_CAP,
    domain: 'STEWARD_ASSIGNMENT_ROWS_AND_CONTACT_AVAILABILITY',
    actor: 'Member looking for a steward, steward or officer reading the stewards of a unit or worksite, and the office that appoints a steward',
    routes: ['stewards/route.ts', 'stewards/[id]/route.ts'],
    evidence: [
      ev(STEWARD_SCHEMA, "stewardType: stewardTypeEnum('steward_type').notNull(),"),
      ev(STEWARD_SCHEMA, "personalPhone: varchar('personal_phone', { length: 50 }),"),
      ev(STEWARD_SCHEMA, "availabilityNotes: text('availability_notes'),"),
      ev(STEWARD_SERVICE, ' * Assign a steward to a grievance — inserts assignment row'),
    ],
  },
  IDS_STORAGE_MEDIA_LIBRARY: {
    capabilityId: MEDIA_CAP,
    domain: 'STORAGE_USAGE_AND_CLEANUP_OVER_MEDIA_LIBRARY',
    actor: 'Member or steward expecting storage usage figures and a storage cleanup, served the organization media library rows',
    routes: ['storage/cleanup/route.ts', 'storage/usage/route.ts'],
    evidence: [
      ev(MEDIA_SCHEMA, "fileUrl: text('file_url').notNull(),"),
      ev(MEDIA_SCHEMA, "fileSize: integer('file_size').notNull(),"),
      ev(MEDIA_SCHEMA, "uploadedBy: text('uploaded_by').references(() => profiles.userId),"),
    ],
  },
  IDS_SUPPORT_NOTIFICATION_ROWS: {
    capabilityId: NOTIFY_CAP,
    domain: 'SUPPORT_METRICS_AND_SLA_OVER_IN_APP_NOTIFICATIONS',
    actor: 'Support or union staff expecting support metrics and service-level figures, served the in-app notification rows of the organization',
    routes: ['support/metrics/route.ts'],
    evidence: [
      ev(NOTIFICATION_SCHEMA, "actionUrl: text('action_url'),"),
      ev(NOTIFICATION_SCHEMA, "message: text('message').notNull(),"),
      ev(NOTIFICATION_SCHEMA, "type: text('type').notNull().default('info'), // info, success, warning, error"),
    ],
  },
  IDS_SUPPORT_SLA_NOTIFICATION_ROWS: {
    capabilityId: NOTIFY_CAP,
    domain: 'SUPPORT_METRICS_AND_SLA_OVER_IN_APP_NOTIFICATIONS',
    actor: 'Support or union staff expecting support metrics and service-level figures, served the in-app notification rows of the organization',
    routes: ['support/sla/route.ts'],
    methods: ['GET'],
    evidence: [
      ev(NOTIFICATION_SCHEMA, "actionUrl: text('action_url'),"),
      ev(NOTIFICATION_SCHEMA, "message: text('message').notNull(),"),
      ev(NOTIFICATION_SCHEMA, "type: text('type').notNull().default('info'), // info, success, warning, error"),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_STEWARD,
    status: 'OUTSTANDING',
    question: 'Which office appoints, confirms and ends a steward of an organization, which of the fields held about a steward (type, unit and worksite coverage, tenure, appointer, work phone, personal phone, preferred contact method, availability notes, notes and the grievance a case-based assignment points at) may a member who is not a steward read, which may only stewards and officers read, and does an assignment row, the organization role title steward or the kernel mandate decide who acts as a steward?',
    sourceState: 'The steward routes read steward_assignments at the member floor with every column and refuse every write through the CRUD governance list; the only code that inserts an assignment row is assignSteward in the steward assignment service, which no route calls, and the organization role steward lives on organization_members, which no steward route reads or changes. No source names the appointing office, the readable fields or the relation between an assignment row, a role title and a mandate.',
    softwareOwners: [STEWARD_CAP],
  },
  {
    id: D_SATISFACTION,
    status: 'OUTSTANDING',
    question: 'Which offices may read the satisfaction ratings that members give their representative (an individual representative, the ranking of every representative, the free text), is a rating published when only one or two members have answered, and does a member who asks to answer anonymously stay unidentifiable to the representative and to the stewards who read the figures?',
    sourceState: 'The performance and ranking routes return per-representative averages at the steward floor with no minimum number of responses; the survey form tells the member that their name will not be visible to the representative, the route stores the anonymity flag on the row, and no query or route reads the flag. No source names the readers, a publication threshold or the anonymity rule.',
    softwareOwners: [SURVEY_CAP],
  },
  {
    id: D_SCIM,
    status: 'OUTSTANDING',
    question: 'Which credential does an identity provider present to provision users into an organization (a long-lived bearer token held by whom, with what expiry and rotation), which identity attribute (userName, external id or subject) is the stable key of a provisioned person, what does a deprovision do (suspend, archive or delete the membership), which provider groups may confer which organization role, and who may read the provisioning log?',
    sourceState: 'The SCIM users route authenticates a browser session and requires the administrator floor; the scim_configurations table with a bearer token, an expiry, a deprovision action and a user attribute mapping, and the scim_events_log table, exist, and the route reads neither; provisioning stores the userName string as the membership user id with the role member. No source names the credential, the key, the deprovision rule or the group-to-role mapping.',
    softwareOwners: [SCIM_CAP],
  },
  {
    id: D_SETTINGS,
    status: 'OUTSTANDING',
    question: 'Which of the keys held in the settings JSON of an organization (the per-capita rate and remittance day that set what it owes its parent body, the credit balance and renewal date that meter its use of metered features, the telephone number by which inbound text messages are attributed to it, branding, security policy and integration values) may the administrator of that organization write, which keys may only the platform operator or the parent body write, and which values must the software enforce when it saves them?',
    sourceState: 'The organization settings route merges any object the administrator sends into the settings JSON with no key allow-list, and other code reads the same JSON as a remittance rate, a credit ledger and an inbound telephone number key; the page that saves multi-factor, session timeout and password policy values writes them to the same JSON and no code reads them to enforce anything. No source names which keys the administrator owns or which values are enforced.',
    softwareOwners: [ORG_CAP],
  },
  {
    id: D_SECURITY,
    status: 'OUTSTANDING',
    question: 'Which offices may read the security events of an organization (authentication, authorization, data access, configuration and suspicious activity, with the source address and user agent), may a person or a process other than the platform record or resolve an event, and how is an event shown not to have been authored or edited by the person it concerns?',
    sourceState: 'The security events route is configured at the security manager floor for reads and writes, and the CRUD governance list denies the table, so every call answers 403; the only reader is the security dashboard page, which checks the security manager role and reads the table with SQL under a system context. No source names the readers, the authors or the integrity rule.',
    softwareOwners: [AUDIT_CAP],
  },
  {
    id: D_SUPPORT,
    status: 'OUTSTANDING',
    question: 'Which office owns the support desk figures (ticket metrics, response and resolution time against a service-level target) and the storage figures (bytes used, quota and the cleanup of files nobody references) of an organization, which stored records are the source of each figure, and who may read them and trigger a cleanup that removes files?',
    sourceState: 'The support metrics and SLA routes read and insert in_app_notifications rows and compute nothing; the storage usage and cleanup routes read and insert cms_media_library rows, sum no file size and delete no file; no route reads a ticket, service-level or storage quota table; getTicketMetrics and getSLAMetrics in the support service compute ticket and SLA figures from support_tickets and no route calls them. No source names the owner, the source records or the readers.',
    softwareOwners: [NOTIFY_CAP, MEDIA_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: STEWARD_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'steward-assignment-directory-and-appointment',
    primaryGate: 14,
    dependencyGates: [6, 10, 13],
    actor: 'Member looking for a steward, steward or officer reading the stewards of a unit or worksite, and the office that appoints, confirms and ends a steward',
    businessOutcome: 'A steward assignment names who is the steward for a unit or worksite and for how long, the appointing office is recorded, a member reads only the contact fields the institution allows a member to read, a steward assignment is created, changed and ended only by the office the institution names and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/stewards',
    service: `${APP}lib/services/steward-assignment.ts`,
    sourceFiles: [
      `${APP}app/api/stewards/route.ts`,
      `${APP}app/api/stewards/[id]/route.ts`,
      `${APP}db/schema/union-structure-schema.ts`,
      `${APP}lib/services/steward-assignment.ts`,
      `${APP}lib/api/crud-governance.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/stewards/route.ts` }],
    auditEvidence: 'The steward routes write nothing: the CRUD governance list refuses every write to steward_assignments before a row or an audit record exists. The steward assignment service inserts an assignment row and updates a caseload counter with the shared database handle and writes no audit record; no route calls it. Reads are not audited.',
    privacyClassification: 'Steward id, steward type, coverage unit, worksite, department, shift, floor and area, tenure and election dates, appointer, training and certification dates, work phone, personal phone, preferred contact method, availability notes, free-text notes and the id of the grievance a case-based assignment points at. A personal telephone number and availability notes of a union representative, and a grievance link on a row a member can list.',
    gap: 'UE-OMIT-STEWARD-CANONICAL-ABSENT (gate 10) records that no steward canonical or steward action-identifier matrix exists; it has no source files and owns no route, so it cannot own the steward routes. UE-OMIT-REPRESENTATION-PROTOCOL-POLICY owns the draft-and-approve representation protocol and the case assignment engine, not the steward directory rows; UE-OMIT-COMMITTEE-WORKSPACE owns committee meetings, minutes and action items; UE-OMIT-ORGANIZATION-ADMINISTRATION owns the organization record and the roster of organization_members (the table that holds the role title steward), and the steward_assignments table is a separate table that no roster route reads; UE-CAP-K-007 owns the generic CRUD factory as a mechanism, not the domain meaning of a table it is configured over; and UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Two route files, stewards and stewards/[id], read the steward_assignments table at the member floor and are configured at the steward write floor, and no existing capability names the steward assignment rows. This record closes none of the gaps and names no appointing office, which no source states.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE[ownerCapabilityId], severity, title, ...extra })

const FACTORY_TENANT = 'conditions.push(eq(orgCol, organizationId));'

const SAT_ANON = 'DEF-0B11-IDS-SATISFACTION-ANONYMITY-FLAG-IS-STORED-AND-NEVER-READ-WHILE-THE-FORM-PROMISES-THE-NAME-IS-HIDDEN'
const SAT_THRESHOLD = 'DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-HAVE-NO-MINIMUM-RESPONSES-AND-ARE-READ-BY-EVERY-STEWARD-FOR-ANY-REPRESENTATIVE-ID'
const SAT_ZERO = 'DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-FOR-AN-UNKNOWN-OR-UNRATED-ID-ARE-200-WITH-ZERO-AVERAGES'
const SAT_CREATE = 'DEF-0B11-IDS-SATISFACTION-CREATE-DOES-NOT-CHECK-CLAIM-STATE-AND-ACCEPTS-ANY-REPRESENTATIVE-ID-ON-AN-UNASSIGNED-CLAIM'
const SAT_PENDING = 'DEF-0B11-IDS-SATISFACTION-PENDING-LIST-HAS-NO-ORGANIZATION-PREDICATE'
const SCIM_NO_BEARER = 'DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION-AND-READS-NO-SCIM-CONFIGURATION'
const SCIM_LIST = 'DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS-ACTIVE-AND-READS-THE-WHOLE-ROSTER-BEFORE-PAGING'
const SCIM_PROVISION = 'DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID-AND-ACTIVATES-WITHOUT-ACCEPTANCE'
const SCIM_BODY = 'DEF-0B11-IDS-SCIM-PROVISION-BODY-IS-UNVALIDATED-AND-MALFORMED-INPUT-IS-A-500'
const SET_KEYS = 'DEF-0B11-IDS-SETTINGS-PUT-MERGES-ANY-KEY-INTO-THE-JSON-THAT-HOLDS-THE-CREDIT-LEDGER-AND-THE-PER-CAPITA-RATE'
const SET_UNENFORCED = 'DEF-0B11-IDS-SETTINGS-SECURITY-POLICY-VALUES-ARE-SAVED-AS-UPDATED-TRUE-AND-ENFORCED-BY-NO-CODE'
const SET_BODY = 'DEF-0B11-IDS-SETTINGS-PUT-IS-UNVALIDATED-AND-MERGES-OUTSIDE-THE-TRANSACTION'
const SET_TWILIO = 'DEF-0B11-IDS-SETTINGS-TWILIO-NUMBER-KEY-ATTRIBUTES-INBOUND-SMS-WITH-NO-UNIQUENESS'
const SEC_DENIED = 'DEF-0B11-IDS-SECURITY-EVENTS-ROUTE-IS-CONFIGURED-FOR-SECURITY-MANAGER-AND-DENIED-FOR-EVERY-CALLER'
const STEWARD_READ = 'DEF-0B11-IDS-STEWARD-ASSIGNMENT-ROWS-READABLE-BY-ANY-MEMBER-WITH-PERSONAL-PHONE-NOTES-AND-GRIEVANCE-LINK'
const STEWARD_FACADE = 'DEF-0B11-IDS-STEWARD-ROUTES-SERVE-ASSIGNMENT-ROWS-AND-NO-ROUTE-APPOINTS-OR-ENDS-A-STEWARD'
const STEWARD_WRITE = 'DEF-0B11-IDS-STEWARD-ROUTES-ARE-CONFIGURED-AT-THE-STEWARD-WRITE-FLOOR-AND-REFUSED-ONLY-BY-THE-GOVERNANCE-LIST'
const STORAGE_FACADE = 'DEF-0B11-IDS-STORAGE-USAGE-AND-CLEANUP-ROUTES-SERVE-MEDIA-LIBRARY-ROWS-AND-COMPUTE-OR-DELETE-NOTHING'
const STORAGE_POST = 'DEF-0B11-IDS-STORAGE-POST-INSERTS-A-CALLER-WRITTEN-MEDIA-ROW-WITH-ANY-FILE-URL-SIZE-AND-UPLOADER'
const SUPPORT_FACADE = 'DEF-0B11-IDS-SUPPORT-METRICS-AND-SLA-ROUTES-SERVE-NOTIFICATION-ROWS-NOT-SUPPORT-FIGURES'
const SUPPORT_READ = 'DEF-0B11-IDS-SUPPORT-READ-GIVES-EVERY-STEWARD-THE-NOTIFICATIONS-OF-EVERY-MEMBER'
const SUPPORT_POST = 'DEF-0B11-IDS-SUPPORT-METRICS-POST-LETS-A-STEWARD-STORE-A-NOTIFICATION-FOR-ANY-USER-ID-WITH-A-LINK-AND-NO-SENDER'
const CRUD_MASS = 'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'

export const DEFECTS = [
  D(STEWARD_READ, STEWARD_CAP, 'HIGH',
    'Every GET over steward_assignments (the stewards collection and the stewards/[id] item) is configured at readRole member, and the table has no user, member, email or phone column by those names (its contact columns are workPhone, personalPhone, preferredContactMethod and availabilityNotes), so the low-role guard opens the read: any member of the organization, not only a steward or officer, receives the steward assignment rows with the personal phone number, work phone number, preferred contact method, availability notes, free-text notes, the grievance id of a case-based assignment, the appointer, tenure and training dates, and the unit, worksite and shift coverage, with no field projection and no read audit.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any member of an organization, whatever their role, calls GET /api/stewards or GET /api/stewards/<id>: readRole is member, the generic factory scopes the rows to the session organization and, because steward_assignments has none of the owner or personal column names the low-role guard looks for, applies no owner condition, and it returns the whole row (up to 100 per page) including personal_phone, availability_notes, notes and grievance_id.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'A member, including one who is the subject of a grievance the steward handles, reads the personal telephone number and availability notes of every steward and the grievance each case-based assignment is linked to; a steward who gave a work number to members has also given every member a personal number and free-text notes, and the grievance link reveals which member or case a steward is assigned to.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [{ ref: STEWARDS_ROUTE, quote: "readRole: 'member'," }],
        existingContainment: {
          summary: 'The factory adds an organization predicate from the session organization, so only the rows of the caller own organization are read; nothing narrows them to a steward, an officer, a coverage area or a set of permitted fields, so the exposure is every steward row of the organization to every member.',
          evidence: [{ ref: CRUD_FACTORY_FILE, quote: FACTORY_TENANT }],
        },
        justification: 'The routes serve personal contact data and free-text notes about a union representative, and a grievance link, to every authenticated member at the lowest role floor with no field projection; the tenant predicate keeps other organizations out but does not limit a same-organization reader, and no source establishes that members are the intended audience of the personal phone, the notes or the grievance link, so the read blocks release until the institution names the readers and the permitted fields.',
      },
    }),
  D(STEWARD_FACADE, STEWARD_CAP, 'MEDIUM',
    'The stewards and stewards/[id] routes are crudRoutes over steward_assignments: GET returns assignment rows, POST, PATCH and DELETE are refused with 403 because the governance list holds the table read-only, no other route appoints, confirms or ends a steward, and the only code that inserts an assignment row is assignSteward in the steward assignment service (a grievance assignment that sets the type to steward, writes no audit record and bumps a caseload counter on the separate stewards table) which no route calls, so the route names promise a steward directory with appointment and the source offers a read of per-case assignment rows and no way to create the directory.',
  ),
  D(STEWARD_WRITE, STEWARD_CAP, 'MEDIUM',
    'The stewards collection and item routes configure writeRole steward over steward_assignments and the item route exports PATCH and DELETE with no blocked fields; the only thing that stops a steward from creating, rewriting or archiving any steward assignment (type, appointer, tenure, coverage, notes) is the presence of steward_assignments in the READ_ONLY list of the CRUD governance file, so a role title at the steward floor would become the authority to appoint stewards the moment that list changes.'),
  D(SAT_ANON, SURVEY_CAP, 'MEDIUM',
    'The survey form tells the member that submitting anonymously means their name will not be visible to their representative, and the submit route stores isAnonymous on the survey row, but no query, service function or route reads the flag: the survey row keeps member_id and the rating and the free text whatever the flag says, the representative performance and ranking routes aggregate anonymous and named responses together, and a representative with one completed survey is returned that one response as an average, so an anonymous response is not anonymous to a steward who knows which claim the representative handled.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(SAT_THRESHOLD, SURVEY_CAP, 'MEDIUM',
    'GET /api/satisfaction/lro/<lroId> returns the six rating averages, the overall average and the recommend rate of any representative id the steward types in, and GET /api/satisfaction/rankings returns and ranks every representative of the organization who has a completed survey, at the steward floor, with no minimum number of responses, no check that the id is a representative of the organization or the caller, no control over which steward may read the performance of which representative, and no read audit.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(SAT_ZERO, SURVEY_CAP, 'MEDIUM',
    'getLroPerformance turns a null average into zero (n = parseFloat(v ?? 0)) and computes the overall average as the mean of six values that may all be zero, so GET /api/satisfaction/lro/<lroId> for an id that is not a representative, or that has no completed survey in the organization, answers 200 with totalSurveys 0, six averages of 0, an overall average of 0 and a recommend rate of 0, which reads as a representative rated 0 out of 5 and not as no data.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(SAT_CREATE, SURVEY_CAP, 'MEDIUM',
    'POST /api/satisfaction (described in its header as an administrator action and in its OpenAPI text as creating a survey for a closed claim) is configured at the steward floor and selects only memberId and assignedTo from the claim: it never reads the claim status, so a survey can be created for an open claim, and when the claim has no assignedTo the lroId in the body is accepted as any string with no check that it names a representative of the organization, so a survey can be created that asks the member to rate a person who did not handle the claim.'),
  D(SAT_PENDING, SURVEY_CAP, 'LOW',
    'GET /api/satisfaction passes only the session user id to getPendingSurveys, which filters satisfaction_surveys on member_id and status pending with no organization predicate and returns the whole rows, so a person who is a member of two organizations receives the pending surveys of both (claim id, representative id, sent time) whichever organization the session is acting in.'),
  D(SCIM_NO_BEARER, SCIM_CAP, 'MEDIUM',
    'The SCIM 2.0 users route authenticates only a browser session at the administrator floor (withApi auth required, minRole admin) and reads neither scim_configurations (bearer token, token hash, expiry, enabled flag, deprovision action, attribute mapping) nor scim_events_log, so an identity provider that presents the long-lived bearer token the schema describes cannot call it, no token is issued, checked, expired or rotated by any route, no SCIM provisioning event is logged, and the route offers only list and create with no get, replace, patch or delete of a user, no groups and no service provider configuration, so a deprovision cannot be sent at all.'),
  D(SCIM_LIST, SCIM_CAP, 'MEDIUM',
    'GET /api/scim/v2/<organizationId>/Users selects every organization_members row of the organization with no deleted_at and no status condition, slices the page in memory after loading the whole roster, and maps active to member.status equal to active alone, so a member who was removed (deleted_at set) while the status column still reads active is listed and reported as an active user with name and e-mail address, a count that is not a number (count=abc) makes the slice end NaN and the page empty, and a count of zero or less is accepted.'),
  D(SCIM_PROVISION, SCIM_CAP, 'MEDIUM',
    'POST /api/scim/v2/<organizationId>/Users inserts an organization_members row whose user_id is the userName string from the body (the membership key that getUserRoleInOrganization matches against the session user id), with the e-mail taken from the body, the role fixed to member and the status active immediately: the identity provider subject is never read, the person does not accept, the userName may be any string including the identifier of an existing user of another organization (who is then made an active member of this one), and a provisioned person whose session user id differs from the userName string can never match the row, while a removed member with the same user id answers 409 as an existing user.'),
  D(SCIM_BODY, SCIM_CAP, 'LOW',
    'The SCIM create route reads the body with an unguarded request.json() and a type cast instead of a schema: malformed JSON or an emails value that is not an array raises a plain error that withApi answers as a 500, a userName that is not a string passes the presence check and reaches the insert, and no length or format bound is applied to userName, name or e-mail.'),
  D(SET_KEYS, ORG_CAP, 'HIGH',
    'PUT /api/settings/organization merges whatever object the administrator sends as body.settings, with no key allow-list and no value validation, into the organizations.settings JSON that other code reads as authority: services/clc/per-capita-calculator reads settings.perCapitaRate (an organization with a rate of 0 or less is skipped) and settings.remittanceDay to compute the per-capita amount an organization with a parent owes that parent, lib/services/entitlements reads settings.credits and settings.nextCreditRenewal as the credit balance that checkEntitlement tests before a credit-requiring AI feature, and the twilioPhoneNumber key attributes inbound text messages, so an organization administrator can set their own remittance rate and day, credit balance and renewal date directly, and the audit row lists only the names of the fields written (settings, name, shortName, provinceTerritory), never a value.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'An administrator of any organization (minRole admin) sends PUT /api/settings/organization with {"settings":{"perCapitaRate":"0.01","credits":1000000}}: the route merges the object into the stored settings JSON of the session organization in a tenant transaction and commits an organization.settings_update audit row that names the field settings but not the values, and the per-capita calculator and the entitlement check read those keys back on their next call.',
        potentialImpact: {
          classes: ['FINANCIAL_INTEGRITY', 'UNAUTHORIZED_MUTATION'],
          description: 'An organization administrator can lower or zero the per-capita rate (a rate of 0 removes the organization from the monthly remittance run, a low rate shrinks the amount computed as owed to its parent body) and can set the credit balance and renewal date that the entitlement check reads, so the parent body and the platform operator, who are not the writer, receive an amount the software computed from a value the payer wrote; the audit row does not record the values, so the change cannot be reconstructed.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [{ ref: SETTINGS_ROUTE, quote: "{ auth: { required: true, minRole: 'admin' } }," }],
        existingContainment: {
          summary: 'The caller must hold the administrator role and the update is scoped to the organization id of the session, so one organization cannot write another organization row; nothing limits which keys the administrator writes or which organization reads them for billing and remittance.',
          evidence: [{ ref: SETTINGS_ROUTE, quote: '.where(eq(sql`${organizations.id}::text`, orgId));' }],
        },
        justification: 'The remittance amount lands on a party other than the writer (the parent body that the per-capita calculator remits to) and is reached by one administrator request with no allow-list, no value validation and no value in the audit record; the administrator role floor limits who can do it but not what it affects, the monthly job that reads the rate is source that runs for every organization with a parent, and no source names the administrator as the owner of the remittance rate or the credit balance, so the route blocks release until the keys the administrator may write are decided and enforced.',
      },
    }),
  D(SET_UNENFORCED, ORG_CAP, 'MEDIUM',
    'The platform settings page saves sessionTimeout, mfaEnforcement, passwordMinLength, requireMixedCase, requireSymbol, rateLimitPerMin and webhookUrl into the organization settings JSON through this route, which answers {updated:true}, and the settings page reads them back with defaults (mfaEnforcement admins_only, passwordMinLength 12), but no authentication, session, password, rate-limit or notification code found in the application reads those keys, so an administrator who sets multi-factor enforcement or a password policy is told the setting is saved while nothing enforces it.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(SET_BODY, ORG_CAP, 'MEDIUM',
    'PUT /api/settings/organization takes the body without a schema, accepts an empty string or an unbounded string as name, shortName and provinceTerritory, reads the current settings JSON with the shared database handle outside the transaction that writes the merge (so two concurrent saves overwrite each other keys), answers a missing body or organization as a plain error that withApi turns into a 500, and GET answers 200 with organization null for an organization row that does not exist.'),
  D(SET_TWILIO, ORG_CAP, 'MEDIUM',
    'handleInboundSms attributes an inbound text message to the organization whose settings JSON holds the called number under twilioPhoneNumber, selecting with limit 1 and no ordering or uniqueness, and the organization settings route lets any organization administrator write that key, so an administrator who stores the number of another organization makes the lookup ambiguous and the inbound message body and sender number can be stored in the conversation table of the wrong organization.'),
  D(SEC_DENIED, AUDIT_CAP, 'LOW',
    'The security events route is configured for readRole and writeRole security_manager with a header comment that describes a privileged reader and a closed forgery path, but security_events is in the DENIED list of the CRUD governance file, so assertCrudRead and assertCrudWrite answer 403 to every caller including a security manager; the privileged reader of the table is the security dashboard page, which checks hasMinRole security_manager and reads the table with SQL under a system context, so the API the comment describes does not exist and the integrity rule for who may author a security event is held only by the governance list.'),
  D(STORAGE_FACADE, MEDIA_CAP, 'MEDIUM',
    'The storage/usage and storage/cleanup routes are crudRoutes over cms_media_library: GET returns the media library rows of the organization (file name, file url, type, size, folder, tags, uploader) at the member floor, and neither route sums file sizes, reads a quota, compares a file with the references to it or deletes anything, so a caller expecting storage usage receives a page of rows and a caller expecting a cleanup triggers none; the cms_media_library table is read and written by no code other than these two routes and the upload route.',
  ),
  D(STORAGE_POST, MEDIA_CAP, 'MEDIUM',
    'POST /api/storage/usage and POST /api/storage/cleanup insert a cms_media_library row from the whole request body at the steward floor: no file is received or checked, so file_url (any string, including an external address), file_size, mime_type, uploaded_by (any profile user id) and folder are whatever the caller writes, and a library entry can point at a file that does not exist, at an address outside the application storage, or be attributed to another person.'),
  D(SUPPORT_FACADE, NOTIFY_CAP, 'MEDIUM',
    'The support/metrics and support/sla routes are crudRoutes over in_app_notifications: GET returns notification rows (user id, title, message, type, action label and url, data, read flag) and POST inserts one, and no route reads or computes a ticket count, response time, resolution time or service-level figure, so a caller expecting support metrics or SLA compliance receives unrelated notification rows; the figures themselves are computed by getTicketMetrics and getSLAMetrics in the support service over support_tickets, and no route calls that service.',
  ),
  D(SUPPORT_READ, NOTIFY_CAP, 'MEDIUM',
    'GET /api/support/metrics and GET /api/support/sla hold a caller below steward to their own in_app_notifications rows, but any steward or higher role reads the notifications of every user of the organization (title, message, action url and the data object), unbounded by any relationship to the recipient and without a read audit, so notifications that name a member, a case or a grievance are readable beyond the member they were addressed to.',
  ),
  D(SUPPORT_POST, NOTIFY_CAP, 'MEDIUM',
    'POST /api/support/metrics copies the body into an in_app_notifications row at the steward floor with no check that the user id is a member of the organization (the sibling POST /api/notifications makes that check), with a caller-written title, message and action url and no sender stored, so a steward can store a notification with an arbitrary link for any user id string and it appears to the recipient as a message of the application.'),
]

const future = {
  satGet: 'Filter the pending list by the session organization as well as the member, and return a projection that omits the representative id until the institution decides a member may see it.',
  satPost: 'Create a survey only for a claim in a closed or resolved state, require the representative id to be the claim assignee or a representative of the organization, and keep the in-transaction audit record.',
  satItem: 'Keep the owner and organization conditions and the in-transaction audit, validate the survey state transition in one place and honour the anonymity flag in every read of a response.',
  satPerformance: 'Decide who may read the ratings of a representative, publish a figure only above a minimum number of responses, exclude or aggregate anonymous responses by the anonymity rule, answer 404 for an id that is not a representative and audit the read.',
  scim: 'Authenticate the identity provider by a stored, hashed and expiring bearer token read from scim_configurations, key a provisioned person by the identity provider subject, add get, patch and delete (deprovision) with the configured action, log each event in scim_events_log, exclude removed members from the list and validate the body with a schema.',
  settingsGet: 'Return only the settings keys the institution allows an administrator to read and keep secrets out of the response.',
  settingsPut: 'Accept only an allow-list of settings keys, validate each value, route remittance and credit values through the offices that own them, merge inside the transaction with a row lock and write the changed values to the audit record.',
  security: 'Decide the readers and authors of security events, serve them through a dedicated authority-checked route that audits each read, keep events append-only and refuse any author who is the subject of the event.',
  steward: 'Decide who may read which steward fields, project a member-safe directory (name, type, coverage and the work contact the steward chose to publish) and keep the personal phone, notes and grievance link to the officers who need them, build an appointment route owned by the appointing office with an audit record, or answer 501 until it exists.',
  storage: 'Either compute usage from the stored files and delete only unreferenced files under an authority the institution names with an audit record, or answer 501 for both routes; never insert a library row from a client-written body.',
  support: 'Either read support and service-level records under an owner the institution names, or answer 501 and remove the paths; keep notifications on the notification routes with a recipient check and a stored sender.',
}

/* ------------------------------------------------------------------------------------------------------------ */
/* satisfaction                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const SURVEY_SENS = 'Claim id, member id, representative id, survey status, six ratings, overall score, free-text feedback, recommend flag, anonymity flag, sent and completed times'

const satisfactionBase = (a) => ({
  service: `${a.routeFile} (withApi, ${SATISFACTION_SERVICE})`,
  authn: `${SESSION} (withApi, auth required).`,
  gate: GATE[SURVEY_CAP],
  deps: [6, 13],
  corr: [],
})

function satisfactionList(a) {
  return mk({
    ...satisfactionBase(a),
    persona: 'Member of the organization (any role) listing the satisfaction surveys that are waiting for their answer',
    authz: 'withApi with minRole member: any signed-in member. The handler passes only the session user id to the service; the organization is not used. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No organization predicate: getPendingSurveys filters satisfaction_surveys on member_id equal to the session user id and status pending only, through the shared database handle, so the rows of every organization of the caller are returned.',
    owner: 'satisfaction_surveys rows addressed to the caller (member_id equals the session user id) in any organization.',
    sens: SURVEY_SENS,
    priv: 'The caller receives their own pending survey rows, including the representative id and claim id, from every organization they belong to; no other person row is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of a member own survey rows need no audit record.',
    does: 'Returns the pending survey rows of the session user, newest first, with a count.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: future.satGet,
    dec: [D_SATISFACTION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('tenantScope', 'const surveys = await getPendingSurveys(userId!);'),
      a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.memberId, memberId),', 'getPendingSurveys'),
      a.h('mutation', 'return { surveys, count: surveys.length };'),
      a.svc('behavior', SATISFACTION_SERVICE, "eq(satisfactionSurveys.status, 'pending')", 'getPendingSurveys'),
      a.sch('privacy', SATISFACTION_SCHEMA, "lroId: varchar('lro_id', { length: 255 }).notNull(), // LRO being rated (assignedTo)", { resolvesExport: 'satisfactionSurveys' }),
      a.svc('defect', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.status, \'pending\')', 'getPendingSurveys'),
    ],
    inf: [
      { claim: 'defect', statement: 'getPendingSurveys takes the member id alone and has no organization argument, and satisfaction_surveys carries an organization_id column, so the organization of the session is not part of the query.' },
    ],
    def: [SAT_PENDING],
  })
}

function satisfactionCreate(a) {
  return mk({
    ...satisfactionBase(a),
    persona: 'Steward creating a satisfaction survey for a member who was represented on a claim',
    authz: 'withApi with minRole steward and a zod body (claim id, member id, representative id): any steward of the organization. The handler additionally requires that the claim belongs to the session organization, that the member in the body is the claim member and, when the claim has an assignee, that the representative in the body is that assignee. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The claim is read under withRLSContext with an explicit organization predicate (claims.organizationId equals the session organization) and the survey is created with the session organization id; the service re-checks the existing survey by organization, claim and member.',
    owner: 'A new satisfaction_surveys row for the claim member in the session organization; the audit row is owned by the organization.',
    sens: SURVEY_SENS,
    priv: 'The response returns the created survey row, naming the claim, the member and the representative; the audit row records the claim id and representative id and not any rating.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The survey insert and the satisfaction.survey.create audit row (persistAtomicAudit on the transaction handle of the service db.transaction) commit together; an existing survey for the claim and member is returned without a second write or audit row.',
    reqAudit: 'Keep the in-transaction audit row and add the authorizing mandate of the steward who created the survey.',
    does: 'Requires a user and organization, reads the claim by id and organization, answers 404 when it is absent, 400 when the member is not the claim member or the representative is not the assignee, then inserts a pending survey (or returns the existing one) and writes the audit row, answering 201.',
    status: 'PARTIAL',
    future: future.satPost,
    dec: [D_SATISFACTION, D_REPRESENTATION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
      a.h('authorization', 'if (claim.memberId !== body.memberId) {'),
      a.h('tenantScope', 'const [claim] = await withRLSContext({ organizationId }, (tx) =>'),
      a.h('tenantScope', '.where(and(eq(claims.id, body.claimId), eq(claims.organizationId, organizationId)))'),
      a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.organizationId, data.organizationId),', 'createSatisfactionSurvey'),
      a.h('mutation', 'const survey = await createSatisfactionSurvey('),
      a.svc('mutation', SATISFACTION_SERVICE, '.insert(satisfactionSurveys)', 'createSatisfactionSurvey'),
      a.svc('audit', SATISFACTION_SERVICE, 'await persistAtomicAudit(tx as unknown as RLSTx, {', 'createSatisfactionSurvey'),
      a.svc('audit', SATISFACTION_SERVICE, "action: 'satisfaction.survey.create',", 'createSatisfactionSurvey'),
      a.h('behavior', 'if (claim.assignedTo && claim.assignedTo !== body.lroId) {'),
      a.h('defect', '.select({ memberId: claims.memberId, assignedTo: claims.assignedTo })'),
      a.h('defect', 'lroId: z.string().min(1),'),
    ],
    inf: [
      { claim: 'defect', statement: 'lib/workflow-engine.ts creates the automatic survey through createSatisfactionSurvey when a claim is resolved or closed and the claim has both a member and an assignee, and it passes the claim assignee as the representative; the manual route reproduces none of those conditions.' },
      { claim: 'defect', statement: 'The route header calls the POST an administrator action and the route enforces the steward floor; the claim select lists memberId and assignedTo and no status column, so nothing in the route compares the claim state with closed or resolved, while the workflow engine creates the automatic survey only when a claim is resolved or closed with an assignee.' },
    ],
    def: [SAT_CREATE],
  })
}

function satisfactionItemGet(a) {
  return mk({
    ...satisfactionBase(a),
    persona: 'Member opening one of the satisfaction surveys addressed to them',
    authz: 'withApi with minRole member and an owner condition in the service: the survey is returned only when its member_id equals the session user id and its organization equals the session organization; any other id answers 404. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'getOwnSatisfactionSurvey filters by survey id, member id and organization id, so a path id of another member or another organization resolves to no row.',
    owner: 'The satisfaction_surveys row addressed to the caller in the session organization.',
    sens: SURVEY_SENS,
    priv: 'The caller receives their own survey row in full (ratings, feedback, representative id, anonymity flag); no row of another person is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of a member own survey need no audit record.',
    does: 'Requires a user and organization, reads the survey by id, member and organization, answers 404 when absent and returns the row.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: future.satItem,
    dec: [D_SATISFACTION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('tenantScope', 'const survey = await getOwnSatisfactionSurvey(params.id, userId, organizationId);'),
      a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.memberId, memberId),', 'getOwnSatisfactionSurvey'),
      a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.organizationId, organizationId)', 'getOwnSatisfactionSurvey'),
      a.h('mutation', 'return survey;'),
      a.sch('privacy', SATISFACTION_SCHEMA, "feedback: text('feedback'),", { resolvesExport: 'satisfactionSurveys' }),
    ],
    def: [],
  })
}

function satisfactionItemPost(a) {
  return mk({
    ...satisfactionBase(a),
    persona: 'Member submitting the six ratings of their representative, or declining the survey',
    authz: 'withApi with minRole member and a zod body (action, six ratings of 1 to 5, feedback up to 2000 characters, recommend flag, anonymity flag); the service refuses a survey whose member is not the session user or whose organization differs (answered 404) and a survey that is no longer pending (answered 409). A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The survey is read by id and compared with the session organization in code, and the update is conditioned on the survey id, the member id, the survey organization id and a pending or sent status.',
    owner: 'The satisfaction_surveys row addressed to the caller; the audit row is owned by the survey organization.',
    sens: SURVEY_SENS,
    priv: 'The caller own survey row is updated and returned in full; the audit row names the claim id and not the ratings or the free text.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The rating (or decline) update and the satisfaction.survey.submit (or .decline) audit row commit in one service db.transaction through persistAtomicAudit; the audit lists the claim id only.',
    reqAudit: 'Keep the in-transaction audit row.',
    does: 'Declines the survey, or requires all six ratings and stores them with the mean overall score, the free text, the recommend flag and the anonymity flag, completes the survey and writes the audit row; an unknown or foreign survey answers 404 and a finished one 409.',
    status: 'PARTIAL',
    future: future.satItem,
    dec: [D_SATISFACTION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'member' },"),
      a.h('authorization', 'action: z.enum([\'submit\', \'decline\']).default(\'submit\'),'),
      a.h('tenantScope', 'return await declineSurvey(params.id, userId, organizationId).catch(surveyRefusal);'),
      a.svc('tenantScope', SATISFACTION_SERVICE, "if (!survey || (organizationId && survey.organizationId !== organizationId)) throw new Error('Survey not found');", 'submitSatisfactionRatings'),
      a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.organizationId, survey.organizationId),', 'submitSatisfactionRatings'),
      a.h('mutation', 'return await submitSatisfactionRatings(params.id, userId, {'),
      a.svc('mutation', SATISFACTION_SERVICE, '.update(satisfactionSurveys)', 'submitSatisfactionRatings'),
      a.svc('mutation', SATISFACTION_SERVICE, "status: 'completed',", 'submitSatisfactionRatings'),
      a.svc('audit', SATISFACTION_SERVICE, 'await persistAtomicAudit(tx as unknown as RLSTx, {', 'submitSatisfactionRatings'),
      a.svc('audit', SATISFACTION_SERVICE, "action: 'satisfaction.survey.submit',", 'submitSatisfactionRatings'),
      a.svc('audit', SATISFACTION_SERVICE, 'await persistAtomicAudit(tx as unknown as RLSTx, {', 'declineSurvey'),
      a.svc('audit', SATISFACTION_SERVICE, "action: 'satisfaction.survey.decline',", 'declineSurvey'),
      a.local('behavior', 'surveyRefusal', "if (message.startsWith('Not authorized')) throw ApiError.notFound('Satisfaction survey');"),
      a.h('privacy', 'isAnonymous: body.isAnonymous,'),
      a.svc('defect', SATISFACTION_SERVICE, 'isAnonymous: ratings.isAnonymous ?? false,', 'submitSatisfactionRatings'),
    ],
    inf: [
      { claim: 'defect', statement: 'The anonymity flag is written into the survey row as isAnonymous and the row keeps member_id; no select in the satisfaction service and no route filters, masks or branches on isAnonymous, and the survey form describes the switch as hiding the name from the representative.' },
    ],
    def: [SAT_ANON],
  })
}

function performanceFacts(a, kind) {
  const ranking = kind === 'rankings'
  const symbol = ranking ? 'getOrganizationLroRankings' : 'getLroPerformance'
  return mk({
    ...satisfactionBase(a),
    persona: ranking
      ? 'Steward reading the ranking of every representative of the organization on the representative ratings page'
      : 'Steward reading the aggregated satisfaction ratings of one representative',
    authz: 'withApi with minRole steward: any steward of the organization may read the performance of any representative. The handler applies no relation between the caller and the representative, and the floor is a role title, not a kernel decision (no authorizeAction call, so kernelAuthorization stays false).',
    tenant: ranking
      ? 'getOrganizationLroRankings selects the distinct representative ids of completed surveys of the session organization and aggregates each with the organization predicate; the organization id is the non-null session value.'
      : 'The representative id is taken from the path with no check that it belongs to the organization; the aggregation applies the organization predicate only when an organization id is passed, and withApi supplies the session organization (a missing organization answers 400 before the handler).',
    owner: 'Aggregates of completed satisfaction_surveys rows of the session organization about each representative; no row is returned.',
    sens: 'Per-representative averages of communication, responsiveness, knowledge, advocacy, professionalism and outcome ratings, overall average, recommend rate and number of completed surveys, derived from member responses that may be marked anonymous',
    priv: ranking
      ? 'Every steward receives the averages and the number of completed surveys of every representative who has one, ranked; with one response the average is that response, and anonymous and named responses are aggregated alike.'
      : 'A steward receives the averages, recommend rate and survey count of the representative id in the path, zero-filled when there is none; with one response the average is that response.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Audit reads of representative performance once the readers are named, because the figures evaluate a named person.',
    does: ranking
      ? 'Reads the distinct representative ids with a completed survey in the organization, computes the six averages, overall average and recommend rate of each with two queries per representative, sorts by overall average descending and returns the list.'
      : 'Computes the six averages, the overall average (mean of the six averages, zeros for nulls), the recommend rate and the count of completed surveys of the representative id from the path, and returns them whether or not any survey exists.',
    status: 'PARTIAL',
    future: future.satPerformance,
    dec: [D_SATISFACTION, D_AUDIT_READERS],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
      ranking
        ? a.h('tenantScope', 'const rankings = await getOrganizationLroRankings(organizationId!);')
        : a.h('tenantScope', 'const performance = await getLroPerformance(params.lroId, organizationId ?? undefined);'),
      ranking
        ? a.svc('tenantScope', SATISFACTION_SERVICE, 'eq(satisfactionSurveys.organizationId, organizationId),', symbol)
        : a.svc('tenantScope', SATISFACTION_SERVICE, 'conditions.push(eq(satisfactionSurveys.organizationId, organizationId));', symbol),
      ranking ? a.h('mutation', 'return { rankings };') : a.h('mutation', 'return { ...performance };'),
      ranking
        ? a.svc('behavior', SATISFACTION_SERVICE, 'performances.sort((a, b) => b.overallAverage - a.overallAverage);', symbol)
        : a.svc('behavior', SATISFACTION_SERVICE, 'overallAverage: parseFloat(overallAverage.toFixed(2)),', 'getLroPerformance'),
      a.svc('privacy', SATISFACTION_SERVICE, 'avgCommunication: avg(satisfactionSurveys.communicationRating),', 'getLroPerformance'),
      a.svc('defect', SATISFACTION_SERVICE, "const n = (v: string | null) => parseFloat(v ?? '0');", 'getLroPerformance'),
      a.svc('defect', SATISFACTION_SERVICE, 'totalSurveys: metrics.totalSurveys,', 'getLroPerformance'),
      a.sch('defect', SATISFACTION_SCHEMA, "isAnonymous: boolean('is_anonymous').notNull().default(false),", { resolvesExport: 'satisfactionSurveys' }),
    ],
    inf: [
      { claim: 'defect', statement: 'No query in getLroPerformance or getOrganizationLroRankings reads isAnonymous or applies a having or minimum count, and the route does not compare the path representative id with any representative or user table of the organization.' },
    ],
    def: ranking ? [SAT_THRESHOLD, SAT_ANON] : [SAT_THRESHOLD, SAT_ANON, SAT_ZERO],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* SCIM                                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const scimBase = (a) => ({
  service: `${a.routeFile} (withApi, organization_members through the shared handle or withRLSContext)`,
  authn: `${SESSION} (withApi, auth required; no bearer token is read).`,
  gate: GATE[SCIM_CAP],
  deps: [1, 13],
  corr: [],
})

function scimList(a) {
  return mk({
    ...scimBase(a),
    persona: 'Organization administrator, or an identity provider acting through an administrator session, listing the members of the organization in SCIM form',
    authz: 'withApi with minRole admin: any administrator of the organization (and any higher role title). The path organization id must equal the session organization id or the route answers 404. No bearer token, scim_configurations row or enabled flag is read. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The path organization id is compared with the session organization id, and the roster is selected by organization id through the shared database handle (no withRLSContext), so the isolation of the read rests on that explicit predicate.',
    owner: 'organization_members rows of the session organization, including removed members, mapped to SCIM user resources.',
    sens: 'Member id, user id or e-mail as userName, name, e-mail address, status, joined and updated times of every roster row',
    priv: 'An administrator receives name, e-mail and active state for every roster row of the own organization, including members whose deleted_at is set; no other organization is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row, no audit record and no scim_events_log row.',
    reqAudit: 'Log each SCIM read in scim_events_log once the credential and the readers are decided.',
    does: 'Requires an organization, compares it with the path, selects all organization_members rows of the organization, slices the page in memory by startIndex and count (capped at 100) and returns a SCIM ListResponse of user resources.',
    status: 'PARTIAL',
    future: future.scim,
    dec: [D_SCIM, D_FEDERATION, D_ROSTER],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' },"),
      a.h('tenantScope', "if (params.organizationId !== organizationId) throw ApiError.notFound('Organization');"),
      a.h('tenantScope', '.where(eq(organizationMembers.organizationId, orgId));'),
      a.h('mutation', 'Resources: paged.map(toScimUser),'),
      a.local('privacy', 'toScimUser', 'userName: member.email ?? member.userId,'),
      a.local('defect', 'toScimUser', "active: member.status === 'active',"),
      a.h('defect', 'const paged = members.slice(startIndex - 1, startIndex - 1 + count);'),
      a.h('defect', "const count = Math.min(100, parseInt(url.searchParams.get('count') || '50', 10));"),
      a.tbl('defect', 'organizationMembers', /deletedAt: timestamp\('deleted_at'/),
    ],
    inf: [
      { claim: 'defect', statement: 'The route imports no scimConfigurations or scimEventsLog table and reads no Authorization header; the only guard is the withApi session floor, so a bearer token cannot authenticate the call.' },
      { claim: 'defect', statement: 'getUserRoleInOrganization (the legacy role lookup) conditions on status active and deleted_at null, whereas this listing conditions on neither, so a removed member whose status column still reads active is reported as an active user.' },
    ],
    def: [SCIM_NO_BEARER, SCIM_LIST],
  })
}

function scimCreate(a) {
  return mk({
    ...scimBase(a),
    persona: 'Organization administrator, or an identity provider acting through an administrator session, provisioning a new member of the organization',
    authz: 'withApi with minRole admin: any administrator of the organization. The path organization id must equal the session organization id or the route answers 404. The role of the provisioned member is fixed to member; the body carries no role, group or entitlement. No bearer token is read. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The path organization id is compared with the session organization id, and the insert and the audit row run under withRLSContext with the session organization id and carry that organization id.',
    owner: 'A new organization_members row of the session organization keyed by the userName string, and the audit row of the organization.',
    sens: 'User id (the userName string), e-mail address, display name, role, status of the new membership',
    priv: 'The response returns the created membership as a SCIM user (id, userName, name, e-mail, active); the audit row records the provisioned userName.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The membership insert and the scim.user.provision audit row (persistAtomicAudit on the withRLSContext transaction handle) commit together; the audit lists the provisioned userName.',
    reqAudit: 'Keep the in-transaction audit row, add the provisioning credential or the administrator who acted and write scim_events_log.',
    does: 'Compares the path organization with the session, reads userName, name and e-mails from the unvalidated body, requires userName, inserts an active member with that userName as user id and role member (do nothing on conflict, 409 when no row came back), writes the audit row and returns the SCIM user.',
    status: 'PARTIAL',
    future: future.scim,
    dec: [D_SCIM, D_FEDERATION, D_ROSTER],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' },"),
      a.h('tenantScope', "if (params.organizationId !== organizationId) throw ApiError.notFound('Organization');"),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('mutation', '.insert(organizationMembers)'),
      a.h('mutation', '.onConflictDoNothing()'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('privacy', 'email: primaryEmail ?? userName,'),
      a.h('defect', 'userId: userName,'),
      a.h('defect', "role: 'member',"),
      a.h('defect', "status: 'active',"),
      a.h('defect', 'const body = await request.json();'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route imports no scimConfigurations or scimEventsLog table and reads no Authorization header; the only guard is the withApi session floor, so the bearer token described by scim_configurations cannot authenticate the call and no scim_events_log row is written.' },
      { claim: 'defect', statement: 'getUserRoleInOrganization in lib/organization-utils.ts matches organization_members.user_id against the session user id (with status active and deleted_at null), so the membership key written here is the value that must equal the session user id for the person to hold the role.' },
      { claim: 'defect', statement: 'The unique membership index is on organization and user id; a removed member keeps the row (deleted_at set), so the do-nothing insert returns no row and the route answers 409 for that user id.' },
      { claim: 'defect', statement: 'The route reads no identity provider subject, external id or group from the body; userName is used as the user id and, when no e-mail is sent, as the e-mail.' },
    ],
    def: [SCIM_NO_BEARER, SCIM_PROVISION, SCIM_BODY],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* settings                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

const settingsBase = (a) => ({
  service: `${a.routeFile} (withApi, organizations through the shared handle and withRLSContext)`,
  authn: `${SESSION} (withApi, auth required).`,
  gate: GATE[ORG_CAP],
  deps: [1, 13],
  corr: [],
})

function settingsGet(a) {
  return mk({
    ...settingsBase(a),
    persona: 'Organization administrator loading the organization profile and settings on the settings pages',
    authz: 'withApi with minRole admin: any administrator of the organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The organization id is the session value and the row is selected by organizations.id cast to text equal to that id through the shared database handle, so the predicate is explicit; the member count is counted by the same organization id.',
    owner: 'The organizations row of the session organization and the count of its organization_members rows.',
    sens: 'Organization name, short name, region, type, status, member count, subscription tier, enabled features, fiscal year end and the whole settings JSON (remittance rate, credit balance, branding, security policy and integration values)',
    priv: 'An administrator receives the whole settings JSON of the own organization, including any value an earlier administrator stored; no other organization is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of the settings JSON need no audit record unless it holds a secret; then project it.',
    does: 'Returns organization null when no organization id or row exists, otherwise counts the organization members and returns the profile fields, subscription tier, features, fiscal year end and the settings JSON.',
    status: 'PARTIAL',
    future: future.settingsGet,
    dec: [D_ORG_RECORD, D_SETTINGS],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "{ auth: { required: true, minRole: 'admin' } },"),
      a.h('tenantScope', 'const orgId = ctx.organizationId;'),
      a.h('tenantScope', '.where(eq(sql`${organizations.id}::text`, orgId));'),
      a.h('mutation', 'organization: {'),
      a.h('privacy', 'settings,'),
      a.tbl('privacy', 'organizations', /settings: jsonb\('settings'\)/),
      a.h('defect', 'return { organization: null };'),
    ],
    def: [SET_BODY],
  })
}

function settingsPut(a) {
  return mk({
    ...settingsBase(a),
    persona: 'Organization administrator saving the organization profile or the settings JSON on the organization settings page, or saving platform, security and notification values on the platform settings page',
    authz: 'withApi with minRole admin: any administrator of the organization. The route does not distinguish the keys of the settings JSON: every administrator may write every key. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The organization id is the session value; the read of the current settings and the update are both conditioned on organizations.id equal to that id, and the update and the audit row run in withRLSContext.',
    owner: 'The organizations row of the session organization (name, short name, region and the merged settings JSON) and the audit row of the organization.',
    sens: 'Organization name, short name, region and the settings JSON, which holds the per-capita rate and remittance day, the credit balance and renewal date, the inbound telephone number key, branding, and the security, notification and integration values',
    priv: 'The response is {updated:true}; the audit row names the fields written (settings, name, shortName, provinceTerritory) and not their values.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The organizations update and the organization.settings_update audit row (persistAtomicAudit on the withRLSContext transaction handle) commit together; the audit lists the field names written and no values, and the current settings are read before the transaction with the shared handle.',
    reqAudit: 'Keep the in-transaction audit row and record the previous and new values of each key changed.',
    does: 'Requires an organization and a body, copies name, shortName and provinceTerritory when they are strings, reads the current settings JSON and shallow-merges the body settings object over it, answers updated false when nothing was provided, otherwise updates the organization row and writes the audit row in one transaction and answers updated true.',
    status: 'PARTIAL',
    future: future.settingsPut,
    dec: [D_ORG_RECORD, D_SETTINGS],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "{ auth: { required: true, minRole: 'admin' } },"),
      a.h('tenantScope', 'const orgId = ctx.organizationId;'),
      a.h('tenantScope', '.where(eq(sql`${organizations.id}::text`, orgId));'),
      a.h('tenantScope', 'await withRLSContext(async (tx) => {'),
      a.h('mutation', '.update(organizations)'),
      a.h('mutation', 'return { updated: true };'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('privacy', "details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },"),
      a.h('defect', 'updates.settings = { ...currentSettings, ...(body.settings as Record<string, unknown>) };'),
      a.h('defect', "if (typeof body.name === 'string') updates.name = body.name;"),
      a.h('defect', 'const [currentOrg] = await db'),
      a.h('defect', "throw new Error('Request body is required');"),
      a.tbl('defect', 'organizations', /settings: jsonb\('settings'\)/),
    ],
    inf: [
      { claim: 'defect', statement: 'A search of the application for mfaEnforcement, passwordMinLength and requireMixedCase finds only the settings page, which reads them with defaults, and the platform settings component, which writes them; no authentication, session, password or rate-limit code reads them, so the saved values are not enforced anywhere in the application.' },
      { claim: 'defect', statement: 'entitlements.ts writes settings.credits and settings.nextCreditRenewal back into the same settings JSON when credits are consumed, added or reset, and services/clc/per-capita-calculator reads settings.perCapitaRate and settings.remittanceDay from it; the route merges any key the body carries over those values.' },
      { claim: 'defect', statement: 'services/clc/per-capita-calculator.ts reads settings.perCapitaRate (default 1.0, an organization with a rate of 0 or less is skipped) to set the total amount of the monthly per-capita remittance, and lib/services/entitlements.ts reads settings.credits (default from the tier) as the credit balance; the route merges any key of the body over both.' },
      { claim: 'defect', statement: 'consumeCredits, addCredits and the billing-cycle reset in lib/services/entitlements.ts update organizations.settings with an object that holds only the credit keys (no spread of the stored settings in addCredits and the reset, an empty object spread in consumeCredits), which would replace the whole settings JSON; no code in the application calls them, so the replacement is not reachable today, and checkEntitlement reads settings.credits without ever decrementing it.' },
      { claim: 'defect', statement: 'The platform settings component saves sessionTimeout, mfaEnforcement, passwordMinLength, requireMixedCase, requireSymbol, rateLimitPerMin and webhookUrl through this route, and the settings page reads mfaEnforcement and passwordMinLength back with defaults; the route answers {updated:true} for them.' },
      { claim: 'defect', statement: 'services/twilio-sms-service.ts resolves the organization of an inbound message with a select on organizations where settings ->> twilioPhoneNumber equals the called number, limit 1, and stores the message body and sender number under the organization id it returns.' },
      { claim: 'defect', statement: 'Nothing in the application writes the twilioPhoneNumber key except this generic settings merge; the lookup that reads it uses limit 1 without an ordering, so which of two organizations holding the same number is returned is not defined by the query.' },
    ],
    def: [SET_KEYS, SET_UNENFORCED, SET_BODY, SET_TWILIO],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* generic CRUD profiles                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

function securityRecord(a) {
  const isRead = a.method === 'GET'
  const floor = 'security_manager'
  return mk({
    persona: isRead
      ? 'Security manager expecting to read the security events of the organization'
      : 'Security manager or process expecting to record a security event',
    service: `${CRUD_FACTORY} (crudRoutes over security_events)`,
    authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
    authz: `Generic CRUD role floor: ${a.method} requires ${floor}; security_events is DENIED in the CRUD governance table, so the factory then refuses the ${isRead ? 'read' : 'write'} for every caller. A role title is not a kernel decision.`,
    tenant: 'orgScoped: true and the table has an organization column: the factory would scope the query to the session organization; the request is refused before any query.',
    owner: 'security_events rows of the organization (event type, category, severity, description, source address, user agent, additional data, risk score, resolution); the generic factory serves none of them because the table is denied.',
    sens: 'User id, event type and category, severity, description, source IP address, user agent, additional data, risk score, resolution notes',
    priv: isRead
      ? 'Nothing is returned: security_events is DENIED in the CRUD governance table, so the read is refused with 403 for every caller, including a security manager.'
      : 'Nothing is stored: security_events is DENIED, so the write is refused with 403 for every caller, including a security manager.',
    mut: isRead ? 'NOT_MUTATING' : 'WRITE_REFUSED_BY_GOVERNANCE',
    auditDetail: isRead
      ? 'security_events is DENIED in the CRUD governance table, so assertCrudRead refuses every read with 403 before any query; nothing is read, written or audited.'
      : 'security_events is DENIED in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.',
    reqAudit: isRead
      ? 'No audit record is needed for a refused read; a dedicated, authority-checked route must decide who may read security events and audit each read.'
      : 'No audit record is required for a refused write; if security events are later written through a dedicated route the event must be append-only and commit in the same transaction as its cause.',
    does: isRead
      ? 'Authenticates a caller at the security manager floor, then refuses the read with 403 because the table is denied, before any query.'
      : 'Authenticates a caller at the security manager floor, then refuses the write with 403 because the table is denied, before any insert or audit row.',
    status: 'LATENT_NOT_OPERATIONAL',
    gate: GATE[AUDIT_CAP],
    deps: [13],
    future: future.security,
    dec: [D_SECURITY, D_AUDIT_READERS],
    ev: [
      a.h('authorization', isRead ? "readRole: 'security_manager'," : "writeRole: 'security_manager',"),
      ...guardEv(a, 'crud'),
      a.h('tenantScope', 'orgScoped: true,'),
      a.tbl('tenantScope', 'securityEvents', /organizationId: uuid\("organization_id"\)/),
      a.sch('scope', CRUD_GOVERNANCE, "'security_events'"),
      isRead
        ? a.imp('mutation', 'crudRoutes', 'assertCrudRead(governance);')
        : a.imp('mutation', 'crudRoutes', 'assertCrudWrite(governance);'),
      isRead
        ? a.sch('behavior', CRUD_GOVERNANCE, 'export function assertCrudRead')
        : a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
      a.tbl('privacy', 'securityEvents', /additionalData: jsonb\("additional_data"\)/),
      a.h('defect', "readRole: 'security_manager',"),
    ],
    inf: [
      { claim: 'defect', statement: 'The route file configures readRole and writeRole security_manager and its header describes a privileged reader; the CRUD governance DENIED list names security_events, so assertCrudRead and assertCrudWrite throw before any query, and the security dashboard page checks hasMinRole security_manager and reads the table with SQL under a system context instead.' },
    ],
    def: [SEC_DENIED],
    crudTable: 'security_events',
    crudClass: 'DENIED',
    corr: isRead ? [] : [{ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'security_events is DENIED, so the write is refused before any row or audit record is written.' }],
  })
}

function stewardProfile(a) {
  const isRead = a.method === 'GET'
  const isItem = a.route === 'stewards/[id]/route.ts'
  return {
    persona: isRead
      ? 'Member of the organization (any role) looking for a steward, and a steward or officer reading steward assignments'
      : 'Steward or officer expecting to appoint, change or end a steward assignment',
    owner: 'steward_assignments rows of the organization: a per-assignment row (steward, type, coverage, tenure, appointer, contact fields, notes and an optional grievance id), not a steward directory of people.',
    sens: 'Steward user id, steward type, status, unit, worksite, department, shift, floor, area, tenure and election dates, appointer, training and certification dates, work phone, personal phone, preferred contact method, availability notes, notes and grievance id',
    priv: (m) => (m === 'GET'
      ? `Any member of the organization reads the steward assignment row${isItem ? ' of the path id' : 's of the organization, 50 per page by default and 100 at most,'} with the personal phone, work phone, preferred contact method, availability notes, notes and grievance id; no row of another organization is reachable, nothing narrows the fields or the readers and no read is audited.`
      : 'Nothing is stored: steward_assignments is READ_ONLY in the CRUD governance table, so the write is refused with 403 before any row or audit record exists.'),
    does: (m, _model, floor) => {
      if (m === 'GET') {
        return `Returns the steward_assignments row${isItem ? ' of the path id' : 's'} of the session organization at a role floor of ${floor}${isItem ? '' : ', newest first and paginated,'} with every column and no field projection; a caller below steward is not narrowed because the table has no owner or personal column by the names the low-role guard checks.`
      }
      return `Authenticates a caller at the ${floor} floor, then refuses the ${m} with 403 because the table is read-only in the governance list, before any row or audit record.`
    },
    future: future.steward,
    gate: GATE[STEWARD_CAP],
    deps: [6, 10, 13],
    decisions: [D_STEWARD, D_REPRESENTATION],
    def: () => (isRead ? [STEWARD_READ, STEWARD_FACADE] : [STEWARD_FACADE, STEWARD_WRITE]),
    extraEv: (b) => {
      const out = [
        b.tbl('privacy', 'stewardAssignments', /personalPhone: varchar\('personal_phone'/),
        b.tbl('privacy', 'stewardAssignments', /availabilityNotes: text\('availability_notes'\)/),
      ]
      if (isRead) {
        out.push(
          b.tbl('privacy', 'stewardAssignments', /grievanceId: uuid\('grievance_id'\)/),
          b.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"),
          b.imp('defect', 'crudRoutes', 'const lowRole = await readScope(userId, organizationId);'),
        )
      } else {
        out.push(
          b.h('defect', "writeRole: 'steward',"),
        )
      }
      return out
    },
    inferences: () => [
      { claim: 'defect', statement: 'The only insert into steward_assignments in application code is assignSteward in the steward assignment service, which no route handler calls; the organization role title steward is a value of organization_members.role, which no steward route reads, so an assignment row does not confer or record the role.' },
    ],
    reqRead: 'Audit reads of steward assignment rows that carry a personal phone, notes or a grievance link once the readers are named.',
    status: (m) => (m === 'GET' ? 'FACADE_OVER_GENERIC_TABLE' : 'LATENT_NOT_OPERATIONAL'),
  }
}

function mediaProfile(a) {
  const isRead = a.method === 'GET'
  const name = a.route.startsWith('storage/cleanup') ? 'storage cleanup' : 'storage usage'
  return {
    persona: isRead
      ? `Member of the organization (any role) calling the ${name} route, and a steward or administrator who expects ${name === 'storage cleanup' ? 'a cleanup of unused files' : 'bytes used and quota'}`
      : `Steward expecting to ${name === 'storage cleanup' ? 'run a storage cleanup' : 'record storage usage'}`,
    owner: `cms_media_library rows of the organization (${name} is not a table of its own: the route serves the media library).`,
    sens: 'File name, file url, file type, mime type, file size, width, height, alt text, caption, tags, folder and uploader of each media library entry',
    priv: (m) => (m === 'GET'
      ? 'Any member of the organization reads the media library rows of the organization with file urls, names, captions, folders and uploader ids; no row of another organization is reachable and nothing is summed or deleted.'
      : 'The media row stored from the body is returned in full; file url, size, mime type, folder and uploader are whatever the caller wrote.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns the cms_media_library rows of the session organization at a role floor of ${floor}, newest first and paginated; it sums no file size, reads no quota and deletes no file, whatever the path says.`
      : `Inserts a cms_media_library row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; no file is received, checked or removed.`),
    future: future.storage,
    gate: GATE[MEDIA_CAP],
    deps: [6, 13],
    decisions: [D_SUPPORT],
    def: () => (isRead ? [STORAGE_FACADE] : [STORAGE_FACADE, STORAGE_POST]),
    extraEv: (b) => [
      b.tbl('privacy', 'cmsMediaLibrary', /fileUrl: text\('file_url'\)\.notNull\(\)/),
      b.tbl('privacy', 'cmsMediaLibrary', /fileSize: integer\('file_size'\)\.notNull\(\)/),
      ...(isRead ? [] : [b.tbl('defect', 'cmsMediaLibrary', /uploadedBy: text\('uploaded_by'\)/)]),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over cmsMediaLibrary with orgScoped, readRole member and writeRole steward and nothing else; the table is read and written only by this route, storage/cleanup and the upload route, and no code in the application stores a file in or removes a file from a store on behalf of these rows.' },
    ],
    reqRead: 'Audit reads of the media library once the readers of private files are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

function supportProfile(a) {
  const isRead = a.method === 'GET'
  const name = a.route.startsWith('support/sla') ? 'support SLA' : 'support metrics'
  return {
    persona: isRead
      ? `Member reading the notifications addressed to them, and steward or administrator who expects ${name} figures`
      : 'Steward who expects to record a support metric and instead addresses an in-app notification to a user',
    owner: `in_app_notifications rows of the organization (${name} is not a table of its own: the route serves the notification inbox).`,
    sens: 'User id, title, message, type, action label and url, data object, read flag and times of each in-app notification',
    priv: (m) => (m === 'GET'
      ? 'A caller below steward receives only the notifications addressed to their own user id; a steward or above receives the title, message, action url and data of every user notification of the organization; no row of another organization is reachable and no figure is computed.'
      : 'The notification row stored from the body is returned in full; the user id, title, message, action url and data are whatever the caller wrote.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns in_app_notifications rows of the session organization at a role floor of ${floor} (own user id rows only below steward), newest first and paginated; it computes no ticket count, response time, resolution time or service-level figure.`
      : `Inserts an in_app_notifications row from the whole body at a role floor of ${floor}, with the organization and creator taken from the session, and commits the factory audit record with it; the user id is not checked against the roster and no sender is stored.`),
    future: future.support,
    gate: GATE[NOTIFY_CAP],
    deps: [9, 13],
    decisions: [D_SUPPORT, D_NOTIFY],
    def: () => (isRead ? [SUPPORT_FACADE, SUPPORT_READ] : [SUPPORT_FACADE, SUPPORT_POST]),
    extraEv: (b) => [
      b.tbl('privacy', 'inAppNotifications', /actionUrl: text\('action_url'\)/),
      b.tbl('privacy', 'inAppNotifications', /message: text\('message'\)\.notNull\(\)/),
      ...(isRead ? [] : [b.tbl('defect', 'inAppNotifications', /userId: text\('user_id'\)\.notNull\(\)/)]),
    ],
    inferences: () => [
      { claim: 'defect', statement: 'The route file configures crudRoutes over inAppNotifications with orgScoped, readRole member and writeRole steward and nothing else; no route under app/api reads a ticket, response-time or service-level table or calls getTicketMetrics or getSLAMetrics of the support service, and no client in the application calls this path.' },
    ],
    reqRead: 'Audit reads of notification rows that name a member, case or grievance once the readers are named.',
    status: () => 'FACADE_OVER_GENERIC_TABLE',
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

const METRICS_ANALYTICS_SCREEN = {
  ANALYTICS_CROSSES_BOUNDARY: {
    reason: 'The metrics path computes no aggregate: the route is the generic factory over in_app_notifications, which returns rows and sums nothing, and every query it runs is bounded to the session organization by the factory organization predicate, so no figure crosses an organization boundary.',
    evidence: [
      { ref: CRUD_FACTORY_FILE, quote: FACTORY_TENANT },
      { ref: `${API}support/metrics/route.ts`, quote: 'orgScoped: true,' },
    ],
  },
}

export const RISK_SCREENS = {
  'support/metrics/route.ts|GET': METRICS_ANALYTICS_SCREEN,
  'support/metrics/route.ts|POST': METRICS_ANALYTICS_SCREEN,
}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a, readText) {
  const { route, method } = a
  switch (route) {
    case 'satisfaction/route.ts': return method === 'GET' ? satisfactionList(a) : satisfactionCreate(a)
    case 'satisfaction/[id]/route.ts': return method === 'GET' ? satisfactionItemGet(a) : satisfactionItemPost(a)
    case 'satisfaction/lro/[lroId]/route.ts': return performanceFacts(a, 'lro')
    case 'satisfaction/rankings/route.ts': return performanceFacts(a, 'rankings')
    case 'scim/v2/[organizationId]/Users/route.ts': return method === 'GET' ? scimList(a) : scimCreate(a)
    case 'settings/organization/route.ts': return method === 'GET' ? settingsGet(a) : settingsPut(a)
    case 'security/events/route.ts': return securityRecord(a)
    case 'stewards/route.ts':
    case 'stewards/[id]/route.ts': return crudRecord(a, readText, stewardProfile(a))
    case 'storage/cleanup/route.ts':
    case 'storage/usage/route.ts': return crudRecord(a, readText, mediaProfile(a))
    case 'support/metrics/route.ts':
    case 'support/sla/route.ts': return crudRecord(a, readText, supportProfile(a))
    default: throw new Error(`no identity-support facts for ${route}`)
  }
}