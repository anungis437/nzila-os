/**
 * Facts: jurisdiction, labour standards, knowledge base, location, intelligence, investigations, health and
 * welfare and meeting room routes. Several of these paths are named for a business domain but are the generic CRUD
 * factory over an unrelated table or a byte-identical alias wrapper over another route; the statutory-parameter routes
 * serve hard-coded constants as authoritative rules and verdicts; the location routes handle precise member position.
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the
 * resolved schema, and is proved again by the validator. This tranche records the source; it repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, CRUD_FACTORY, GET_WRITES, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord, MASS_CREATE } from './ue-gate0b5-crud.mjs'

const COMPLIANCE = 'UE-OMIT-COMPLIANCE-ASSURANCE'
const PRIVACY = 'UE-OMIT-PRIVACY-RIGHTS'
const KT = 'UE-OMIT-EXIT-INTERVIEW-KNOWLEDGE-TRANSFER'
const AI = 'UE-OMIT-AI-ADVISORY-GOVERNANCE'
const AUDIT = 'UE-OMIT-AUDIT-LOG-VISIBILITY'
const CASE = 'UE-CAP-K-010'
const FINANCE = 'UE-OMIT-FINANCE-UNAVAILABLE'
const CALENDAR = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const K007 = 'UE-CAP-K-007'
const K006 = 'UE-CAP-K-006'

const GATE = {
  [COMPLIANCE]: 14,
  [PRIVACY]: 6,
  [KT]: 14,
  [AI]: 14,
  [AUDIT]: 14,
  [CASE]: 4,
  [FINANCE]: 5,
  [CALENDAR]: 14,
  [K007]: 13,
  [K006]: 14,
}

const LIB = `${APP}lib/canadian-labour-standards`
const WCB = `${LIB}/wcb-boards.ts`
const TERMINATION = `${LIB}/termination-notice.ts`
const GEOFENCE_SERVICE = `${APP}services/geofence-privacy-service.ts`
const GEOFENCE_SCHEMA = `${APP}db/schema/geofence-privacy-schema.ts`
const RULES_ROUTE = `${API}jurisdiction-rules/route.ts`
const KB_SCHEMA = `${APP}db/schema/ai-chatbot-schema.ts`
const CONSENT_SERVICE = 'GeofencePrivacyService.requestLocationConsent'
const SVC = (member) => `GeofencePrivacyService.${member}`

export const ROUTES = new Set([
  'healthwelfare/plans/route.ts',
  'intelligence/route.ts',
  'investigations/audit/route.ts',
  'investigations/route.ts',
  'jurisdiction-rules/route.ts',
  'jurisdiction/clc-compliance/route.ts',
  'jurisdiction/validate-deadline/route.ts',
  'knowledge-base/[id]/route.ts',
  'knowledge-base/route.ts',
  'labour-standards/[jurisdiction]/compliance-check/route.ts',
  'labour-standards/[jurisdiction]/route.ts',
  'labour-standards/route.ts',
  'location/consent/route.ts',
  'location/geofence/route.ts',
  'location/track/route.ts',
  'meeting-rooms/[id]/bookings/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  JUR_COMPLIANCE_STATUTORY_PARAMETERS: {
    capabilityId: COMPLIANCE,
    domain: 'STATUTORY_PARAMETER_RULES_AND_COMPLIANCE_CHECK',
    actor: 'Signed-in user, steward or unauthenticated visitor reading jurisdiction rule parameters, labour standards profiles and a practice-against-statute check, all computed from constants compiled into the application',
    routes: [
      'jurisdiction-rules/route.ts',
      'labour-standards/route.ts',
      'labour-standards/[jurisdiction]/route.ts',
      'labour-standards/[jurisdiction]/compliance-check/route.ts',
    ],
    evidence: [
      ev(`${API}labour-standards/[jurisdiction]/compliance-check/route.ts`, ' * Accepts org practices and returns violations/warnings against'),
      ev(`${API}labour-standards/[jurisdiction]/route.ts`, ' * Includes: break rules, overtime, termination notice, statutory holidays,'),
      ev(WCB, 'export const WCB_BOARDS: Record<CanadianJurisdiction, WorkersCompBoard> = {'),
      ev(TERMINATION, 'export const TERMINATION_NOTICE: Record<CanadianJurisdiction, TerminationNoticeSchedule> = {'),
    ],
  },
  JUR_COMPLIANCE_BARGAINING_UNIT_FACADES: {
    capabilityId: COMPLIANCE,
    domain: 'JURISDICTION_PATH_NAMES_OVER_BARGAINING_UNIT_ROWS',
    actor: 'Member reading, and steward adding, bargaining unit rows through paths named for a CLC compliance check and a deadline validation',
    routes: ['jurisdiction/clc-compliance/route.ts', 'jurisdiction/validate-deadline/route.ts'],
    evidence: [
      ev(`${APP}db/schema/union-structure-schema.ts`, "export const bargainingUnits = pgTable("),
      ev(`${API}jurisdiction/clc-compliance/route.ts`, ' * CRUD collection route for bargainingUnits'),
      ev(`${API}jurisdiction/validate-deadline/route.ts`, ' * CRUD collection route for bargainingUnits'),
    ],
  },
  JUR_FINANCE_REMITTANCE_FACADE: {
    capabilityId: FINANCE,
    domain: 'HEALTH_AND_WELFARE_PATH_OVER_PER_CAPITA_REMITTANCES',
    actor: 'Member reading the per-capita remittance ledger of the organization under a path named for health and welfare plans',
    routes: ['healthwelfare/plans/route.ts'],
    evidence: [
      ev(`${APP}db/schema/clc-per-capita-schema.ts`, "export const perCapitaRemittances = pgTable("),
      ev(`${APP}db/schema/clc-per-capita-schema.ts`, " * Tracks monthly per-capita tax payments from local unions to parent organizations (CLC)"),
      ev(`${API}healthwelfare/plans/route.ts`, ' * CRUD collection route for perCapitaRemittances'),
    ],
  },
  JUR_AI_INTELLIGENCE_ALIAS: {
    capabilityId: AI,
    domain: 'INTELLIGENCE_PATH_OVER_INSIGHT_RECOMMENDATION_ROWS',
    actor: 'Member reading and steward storing insight recommendation rows through a path named intelligence',
    routes: ['intelligence/route.ts'],
    evidence: [
      ev(`${API}intelligence/route.ts`, "import { GET as DelegateGET, POST as DelegatePOST } from '../analytics/insights/route';"),
      ev(`${API}analytics/insights/route.ts`, ' * CRUD collection route for insightRecommendations'),
    ],
  },
  JUR_CASE_INVESTIGATIONS_ALIAS: {
    capabilityId: CASE,
    domain: 'INVESTIGATIONS_PATH_OVER_CASE_COLLECTION',
    actor: 'Case-handling staff and the member on their own case, reaching the case collection through a path named investigations',
    routes: ['investigations/route.ts'],
    evidence: [
      ev(`${API}investigations/route.ts`, "import { GET as DelegateGET, POST as DelegatePOST } from '../cases/route';"),
      ev(`${API}cases/route.ts`, ' * Cases collection route — list and create cases (claims).'),
    ],
  },
  JUR_AUDIT_INVESTIGATIONS_ALIAS: {
    capabilityId: AUDIT,
    domain: 'INVESTIGATIONS_AUDIT_PATH_OVER_ORGANIZATION_AUDIT_LOG',
    actor: 'Officer reading the organization audit-log rows through a path named investigations audit',
    routes: ['investigations/audit/route.ts'],
    evidence: [
      ev(`${API}investigations/audit/route.ts`, "import { GET as DelegateGET } from '../../audits/route';"),
      ev(`${API}audits/route.ts`, ' * Organization audit logs from PostgreSQL.'),
    ],
  },
  JUR_KNOWLEDGE_BASE_READS: {
    capabilityId: KT,
    domain: 'KNOWLEDGE_BASE_LIST_AND_ITEM_READ',
    actor: 'Any signed-in user of an organization, or of a child of the organization that owns the row, reading knowledge-base documents that include the copies made from published exit interviews',
    routes: ['knowledge-base/route.ts', 'knowledge-base/[id]/route.ts'],
    evidence: [
      ev(`${API}knowledge-base/route.ts`, ' * Returns active knowledge base records for the current user\'s org.'),
      ev(`${API}knowledge-base/[id]/route.ts`, ' * Validates the requesting user\'s org (or parent org) owns the record.'),
      ev(KB_SCHEMA, 'export const knowledgeBase = pgTable('),
      ev(`${API}exit-interviews/[id]/publish/route.ts`, "sourceType: 'exit_interview',"),
    ],
  },
  JUR_LOCATION_CONSENT_AND_TRACKING: {
    capabilityId: PRIVACY,
    domain: 'MEMBER_LOCATION_CONSENT_GEOFENCE_AND_TRACKING',
    actor: 'Member granting, checking and revoking location consent, recording a position and checking a geofence, and a steward defining geofences for a strike or event',
    routes: ['location/consent/route.ts', 'location/geofence/route.ts', 'location/track/route.ts'],
    evidence: [
      ev(GEOFENCE_SCHEMA, 'export const memberLocationConsent = pgTable("member_location_consent", {'),
      ev(GEOFENCE_SCHEMA, 'export const locationTracking = pgTable("location_tracking", {'),
      ev(GEOFENCE_SCHEMA, 'export const geofences = pgTable("geofences", {'),
      ev(GEOFENCE_SERVICE, ' * - 24-hour maximum data retention'),
    ],
  },
  JUR_CALENDAR_MEETING_ROOM_FACADE: {
    capabilityId: CALENDAR,
    domain: 'MEETING_ROOM_BOOKINGS_PATH_OVER_MEETING_ROOM_ITEM',
    actor: 'Member reading, and administrator removing, a meeting room under a path named for the bookings of the room',
    routes: ['meeting-rooms/[id]/bookings/route.ts'],
    methods: ['DELETE', 'GET'],
    evidence: [
      ev(`${APP}db/schema/calendar-schema.ts`, "export const meetingRooms = pgTable('meeting_rooms', {"),
      ev(`${APP}db/schema/calendar-schema.ts`, "export const roomBookings = pgTable('room_bookings', {"),
      ev(`${API}meeting-rooms/[id]/bookings/route.ts`, ' * CRUD item route for meetingRooms'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE[ownerCapabilityId], severity, title, ...extra })

const ROUTE_ALLOWLIST = 'DEF-0B1-ALLOWLIST-DRIFT'

export const DECISIONS = [
  {
    id: 'UE-INST-MEMBER-LOCATION-PROCESSING',
    status: 'OUTSTANDING',
    question: 'For which purposes may the union collect a member precise position, which office may read an individual position or a geofence entry, how is a consent bound to a purpose, an organization and a strike or event, and which office owns the retention and the erasure of the points a member produced without an active consent?',
    sourceState: 'The consent row is keyed by the member user id alone and carries a free-text purpose and two flags (strike, events); the tracking route checks the flags for strike, picket and event points and nothing for meeting and organizing points; the geofence entry check stores a position without reading the consent; no route reads a stored position back and no source names an office that may; the retention handler states an hourly schedule that no scheduler entry in the repository invokes.',
    softwareOwners: [PRIVACY],
  },
]

export const DEFECTS = [
  D('DEF-0B8-JUR-WCB-REPORTING-DEADLINE-SERVED-AS-ARBITRATION-DEADLINE', COMPLIANCE, 'HIGH',
    'The jurisdiction rules route serves, for every jurisdiction that has a workers compensation board entry, a rule named WCB Claim Filing Deadline under the category arbitration_deadline whose deadline_days is the claimDeadlineDays constant, and that constant is documented in its own notes as the period within which the employer must report an injury (Alberta 72 hours stored as 72 in a field named days, Saskatchewan and Manitoba 5 business days, New Brunswick 3 days) while getClaimDeadlineDays describes it as calendar days; the fallback of 30 can never apply because the function always returns a number, and the ComplianceChecker component reads the first arbitration_deadline rule and renders the arbitration scheduling gap as compliant or violation against that number.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any signed-in user can request /api/jurisdiction-rules with category arbitration_deadline and receive a 200 success document whose single rule carries a workers compensation employer reporting period as deadline_days with a legal reference to the compensation statute; the only consumer in the repository is the ComplianceChecker component, which is exported from the component index and is not imported by any page.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A steward or officer who schedules or checks an arbitration or grievance step against the number, or a screen that mounts the component, is told that a filing is compliant or in violation against a period that belongs to another obligation and whose unit differs by jurisdiction, so a statutory limit can be misjudged either way.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/jurisdiction-rules/route.ts', quote: 'export const GET = withApiAuth(handler);' },
          { ref: 'apps/union-eyes/components/jurisdiction/compliance-checker.tsx', quote: '`/api/jurisdiction-rules?jurisdiction=${jurisdiction}&category=arbitration_deadline`' },
        ],
        existingContainment: {
          summary: 'The one in-repository consumer is a component that the component index exports and no page mounts, so no screen currently presents the number as an arbitration verdict; the route itself is open to every signed-in user.',
          evidence: [
            { ref: 'apps/union-eyes/components/jurisdiction/index.ts', quote: "export { ComplianceChecker } from './compliance-checker';" },
          ],
        },
        blockingCondition: 'A page, client or integration mounts ComplianceChecker or otherwise uses the arbitration_deadline rule of /api/jurisdiction-rules to decide or display whether an arbitration or grievance step is within time.',
        justification: 'The route answers with authority-looking data whose meaning and unit do not match its label, and a verdict component is wired to it; no page uses that component today, so the harm needs a screen or client to rely on it, and the release is blocked from the moment one does.',
      },
    }),
  D('DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS', COMPLIANCE, 'HIGH',
    'The British Columbia termination notice schedule ends with a tier whose maxYears is 8 while every other schedule ends with maxYears null, and calculateTerminationNotice matches a tier only while yearsOfService is below maxYears, so for any British Columbia tenure of 8 years or more no tier matches and the required notice is 0 weeks: the compliance check never reports a termination_notice violation for such an employee, whatever notice was given, and the jurisdiction rules and labour standards profile publish the schedule with no tier above 8 years.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A steward or higher role posting tenureYears of 8 or more with a British Columbia jurisdiction and any terminationNoticeWeeks receives a 200 result with zero termination_notice findings, and the unauthenticated labour standards profile and the signed-in rules route return the same truncated schedule; the only in-repository caller found for the compliance check is its route test.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A union representative asking whether the notice an employer gave a long-service British Columbia employee meets the statutory minimum is told there is no violation, so an under-noticed dismissal can be treated as compliant and a grievance or complaint not raised.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/labour-standards/[jurisdiction]/compliance-check/route.ts', quote: "auth: { minRole: 'steward' }," },
          { ref: 'apps/union-eyes/lib/canadian-labour-standards/termination-notice.ts', quote: '{ minYears: 7, maxYears: 8, weeksNotice: 8 },' },
        ],
        existingContainment: {
          summary: 'The compliance check refuses callers below the steward role, which narrows who receives the wrong answer; it does not change the answer.',
          evidence: [
            { ref: 'apps/union-eyes/app/api/labour-standards/[jurisdiction]/compliance-check/route.ts', quote: "auth: { minRole: 'steward' }," },
          ],
        },
        blockingCondition: 'A steward, a screen or an integration relies on the compliance check or the published schedule to decide whether the notice given to a British Columbia employee with 8 or more years of service meets the statutory minimum.',
        justification: 'The defect is a data-shape fault that silently turns a violation into no finding for a defined tenure band; the route is live for stewards but no caller in the repository relies on it, so the release is blocked when any representative or screen treats its termination verdict as a determination.',
      },
    }),
  D('DEF-0B8-JUR-COMPLIANCE-CHECK-REPORTS-ZERO-FINDINGS-WHEN-NO-CHECK-APPLIES', COMPLIANCE, 'MEDIUM',
    'The labour standards compliance check declares every body field optional and each rule block runs only when its own fields are present, so an empty body, a body missing the tenure or notice pair, or a daily-hours figure below the meal-break trigger returns a 200 summary with totalFindings, violations and warnings of 0 and an empty findings list; the response does not list which checks were evaluated, accepts negative and absurd hour counts, and gives no sign that nothing was checked, so a request that tested nothing reads as a clean result.'),
  D('DEF-0B8-JUR-STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS', COMPLIANCE, 'MEDIUM',
    'The break, overtime, termination notice, statutory holiday and workers compensation tables behind the jurisdiction rules, labour standards list, profile and compliance check are literals compiled into the application: apart from the anti-scab entries they carry no effective date, version, source document or verifier, no office is named as having determined them, and the routes return them with statute and article citations and violation severities as if they were governed law, so a stale or wrong constant is served as authority until the code is edited.'),
  D('DEF-0B8-JUR-PROFILE-MINIMUM-WAGE-IS-A-PLACEHOLDER-ZERO', COMPLIANCE, 'MEDIUM',
    'The labour standards profile returns minimumWage as { hourly: 0, effectiveDate: \'varies\' } with a comment that it is populated by live data, but the handler reads no live source, so every jurisdiction profile publishes a zero hourly minimum wage to unauthenticated callers as a real field of the profile.'),
  D('DEF-0B8-JUR-RULES-ROUTE-ACCEPTS-ANY-CODE-AND-ANSWERS-SUCCESS-WITH-NO-OR-WRONG-RULES', COMPLIANCE, 'MEDIUM',
    'The jurisdiction rules route maps a known CA-XX code and otherwise casts the raw query string to a jurisdiction, never validates it against the known set, and indexes plain-object tables with it, so an unknown code answers success true with an empty rule list (no error), an inherited property name such as constructor selects a function from the tables and raises a TypeError that the handler reports only as a generic 500, and a category that matches no rule also answers success with an empty list.'),
  D('DEF-0B8-JUR-CLC-AND-DEADLINE-PATHS-ARE-BARGAINING-UNIT-CRUD-NO-VALIDATION', COMPLIANCE, 'MEDIUM',
    'The /api/jurisdiction/clc-compliance and /api/jurisdiction/validate-deadline routes are the same generic crudRoutes configuration over bargaining_units: neither path checks a CLC rule or validates or calculates a deadline, a GET lists the bargaining unit rows of the organization (certification numbers and dates, contract expiry, next bargaining date, chief steward and chair user ids) at the member floor, and a POST inserts a bargaining unit from the request body and answers success, so a client that posts to validate-deadline expecting a validation gets a stored unit and no verdict.'),
  D('DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD', K007, 'LOW',
    'The intelligence, investigations and investigations/audit routes wrap another route behind a requireOrgAccess function that returns the literal true and, for POST, a validateMutationBoundary whose schema checks only that request.method is a string, so the 401 and 400 branches are unreachable and the wrappers read as an access check that is not there; every real check comes from the delegated handler.'),
  D('DEF-0B8-JUR-INVESTIGATIONS-PATH-IS-THE-CASE-COLLECTION-NO-INVESTIGATION-RECORD', CASE, 'MEDIUM',
    'The /api/investigations route re-exports the case collection handlers: GET lists claims (claim number, member id, member name and e-mail, description, desired outcome, assignee, status, AI and merit scores) and POST at the steward floor creates a claim, so no investigation record, investigator assignment, confidentiality marking, party list or investigation-specific audit exists behind a name that suggests a confidential workplace investigation.'),
  D('DEF-0B8-JUR-INVESTIGATIONS-AUDIT-PATH-RETURNS-THE-WHOLE-ORGANIZATION-AUDIT-LOG', AUDIT, 'MEDIUM',
    'The /api/investigations/audit route re-exports the audits list: it takes no investigation id or filter and returns the 100 newest audit-log rows of the whole organization (action, resource type, outcome, severity and the acting user id as auditor) to any officer, so a path named for the audit of an investigation discloses the organization-wide activity trail and cannot show the audit of one investigation.'),
  D('DEF-0B8-JUR-KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS-ENTITLEMENT-AND-LEAVE-NO-READ-TRACE', KT, 'MEDIUM',
    'The knowledge-base list and item routes filter only by the organization and its parent and by is_active: they never read is_public or allowed_organizations, so the access-control columns of the table do not limit a read (the publish route stores exit-interview copies with is_public false and they are still returned), they apply no union_knowledge_suite entitlement although publication requires it, the list q parameter matches the full content of rows whose content it does not return (a search oracle over exit-interview text), and neither read writes an audit record of who opened which document.'),
  D('DEF-0B8-JUR-KNOWLEDGE-BASE-ITEM-GET-INCREMENTS-VIEW-COUNT-IN-SYSTEM-CONTEXT-WITHOUT-ORG-PREDICATE', K006, 'LOW',
    'The knowledge-base item GET writes: after the read it runs UPDATE knowledge_base SET view_count = view_count + 1 WHERE id under withSystemContext, which bypasses row-level security, with no organization predicate, not awaited and with no audit record; the id was matched under an organization predicate by the select just before, but the write itself is an unscoped system-context statement that a read-only route should not hold.'),
  D('DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK', PRIVACY, 'HIGH',
    'The geofence GET takes latitude and longitude from the query string and, when the point is inside the fence, checkGeofenceEntry inserts a geofence_events row with the member user id, the geofence id and the precise coordinates through the shared db handle, with no call to hasValidConsent, no tracking-enabled check, no transaction and no audit record, so a member who never opted in or revoked consent has a precise position stored by a GET, and that row can be neither read nor deleted through the consent routes (revocation answers 404 when no active consent exists).',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any signed-in user whose organization owns a geofence can call GET /api/location/geofence with that geofence id and a point inside it, and a geofence_events row with the user id and the coordinates is stored whether or not the user holds an active location consent; no web or mobile caller of the route exists in the repository, and the only deletion of such rows is the retention handler that no scheduler entry invokes.',
        potentialImpact: {
          classes: ['PRIVACY_OR_CONSENT'],
          description: 'A client that checks geofence entry for members who have not opted in, or after revocation, records their precise position without the explicit opt-in the service header promises and without a trace in the audit trail, and the member has no route that erases those rows.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/location/geofence/route.ts', quote: 'export const GET = withApiAuth(async (req: NextRequest) => {' },
          { ref: 'apps/union-eyes/services/geofence-privacy-service.ts', quote: 'await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);' },
        ],
        existingContainment: {
          summary: 'The caller must belong to the organization that owns the geofence and the stored user id is the session user, so only the caller own position is stored; the row carries a 24-hour expiry that the retention handler, not the route, acts on.',
          evidence: [
            { ref: 'apps/union-eyes/services/geofence-privacy-service.ts', quote: 'if (fence.unionLocalId !== trustedUnionLocalId) {' },
            { ref: 'apps/union-eyes/services/geofence-privacy-service.ts', quote: 'expiresAt.setHours(expiresAt.getHours() + this.MAX_RETENTION_HOURS);' },
          ],
        },
        blockingCondition: 'A web or mobile client calls the geofence entry check for a member who has no active location consent, or the location retention handler remains unscheduled while any client submits positions.',
        justification: 'The route stores a precise position on a GET with no consent condition, which contradicts the opt-in rule stated by the service; the data is the caller own and no client in the repository calls the route, so the release is blocked when a client submits positions for members without consent or without the retention job running.',
      },
    }),
  D('DEF-0B8-JUR-LOCATION-ERASURE-IS-REACHABLE-ONLY-THROUGH-AN-ACTIVE-CONSENT', PRIVACY, 'MEDIUM',
    'The consent DELETE revokes consent and deletes the member location points and geofence events only after an update that matches a consent row whose status is not opted_out, and it answers 404 and deletes nothing when the member has no such row, so a member whose positions were stored without consent (geofence entry check), whose consent was revoked earlier, or who never had a consent row, has no route that erases the stored rows and depends on the retention handler that no scheduler invokes.'),
  D('DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500', PRIVACY, 'MEDIUM',
    'The location track POST inserts the precise position through the shared db handle with no transaction, no persistAtomicAudit, no location_tracking_audit row and no log of the write, although consent grant and revocation are audited, so no record shows when positions were collected for a member; getConfig creates a default configuration row with tracking enabled on first use as a side effect of this write path; and a missing consent, a disabled configuration and any database failure are all answered 500 with the raw error message.'),
  D('DEF-0B8-JUR-LOCATION-CONSENT-IS-NOT-BOUND-TO-PURPOSE-ORGANIZATION-OR-STRIKE', PRIVACY, 'MEDIUM',
    'The location consent row is unique by user id alone with no organization, strike or event column, and tracking checks only that an opted-in row exists plus the strike or event flag for strike, picket and event points: the free-text consentPurpose and the purpose description are never compared with the purpose of a point, meeting and organizing points need nothing beyond an opt-in, and strikeId and eventId are accepted as any uuid and not verified to belong to the organization, so a consent given for one purpose in one organization authorizes collection for every other purpose, strike and event.'),
  D('DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED', PRIVACY, 'MEDIUM',
    'The consent POST stores the consentText, purpose and purposeDescription exactly as the request body gives them, under a fixed consentVersion of 1.0: the zod schema declared for the route is never applied (the body is destructured unchecked and only checked for presence), the server holds no copy of the text the member was shown, and the same request can claim any text, so the stored consent record, which the privacy model calls the exact text shown to the user, is attested by the caller and not by the application.'),
  D('DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT', PRIVACY, 'LOW',
    'The consent status GET calls hasValidConsent, which updates the consent row to expired through the shared db handle, with no transaction and no audit record, when the stored expiry has passed, and reflects the unvalidated context query parameter without checking that it is strike or event, so a read changes the consent state and leaves no trace.'),
  D('DEF-0B8-JUR-GEOFENCE-CREATE-BODY-IS-UNVALIDATED-AND-STRIKE-ID-UNVERIFIED', PRIVACY, 'MEDIUM',
    'The geofence POST applies no schema (the declared zod schema is unused): name, type, coordinates and radius are checked only for presence and simple comparisons on the raw body values, so a string coordinate passes the range checks and then fails at toFixed with a 500, the radius has no upper bound, so a geofence the size of the planet makes every position inside it, the geofence type is any text, and strikeId is stored without being verified to belong to the organization.'),
  D('DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR', FINANCE, 'MEDIUM',
    'The /api/healthwelfare/plans route is the generic crudRoutes configuration over per_capita_remittances and has nothing to do with health and welfare plans: a GET returns the organization remittance ledger at the member floor (member counts, per-capita rate, total amount, approver and rejecter user ids, rejection reason, payment method and reference, remittance and receipt file URLs), and a POST is refused because the table is READ_ONLY in the CRUD governance table, so every member reads financial remittance records and no plan exists behind the name.'),
  D('DEF-0B8-JUR-MEETING-ROOM-BOOKINGS-PATH-IS-THE-ROOM-ITEM-DELETE-ARCHIVES-THE-ROOM', CALENDAR, 'MEDIUM',
    'The /api/meeting-rooms/[id]/bookings route is the generic item configuration over meeting_rooms: its id is a room id and a GET returns the room row (not its bookings, which live in room_bookings and are read by nothing here), and a DELETE sent to a bookings path to cancel a booking removes the room itself at the administrator floor, so a client that treats the path as a booking collection cancels no booking and takes the room out of service.'),
]

const hh = (a, claim, pattern) => {
  try {
    return a.h(claim, pattern)
  } catch (error) {
    try {
      return a.local(claim, 'handler', pattern)
    } catch {
      throw error
    }
  }
}

const COMPLIANCE_DECISION = ['UE-INST-COMPLIANCE-DETERMINATION-AUTHORITY']
const LOCATION_DECISION = ['UE-INST-MEMBER-LOCATION-PROCESSING']

/* ------------------------------------------------------------------------------------------------------------ */
/* jurisdiction rules and labour standards                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const rulesFuture = 'Serve statutory parameters from a governed, versioned source that names the office that determined each value, its effective date and its unit; give each rule a label that matches its meaning (an employer reporting period is not an arbitration deadline); reject an unknown jurisdiction code with 400; and do not let any screen present a compliant or violation verdict from these numbers until the determining office is named.'

const rulesGet = (a) => mk({
  persona: 'Signed-in user, such as a steward or officer, requesting statutory rule parameters for a jurisdiction code',
  service: `${API}jurisdiction-rules/route.ts (GET) over lib/canadian-labour-standards constants`,
  authn: 'Session check by the deprecated withApiAuth guard, which answers 401 when auth() carries no user id; no organization is resolved.',
  cat: 'SESSION_ONLY',
  authz: 'No role check and no organization: every signed-in caller receives the same rules for the jurisdiction named in the query string. A session is not a kernel decision and nothing names the office that determined the parameters.',
  tenant: 'None: the route reads no organization data. The jurisdiction code comes from the query string, defaulting to CA-FED, and indexes constants compiled into the application.',
  owner: 'No stored rows: break, overtime, termination notice and workers compensation constants of lib/canadian-labour-standards.',
  sens: 'Statute citations and numeric parameters (break minutes, overtime thresholds, notice tiers and a deadline number); no personal or organization data',
  priv: 'No personal data is returned. The deadline figure is returned as the WCB Claim Filing Deadline of the arbitration_deadline category, which is not what the constant records.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'A deadline or verdict that a representative relies on in a case should be recorded with the source version used; this read needs no audit record itself.',
  does: 'Maps the query code to a jurisdiction, builds a rule list from the workers compensation, break, overtime and termination notice constants, optionally filters by category and returns success true with the list; an unknown code returns an empty list, and any exception returns 500.',
  status: 'PARTIAL',
  gate: 14,
  deps: [13],
  future: rulesFuture,
  dec: COMPLIANCE_DECISION,
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authorization', 'export const GET = withApiAuth(handler);'),
    a.local('tenantScope', 'handler', "const jurisdictionParam = searchParams.get('jurisdiction') || 'CA-FED';"),
    a.local('mutation', 'handler', 'const allRules = buildRulesForJurisdiction(jur);'),
    a.local('behavior', 'handler', 'success: true,'),
    a.local('defect', 'handler', 'const jur = parseJurisdictionCode(jurisdictionParam);'),
    a.local('defect', 'handler', 'const allRules = buildRulesForJurisdiction(jur);'),
    a.local('behavior', 'handler', "{ success: false, error: 'Failed to fetch jurisdiction rules' },"),
    a.svc('defect', WCB, "notes: 'Employer must report within 72 hours. myWCB online portal for filing.',", 'WCB_BOARDS'),
    a.svc('defect', WCB, "notes: 'Employer must report within 5 business days. Online filing via WCBSask portal.',", 'WCB_BOARDS'),
    a.svc('defect', WCB, 'return WCB_BOARDS[jurisdiction].claimDeadlineDays;', 'getClaimDeadlineDays'),
    a.svc('defect', TERMINATION, '{ minYears: 7, maxYears: 8, weeksNotice: 8 },', 'TERMINATION_NOTICE'),
    a.svc('defect', TERMINATION, 'yearsOfService >= tier.minYears &&', 'calculateTerminationNotice'),
  ],
  inf: [
    { claim: 'defect', statement: 'The rule list is built by indexing WCB_BOARDS, BREAK_RULES, OVERTIME_RULES and TERMINATION_NOTICE, plain objects, with a string that is not validated against the key set; an unknown key gives undefined and no rule and success stays true, and an inherited key such as constructor gives a truthy function that the for-of over break rules cannot iterate, which the try block reports as a generic 500.' },
    { claim: 'defect', statement: 'The only consumer of the arbitration_deadline category in the repository is components/jurisdiction/compliance-checker.tsx, which turns the first rule parameters.deadline_days (default 30) into a compliant or violation check message; the component is exported from components/jurisdiction/index.ts and no page imports it.' },
  ],
  def: [
    'DEF-0B8-JUR-WCB-REPORTING-DEADLINE-SERVED-AS-ARBITRATION-DEADLINE',
    'DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS',
    'DEF-0B8-JUR-STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS',
    'DEF-0B8-JUR-RULES-ROUTE-ACCEPTS-ANY-CODE-AND-ANSWERS-SUCCESS-WITH-NO-OR-WRONG-RULES',
  ],
  corr: [],
})

const publicLabourFuture = 'Decide whether labour standards are public reference data, record that decision in the route exposure contract and the public-route list the edge enforces, and serve versioned, sourced values; until then the unauthenticated profile must not carry a placeholder wage or an incomplete notice schedule.'

const labourBase = (a) => ({
  persona: 'Unauthenticated visitor or signed-in user reading Canadian labour standards reference data',
  service: `${API}${a.route} (GET via withApi) over lib/canadian-labour-standards constants`,
  authn: 'None required: the route declares auth required false, so withApi resolves no session and the handler runs for any caller.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check: auth required is false in the route configuration. The route is not on the public-route list that the edge consults, and nothing names the office that decided the data is public.',
  tenant: 'None: no organization data is read; the response is built from constants compiled into the application.',
  owner: 'No stored rows: break, overtime, termination notice, statutory holiday, board, anti-scab and pay equity constants of lib/canadian-labour-standards.',
  sens: 'Statute names, citations and numeric labour-standards parameters for the 14 Canadian jurisdictions; no personal or organization data',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'No audit record is needed for public reference data once the exposure contract and the data version are recorded.',
  status: 'PARTIAL',
  gate: 14,
  deps: [13, 15],
  dec: COMPLIANCE_DECISION,
  future: publicLabourFuture,
})

const labourEv = (a) => [
  a.h('authentication', 'auth: { required: false },'),
  a.imp('authentication', 'withApi', 'const requireAuth = options.auth?.required !== false'),
  a.h('authorization', 'auth: { required: false },'),
]

const labourListGet = (a) => mk({
  ...labourBase(a),
  priv: 'No personal data. The list gives each jurisdiction a code, a name and counts and thresholds taken from the constants; a count of notice tiers is not a statement that the schedule is complete.',
  does: 'Maps the 14 jurisdiction codes to a summary row (break rule count, weekly overtime threshold, notice tier count, statutory holiday count, board acronyms, anti-scab and pay equity flags) from constants and returns the array.',
  ev: [
    ...labourEv(a),
    a.h('tenantScope', 'const jurisdictions = ALL_JURISDICTIONS.map((code) => ({'),
    a.h('mutation', 'return jurisdictions;'),
    a.h('behavior', 'terminationNoticeTiers: TERMINATION_NOTICE[code]?.tiers.length ?? 0,'),
    a.svc('defect', TERMINATION, '{ minYears: 7, maxYears: 8, weeksNotice: 8 },', 'TERMINATION_NOTICE'),
  ],
  inf: [
    { claim: 'defect', statement: 'The route is absent from lib/public-routes.ts PUBLIC_API_ROUTES and from proxy.ts, so the unauthenticated access is declared only in the route configuration; the three public-route lists and the edge do not agree on it.' },
  ],
  def: [
    'DEF-0B8-JUR-STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS',
    ROUTE_ALLOWLIST,
  ],
  corr: [],
})

const labourProfileGet = (a) => mk({
  ...labourBase(a),
  priv: 'No personal data. The profile returns the full constant tables for one jurisdiction, including a zero minimum wage placeholder and a British Columbia notice schedule that stops at 8 years.',
  does: 'Validates the path jurisdiction against the 14 codes (400 otherwise) and returns the profile: Act name, break rules, overtime rule, termination notice schedule, statutory holidays, board entries, anti-scab and pay equity entries from constants and a minimumWage of hourly 0 and effectiveDate varies.',
  ev: [
    ...labourEv(a),
    a.h('tenantScope', 'const profile = {'),
    a.h('mutation', 'return profile;'),
    a.h('behavior', 'terminationNotice: TERMINATION_NOTICE[jurisdiction],'),
    a.h('defect', "minimumWage: { hourly: 0, effectiveDate: 'varies' }, // populated by live data"),
    a.svc('defect', TERMINATION, '{ minYears: 7, maxYears: 8, weeksNotice: 8 },', 'TERMINATION_NOTICE'),
  ],
  inf: [
    { claim: 'defect', statement: 'No statement of the handler reads a database, file or network source for minimumWage; the value is a literal object, so the live data named in the comment does not exist in the route.' },
    { claim: 'defect', statement: 'The route is absent from lib/public-routes.ts PUBLIC_API_ROUTES and from proxy.ts, so the unauthenticated access is declared only in the route configuration.' },
  ],
  def: [
    'DEF-0B8-JUR-PROFILE-MINIMUM-WAGE-IS-A-PLACEHOLDER-ZERO',
    'DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS',
    'DEF-0B8-JUR-STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS',
    ROUTE_ALLOWLIST,
  ],
  corr: [],
})

const complianceCheckPost = (a) => mk({
  persona: 'Steward or higher role typing an organization practice (hours, breaks, notice given, holidays observed) to compare against a jurisdiction labour standard',
  service: `${API}${a.route} (POST via withApi) over lib/canadian-labour-standards constants`,
  authn: `${SESSION} (withApi with an authenticated session and an organization context).`,
  authz: 'withApi with a steward role floor (auth minRole steward). The check reads nothing of the organization: a role title is not a kernel decision and no office is named as the one that determines a violation.',
  tenant: 'None: the organization of the session is not read or used; the findings are computed from the typed numbers and the jurisdiction in the path.',
  owner: 'No stored rows: the response is computed from the request body and constants; nothing is saved.',
  sens: 'Hours, notice weeks, tenure and practice flags typed by the caller, and statute citations; the practice is not tied to an employer, employee or organization record',
  priv: 'No personal data is stored or returned beyond what the caller typed; the response labels typed numbers as violations, warnings or info against the constants.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'A POST that only computes findings from the request body and constants; it inserts, updates and deletes nothing.',
  auditDetail: 'The handler writes no row and no audit record; the verdict and its inputs are not kept.',
  reqAudit: 'A compliance verdict that a representative relies on should be recorded with the inputs, the rule version and the office that determined it; this route keeps none.',
  does: 'Validates the jurisdiction, then compares the typed meal break, weekly hours (overtime), tenure and notice weeks, statutory holidays observed, replacement workers and pay equity flag with the constants and returns the counts and findings (violation, warning, info); a field that is absent skips its check, and a British Columbia tenure of 8 years or more matches no notice tier and yields no finding.',
  status: 'PARTIAL',
  gate: 14,
  deps: [13],
  dec: COMPLIANCE_DECISION,
  future: 'Compute a compliance verdict only from records of the organization against versioned statutory parameters, name the office that determined it, list the checks evaluated and those skipped, bound the inputs, repair the schedule gaps in the constants, and keep the inputs and the result.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'steward' },"),
    a.h('tenantScope', 'const code = params.jurisdiction?.toUpperCase() === \'FEDERAL\''),
    a.h('mutation', 'const findings: ComplianceFinding[] = [];'),
    a.h('behavior', 'const required = calculateTerminationNotice(jurisdiction, body.tenureYears);'),
    a.h('behavior', 'totalFindings: findings.length,'),
    a.h('defect', 'if (body.tenureYears != null && body.terminationNoticeWeeks != null) {'),
    a.h('audit', 'totalFindings: findings.length,'),
    a.svc('defect', TERMINATION, '{ minYears: 7, maxYears: 8, weeksNotice: 8 },', 'TERMINATION_NOTICE'),
    a.svc('defect', TERMINATION, 'yearsOfService >= tier.minYears &&', 'calculateTerminationNotice'),
  ],
  inf: [
    { claim: 'defect', statement: 'Every field of complianceBodySchema is optional and each block of the handler is guarded by a presence test on its own fields, so a body with no fields runs no block and the handler returns zero findings with 200; the response names no check that ran.' },
    { claim: 'defect', statement: 'The only caller of this route found in the repository is app/api/__tests__/labour-standards-compliance-check.route.test.ts; no component or page calls it.' },
  ],
  def: [
    'DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS',
    'DEF-0B8-JUR-COMPLIANCE-CHECK-REPORTS-ZERO-FINDINGS-WHEN-NO-CHECK-APPLIES',
    'DEF-0B8-JUR-STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS',
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* generic CRUD facades                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const jurisdictionUnitProfile = {
  persona: 'Member reading, and steward adding, bargaining unit rows through a path that is named for a CLC compliance check or a deadline validation',
  owner: 'bargaining_units rows of the organization: unit name, number and type, certification number, date and body, contract expiry and next bargaining date, classifications, member count, and chief steward and chair user ids.',
  sens: 'Bargaining unit identity and certification details, contract expiry and next bargaining dates, classifications, member counts and the user ids of the chief steward and the bargaining chair',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the bargaining unit rows of the organization, with certification details, contract and bargaining dates and the user ids of the unit officers; no compliance or deadline result is returned.'
    : 'The response returns the stored bargaining unit row; the audit record lists the field names written and no values; no compliance or deadline validation result exists.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of bargaining_units rows of the organization at a role floor of ${floor}. It checks no CLC rule, validates and calculates no deadline, and reads no jurisdiction source, whatever the path segment says.`
    : `Inserts a bargaining_units row from the request body at a role floor of ${floor} and answers success. It validates no deadline, checks no CLC rule and returns no verdict, whatever the path segment says.`),
  future: 'Retire the path names or build the compliance check and the deadline validation as real operations that read the records of the organization, cite a governed statutory source, name the office that determined the result and keep it; take the unit rows to a route named for them with the offices that may read contract and bargaining dates.',
  gate: 14,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: COMPLIANCE_DECISION,
  def: () => ['DEF-0B8-JUR-CLC-AND-DEADLINE-PATHS-ARE-BARGAINING-UNIT-CRUD-NO-VALIDATION'],
  extraEv: (a) => [
    a.tbl('defect', 'bargainingUnits', /contractExpiryDate: date\('contract_expiry_date'\)/),
    a.tbl('privacy', 'bargainingUnits', /chiefStewardId: text\('chief_steward_id'\)/),
    a.tbl('defect', 'bargainingUnits', /nextBargainingDate: date\('next_bargaining_date'\)/),
  ],
  reqRead: 'Audit reads of bargaining unit rows once the offices that may read contract and bargaining dates are named.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file configures crudRoutes over bargainingUnits and imports no jurisdiction, deadline, calendar or rule module, so the path segments clc-compliance and validate-deadline select nothing and the same bargaining unit rows come back from both.' },
  ],
}

const remittanceProfile = {
  persona: 'Member reading the per-capita remittance ledger of the organization through a path named for health and welfare plans; a steward write is refused',
  owner: 'per_capita_remittances rows keyed by the submitting organization (organizationId, an alias of fromOrganizationId) and the receiving organization (toOrganizationId); no health or welfare plan table is read.',
  sens: 'Per-capita remittance months, member counts, rates, total amounts, approver and rejecter user ids, rejection reasons, payment method and reference and remittance and receipt file URLs',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the remittance rows of the submitting organization, including member counts, rate and total amount, the user ids of the approver and rejecter, the rejection reason, the payment reference and the remittance and receipt file URLs.'
    : 'Nothing is stored: per_capita_remittances is READ_ONLY in the CRUD governance table, so the write is refused with 403 before any row or audit record is written.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of per_capita_remittances rows of the organization at a role floor of ${floor}. No health and welfare plan, benefit or carrier record is read, whatever the path says.`
    : `Answers 403 to every caller at the ${floor} role floor: assertCrudWrite refuses the READ_ONLY per_capita_remittances table before the insert.`),
  future: 'Retire the health and welfare path name or build a plan route with its own table and offices; put the remittance ledger behind the financial offices the institution names with an authority check and a read audit, and keep approval and payment fields out of any generic write.',
  gate: 5,
  deps: [1, 13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: () => ['DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER-AT-MEMBER-FLOOR'],
  extraEv: (a) => [
    a.tbl('privacy', 'perCapitaRemittances', /rejectionReason: text\('rejection_reason'\)/),
    a.tbl('privacy', 'perCapitaRemittances', /paymentReference: varchar\('payment_reference'/),
    a.tbl('privacy', 'perCapitaRemittances', /receiptFileUrl: text\('receipt_file_url'\)/),
  ],
  reqRead: 'Audit reads of the remittance ledger once the financial offices that may read it are named.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file configures crudRoutes over perCapitaRemittances and imports no plan, benefit or carrier module; the table records monthly per-capita payments from local unions to parent organizations, so the healthwelfare/plans name describes no stored data.' },
  ],
}

const meetingRoomProfile = {
  persona: 'Member reading a meeting room row, and administrator removing one, through a path named for the bookings of the room',
  owner: 'meeting_rooms rows of the organization (name, building, floor, capacity, features, status, booking rules); bookings are held by room_bookings, which no statement of this route reads.',
  sens: 'Meeting room name, building address, capacity, equipment and booking rules',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the room row for the id, with its address, equipment and booking rules; no booking, booker or purpose is returned.'
    : 'The removed room row is returned; the audit record names the fields it changed; no booking is cancelled or returned.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns the meeting_rooms row for the path id scoped to the organization at a role floor of ${floor}; the bookings segment of the path selects nothing and room_bookings is not read.`
    : `Archives or deletes the meeting_rooms row for the path id at the fixed administrator floor (${floor}); no booking is looked up or cancelled.`),
  future: 'Give the bookings path its own handlers over room_bookings with an owner or booker condition, or retire the path; bind the room item route to a room path, and decide with the institution who may take a room out of service and what becomes of its bookings.',
  gate: 14,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: () => ['DEF-0B8-JUR-MEETING-ROOM-BOOKINGS-PATH-IS-THE-ROOM-ITEM-DELETE-ARCHIVES-THE-ROOM'],
  extraEv: (a) => [
    a.tbl('defect', 'meetingRooms', /status: roomStatusEnum\('status'\)/),
    a.tbl('privacy', 'meetingRooms', /address: text\('address'\)/),
  ],
  reqRead: 'Reads of room rows need no audit record; removal of a room should be audited with the bookings it affects.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file configures crudRoutes over meetingRooms with itemRoute true and imports no booking module; the path segment bookings selects nothing and the id in the path is a meeting room id, so a booking id sent to this route addresses no booking.' },
  ],
}

/* ------------------------------------------------------------------------------------------------------------ */
/* alias wrappers: intelligence, investigations, investigations audit                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const aliasGuardEv = (a, delegateCall) => [
  a.local('authorization', 'requireOrgAccess', 'return true;'),
  hh(a, 'authorization', 'if (!requireOrgAccess(request)) {'),
  hh(a, 'defect', delegateCall),
]

const intelligenceGet = (a) => mk({
  persona: 'Member reading the insight recommendation rows of the organization through a path named intelligence',
  service: `${API}intelligence/route.ts (alias of analytics/insights) over the generic CRUD factory for insight_recommendations`,
  authn: 'Authenticated session resolved by the generic CRUD factory in the delegated analytics/insights handler; the alias adds only a requireOrgAccess placeholder that returns true.',
  authz: 'The delegated handler is the generic CRUD factory with a member read floor. The alias guard requireOrgAccess always returns true and contributes nothing. A role title is not a kernel decision.',
  tenant: 'The delegated factory scopes the query to the session organization (orgScoped true and insight_recommendations has an organization column).',
  owner: 'insight_recommendations rows of the organization; the rows are stored values, not output of a model run by this route.',
  sens: 'Insight recommendation text, type, confidence score, AI reference id and status of the organization',
  priv: 'Any member receives the stored insight recommendation rows of the organization, including AI reference ids and confidence scores that a steward can write.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the delegated factory and the alias write no row and no audit record.',
  reqAudit: 'Reads of recommendations need no audit record unless they carry personal data; if recommendations are produced by a model the production of each should be audited.',
  does: 'Passes the request to the analytics/insights collection handler, which lists insight_recommendations rows of the organization at the member floor; no model is called and nothing is computed, whatever the name intelligence suggests.',
  status: 'FACADE_OVER_GENERIC_TABLE',
  gate: 14,
  deps: [13],
  future: 'Retire the alias or build an intelligence route that names its source, records each model invocation in an audit record, discloses the data class sent to a model and keeps stored rows apart from model output; replace the placeholder guard with a real authority decision.',
  ev: [
    ...aliasGuardEv(a, 'return DelegateGET(request as never, context as never);'),
    hh(a, 'authentication', 'return DelegateGET(request as never, context as never);'),
    a.svc('authorization', `${API}analytics/insights/route.ts`, "readRole: 'member',"),
    a.svc('authentication', CRUD_FACTORY, 'auth: { required: true, minRole: readRole },'),
    a.svc('tenantScope', CRUD_FACTORY, 'conditions.push(eq(orgCol, organizationId));'),
    a.svc('mutation', CRUD_FACTORY, /db\.select\(\)\.from\(table\)/),
    a.svc('behavior', `${API}analytics/insights/route.ts`, 'table: insightRecommendations,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The alias imports only the delegated handlers and zod, and the delegate file configures crudRoutes over insightRecommendations and imports no model client, so no intelligence is computed by either file.' },
  ],
  def: [
    'DEF-0B2-ANALYTICS-CRUD-FACADE',
    'DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD',
  ],
  corr: [],
})

const intelligencePost = (a) => mk({
  persona: 'Steward storing an insight recommendation row through a path named intelligence',
  service: `${API}intelligence/route.ts (alias of analytics/insights) over the generic CRUD factory for insight_recommendations`,
  authn: 'Authenticated session resolved by the generic CRUD factory in the delegated analytics/insights handler; the alias adds only a requireOrgAccess placeholder that returns true.',
  authz: 'The delegated handler is the generic CRUD factory with a steward write floor. The alias guard requireOrgAccess always returns true and the mutation boundary check parses only the method string. A role title is not a kernel decision.',
  tenant: 'The delegated factory writes the session organization on the insert (orgScoped true and insight_recommendations has an organization column).',
  owner: 'insight_recommendations rows of the organization; the caller chooses the type, text, AI reference id and confidence score the row carries.',
  sens: 'Insight recommendation text, type, confidence score, AI reference id and status',
  priv: 'The stored row is returned to the steward and then served to every member as an insight; the audit record lists the field names written and no values.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The delegated factory commits the row and persistAtomicAudit (crud.insight_recommendations.create) in one tenant transaction; the alias adds no audit record. The audit lists field names and no values and does not mark a row as caller-written rather than model-produced.',
  reqAudit: 'Keep the factory in-transaction audit record and add whether the row was produced by a model or typed by a person, with the model invocation when there is one.',
  does: 'Runs the analytics/insights POST handler unchanged after the placeholder guard: the factory inserts an insight_recommendations row from the request body at the steward floor, including any AI reference id and confidence score the caller sends, and serves it back as an insight; no model is called.',
  status: 'FACADE_OVER_GENERIC_TABLE',
  gate: 14,
  deps: [13],
  future: 'Retire the alias or make recommendations an output of an audited model run only; block the AI reference, confidence and status columns from the body; replace the placeholder guard and the method-string check with a real authority decision.',
  ev: [
    ...aliasGuardEv(a, 'return DelegatePOST(request as never, context as never);'),
    hh(a, 'authentication', 'return DelegatePOST(request as never, context as never);'),
    a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'),
    a.svc('authorization', `${API}analytics/insights/route.ts`, "writeRole: 'steward',"),
    a.svc('authentication', CRUD_FACTORY, 'auth: { required: true, minRole: writeRole },'),
    a.svc('tenantScope', CRUD_FACTORY, 'conditions.push(eq(orgCol, organizationId));'),
    a.svc('mutation', CRUD_FACTORY, 'tx.insert(table).values(finalValues)'),
    a.svc('audit', CRUD_FACTORY, 'await persistAtomicAudit(tx, {'),
    a.svc('defect', CRUD_FACTORY, MASS_CREATE, 'crudRoutes'),
  ],
  inf: [
    { claim: 'defect', statement: 'The alias imports only the delegated handlers and zod, and the delegate file configures crudRoutes over insightRecommendations with no blockedPatchFields, so the body can set the AI reference id, confidence score and status of a row that is then served as an insight.' },
  ],
  def: [
    'DEF-0B2-ANALYTICS-CRUD-FACADE',
    'DEF-0B3-ANALYTICS-ROWS-FORGE-AI-PROVENANCE',
    'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT',
    'DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD',
  ],
  corr: [],
})

const casesAuthzGet = "auth: { required: true, minRole: 'member' },"
const casesAuthzPost = "auth: { required: true, minRole: 'steward' },"

const investigationsBase = (a) => ({
  persona: 'Case-handling staff, or the member on their own case, reaching the case collection through a path named investigations',
  service: `${API}investigations/route.ts (alias of cases) over withApi and the case authorization library`,
  authn: 'Session resolved by withApi in the delegated cases handler; the alias adds only a requireOrgAccess placeholder that returns true.',
  authz: 'The delegated cases handler applies the withApi role floor and the case read scope of the actor (members their own cases, case-handling staff the organization, a triage designation the unassigned queue as metadata). The alias guard returns true and contributes nothing. A role floor is not a kernel decision.',
  tenant: 'The delegated handler scopes reads through caseReadScope of the case actor and the insert writes the session organization.',
  owner: 'claims rows of the organization and organization_members name and e-mail joined to them; no investigation record exists.',
  sens: 'Claim number, member id, name and e-mail, description, location, desired outcome, assignee, AI and merit scores, amounts and resolution',
  status: 'FACADE_OVER_GENERIC_TABLE',
  gate: 4,
  deps: [10, 13],
  dec: [],
})

const investigationsGet = (a) => mk({
  ...investigationsBase(a),
  priv: 'The caller receives up to 200 case rows within the case read scope, with the member name and e-mail, the description and the AI scores, and the unassigned queue as metadata when a triage designation is held.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the delegated handler and the alias write no row and no audit record.',
  reqAudit: 'Reads of case descriptions carrying personal and disciplinary content should be audited once the readers are named.',
  does: 'Passes the request to the cases list handler: the case read scope selects up to 200 claims rows of the organization with the member name and e-mail and a triage queue; no investigation concept is read, whatever the path name says.',
  future: 'Retire the alias or define an investigation record (parties, investigator, confidentiality marking, findings) with its own authority decision and audit; replace the placeholder guard with a real check.',
  ev: [
    ...aliasGuardEv(a, 'return DelegateGET(request as never, context as never);'),
    a.imp('authentication', 'GET', casesAuthzGet),
    a.imp('authorization', 'GET', casesAuthzGet),
    a.imp('tenantScope', 'GET', 'const orgFilter = sql`AND ${caseReadScope(actor, \'c\')}`;'),
    a.imp('mutation', 'GET', 'LIMIT 200'),
    a.imp('privacy', 'GET', 'm.email  AS "memberEmail"'),
  ],
  inf: [
    { claim: 'defect', statement: 'The alias imports only the delegated cases handlers and zod, and the cases handler reads the claims table; no table, column or service named for investigations is reached from either file.' },
  ],
  def: [
    'DEF-0B8-JUR-INVESTIGATIONS-PATH-IS-THE-CASE-COLLECTION-NO-INVESTIGATION-RECORD',
    'DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD',
  ],
  corr: [],
})

const investigationsPost = (a) => mk({
  ...investigationsBase(a),
  priv: 'The created claim row (description, witness details, desired outcome and the member link) is stored for the organization; the response returns the created case.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The delegated cases handler commits the claim and persistAtomicAudit in one RLS transaction; the alias adds no audit record of its own and the audit does not mark the claim as an investigation.',
  reqAudit: 'Keep the in-transaction audit record of the case creation and add the authority decision that allowed filing a case for the member.',
  does: 'Runs the cases POST handler unchanged after the placeholder guard and a check that the request has a method string: a steward creates a claims row for the organization from the validated body; no investigation record is created.',
  future: 'Retire the alias or define an investigation record with its own authority decision; replace the placeholder guard and the method-string check, which prove nothing, with a real authority decision.',
  ev: [
    ...aliasGuardEv(a, 'return DelegatePOST(request as never, context as never);'),
    a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'),
    a.imp('authentication', 'POST', casesAuthzPost),
    a.imp('authorization', 'POST', casesAuthzPost),
    a.imp('tenantScope', 'POST', "if (!organizationId) throw ApiError.badRequest('Organization context required');"),
    a.imp('mutation', 'POST', 'const parsed = caseCreateSchema.safeParse(body);'),
    a.imp('audit', 'POST', 'await persistAtomicAudit('),
  ],
  inf: [
    { claim: 'defect', statement: 'validateMutationBoundary parses an object built from request.method, which is always a string, so the schema cannot fail; requireOrgAccess returns the literal true, so the 401 branch is unreachable; the route imports nothing but the delegated handlers and zod.' },
  ],
  def: [
    'DEF-0B8-JUR-INVESTIGATIONS-PATH-IS-THE-CASE-COLLECTION-NO-INVESTIGATION-RECORD',
    'DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD',
  ],
  corr: [],
})

const investigationsAuditGet = (a) => mk({
  persona: 'Officer reading the organization audit-log rows through a path named investigations audit',
  service: `${API}investigations/audit/route.ts (alias of audits) over withApi and the audit_logs table`,
  authn: 'Session resolved by withApi in the delegated audits handler; the alias adds only a requireOrgAccess placeholder that returns true.',
  authz: 'The delegated audits handler applies the withApi officer role floor. The alias guard returns true and contributes nothing. The institutional decision on who may read audit history is not recorded; a role floor is not a kernel decision.',
  tenant: 'The delegated handler selects audit_logs with the organization predicate of the session (auditLogs.organizationId equals organizationId).',
  owner: 'audit_logs rows of the organization from the legacy audit security table; the route reads no investigation record.',
  sens: 'Audit action names, resource types, outcomes, severities and the user ids of the acting users',
  priv: 'Any officer receives the 100 newest audit rows of the organization with the acting user id presented as the auditor, regardless of which case or investigation the caller is working on.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the delegated handler and the alias write no row and no audit record of the audit read.',
  reqAudit: 'Record each read of organization audit history with the reader and the filter used once the readers are named.',
  does: 'Passes the request to the audits list handler: selects the 100 newest audit_logs rows of the organization and presents each as an audit engagement with a status derived from the outcome, findings 0 and hasReport false; no investigation id or filter is read.',
  status: 'FACADE_OVER_GENERIC_TABLE',
  gate: 14,
  deps: [13],
  dec: ['UE-INST-AUDIT-HISTORY-READERS'],
  future: 'Retire the alias or build an investigation audit route keyed by an investigation id with its own readers and redaction; replace the placeholder guard with a real check and read the canonical audit table.',
  ev: [
    ...aliasGuardEv(a, 'return DelegateGET(request as never, context as never);'),
    a.imp('authentication', 'GET', "{ auth: { required: true, minRole: 'officer' } },"),
    a.imp('authorization', 'GET', "{ auth: { required: true, minRole: 'officer' } },"),
    a.imp('tenantScope', 'GET', '.where(eq(auditLogs.organizationId, organizationId!))'),
    a.imp('mutation', 'GET', '.orderBy(desc(auditLogs.createdAt))'),
    a.imp('privacy', 'GET', "auditor: row.userId ?? 'system',"),
    a.imp('defect', 'GET', '.limit(100);'),
    a.imp('defect', 'GET', 'findings: 0,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The alias imports only the delegated audits handler, and the audits handler reads no request parameter; no investigation id, case id or filter is read by either file, so the response is the same organization-wide page for every caller of the officer role.' },
  ],
  def: [
    'DEF-0B8-JUR-INVESTIGATIONS-AUDIT-PATH-RETURNS-THE-WHOLE-ORGANIZATION-AUDIT-LOG',
    'DEF-0B3-AUDITS-FABRICATED-ENGAGEMENT-FIELDS',
    'DEF-0B3-AUDITS-LEGACY-TABLE-NOT-CANONICAL',
    'DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD',
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* knowledge base                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const KB_CROSS = 'The list and item reads add the parent organization of the caller organization to the organization predicate, so a member of a local reads every active knowledge_base row of the parent organization, including the full-text copies of published exit interviews with the retiring employee name; no source says which parent rows are meant for locals and no sensitivity, consent or role condition applies, so the parent-to-child read is not authorized by the comment that locals see national-level documents.'

const kbFuture = 'Decide with the institution which knowledge-base rows may cross to child organizations and which offices may read a row of each source type, apply the sensitivity and consent of the source record and the knowledge-suite entitlement to every read, honor is_public and allowed_organizations, search only what the caller may read and record reads of restricted documents; keep the view counter out of the read path or write it as a scoped, audited update.'

const kbBase = (a) => ({
  persona: 'Any signed-in user of an organization, or of a child organization of the owner, reading knowledge-base documents, including the copies of published exit interviews',
  service: `${API}${a.route} (GET via withApiAuth) over the knowledge_base table`,
  authn: 'Session check by the deprecated withApiAuth guard (401 when auth() carries no user id); the organization comes from getCurrentUser.',
  cat: 'SESSION_ONLY',
  authz: 'No role floor and no entitlement: withApiAuth only requires a signed-in user, and the handler requires an organization on the user. Publication of the exit-interview copies requires the union_knowledge_suite entitlement and the administrator floor, which these reads do not apply. A session is not a kernel decision.',
  tenant: 'The predicate is organization_id in the caller organization and its parent organization (parent_id read under withSystemContext from the organizations table) plus is_active true; the organization comes from the session user and not from the request.',
  owner: 'knowledge_base rows of the organization and of its parent, including rows with source_type exit_interview created by the publish and index routes from interview records.',
  sens: 'Document titles, summaries, tags, source URLs, versions and, on the item route, the full content, which for exit_interview rows holds the retiring employee name, role, years of service and the interview advice text',
  mut: 'NOT_MUTATING',
  status: 'PARTIAL',
  gate: 14,
  deps: [13],
  dec: ['UE-INST-KNOWLEDGE-PUBLICATION', 'UE-INST-EXIT-INTERVIEW-RECORD-READERS'],
  future: kbFuture,
  cross: KB_CROSS,
})

const kbCommonEv = (a) => [
  ...guardEv(a, 'withApiAuth'),
  a.h('authorization', "export const GET = withApiAuth(async ("),
  a.h('tenantScope', 'const orgId = user?.organizationId;'),
  a.h('tenantScope', 'const orgIds = parentId ? [orgId, parentId] : [orgId];'),
  a.h('tenantScope', 'inArray(knowledgeBase.organizationId, orgIds),'),
  a.h('tenantScope', "sql`SELECT parent_id::text FROM organizations WHERE id = ${orgId}::uuid`,"),
  a.h('privacy', 'summary: knowledgeBase.summary,'),
  a.h('defect', 'eq(knowledgeBase.isActive, true),'),
  a.tbl('privacy', 'knowledgeBase', /isPublic: boolean\("is_public"\)/),
  a.tbl('defect', 'knowledgeBase', /allowedOrganizations: jsonb\("allowed_organizations"\)/),
]

const kbListGet = (a) => mk({
  ...kbBase(a),
  priv: 'Any signed-in user receives up to 200 active documents of the organization and its parent with title, summary, tags, source URL and counts; the q parameter matches the full content of rows whose content is not returned, so a caller can probe the text of exit-interview copies by search.',
  auditDetail: 'A read: the handler writes no row and no audit record of who listed or searched the documents.',
  reqAudit: 'Audit searches and reads of documents sourced from exit interviews once the sensitivity and the readers of those documents are decided.',
  does: 'Resolves the caller organization and its parent, lists up to 200 active knowledge_base rows of both filtered by document type, source type and an ILIKE match of the title or full content, and returns the rows, the count and per-source counts; an organization-less user gets an empty list with 200.',
  ev: [
    ...kbCommonEv(a),
    a.h('mutation', '.from(knowledgeBase)'),
    a.h('behavior', 'ilike(knowledgeBase.content, pattern),'),
    a.h('behavior', '.limit(200);'),
    a.h('defect', "return NextResponse.json({ data: [], total: 0 });"),
  ],
  inf: [
    { claim: 'defect', statement: 'No statement of the handler reads isPublic, allowedOrganizations, sourceType exit_interview rows apart from the optional sourceType filter, a role, an entitlement or any consent or sensitivity field of the source interview; the publish route stores exit-interview copies with isPublic false and these routes return them anyway.' },
  ],
  def: [
    'DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE',
    'DEF-0B8-JUR-KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS-ENTITLEMENT-AND-LEAVE-NO-READ-TRACE',
  ],
  corr: [],
})

const kbItemGet = (a) => mk({
  ...kbBase(a),
  priv: 'Any signed-in user of the organization or of a child organization receives the full content of an active document by id, including the retiring employee name and the whole interview text of an exit-interview copy, whatever its sensitivity or consent.',
  mut: 'NONE',
  auditDetail: 'The GET writes a counter: it runs UPDATE knowledge_base SET view_count = view_count + 1 under withSystemContext, not awaited, with no audit record; the read itself leaves no record of who opened the document.',
  reqAudit: 'Record the read of a restricted document (reader, document, time) in an audit record and keep the counter in a scoped, audited write or remove it from the read.',
  does: 'Resolves the caller organization and its parent, selects the active knowledge_base row with the path id in either organization with its full content, bumps view_count in the background under the system context and returns the row; 404 when no row matches and 403 when the user has no organization.',
  ev: [
    ...kbCommonEv(a),
    a.h('tenantScope', 'eq(knowledgeBase.id, id),'),
    a.h('mutation', 'sql`UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ${id}::uuid`,'),
    a.h('mutation', 'withSystemContext(() => db.execute('),
    a.h('behavior', 'content: knowledgeBase.content,'),
    a.h('audit', 'return NextResponse.json({ data: row });'),
    a.svc('behavior', `${APP}lib/db/with-rls-context.ts`, 'await db.insert(users).values({'),
    a.h('defect', '.catch((error) => {'),
  ],
  inf: [
    { claim: 'defect', statement: 'No statement of the handler reads isPublic, allowedOrganizations, a role, an entitlement or any consent or sensitivity field of the source interview; the publish route stores exit-interview copies with isPublic false and this route returns their full content anyway.' },
    { claim: 'defect', statement: 'The view counter is written by a raw SQL UPDATE string passed to db.execute inside withSystemContext, whose own documentation describes system-role writes that bypass row-level security and shows a db.insert; the helper therefore runs the counter statement outside the tenant policies.' },
  ],
  def: [
    'DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE',
    'DEF-0B8-JUR-KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS-ENTITLEMENT-AND-LEAVE-NO-READ-TRACE',
    'DEF-0B8-JUR-KNOWLEDGE-BASE-ITEM-GET-INCREMENTS-VIEW-COUNT-IN-SYSTEM-CONTEXT-WITHOUT-ORG-PREDICATE',
  ],
  corr: [GET_WRITES('NONE')],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* location                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const retentionDef = 'DEF-0B6-SYS-LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY'

const locationBase = (a) => ({
  service: `${API}${a.route} (${a.method} via withApiAuth) over services/geofence-privacy-service.ts`,
  authn: 'Session check by the deprecated withApiAuth guard, then getCurrentUser inside the handler (401-style standardized error when it returns no user).',
  cat: 'SESSION_ONLY',
  gate: 6,
  deps: [9, 13],
  dec: LOCATION_DECISION,
})

const trackMemberOwner = 'member_location_consent, location_tracking, geofence_events and location_tracking_audit rows keyed by the member user id (varchar) with no organization column; geofences rows keyed by union_local_id.'

const consentPost = (a) => mk({
  ...locationBase(a),
  persona: 'Member granting location tracking consent for themself',
  authz: 'withApiAuth plus self-service: the user id is always the session user and never taken from the body (stated in the route header); no role floor is applied and none is needed to consent for oneself. A session is not a kernel decision.',
  tenant: 'The organization is resolved from the session (getOrganizationIdForUser) and used for the RLS context and the audit row; the consent table itself has no organization column and is unique by user id, so the row is scoped to the member and not to the organization.',
  owner: trackMemberOwner,
  sens: 'The member user id, location consent purpose and description, the consent text, the allowed-during-strike and events flags, the caller IP address and user agent, and a six-month expiry',
  priv: 'The member consent record, including the IP address and user agent, is stored under the member id; the response returns the consent row and a message that data will be retained for 24 hours at most, a limit that depends on a retention handler no scheduler invokes.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The consent upsert, the location_tracking_audit row (consent_granted) and persistAtomicAudit (location.consent.grant) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit records and add the version of the consent text shown to the member and the strike or organization the consent covers.',
  does: 'Requires purpose, purposeDescription and consentText in the body, then upserts the member consent as opted in with a six-month expiry, foreground only, 24-hour retention and the caller flags, writes the privacy audit row and the platform audit record in the same transaction and returns the row; 409 when an active consent exists, 500 on any other failure.',
  status: 'PARTIAL',
  future: 'Validate the body with a schema, store the consent text from the server by version rather than from the caller, bind the consent to a purpose, an organization and a strike or event, and record the consent version shown; keep the audit in the same transaction.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', 'const userId = user.id;'),
    a.h('tenantScope', 'const organizationId = await getOrganizationIdForUser(userId);'),
    a.h('tenantScope', 'const consent = await withRLSContext({ organizationId }, async (tx) => {'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'userId: varchar("user_id", { length: 255 }).notNull().unique(),', { symbol: 'memberLocationConsent', absentColumns: ['organizationId'] }),
    a.h('mutation', 'const granted = await GeofencePrivacyService.requestLocationConsent('),
    a.svc('mutation', GEOFENCE_SERVICE, '.insert(memberLocationConsent)', CONSENT_SERVICE),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.svc('audit', GEOFENCE_SERVICE, 'await tx.insert(locationTrackingAudit).values({', 'GeofencePrivacyService.logAuditAction'),
    a.h('behavior', "message: \"Location tracking consent granted. Data will be retained for 24 hours maximum.\" }"),
    a.h('privacy', 'const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";'),
    a.h('defect', 'const { purpose, purposeDescription, consentText, allowedDuringStrike, allowedDuringEvents } = body;'),
    a.h('defect', 'if (!purpose || !purposeDescription || !consentText) {'),
    a.svc('defect', GEOFENCE_SERVICE, 'consentText: request.consentText,', CONSENT_SERVICE),
    a.svc('defect', GEOFENCE_SERVICE, 'consentVersion: this.CONSENT_VERSION,', CONSENT_SERVICE),
  ],
  inf: [
    { claim: 'defect', statement: 'The route declares _locationConsentSchema with a leading underscore and never calls parse or safeParse on it; the body is destructured as an untyped value and only tested for presence, and allowedDuringStrike and allowedDuringEvents are stored by truthiness.' },
    { claim: 'defect', statement: 'The stored ip_address column is varchar(45) and the route stores the raw x-forwarded-for header value, which can be a list longer than 45 characters; the consent insert would then fail and surface as 500.' },
  ],
  def: [
    'DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED',
    'DEF-0B8-JUR-LOCATION-CONSENT-IS-NOT-BOUND-TO-PURPOSE-ORGANIZATION-OR-STRIKE',
    retentionDef,
  ],
  corr: [],
})

const consentGet = (a) => mk({
  ...locationBase(a),
  persona: 'Member checking whether their own location consent is valid',
  authz: 'withApiAuth plus self-service: the user id is always the session user. No role floor is applied.',
  tenant: 'None: the query is by the session user id alone; the consent table has no organization column.',
  owner: trackMemberOwner,
  sens: 'The member user id and whether a valid consent exists for the strike or event context',
  priv: 'The member receives their own user id, whether a valid consent exists and the context string they sent; nothing of another member is returned.',
  mut: 'NONE',
  auditDetail: 'The GET can write: hasValidConsent sets the consent row to expired through the shared db handle when its expiry has passed, with no transaction and no audit record.',
  reqAudit: 'Move consent expiry to a scheduled, audited job or write it in an audited transaction; a status read should write nothing.',
  does: 'Reads the member opted-in consent row, expires it as a side effect when its expiry has passed, applies the strike or event flag for the context query value and returns the user id, a boolean and the context.',
  status: 'PARTIAL',
  future: 'Make the status read side-effect free, validate the context as strike or event, and expire consent in an audited job.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', 'const userId = user.id;'),
    a.h('tenantScope', 'const hasConsent = await GeofencePrivacyService.hasValidConsent(userId, context);'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'userId: varchar("user_id", { length: 255 }).notNull().unique(),', { symbol: 'memberLocationConsent', absentColumns: ['organizationId'] }),
    a.svc('mutation', GEOFENCE_SERVICE, 'await this.expireConsent(userConsent.id, userId);', SVC('hasValidConsent')),
    a.svc('mutation', GEOFENCE_SERVICE, '.update(memberLocationConsent)', SVC('expireConsent')),
    a.svc('audit', GEOFENCE_SERVICE, '.update(memberLocationConsent)', SVC('expireConsent')),
    a.h('behavior', 'const context = searchParams.get("context") as "strike" | "event" | undefined;'),
    a.h('privacy', 'userId,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The context query value is cast to the union type strike or event without a runtime check; any other string reaches hasValidConsent, matches neither context test and returns true for an opted-in member.' },
  ],
  def: ['DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT'],
  corr: [GET_WRITES('NONE')],
})

const consentDelete = (a) => mk({
  ...locationBase(a),
  persona: 'Member revoking their own location consent and deleting their stored location data',
  authz: 'withApiAuth plus self-service: the user id is always the session user. No role floor is applied.',
  tenant: 'The organization is resolved from the session and used for the RLS context and the audit row; the consent and location tables have no organization column, so every statement is scoped by the member user id alone.',
  owner: trackMemberOwner,
  sens: 'The member consent row, location points and geofence events, and the revocation reason text',
  priv: 'The member consent is set to opted out and their location points and geofence events are deleted; the audit record keeps the free-text reason from the query string.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The consent update, the deletion of the member location_tracking and geofence_events rows, the location_deletion_log row, the location_tracking_audit row (consent_revoked) and persistAtomicAudit (location.consent.revoke) commit in one RLS transaction.',
  reqAudit: 'Keep the in-transaction records and add the count of rows erased to the platform audit record.',
  does: 'Sets the member consent to opted out when an active or expired consent row exists, deletes every location point and geofence event of the member, logs the deletion and the audit records in the same transaction and returns success; 404 when no such consent exists, which also means nothing is deleted.',
  status: 'IMPLEMENTED_IN_SOURCE',
  future: 'Erase a member stored positions whether or not a consent row exists, bound the free-text reason, and record the number of rows erased.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', 'const userId = user.id;'),
    a.h('tenantScope', 'const organizationId = await getOrganizationIdForUser(userId);'),
    a.h('tenantScope', 'await withRLSContext({ organizationId }, async (tx) => {'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'userId: varchar("user_id", { length: 255 }).notNull(),', { symbol: 'locationTracking', absentColumns: ['organizationId'] }),
    a.h('mutation', 'const revoked = await GeofencePrivacyService.revokeLocationConsent(userId, reason || undefined, tx);'),
    a.svc('mutation', GEOFENCE_SERVICE, '.delete(locationTracking)', 'GeofencePrivacyService.deleteAllUserLocationData'),
    a.svc('mutation', GEOFENCE_SERVICE, '.delete(geofenceEvents)', 'GeofencePrivacyService.deleteAllUserLocationData'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', 'message: "Location tracking consent revoked. All location data has been deleted.",'),
    a.svc('defect', GEOFENCE_SERVICE, 'if (revoked.length === 0) throw new LocationConsentNotFoundError();', 'GeofencePrivacyService.revokeLocationConsent'),
    a.svc('defect', GEOFENCE_SERVICE, '.where(and(eq(memberLocationConsent.userId, userId), ne(memberLocationConsent.consentStatus, "opted_out")))', 'GeofencePrivacyService.revokeLocationConsent'),
    a.h('defect', 'return NextResponse.json({ error: error.message }, { status: 404 });'),
  ],
  inf: [
    { claim: 'defect', statement: 'deleteAllUserLocationData is called after the consent update inside revokeLocationConsent and the not-found error is thrown before it, so when no consent row matches, neither the location points nor the geofence events of the member are deleted.' },
  ],
  def: ['DEF-0B8-JUR-LOCATION-ERASURE-IS-REACHABLE-ONLY-THROUGH-AN-ACTIVE-CONSENT'],
  corr: [],
})

const geofencePost = (a) => mk({
  ...locationBase(a),
  persona: 'Steward or higher role defining a geofence (strike line, union hall, safety zone) for a strike or event',
  authz: 'withApiAuth plus an in-handler role check: hasMinRole steward (403 below it). The geofence organization is the session organization resolved server side. A role floor is not a kernel decision and no office is named as the one that may define a geofence.',
  tenant: 'The geofence unionLocalId is resolved from the session (getOrganizationIdForUser) and never from the body; the geofences table has no organization column, so unionLocalId is its only tenant field and it is nullable. strikeId is taken from the body without being checked against the organization.',
  owner: 'geofences rows keyed by union_local_id: name, type, center coordinates, radius and strike id.',
  sens: 'Geofence name, description, type, center coordinates and radius, which locate a strike line, a union hall or a safety zone',
  priv: 'The geofence definition, including its center coordinates and radius, is stored for the organization and returned to the steward; any member of the organization can later probe the geofence by id.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The geofence insert and persistAtomicAudit (location.geofence.create) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit record and add the verified strike or event the geofence belongs to.',
  does: 'Checks the steward floor, requires name, type, coordinates and radius in the body, range-checks the coordinates and the positive radius on the raw values, inserts an active geofence for the session organization and writes the audit record in the same transaction and returns the row; any failure is 500.',
  status: 'PARTIAL',
  future: 'Validate the body with a schema, bound the radius, verify the strike or event against the organization and decide with the institution which offices may define geofences.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', "if (!(await hasMinRole('steward'))) {"),
    a.imp('authorization', 'hasMinRole', 'const resolvedRole = await getRole(userId, resolvedOrgId);'),
    a.h('tenantScope', 'const trustedUnionLocalId = await getOrganizationIdForUser(user.id);'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'unionLocalId: uuid("union_local_id"),', { symbol: 'geofences', absentColumns: ['organizationId'] }),
    a.h('mutation', 'const created = await GeofencePrivacyService.createGeofence('),
    a.svc('mutation', GEOFENCE_SERVICE, '.insert(geofences)', 'GeofencePrivacyService.createGeofence'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('defect', 'const { name, description, geofenceType, centerLatitude, centerLongitude, radiusMeters, strikeId } = body;'),
    a.h('defect', 'if (radiusMeters <= 0) {'),
    a.svc('defect', GEOFENCE_SERVICE, 'centerLatitude: geofence.centerLatitude.toFixed(8),', 'GeofencePrivacyService.createGeofence'),
    a.svc('defect', GEOFENCE_SERVICE, 'strikeId: geofence.strikeId,', 'GeofencePrivacyService.createGeofence'),
  ],
  inf: [
    { claim: 'defect', statement: 'The route declares _locationGeofenceSchema with a leading underscore and never applies it; the body values are compared and passed to toFixed without a type check, so a string coordinate passes the range comparisons and throws at toFixed, and the radius has no maximum.' },
  ],
  def: ['DEF-0B8-JUR-GEOFENCE-CREATE-BODY-IS-UNVALIDATED-AND-STRIKE-ID-UNVERIFIED'],
  corr: [],
})

const geofenceGet = (a) => mk({
  ...locationBase(a),
  persona: 'Member checking whether a position they send is inside a geofence of their organization',
  authz: 'withApiAuth plus self-service: the user id is the session user and the geofence must belong to the session organization (unionLocalId equals the caller organization, else the same not-found error). No role floor and no consent check apply.',
  tenant: 'The geofence is selected by the id from the query string and then compared with the caller organization (fence.unionLocalId against the id resolved from the session); the geofence_events row written on entry has no organization column.',
  owner: trackMemberOwner,
  sens: 'The position the member sends (latitude and longitude), the distance to a geofence center and the stored entry event with coordinates',
  priv: 'The member receives the distance to the center of the geofence and whether they are inside; when inside, the position and user id are stored in geofence_events with a 24-hour expiry, with no consent check and no audit record.',
  mut: 'NONE',
  auditDetail: 'The GET writes: when the point is inside the fence, logGeofenceEvent inserts a geofence_events row (user id, geofence id, entry, coordinates, 24-hour expiry) through the shared db handle, with no transaction and no audit record.',
  reqAudit: 'Make the entry check side-effect free, or require an active consent, write the event in an audited transaction and record who stored which position.',
  does: 'Requires geofenceId, latitude and longitude in the query, loads the geofence by id, refuses a geofence of another organization as not found, computes the distance to the center with the Haversine formula, stores an entry event with the coordinates when inside and returns inside, distance and a message; any failure is 500.',
  status: 'PARTIAL',
  future: 'Check the member consent before storing any position, keep reads free of writes, validate the geofence id as a uuid, and audit stored events.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', 'const trustedUnionLocalId = await getOrganizationIdForUser(user.id);'),
    a.svc('authorization', GEOFENCE_SERVICE, 'if (fence.unionLocalId !== trustedUnionLocalId) {', SVC('checkGeofenceEntry')),
    a.h('tenantScope', 'const result = await GeofencePrivacyService.checkGeofenceEntry(user.id, lat, lon, geofenceId, trustedUnionLocalId);'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'userId: varchar("user_id", { length: 255 }).notNull(),', { symbol: 'geofenceEvents', absentColumns: ['organizationId'] }),
    a.svc('mutation', GEOFENCE_SERVICE, 'await db.insert(geofenceEvents).values({', SVC('logGeofenceEvent')),
    a.svc('audit', GEOFENCE_SERVICE, 'await db.insert(geofenceEvents).values({', SVC('logGeofenceEvent')),
    a.svc('defect', GEOFENCE_SERVICE, 'await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);', SVC('checkGeofenceEntry')),
    a.h('privacy', 'distance: result.distance,'),
    a.h('behavior', 'const lat = parseFloat(latitude);'),
    a.h('defect', 'const geofenceId = searchParams.get("geofenceId");'),
  ],
  inf: [
    { claim: 'defect', statement: 'checkGeofenceEntry and logGeofenceEvent contain no call to hasValidConsent, no read of the tracking configuration and no audit insert, and the route calls neither, so the position is stored for a member whatever the consent state; revokeLocationConsent finds no row to revoke for such a member and the consent routes cannot delete the event.' },
    { claim: 'defect', statement: 'No page, component or client in the repository calls GET /api/location/geofence; the only references are the route and its test file.' },
  ],
  def: [
    'DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK',
    'DEF-0B8-JUR-LOCATION-ERASURE-IS-REACHABLE-ONLY-THROUGH-AN-ACTIVE-CONSENT',
    retentionDef,
  ],
  corr: [GET_WRITES('NONE')],
})

const trackPost = (a) => mk({
  ...locationBase(a),
  persona: 'Member with an active opt-in recording their own foreground position for a strike, picket, meeting, event or organizing purpose',
  authz: 'withApiAuth plus self-service: the user id is always the session user. The service then requires an active opted-in consent (with the strike or event flag for strike, picket and event points) and the global tracking switch. No role floor applies.',
  tenant: 'None: the position is stored under the member user id with no organization column; strikeId and eventId are accepted as any uuid and not checked against the organization.',
  owner: trackMemberOwner,
  sens: 'The member precise latitude, longitude, accuracy and altitude with a purpose, an activity type and a strike or event id, a 24-hour expiry',
  priv: 'The member precise position is stored under their user id for 24 hours at most as stated, and the stored row is returned; the 24-hour deletion depends on a retention handler that no scheduler entry invokes.',
  mut: 'NONE',
  auditDetail: 'The POST inserts the location_tracking row through the shared db handle with no transaction and no audit record of any kind, although consent grant and revocation write audit records.',
  reqAudit: 'Record each collected position (member, purpose, time, expiry) in an audit record written in the same transaction as the point, or record counts per consent period.',
  does: 'Validates the body with zod (coordinate ranges, purpose among strike, picket, meeting, event and organizing), requires a valid consent for the purpose context and an enabled configuration, inserts the position with a 24-hour expiry and returns the row; a missing consent or any failure is 500 with the error message.',
  status: 'PARTIAL',
  future: 'Check the consent against the stated purpose, organization and strike, write the point and an audit record in one transaction, answer a missing consent with 403 and a neutral message, and schedule the retention handler.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('authorization', 'const validation = locationTrackSchema.safeParse(body);'),
    a.h('tenantScope', 'userId: user.id,'),
    a.sch('tenantScope', GEOFENCE_SCHEMA, 'userId: varchar("user_id", { length: 255 }).notNull(),', { symbol: 'locationTracking', absentColumns: ['organizationId'] }),
    a.h('mutation', 'const location = await GeofencePrivacyService.trackLocation({'),
    a.svc('mutation', GEOFENCE_SERVICE, '.insert(locationTracking)', SVC('trackLocation')),
    a.svc('audit', GEOFENCE_SERVICE, 'const [location] = await db', SVC('trackLocation')),
    a.local('behavior', 'locationTrackSchema', 'purpose: z.enum(["strike", "picket", "meeting", "event", "organizing"]),'),
    a.svc('behavior', GEOFENCE_SERVICE, 'const hasConsent = await this.hasValidConsent(tracking.userId, consentContext);', SVC('trackLocation')),
    a.svc('defect', GEOFENCE_SERVICE, 'throw new Error("Location tracking requires explicit opt-in consent");', SVC('trackLocation')),
    a.svc('defect', GEOFENCE_SERVICE, 'locationTrackingEnabled: true,', SVC('getConfig')),
    a.h('defect', 'return NextResponse.json('),
    a.h('defect', '{ error: (error as Error).message || "Failed to track location" },'),
  ],
  inf: [
    { claim: 'defect', statement: 'trackLocation derives the consent context only for the purposes strike, picket and event; for meeting and organizing it passes no context, and hasValidConsent then checks only that an opted-in, unexpired row exists for the user; consentPurpose and purposeDescription are never read in trackLocation, and strikeId and eventId are written as received.' },
  ],
  def: [
    'DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500',
    'DEF-0B8-JUR-LOCATION-CONSENT-IS-NOT-BOUND-TO-PURPOSE-ORGANIZATION-OR-STRIKE',
    retentionDef,
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const pinRemittanceTable = (record) => ({
  ...record,
  evidence: (record.evidence ?? []).map((item) => {
    if (item.resolvesExport !== 'perCapitaRemittances') return item
    const { resolvesExport, ...rest } = item
    return { ...rest, symbol: resolvesExport }
  }),
})

export function facts(a, readText) {
  const { route, method } = a
  switch (route) {
    case 'jurisdiction-rules/route.ts':
      return rulesGet(a)
    case 'labour-standards/route.ts':
      return labourListGet(a)
    case 'labour-standards/[jurisdiction]/route.ts':
      return labourProfileGet(a)
    case 'labour-standards/[jurisdiction]/compliance-check/route.ts':
      return complianceCheckPost(a)
    case 'jurisdiction/clc-compliance/route.ts':
    case 'jurisdiction/validate-deadline/route.ts':
      return crudRecord(a, readText, jurisdictionUnitProfile)
    case 'healthwelfare/plans/route.ts':
      return pinRemittanceTable(crudRecord(a, readText, remittanceProfile))
    case 'meeting-rooms/[id]/bookings/route.ts':
      return crudRecord(a, readText, meetingRoomProfile)
    case 'intelligence/route.ts':
      return method === 'GET' ? intelligenceGet(a) : intelligencePost(a)
    case 'investigations/route.ts':
      return method === 'GET' ? investigationsGet(a) : investigationsPost(a)
    case 'investigations/audit/route.ts':
      return investigationsAuditGet(a)
    case 'knowledge-base/route.ts':
      return kbListGet(a)
    case 'knowledge-base/[id]/route.ts':
      return kbItemGet(a)
    case 'location/consent/route.ts':
      return method === 'POST' ? consentPost(a) : method === 'GET' ? consentGet(a) : consentDelete(a)
    case 'location/geofence/route.ts':
      return method === 'POST' ? geofencePost(a) : geofenceGet(a)
    case 'location/track/route.ts':
      return trackPost(a)
    default:
      throw new Error(`no jurisdiction-misc facts for ${a.route}`)
  }
}
