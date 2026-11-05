/**
 * Gate 0B.6 facts for the education and training routes (education/*, content/*, cron/education-reminders).
 *
 * Eleven of the twelve education files are the generic CRUD factory over the scheduling training tables, and six of
 * them carry an action-sounding path (certificate generation, renewal reminders, enrollments, attendance, notification
 * preferences, completion certificates) over the training_courses table: the path promises a capability the table
 * cannot give. The CRUD helper reads route configuration, table definition, governance class and factory behaviour
 * from source; this module states what no source line can say and the defects the quoted lines prove. The content
 * routes and the reminder cron are hand-written.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, CRUD_GOVERNANCE, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord, crudModel } from './ue-gate0b5-crud.mjs'

const TRAINING = `${APP}db/schema/domains/scheduling/training.ts`
const CMS = `${APP}db/schema/domains/infrastructure/cms.ts`
const NOTIFICATIONS = `${APP}lib/email/training-notifications.ts`
const EMAIL = `${APP}lib/email-service.ts`
const SECRET = `${APP}lib/api/secret-compare.ts`
const DASHBOARD_CONTENT = `${APP}app/[locale]/dashboard/content/page.tsx`

export const EDU = 'UE-OMIT-EDUCATION-AND-TRAINING-RECORDS'
export const CONTENT = 'UE-OMIT-CONTENT-LIBRARY-EDITORIAL'
const GATE = 14

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const D = (id, severity, title, ownerCapabilityId = EDU) => ({ id, gate: GATE, severity, title, ownerCapabilityId })

export const DECISIONS = [
  {
    id: 'UE-INST-EDUCATION-TRAINING-RECORD-READERS',
    status: 'OUTSTANDING',
    question: 'Which offices may read the training registrations, completions, certifications and session details (meeting access codes, budgets, accommodation) of other members of an organization, and may a member see a session they are not registered for?',
    sourceState: 'The training routes are the generic CRUD factory: registrations, completions and certifications are held to the caller own member id at every role, so no office reads another member record, while sessions are readable in full by any member of the organization. No source names an education officer, instructor or steward mandate for training records.',
    softwareOwners: [EDU],
  },
  {
    id: 'UE-INST-EDUCATION-CERTIFICATION-ISSUING-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which office may mark a registration completed, issue a certificate or certification number, verify a certification and revoke it, and what evidence of completion must exist first?',
    sourceState: 'Any steward writes completed, passed, certificateIssued, certificateNumber and verified through the generic create route, and a member who registers can supply the same fields in the body; member_certifications.verified defaults to true. No source names an issuing or verifying authority.',
    softwareOwners: [EDU],
  },
]

export const DEFECTS = [
  D('DEF-0B6-EDU-FACADE-PATHS-ARE-COURSE-CATALOG-CRUD', 'MEDIUM', 'The certifications/generate, certifications/renewal-reminders, completions/certificates and notification-preferences paths are the training_courses generic CRUD under action-sounding names: they generate no certificate, send no reminder, list no certificate and store no preference, and a POST creates a course.'),
  D('DEF-0B6-EDU-ITEM-FACADES-REWRITE-OR-DELETE-COURSE-BY-PATH-ID', 'HIGH', 'The programs/[id]/enrollments and sessions/[id]/attendance item routes read the path id as a training_courses id, so no program enrollment or session attendance is read or written: PATCH rewrites any course field and the administrator DELETE removes the course row permanently because the table has no status column.'),
  D('DEF-0B6-EDU-COMPLETIONS-ROUTE-NOT-FILTERED-TO-COMPLETED', 'MEDIUM', 'The completions route is described as completed registrations only but is configured with no completed condition: GET returns every course_registrations row of the caller and POST inserts any registration, completed or not.'),
  D('DEF-0B6-EDU-COMPLETIONS-POST-SKIPS-REGISTRATION-CHECKS', 'HIGH', 'The completions POST writes course_registrations through the factory with no beforeCreate hook, so it skips the organization checks on courseId and sessionId that the registrations route added, and a steward can insert a registration for any member id that references a course or session of another organization.'),
  D('DEF-0B6-EDU-OWNER-SCOPED-READS-HIDE-MEMBER-RECORDS-FROM-STAFF', 'MEDIUM', 'The registrations, completions and certifications collection reads add memberId equal to the session user id at every role, including steward and administrator, while a steward POST can create rows for any member id: no office can list or verify the training records of another member, and the creating steward cannot read the row back.'),
  D('DEF-0B6-EDU-REGISTRATION-MEMBER-SETS-COMPLETION-FEE-AND-APPROVAL-FIELDS', 'HIGH', 'The registrations POST is open to a member and its beforeCreate hook forces only memberId, so the member body also stores completed, passed, finalGrade, certificateIssued, certificateNumber, approvedBy, feePaid and feeWaived on their own registration.'),
  D('DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK', 'MEDIUM', 'The registrations POST checks only that courseId and sessionId exist in the organization: it does not check that the session belongs to the course, that registration is open, that the session has capacity, or that the member is not already registered, and it does not update the session registration count.'),
  D('DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS', 'MEDIUM', 'The sessions GET returns every column of every session of the organization to any member, including the virtual meeting URL and access code, session budget, actual cost, accommodation hotel and internal notes of sessions the member is not registered for.'),
  D('DEF-0B6-EDU-SESSION-COURSE-ID-NOT-VERIFIED-TO-ORGANIZATION', 'MEDIUM', 'The sessions POST stores courseId from the body without checking that the course belongs to the session organization, and the registration, attendance and completion counters and the average rating are plain body-writable columns, so a steward can attach a session to another organization course and write its statistics.'),
  D('DEF-0B6-EDU-CERTIFICATION-ISSUED-WITHOUT-COMPLETION-OR-VERIFICATION', 'HIGH', 'The certifications POST is a free-form insert: courseId, sessionId and registrationId are optional, nothing checks that the member completed anything, and verified defaults to true, so a steward can create a verified certification, including its verifier, revocation and badge fields, with no link to a completed course.'),
  D('DEF-0B6-EDU-GLOBAL-UNIQUE-CODES-ACROSS-ORGANIZATIONS', 'LOW', 'course_code, session_code and certification_number are unique across all organizations rather than within one, so a code used by one organization makes another organization insert fail and the conflict reveals that the code exists.'),
  D('DEF-0B6-EDU-UI-CALLS-OPERATIONS-THE-ROUTES-DO-NOT-EXPORT', 'MEDIUM', 'The education admin screens call operations the route files do not export or do not perform: POST on the attendance and enrollments item routes that export only GET, PATCH and DELETE, PATCH and DELETE with an id query on the session, program and certification collection routes that export only GET and POST, and renewal reminders on a route that runs the course create, so the screens cannot mark attendance, enroll, edit or delete sessions, programs and certifications, or send reminders, and ignored filters (memberId, sessionStatus, includeProgress) return unfiltered rows.'),
  D('DEF-0B6-EDU-CRON-QUERIES-REFERENCE-COLUMNS-ABSENT-FROM-SCHEMA', 'HIGH', 'Both reminder queries name columns the training schema does not define (course_sessions session_date, session_time, location and duration_hours; member_certifications certificate_number; training_courses continuing_education_hours) and compare the boolean provides_certification to a certification name, so against the declared schema the job fails at its first query and sends nothing; the route test mocks the database and cannot show it.'),
  D('DEF-0B6-EDU-CRON-REMINDERS-IGNORE-OPT-OUT-AND-HAVE-NO-SENT-MARKER', 'MEDIUM', 'The reminder job selects every registered member and every expiring certification holder across all organizations without consulting communication preferences or consent, and records no sent marker, so a member who opted out is still e-mailed and a second run on the same day sends the same reminder again.'),
  D('DEF-0B6-EDU-CRON-REPORTS-SUCCESS-AFTER-FAILED-SENDS', 'MEDIUM', 'The reminder job returns success true and the message "Education reminders processed successfully" whatever the counts, so a run in which every send failed (including an unconfigured e-mail service) reads as success, and the failure list in the response carries member e-mail addresses.'),
  D('DEF-0B6-EDU-CRON-UNBOUNDED-SEQUENTIAL-SENDS', 'LOW', 'The reminder job sends one message at a time with a 100 ms pause and no cap on recipients, across every organization in one request, so the run time grows with the member count and has no resume point if the request is cut off.'),
  D('DEF-0B6-EDU-CONTENT-COMPLETIONS-COUNT-ATTENDED', 'MEDIUM', 'The content training list and the content statistics report completions as the number of registrations with attended true, not completed true, so a member who attended without finishing counts as a completion and the figure shown to every member does not match the completed flag of the registration.'),
  D('DEF-0B6-EDU-CONTENT-LISTS-UNBOUNDED-OR-UNVALIDATED', 'LOW', 'The content training list has no row limit, and the content templates list takes its limit from the query string with no upper bound and no validation, so a caller can request an arbitrarily large page and a negative value reaches the database as a SQL error.'),
  D('DEF-0B6-EDU-CONTENT-DRAFTS-AND-ARCHIVED-READABLE-BY-MEMBER', 'MEDIUM', 'The content templates GET returns cms_pages rows of every status (draft, review, archived and published) to any member of the organization, with the author user id, and ignores the allowed_roles restriction of the row, although the status workflow reserves drafting to content managers and publishing to administrators.', CONTENT),
  D('DEF-0B6-EDU-CONTENT-PUBLISH-NO-SEPARATION-OF-DUTIES', 'LOW', 'The content status transition checks the role for each step but not who prepared the item, so one administrator can move an item from draft through review to published alone, and republishing rewrites published_at.', CONTENT),
]

export const CAPABILITIES = [
  {
    id: EDU,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-006', 'UE-CONV-K-011'],
    obligationKey: 'education-and-training-records',
    primaryGate: GATE,
    dependencyGates: [6, 9, 11, 13],
    actor: 'Member registering for courses and holding certifications; steward or officer maintaining the course catalog, sessions, programs and training records; scheduled job sending session and certification reminders',
    businessOutcome: 'A course, a session and a program belong to one organization and are changed only by the offices the institution names; a registration names a member, a session of the course and an open seat, and a member cannot write their own completion, grade, certificate or fee fields; a certification exists only for a completed course and is verified by a named office; the offices that may read the training record of another member are named; session access codes and costs are not shown to members who are not registered; reminders go only to members who have not opted out, once, and a run reports the sends that failed; and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/education, app/api/content/training, app/api/cron/education-reminders',
    service: TRAINING,
    sourceFiles: [`${APP}app/api/education/registrations/route.ts`, `${APP}app/api/education/completions/route.ts`, `${APP}app/api/education/certifications/route.ts`, `${APP}app/api/cron/education-reminders/route.ts`, TRAINING],
    proof: [{ type: 'path', ref: `${APP}app/api/education/registrations/route.ts` }],
    auditEvidence: 'Every write is the generic CRUD factory, which commits persistAtomicAudit with the row. Reads are not audited, including reads of registrations and certifications. The reminder job writes no row and no audit record.',
    privacyClassification: 'Member course registrations, attendance, grades, certificate numbers, certifications and their expiry dates, session meeting access codes, session costs and member e-mail addresses used by the reminder job.',
    gap: 'No capability named education or training before Gate 0B.6, and the education routes were owned by the route-domain catch-all. The twelve education files are the generic CRUD factory; six of them (certification generation, renewal reminders, completion certificates, notification preferences, program enrollments and session attendance) are the training_courses table under another name and do none of what the path says. Registrations, completions and certifications are read at the caller member id only, so no office reads another member record, while sessions are read in full by any member; a member registering can write completion, grade, certificate and fee fields; the completions route skips the organization checks of the registrations route; a certification is a free-form verified-by-default insert; and the reminder cron references columns the schema does not define, ignores opt-out and sent state, and reports success after failed sends. This record closes none of them. Which offices may read, complete, certify and revoke training records is an institutional matter no source states.',
  },
  {
    id: CONTENT,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-006', 'UE-CONV-K-005'],
    obligationKey: 'content-library-editorial',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Content manager drafting and administrator publishing the organization templates and resources; member reading published content and content statistics',
    businessOutcome: 'A template or resource belongs to one organization, moves through draft, review, published and archived only through the status route by the role each step names, is readable by members only once published, a different person approves than prepared it, and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/content/templates, app/api/content/stats',
    service: CMS,
    sourceFiles: [`${APP}app/api/content/templates/route.ts`, `${APP}app/api/content/templates/[id]/status/route.ts`, `${APP}app/api/content/stats/route.ts`, CMS],
    proof: [{ type: 'path', ref: `${APP}app/api/content/templates/[id]/status/route.ts` }],
    auditEvidence: 'The status transition locks the row and commits persistAtomicAudit with the update in one tenant transaction. The list and statistics reads are not audited.',
    privacyClassification: 'Content titles, slugs, file URLs, author user ids, view and download counters and, in the statistics, training course and completion counts.',
    gap: 'No capability named the content library before Gate 0B.6; cms_pages had no owner and the content routes were owned by the route-domain catch-all. The status route holds the best-formed write of the domain (row lock, transition table, role check per step, optimistic conflict check, atomic audit). The gaps are on the read: any member lists drafts, items in review and archived items with their author user id, the limit is caller-chosen and unbounded, and the transition checks no separation between preparer and approver. This record closes none of them.',
  },
]

const group = (capabilityId, domain, actor, routes, evidence) => ({ capabilityId, domain, actor, routes, evidence })

export const GROUPS = {
  EDUCATION_CATALOG: group(EDU, 'EDUCATION_CATALOG', 'Member browsing, and steward or officer maintaining, the training courses, sessions and programs of the organization',
    ['education/courses/route.ts', 'education/sessions/route.ts', 'education/programs/route.ts', 'content/training/route.ts'], [
      ev(TRAINING, 'export const trainingCourses = pgTable("training_courses", {'),
      ev(TRAINING, 'export const courseSessions = pgTable("course_sessions", {'),
      ev(TRAINING, 'export const trainingPrograms = pgTable("training_programs", {'),
      ev(DASHBOARD_CONTENT, ' * For Content Manager - Templates, resources, training materials'),
    ]),
  EDUCATION_MEMBER_RECORDS: group(EDU, 'EDUCATION_MEMBER_RECORDS', 'Member registering for sessions and holding certifications; steward recording registrations, completions and certifications',
    ['education/registrations/route.ts', 'education/completions/route.ts', 'education/certifications/route.ts'], [
      ev(TRAINING, 'export const courseRegistrations = pgTable("course_registrations", {'),
      ev(TRAINING, 'export const memberCertifications = pgTable("member_certifications", {'),
      ev(`${APP}app/[locale]/dashboard/education/certificates/page.tsx`, ' * View and download earned certifications'),
    ]),
  EDUCATION_FACADE_PATHS: group(EDU, 'EDUCATION_FACADE_PATHS', 'Caller reaching a certification, reminder, enrollment, attendance or preference action by path',
    [
      'education/certifications/generate/route.ts', 'education/certifications/renewal-reminders/route.ts', 'education/completions/certificates/route.ts',
      'education/notification-preferences/route.ts', 'education/programs/[id]/enrollments/route.ts', 'education/sessions/[id]/attendance/route.ts',
    ], [
      ev(TRAINING, 'export const trainingCourses = pgTable("training_courses", {'),
      ev(TRAINING, 'export const memberCertifications = pgTable("member_certifications", {'),
      ev(TRAINING, 'export const trainingPrograms = pgTable("training_programs", {'),
    ]),
  EDUCATION_REMINDERS: group(EDU, 'EDUCATION_REMINDERS', 'Scheduled job runner sending session reminders and certification expiry warnings to members',
    ['cron/education-reminders/route.ts'], [
      ev(NOTIFICATIONS, 'export async function batchSendSessionReminders('),
      ev(NOTIFICATIONS, 'export async function batchSendExpiryWarnings('),
      ev(TRAINING, 'export const memberCertifications = pgTable("member_certifications", {'),
    ]),
  CONTENT_LIBRARY: group(CONTENT, 'CONTENT_LIBRARY', 'Content manager drafting and administrator publishing templates and resources; member reading content and statistics',
    ['content/templates/route.ts', 'content/templates/[id]/status/route.ts', 'content/stats/route.ts'], [
      ev(CMS, "export const cmsPages = pgTable('cms_pages', {"),
      ev(DASHBOARD_CONTENT, ' * For Content Manager - Templates, resources, training materials'),
    ]),
}

export const ROUTES = new Set(Object.values(GROUPS).flatMap((g) => g.routes))

const COURSES_ROUTES = new Set(['education/courses/route.ts'])
const FACADE_COLLECTION = new Set([
  'education/certifications/generate/route.ts', 'education/certifications/renewal-reminders/route.ts',
  'education/completions/certificates/route.ts', 'education/notification-preferences/route.ts',
])
const FACADE_ITEM = new Set(['education/programs/[id]/enrollments/route.ts', 'education/sessions/[id]/attendance/route.ts'])

const FACADE_MEANING = {
  'education/certifications/generate/route.ts': 'certification generation',
  'education/certifications/renewal-reminders/route.ts': 'certification renewal reminders',
  'education/completions/certificates/route.ts': 'completion certificates',
  'education/notification-preferences/route.ts': 'education notification preferences',
  'education/programs/[id]/enrollments/route.ts': 'program enrollments',
  'education/sessions/[id]/attendance/route.ts': 'session attendance',
}

const FACADE_DEFECT = 'DEF-0B6-EDU-FACADE-PATHS-ARE-COURSE-CATALOG-CRUD'
const ITEM_DEFECT = 'DEF-0B6-EDU-ITEM-FACADES-REWRITE-OR-DELETE-COURSE-BY-PATH-ID'


const UI_GAP = 'DEF-0B6-EDU-UI-CALLS-OPERATIONS-THE-ROUTES-DO-NOT-EXPORT'
const uiGapRoutes = new Set([
  'education/certifications/renewal-reminders/route.ts', 'education/programs/[id]/enrollments/route.ts', 'education/sessions/[id]/attendance/route.ts',
  'education/sessions/route.ts', 'education/programs/route.ts', 'education/certifications/route.ts',
])
const uiGapEv = (b) => (uiGapRoutes.has(b.route)
  ? [b.h('defect', FACADE_ITEM.has(b.route) ? 'const { GET, PATCH, DELETE } = crudRoutes({' : 'const { GET, POST } = crudRoutes({')]
  : [])
const uiGapDef = (b) => (uiGapRoutes.has(b.route) ? [UI_GAP] : [])
const uiGapInf = (b) => (uiGapRoutes.has(b.route)
  ? [{ claim: 'defect', statement: `The route file exports ${FACADE_ITEM.has(b.route) ? 'GET, PATCH and DELETE' : 'GET and POST'} from the factory, which reads only the page and limit query parameters; the education admin components (callers recorded on this operation and their siblings) send other methods, an id query or filter parameters to this path, which answer 405 or are ignored.` }]
  : [])

const courseSens = 'Course code, name, description, fees, instructor name, prerequisites, CLC approval, mandatory roles and internal notes'

function courseProfile(a) {
  const facade = FACADE_COLLECTION.has(a.route)
  const item = FACADE_ITEM.has(a.route)
  const meaning = FACADE_MEANING[a.route]
  return {
    persona: facade || item
      ? `Caller reaching ${meaning} by path: the route is the training_courses generic CRUD, so the caller is a member reading, or a steward maintaining, the course catalog`
      : 'Member browsing, and steward maintaining, the training course catalog of the organization through the generic CRUD factory',
    owner: 'training_courses rows of the organization; createdBy records the author the factory sets from the session. The table has no program, session, member or certificate link.',
    sens: courseSens,
    priv: (method) => (method === 'GET'
      ? 'Any member of the organization reads every course row, including fees, the instructor name, mandatory roles and internal notes, and inactive courses.'
      : method === 'DELETE'
        ? 'The course row is removed permanently; only the audit record of the delete remains.'
        : 'Any body field is stored, including fees, mandatory roles, CLC approval and the certification a course provides.'),
    does: (method, _m, floor) => {
      const tail = facade
        ? ` The path says ${meaning} but nothing about ${meaning} is read, written or sent.`
        : item
          ? ` The path id is read as a training_courses id, not as a ${a.route.includes('programs') ? 'program' : 'session'} id, so no ${meaning} row is touched.`
          : ''
      return ({
        GET: `Returns training_courses rows of the organization, paginated, at a role floor of ${floor}.${tail}`,
        POST: `Inserts a training_courses row from the body at a role floor of ${floor}.${tail}`,
        PATCH: `Updates one training_courses row with any body field except the primary key and organization at a role floor of ${floor}.${tail}`,
        DELETE: `Permanently deletes one training_courses row at the fixed administrator floor of the generic delete (${floor}); a course that registrations still reference is refused by a foreign key that declares no delete action.${tail}`,
      })[method]
    },
    future: facade
      ? `Either build ${meaning} as a dedicated authority-checked route that does what its path says and remove this alias, or remove the path; until then it must not advertise ${meaning}.`
      : item
        ? `Remove the alias or implement ${meaning} against ${a.route.includes('programs') ? 'a program enrollment record' : 'the session registrations'} with the path id as the ${a.route.includes('programs') ? 'program' : 'session'}; the course row must not be reachable, rewritable or deletable through it, and a course must be retained, not hard-deleted.`
        : 'Name the offices that may maintain courses, keep the course code unique within the organization, and retain rather than hard-delete the catalog.',
    gate: GATE,
    deps: [6, 13],
    status: () => (facade || item ? 'FACADE_OVER_GENERIC_TABLE' : 'PARTIAL'),
    def: (method) => [
      ...(facade ? [FACADE_DEFECT] : []),
      ...(item ? [ITEM_DEFECT] : []),
      ...(method === 'POST' ? ['DEF-0B6-EDU-GLOBAL-UNIQUE-CODES-ACROSS-ORGANIZATIONS'] : []),
    ],
    extraEv: (b, model) => [
      ...(facade || item ? [b.h('behavior', `table: ${model.tableName},`)] : []),
      ...(item ? [b.h('behavior', 'itemRoute: true,')] : []),
      ...(b.method === 'GET' ? [b.tbl('privacy', 'trainingCourses', /courseFee: numeric/), b.tbl('privacy', 'trainingCourses', /notes: text\("notes"\)/)] : []),
      ...(b.method === 'POST' ? [b.tbl('defect', 'trainingCourses', /unique\("training_courses_course_code_key"\)/)] : []),
      ...(item && b.method === 'DELETE'
        ? [b.sch('defect', TRAINING, /name: "course_registrations_course_id_fkey"/, { symbol: 'courseRegistrations' })]
        : []),
      ...(facade && a.route === 'education/notification-preferences/route.ts'
        ? [b.sch('scope', CRUD_GOVERNANCE, "'user_notification_preferences'")]
        : []),
      ...(facade && a.route === 'education/certifications/generate/route.ts'
        ? [b.tbl('behavior', 'trainingCourses', /certificationName: varchar\("certification_name"/)]
        : []),
      ...(item && a.route === 'education/programs/[id]/enrollments/route.ts'
        ? [b.sch('behavior', TRAINING, /requiredCourses: jsonb\("required_courses"\)/, { symbol: 'trainingPrograms' })]
        : []),
    ],
    inferences: (_method) => [
      ...(facade
        ? [{ claim: 'defect', statement: `The route file imports trainingCourses only and configures the factory over it with no custom handler: it reads no member_certifications, course_registrations or preference table, sends no e-mail and generates no document, so ${meaning} does not exist behind this path.` }]
        : []),
      ...(item
        ? [{ claim: 'defect', statement: `The route file imports trainingCourses only and sets itemRoute: true, so the [id] path segment is matched against training_courses.id; the schema has no program enrollment table and the session attendance fields live on course_registrations, which this file never touches.` }]
        : []),
    ],
    reqRead: 'Course catalog entries carry fees and internal notes but no member data; audit reads only once the readers are named.',
  }
}

const SESSION_PROFILE = {
  persona: 'Member browsing, and steward scheduling, course sessions of the organization through the generic CRUD factory',
  owner: 'course_sessions rows of the organization; createdBy records the author. The row names a course and a lead instructor but is not tied to the registrations that fill it.',
  sens: 'Session dates, venue, virtual meeting URL and access code, lead instructor, budget, actual cost, accommodation hotel, enrollment counters and internal notes',
  priv: (m) => (m === 'GET'
    ? 'Any member of the organization reads the virtual meeting URL and access code, the budget, actual cost, accommodation hotel and notes of every session, registered or not.'
    : 'Any body field is stored, including courseId, the enrollment counters, the average rating, the budget and the meeting access code.'),
  does: (m, _model, floor) => (m === 'GET'
    ? `Returns course_sessions rows of the organization, paginated, at a role floor of ${floor}.`
    : `Inserts a course_sessions row from the body at a role floor of ${floor}.`),
  future: 'Restrict the meeting access code, budget and cost columns to registered members and the offices that run the session, verify the course belongs to the organization, and compute the counters rather than accept them.',
  gate: GATE,
  deps: [6, 13],
  def: (m) => (m === 'GET'
    ? ['DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS']
    : ['DEF-0B6-EDU-SESSION-COURSE-ID-NOT-VERIFIED-TO-ORGANIZATION', 'DEF-0B6-EDU-GLOBAL-UNIQUE-CODES-ACROSS-ORGANIZATIONS']),
  decisions: [],
  extraEv: (b) => (b.method === 'GET'
    ? [
      b.tbl('privacy', 'courseSessions', /virtualMeetingAccessCode: varchar/),
      b.tbl('privacy', 'courseSessions', /sessionBudget: numeric/),
      b.tbl('privacy', 'courseSessions', /accommodationHotel: varchar/),
    ]
    : [
      b.tbl('defect', 'courseSessions', /courseId: uuid\("course_id"\)\.notNull\(\)/),
      b.tbl('defect', 'courseSessions', /registrationCount: integer/),
      b.tbl('defect', 'courseSessions', /unique\("course_sessions_session_code_key"\)/),
    ]),
  inferences: (m) => (m === 'GET'
    ? [{ claim: 'defect', statement: 'The factory selects every column of course_sessions (db.select().from(table)) and applies only the organization condition, because the table has no personal-data column that would trigger the low-role guard; no column is withheld from a member.' }]
    : [{ claim: 'defect', statement: 'The route configures no beforeCreate hook, so courseId is stored as the body gives it; the foreign key references training_courses.id only and does not tie the course to the session organization.' }]),
  reqRead: 'Audit reads of session details once the readers of access codes and costs are named.',
}

const PROGRAM_PROFILE = {
  persona: 'Member browsing, and officer maintaining, the training programs of the organization through the generic CRUD factory',
  owner: 'training_programs rows of the organization; createdBy records the author. The row lists required and elective courses in jsonb columns and has no enrollment or progress record.',
  sens: 'Program name, description, required and elective course lists, certification offered and CLC approval',
  priv: (m) => (m === 'GET'
    ? 'Any member of the organization reads every program row, including inactive programs and internal notes.'
    : 'Any body field is stored, including the required and elective course lists, which are not checked to name courses of the organization.'),
  does: (m, _model, floor) => (m === 'GET'
    ? `Returns training_programs rows of the organization, paginated, at a role floor of ${floor}.`
    : `Inserts a training_programs row from the body at a role floor of ${floor}.`),
  future: 'Validate that required and elective course ids belong to the organization, add an enrollment and progress record, and name the offices that may change a program.',
  gate: GATE,
  deps: [6, 13],
  def: () => [],
  extraEv: (b) => [b.tbl('privacy', 'trainingPrograms', /notes: text\("notes"\)/)],
  reqRead: 'Program rows carry no member data; audit reads only once the readers are named.',
}

const REGISTRATION_READ = {
  GET: 'Returns course_registrations rows of the organization whose memberId equals the session user id, at any role, paginated.',
}

function registrationProfile(a) {
  const route = a.route
  const isCompletions = route === 'education/completions/route.ts'
  const isRegistrations = route === 'education/registrations/route.ts'
  const noun = isCompletions ? 'completions' : 'registrations'
  return {
    persona: isCompletions
      ? 'Member reading their own course registrations, and steward writing registration rows for members, through a route described as completions'
      : 'Member registering for a course session and reading their own registrations through the generic CRUD factory with a registration hook',
    owner: 'course_registrations rows of the organization; the member is memberId, a varchar with no foreign key, and the row holds grade, certificate, fee and approval fields next to attendance.',
    sens: 'Registration status, approval notes, attendance dates and hours, completion, test scores, final grade, certificate number and URL, evaluation comments, travel and accommodation needs, fee payment and waiver reasons of a named member',
    priv: (m) => (m === 'GET'
      ? 'Rows are held to the caller own memberId at every role, so a member reads only their own grade, certificate, fee and evaluation data; no role reads another member row.'
      : isRegistrations
        ? 'The member body is stored on their own registration with memberId forced to the session user id; completion, grade, certificate, approval and fee fields are accepted from the member.'
        : 'Any body field is stored for any memberId, including grade, certificate, completion and fee fields of a member the steward may not otherwise hold a case for.'),
    does: (m, _model, floor) => {
      if (m === 'GET') {
        return isCompletions
          ? `Returns course_registrations rows of the organization whose memberId equals the session user id, at a role floor of ${floor}; despite the route description it applies no completed condition, so every registration of the caller is returned.`
          : REGISTRATION_READ.GET
      }
      return isRegistrations
        ? `Checks that courseId and sessionId, when present in the body, belong to the session organization, forces memberId to the session user id and inserts a course_registrations row from the rest of the body at a role floor of ${floor}.`
        : `Inserts a course_registrations row from the body at a role floor of ${floor}, with no check on memberId, courseId or sessionId and no completed condition despite the route description.`
    },
    future: isRegistrations
      ? 'Accept only courseId, sessionId and notes from a member, derive status, fees and approval from the session, check the session belongs to the course, is open and has a seat, refuse a duplicate registration, and maintain the session counters in the same transaction.'
      : 'Name the offices that may read and complete another member registration, apply the registrations route checks to every write over this table, derive completion, grade and certificate fields from a recorded completion step rather than the body, and restrict the route to completed rows if that is its purpose.',
    gate: GATE,
    deps: [6, 13],
    decisions: ['UE-INST-EDUCATION-TRAINING-RECORD-READERS', ...(a.method === 'POST' ? ['UE-INST-EDUCATION-CERTIFICATION-ISSUING-AUTHORITY'] : [])],
    def: (m) => [
      ...(m === 'GET' ? ['DEF-0B6-EDU-OWNER-SCOPED-READS-HIDE-MEMBER-RECORDS-FROM-STAFF'] : []),
      ...(isCompletions ? ['DEF-0B6-EDU-COMPLETIONS-ROUTE-NOT-FILTERED-TO-COMPLETED'] : []),
      ...(isCompletions && m === 'POST' ? ['DEF-0B6-EDU-COMPLETIONS-POST-SKIPS-REGISTRATION-CHECKS'] : []),
      ...(isRegistrations && m === 'POST'
        ? ['DEF-0B6-EDU-REGISTRATION-MEMBER-SETS-COMPLETION-FEE-AND-APPROVAL-FIELDS', 'DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK']
        : []),
    ],
    extraEv: (b) => {
      const out = [
        b.tbl('privacy', 'courseRegistrations', /finalGrade: varchar\("final_grade"/),
        b.tbl('privacy', 'courseRegistrations', /feeWaiverReason: text\("fee_waiver_reason"\)/),
      ]
      if (b.method === 'GET') {
        out.push(b.imp('defect', 'crudRoutes', 'conditions.push(eq(ownerCol, userId));'))
      } else {
        out.push(b.sch('behavior', LOW_ROLE, "if (hasExplicitOwner) return { kind: 'open' }"))
        out.push(b.tbl('defect', 'courseRegistrations', /completed: boolean\("completed"\)\.default\(false\)/))
        out.push(b.tbl('defect', 'courseRegistrations', /certificateIssued: boolean\("certificate_issued"\)/))
      }
      if (isRegistrations && b.method === 'POST') {
        out.push(
          b.h('mutation', 'beforeCreate: async (values, ctx) => {'),
          b.h('behavior', "if (!course) throw ApiError.badRequest('courseId does not belong to your organization');"),
          b.h('behavior', "if (!session) throw ApiError.badRequest('sessionId does not belong to your organization');"),
          b.h('defect', 'return { ...values, memberId: ctx.userId };'),
          b.tbl('defect', 'courseSessions', /registrationCount: integer/),
        )
      }
      if (isCompletions) {
        out.push(b.h('behavior', 'table: courseRegistrations,'))
        if (b.method === 'POST') out.push(b.imp('defect', 'crudRoutes', 'const transformed = opts.beforeCreate'))
      }
      return out
    },
    inferences: (m) => [
      ...(m === 'GET'
        ? [{ claim: 'defect', statement: `The factory adds eq(ownerCol, userId) for every caller that has a session user id, with no role branch, and no sibling route lists ${noun} for another member; a steward or administrator therefore reads only rows whose memberId equals their own user id.` }]
        : []),
      ...(isCompletions
        ? [{ claim: 'defect', statement: 'The route configuration holds no completed condition and no beforeCreate hook; the words completed only appear in the file header comment, so nothing restricts GET to completed rows and nothing validates a POST.' }]
        : []),
      ...(isRegistrations && m === 'POST'
        ? [{ claim: 'defect', statement: 'beforeCreate returns the whole body spread plus memberId, and tests nothing about the session course, its dates, capacity or an earlier registration of the same member; the session registrationCount is never written by this route.' }]
        : []),
    ],
    reqRead: 'Audit reads of registrations: they hold grades, certificate numbers, fee waiver reasons and evaluation comments of named members.',
  }
}

const CERT_SENS = 'Certification name and number, issuer, issue and expiry dates, verification, CLC registration, revocation reason and certificate and badge URLs of a named member'

function certificationProfile(a) {
  return {
    persona: 'Member reading their own certifications, and steward writing certification rows for members, through the generic CRUD factory',
    owner: 'member_certifications rows of the organization; the member is memberId, a varchar with no foreign key; verifiedBy and revocation are free columns of the body.',
    sens: CERT_SENS,
    priv: (m) => (m === 'GET'
      ? 'Rows are held to the caller own memberId at every role, so a member reads only their own certifications; no role reads another member certification.'
      : 'Any body field is stored for any memberId, including verified, verifiedBy, revoked, revocationReason, clcRegistered and the certificate and badge URLs.'),
    does: (m, _model, floor) => (m === 'GET'
      ? `Returns member_certifications rows of the organization whose memberId equals the session user id, at a role floor of ${floor}, paginated.`
      : `Inserts a member_certifications row from the body at a role floor of ${floor}, with no check that the member completed a course, no link required to a course, session or registration, and verified defaulting to true.`),
    future: 'Name the office that issues, verifies and revokes a certification, require a completed registration for issue, derive verified and verifiedBy from the verifier session, make the certification number unique within the organization, and name who reads another member certification.',
    gate: GATE,
    deps: [6, 13],
    decisions: ['UE-INST-EDUCATION-TRAINING-RECORD-READERS', ...(a.method === 'POST' ? ['UE-INST-EDUCATION-CERTIFICATION-ISSUING-AUTHORITY'] : [])],
    def: (m) => (m === 'GET'
      ? ['DEF-0B6-EDU-OWNER-SCOPED-READS-HIDE-MEMBER-RECORDS-FROM-STAFF']
      : ['DEF-0B6-EDU-CERTIFICATION-ISSUED-WITHOUT-COMPLETION-OR-VERIFICATION', 'DEF-0B6-EDU-GLOBAL-UNIQUE-CODES-ACROSS-ORGANIZATIONS']),
    extraEv: (b) => (b.method === 'GET'
      ? [
        b.tbl('privacy', 'memberCertifications', /revocationReason: text\("revocation_reason"\)/),
        b.imp('defect', 'crudRoutes', 'conditions.push(eq(ownerCol, userId));'),
      ]
      : [
        b.tbl('privacy', 'memberCertifications', /revocationReason: text\("revocation_reason"\)/),
        b.sch('behavior', LOW_ROLE, "if (hasExplicitOwner) return { kind: 'open' }"),
        b.tbl('defect', 'memberCertifications', /verified: boolean\("verified"\)\.default\(true\)/),
        b.tbl('defect', 'memberCertifications', /registrationId: uuid\("registration_id"\),/),
        b.tbl('defect', 'memberCertifications', /unique\("member_certifications_certification_number_key"\)/),
      ]),
    inferences: (m) => (m === 'GET'
      ? [{ claim: 'defect', statement: 'The factory adds eq(ownerCol, userId) for every caller that has a session user id, with no role branch, and no sibling route lists certifications of another member; a steward or administrator reads only rows whose memberId equals their own user id.' }]
      : [{ claim: 'defect', statement: 'The route configures no beforeCreate hook; courseId, sessionId and registrationId are nullable columns, verified defaults to true, and the ownerColumn is not applied to a create, so memberId and the verification fields come from the body.' }]),
    reqRead: 'Audit reads of certifications: they hold certificate numbers and revocation reasons of named members.',
  }
}

const ownerCreateAuthz = (record, method, floor) => {
  record.authorizationDetail = `Generic CRUD role floor: ${method} requires ${floor}. The ownerColumn memberId is applied to reads, updates and deletes; a create does not apply it (an explicit owner column leaves the low-role mode open), so memberId comes from the body. A role title is not a kernel decision.`
  return record
}

function crudFacts(a, readText) {
  const route = a.route
  let profile
  if (COURSES_ROUTES.has(route) || FACADE_COLLECTION.has(route) || FACADE_ITEM.has(route)) profile = courseProfile(a)
  else if (route === 'education/sessions/route.ts') profile = SESSION_PROFILE
  else if (route === 'education/programs/route.ts') profile = PROGRAM_PROFILE
  else if (route === 'education/registrations/route.ts' || route === 'education/completions/route.ts') profile = registrationProfile(a)
  else if (route === 'education/certifications/route.ts') profile = certificationProfile(a)
  else throw new Error(`no education CRUD profile for ${route}`)
  const base = profile
  profile = {
    ...base,
    def: (m, mod) => [...(base.def?.(m, mod) ?? []), ...uiGapDef(a)],
    extraEv: (b, mod) => [...(base.extraEv?.(b, mod) ?? []), ...uiGapEv(b)],
    inferences: (m, mod) => [...(base.inferences?.(m, mod) ?? []), ...uiGapInf(a)],
  }
  const record = crudRecord(a, readText, profile)
  const model = crudModel(a, readText)
  if (a.method === 'POST' && model.explicitOwner && route !== 'education/registrations/route.ts') {
    return ownerCreateAuthz(record, a.method, model.writeRole)
  }
  if (a.method === 'POST' && route === 'education/registrations/route.ts') {
    record.authorizationDetail = 'Generic CRUD role floor: POST requires member. The beforeCreate hook forces memberId to the session user id and checks courseId and sessionId against the session organization; no other field is checked. A role title is not a kernel decision.'
  }
  return record
}

const TRAINING_DEFECT_CONTENT = 'DEF-0B6-EDU-CONTENT-COMPLETIONS-COUNT-ATTENDED'

const contentBase = (a) => ({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  cat: 'ROLE_FLOOR',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  mut: 'NOT_MUTATING',
  dec: [],
})

const contentTraining = (a) => mk({
  ...contentBase(a),
  persona: 'Member viewing the training courses of the organization with completion counts',
  authz: "withApi with minRole member: a role floor of member for the session organization. The route requests the session organization and applies it in the query. A role title is not a kernel decision.",
  tenant: 'The course query carries tc.organization_id equal to the session organization and the completion subquery carries cr.organization_id equal to the course organization.',
  owner: 'training_courses rows of the organization and a count of its course_registrations; the route reads no member row.',
  sens: 'Course code, name, description, category, delivery method, duration, mandatory flag, materials URL and the number of attended registrations per course',
  priv: 'Any member reads every active course with its materials URL and a count of attended registrations; with active=false the same member also reads inactive courses. No member identifier is returned.',
  auditDetail: 'A read: the handler runs two selects, writes no row and no audit record.',
  reqAudit: 'Reads of the course list need no audit record once the figures are aggregate; audit if materials URLs become restricted.',
  does: 'Returns the training courses of the session organization (active only unless active=false), ordered by mandatory flag and attended count, each with a duration label, the materials URL and a completions number that counts registrations with attended true. The list has no row limit.',
  future: 'Count completed registrations, not attended ones, bound the list, hide inactive courses and materials URLs from members who are not entitled to them, and name the readers.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "{ auth: { required: true, minRole: 'member' } },"),
    a.h('tenantScope', 'WHERE tc.organization_id = ${orgId}::uuid'),
    a.h('scope', 'AND cr.attended IS TRUE) AS completion_count,'),
    a.h('mutation', 'const result = await withRLSContext(async () => db.execute(query));'),
    a.h('defect', "const activeOnly = url.searchParams.get('active') !== 'false';"),
    a.h('defect', 'query = sql`${query} ORDER BY tc.is_mandatory DESC, completion_count DESC`;'),
    a.sch('defect', TRAINING, /completed: boolean\("completed"\)\.default\(false\)/, { symbol: 'courseRegistrations' }),
    a.sch('privacy', TRAINING, /courseMaterialsUrl: text\("course_materials_url"\)/, { symbol: 'trainingCourses' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The query ends at ORDER BY with no LIMIT and no page parameter, so the whole course list of the organization is returned in one response.' },
    { claim: 'defect', statement: 'completion_count counts cr.attended IS TRUE while course_registrations carries a separate completed flag, so the completions figure is an attendance count.' },
  ],
  def: [TRAINING_DEFECT_CONTENT, 'DEF-0B6-EDU-CONTENT-LISTS-UNBOUNDED-OR-UNVALIDATED'],
  corr: [],
})

const contentStats = (a) => mk({
  ...contentBase(a),
  persona: 'Member viewing content library and training statistics of the organization',
  authz: "withApi with minRole member: a role floor of member for the session organization. A role title is not a kernel decision.",
  tenant: 'All three statements carry organization_id equal to the session organization, and the completion subquery carries cr.organization_id.',
  owner: 'cms_pages and training_courses rows of the organization and a count of its course_registrations; the route reads no member row.',
  sens: 'Template and resource counts by status, total views and downloads, the most viewed title and category, and training course, active course and completion counts',
  priv: 'Any member reads the counts of draft, review and archived content, total views and downloads, the title of the most viewed item and the training totals; no member identifier is returned.',
  auditDetail: 'A read: the handler runs three aggregate selects, writes no row and no audit record.',
  reqAudit: 'Aggregate reads need no audit record; name the readers of unpublished-content counts first.',
  does: 'Returns template counts by status, resource counts, summed views and downloads, the most viewed item and training totals for the session organization; total completions is the number of registrations with attended true, not completed true.',
  future: 'Count completed registrations as completions, decide whether unpublished-content counts are for content managers only, and name the readers.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "{ auth: { required: true, minRole: 'member' } },"),
    a.h('tenantScope', 'WHERE organization_id = ${orgId}::uuid'),
    a.h('scope', 'WHERE cr.organization_id = ${orgId}::uuid AND cr.attended IS TRUE), 0) AS total_completions'),
    a.h('mutation', 'const { templateResult, topResult, trainingResult } = await withRLSContext(async () => {'),
    a.h('defect', 'WHERE cr.organization_id = ${orgId}::uuid AND cr.attended IS TRUE), 0) AS total_completions'),
    a.sch('defect', TRAINING, /completed: boolean\("completed"\)\.default\(false\)/, { symbol: 'courseRegistrations' }),
    a.sch('scope', CMS, /status: text\('status'\)/, { symbol: 'cmsPages' }),
  ],
  inf: [{ claim: 'defect', statement: 'total_completions counts cr.attended IS TRUE while course_registrations carries a separate completed flag, so the completions total is an attendance count.' }],
  def: [TRAINING_DEFECT_CONTENT],
  corr: [],
})

const contentTemplates = (a) => mk({
  ...contentBase(a),
  persona: 'Member reading the templates and resources of the organization',
  authz: "withApi with minRole member: a role floor of member for the session organization. A role title is not a kernel decision.",
  tenant: 'The query carries organization_id equal to the session organization before the optional content type condition.',
  owner: 'cms_pages rows of the organization; created_by names the author user id.',
  sens: 'Title, slug, description, status, category, content type, file URL and size, download and view counters, publication time and the author user id of every content item',
  priv: 'Any member of the organization reads draft, review and archived items as well as published ones, with the file URL and the author user id.',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of content need no audit record once unpublished items are restricted to content managers.',
  does: 'Returns cms_pages rows of the session organization, optionally filtered by content type, newest first, with a caller-chosen limit (default 50, no upper bound); it adds no status condition.',
  future: 'Show members only published items, restrict drafts, review and archived items to content managers, drop the author user id for members, and cap and validate the limit.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "{ auth: { required: true, minRole: 'member' } },"),
    a.h('tenantScope', 'WHERE organization_id = ${orgId}::uuid'),
    a.h('scope', "const contentType = url.searchParams.get('type') || null;"),
    a.h('mutation', 'const result = await withRLSContext(async () => db.execute(query));'),
    a.h('defect', 'SELECT id, title, slug, meta_description, status, category,'),
    a.h('defect', "const limit = Number(url.searchParams.get('limit')) || 50;"),
    a.h('privacy', 'created_by: r.created_by,'),
    a.sch('defect', CMS, /status: text\('status'\)/, { symbol: 'cmsPages' }),
    a.sch('defect', CMS, /allowedRoles: text\('allowed_roles'\)/, { symbol: 'cmsPages' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The only conditions after organization_id are the optional content_type match and ORDER BY updated_at; no status condition exists, so the status column is returned but never filtered, and the allowed_roles and requires_auth columns of cms_pages are not read.' },
    { claim: 'defect', statement: 'limit is Number(query value) || 50 with no minimum or maximum, so a very large value returns every row and a negative value is sent to LIMIT unchecked.' },
  ],
  def: ['DEF-0B6-EDU-CONTENT-DRAFTS-AND-ARCHIVED-READABLE-BY-MEMBER', 'DEF-0B6-EDU-CONTENT-LISTS-UNBOUNDED-OR-UNVALIDATED'],
  corr: [],
})

const contentStatus = (a) => mk({
  ...contentBase(a),
  persona: 'Content manager moving a draft to review; administrator publishing, rejecting or archiving an item',
  authz: "withApi with minRole content_manager, then a per-transition role check inside the transaction: draft to review needs content_manager, every other step needs admin (hasMinRole(rule.minRole)). A role title is not a kernel decision.",
  tenant: 'The row is selected and updated with organization_id equal to the session organization, and the update also requires the status to equal the status read under the row lock.',
  owner: 'The status, published_at and updated_by columns of one cms_pages row of the organization.',
  sens: 'Content status transition, the item title returned in the response and the audit record naming the previous and new status',
  priv: 'The response returns the item id, title and previous and new status to the caller who is allowed to transition it; no member data is involved.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The row lock, the status update and persistAtomicAudit (content.status.transition, recording from and to status) run in one tenant transaction.',
  reqAudit: 'Keep the in-transaction audit record and add the authorization decision and the preparer and approver identities to it.',
  does: 'Locks the cms_pages row of the session organization, rejects a transition the table does not allow (400), checks the role the step needs (403), updates the status with an optimistic status condition (409 on a concurrent change), sets published_at to now when publishing, writes the audit record and returns the new status; a request for the current status returns 200 with no change and no audit record.',
  status: 'IMPLEMENTED_IN_SOURCE',
  future: 'Record who prepared and who approved an item and refuse approval by the preparer, keep the original published_at when an item is republished, and add the authorization decision to the audit record.',
  deps: [6, 13],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'content_manager' },"),
    a.h('authorization', 'if (!(await hasMinRole(rule.minRole))) {'),
    a.local('authorization', 'TRANSITIONS', "review:    { targets: ['published', 'draft'], minRole: 'admin' },"),
    a.h('tenantScope', 'WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid'),
    a.h('mutation', 'UPDATE cms_pages'),
    a.h('mutation', 'WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid AND status = ${currentStatus}'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('defect', 'updated_by = ${userId},'),
    a.h('defect', ", published_at = now()`"),
  ],
  inf: [{ claim: 'defect', statement: 'The handler writes updated_by with the acting user and compares only the acting role to the step; it never compares the acting user to the user who moved the item to review, so the same administrator can perform draft to review and review to published, and published_at is overwritten with now() on every publish.' }],
  def: ['DEF-0B6-EDU-CONTENT-PUBLISH-NO-SEPARATION-OF-DUTIES'],
  corr: [],
})

const cronReminders = (a) => mk({
  service: `${APP}app/api/${a.route}`,
  persona: 'Scheduled job runner (daily cron) sending session reminders and certification expiry warnings to members by e-mail',
  authn: 'Cron secret: withApi auth { cron: true } reads x-cron-secret or the Authorization bearer value and compares it with CRON_SECRET_KEY or CRON_SECRET through secretsEqual (SHA-256 digests compared with timingSafeEqual); no user session is used.',
  cat: 'EXTERNAL_TRUST',
  authz: 'The cron secret is the only check: an unset or empty secret makes secretsEqual return false, so the route fails closed (401), and any caller holding the secret may trigger a send. There is no role, organization or kernel decision.',
  tenant: 'None by organization: both queries run under withSystemContext (the union_eyes_system role) and select registrations and certifications of every organization; the job is system-wide by design and no organization predicate exists.',
  owner: 'course_registrations, course_sessions, training_courses, member_certifications and members rows of every organization; the job writes no row.',
  sens: 'Member name and e-mail address, course name, session date, time, location and instructor, certification name and number and expiry date, sent by e-mail; the response carries counts and a list of recipient e-mail addresses whose send failed',
  priv: 'E-mail addresses and training details of members of every organization are read under the system role and sent through the e-mail provider; the cron response returns recipient e-mail addresses in its failure list to the caller holding the secret.',
  mut: 'NOT_MUTATING',
  auditDetail: 'The handler writes no row and no audit record; the only trace of a send is logger.info of counts and the provider message log.',
  reqAudit: 'Record each reminder sent (member, kind, session or certification, time) in a table, in the same step that decides the reminder is due, so a rerun does not send it twice.',
  does: 'Selects registered members of sessions in 7, 3 or 1 day and active certifications expiring in 90 or 30 days across all organizations, e-mails each through Resend one at a time with a 100 ms pause, counts sent and failed and returns success true with the counts; an unconfigured provider counts every send as failed. The queries name columns the training schema does not define.',
  status: 'PARTIAL',
  gate: 9,
  deps: [11, 14],
  future: 'Correct both queries against the schema, select per organization with the member opt-out and consent, record sent markers, return a failure status when sends fail, bound and resume the batch, and keep the secret check fail-closed.',
  dec: [],
  ev: [
    a.h('authentication', 'auth: { cron: true },'),
    a.imp('authentication', 'withApi', 'if (!secretsEqual(cronSecret, expected)) {'),
    a.imp('authentication', 'withApi', "const xCronHeader = request.headers.get('x-cron-secret');"),
    a.svc('authorization', SECRET, 'if (!expected) return false'),
    a.svc('authentication', SECRET, 'return timingSafeEqual(left, right)'),
    a.imp('authorization', 'withApi', 'if (requireCron) {'),
    a.h('tenantScope', 'const sessionReminders = await withSystemContext(async () => {'),
    a.h('mutation', 'return await db.execute(sql`'),
    a.imp('tenantScope', 'withSystemContext', 'SET LOCAL ROLE union_eyes_system'),
    a.h('scope', 'JOIN members m ON m.id = cr.member_id'),
    a.h('behavior', 'results.sessionReminders = await batchSendSessionReminders(reminderData);'),
    a.h('behavior', 'results.expiryWarnings = await batchSendExpiryWarnings(warningData);'),
    a.imp('behavior', 'batchSendSessionReminders', 'const result = await sendSessionReminder(reminder);'),
    a.svc('behavior', EMAIL, 'const { data, error } = await client.emails.send(finalPayload);'),
    a.svc('behavior', EMAIL, "error: 'Email service not configured',"),
    a.h('defect', 'cs.session_date,'),
    a.h('defect', 'cs.session_time,'),
    a.h('defect', 'mc.certificate_number,'),
    a.h('defect', 'c.continuing_education_hours'),
    a.h('defect', 'LEFT JOIN training_courses c ON c.provides_certification = mc.certification_name'),
    a.sch('defect', TRAINING, /startDate: date\("start_date"\)\.notNull\(\)/, { symbol: 'courseSessions' }),
    a.sch('defect', TRAINING, /certificationNumber: varchar\("certification_number"/, { symbol: 'memberCertifications' }),
    a.sch('defect', TRAINING, /providesCertification: boolean\("provides_certification"\)/, { symbol: 'trainingCourses' }),
    a.h('defect', "AND m.email != ''"),
    a.h('defect', 'success: true,'),
    a.h('defect', 'message: "Education reminders processed successfully",'),
    a.imp('privacy', 'batchSendSessionReminders', 'results.errors.push(`${reminder.toEmail}: ${result.error}`);'),
    a.imp('defect', 'batchSendSessionReminders', 'await new Promise((resolve) => setTimeout(resolve, 100));'),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler selects from course_sessions the columns session_date, session_time, location and duration_hours, from member_certifications certificate_number, and from training_courses continuing_education_hours; the schema and the migrations define start_date, session_times, venue_name, certification_number and no continuing_education_hours, and provides_certification is a boolean compared with a varchar name, so the queries fail against the declared schema before any send.' },
    { claim: 'defect', statement: 'Neither query joins a preference, consent or opt-out table and the route imports no insert or update, so no sent marker exists: eligibility depends only on the date window, and a second run on the same day selects and sends the same rows.' },
    { claim: 'defect', statement: 'The returned object is built with success true and a fixed message before the counts are consulted; failed counts and the error list are returned alongside, so a run with every send failed still reports success.' },
    { claim: 'defect', statement: 'batchSendSessionReminders and batchSendExpiryWarnings loop over every selected row, awaiting each send and a 100 ms pause; the handler passes the full cross-organization result set and sets no cap or resume point.' },
  ],
  def: [
    'DEF-0B6-EDU-CRON-QUERIES-REFERENCE-COLUMNS-ABSENT-FROM-SCHEMA',
    'DEF-0B6-EDU-CRON-REMINDERS-IGNORE-OPT-OUT-AND-HAVE-NO-SENT-MARKER',
    'DEF-0B6-EDU-CRON-REPORTS-SUCCESS-AFTER-FAILED-SENDS',
    'DEF-0B6-EDU-CRON-UNBOUNDED-SEQUENTIAL-SENDS',
  ],
  corr: [{ field: 'mutating', manifest: 'read-only GET, audit NOT_APPLICABLE:READ', actual: 'This GET writes no row but sends e-mail to members of every organization, so a read-only classification misdescribes an external send that has no audit record.' }],
})

export function facts(a, readText) {
  const { route, method: m } = a
  if (route === 'cron/education-reminders/route.ts') return cronReminders(a)
  if (route === 'content/training/route.ts') return contentTraining(a)
  if (route === 'content/stats/route.ts') return contentStats(a)
  if (route === 'content/templates/route.ts') return contentTemplates(a)
  if (route === 'content/templates/[id]/status/route.ts' && m === 'PATCH') return contentStatus(a)
  return crudFacts(a, readText)
}
