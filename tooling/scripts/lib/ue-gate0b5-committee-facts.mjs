/**
 * Gate 0B.5 facts for the committee workspace: the committee rows (generic CRUD factory) and the meeting, attendance,
 * minutes, action item, document and intelligence routes (hand-written withApi handlers over one service). Every
 * quote is read from the exact handler, an import it uses or the service definition it calls.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const SCAFFOLD_GATE = 8
const SERVICE = `${APP}lib/services/committee-workspace-service.ts`
const CH_MEETING = /eq\(committeeMeetings\.id, children\.meetingId\)/
const CH_ACTION = /eq\(committeeActionItems\.id, children\.actionItemId\)/

export const COMMITTEE_CRUD_ROUTES = new Set(['committees/[id]/route.ts', 'committees/route.ts'])
export const COMMITTEE_WORKSPACE_ROUTES = new Set([
  'committees/[id]/action-items/[itemId]/route.ts', 'committees/[id]/action-items/route.ts', 'committees/[id]/documents/route.ts',
  'committees/[id]/intelligence/route.ts', 'committees/[id]/meetings/[meetingId]/attendance/route.ts',
  'committees/[id]/meetings/[meetingId]/minutes/route.ts', 'committees/[id]/meetings/[meetingId]/route.ts', 'committees/[id]/meetings/route.ts',
])
export const COMMITTEE_ROUTES = new Set([...COMMITTEE_CRUD_ROUTES, ...COMMITTEE_WORKSPACE_ROUTES])

const D = (id, gate, severity, title, ownerCapabilityId) => ({ id, gate, severity, title, ...(ownerCapabilityId ? { ownerCapabilityId } : {}) })

export const COMMITTEE_DEFECTS = [
  D('DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP', GATE, 'MEDIUM', 'Meetings, minutes, decisions, attendance, action items and documents of every committee are readable by any member of the organization, because every read sits at the member role floor and nothing consults committee_memberships; a closed or sensitive committee has no confidentiality.'),
  D('DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED', GATE, 'MEDIUM', 'Attendee member ids, action item assignees, document ids and document file URLs are accepted from the body and stored without being checked against the organization membership, the document register or an allowed storage host, so a record can name a person or file that does not belong to the organization.'),
  D('DEF-0B5-COMMITTEE-DECISIONS-EDITABLE-AFTER-APPROVAL', GATE, 'MEDIUM', 'The generic meeting update excludes only minutes and their approval fields, so the recorded decisions, the agenda items and the meeting status of a meeting whose minutes were approved can still be rewritten by a steward; the approved record is not frozen.'),
  D('DEF-0B5-COMMITTEE-MINUTES-NO-SEPARATION-OF-DUTIES', GATE, 'LOW', 'The user who recorded the minutes may also approve them, because approval needs only the officer floor, which includes every higher role, and no check compares the approver with the recorder.'),
  D('DEF-0B5-COMMITTEE-INTELLIGENCE-GATHERS-ALL-COMMITTEES', GATE, 'MEDIUM', 'A synthesis requested for one committee with no committeeIds in the body gathers the completed minutes of every committee of the organization and files the result under the committee in the path, so the minutes of committees the requester may not follow are summarized into another committee record.'),
  D('DEF-0B5-COMMITTEE-LIST-PAGINATION-UNBOUNDED', GATE, 'LOW', 'The meeting and intelligence list routes pass parseInt of the limit and offset query strings straight to the query: there is no maximum, and a value that is not a number reaches the database as NaN.'),
  D('DEF-0B5-COMMITTEE-INTERNAL-NOTES-READ-BY-ANY-MEMBER', GATE, 'LOW', 'The committee row returned to every member includes the notes and customFields columns and the contact e-mail, which no source marks as steward-only.'),
  D('DEF-0B5-COMMITTEE-INTELLIGENCE-PLACEHOLDER-RETURNED-AS-RESULT', SCAFFOLD_GATE, 'MEDIUM', 'The intelligence POST stores and returns a snapshot whose summary reads Full AI synthesis pending integration, with empty themes, positions and recommendations and a null model, as a successful 200 result, so a stored placeholder is presented as a synthesis.', 'UE-CAP-H-001'),
]

const ownerBase = (a) => ({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  gate: GATE,
  deps: [9, 13],
})

const guards = (a, role, children) => [
  ...guardEv(a, 'withApi'),
  a.h('authorization', `minRole: "${role}"`),
  a.h('tenantScope', 'rlsOrgContext: true,'),
  a.h('tenantScope', /await requireCommitteeScope\(organizationId, /),
  a.imp('tenantScope', 'requireCommitteeScope', '.where(and(eq(committees.id, committeeId), eq(committees.organizationId, organizationId)));'),
  ...(children ? [a.imp('tenantScope', 'requireCommitteeScope', children)] : []),
]

const authz = (role) => `withApi with minRole ${role}: a role floor of ${role} for the session organization. Nothing consults committee membership. A role title is not a kernel decision.`
const TENANT_PATH = 'The committee in the path is proven to belong to the session organization by requireCommitteeScope before the service is called; a committee of another organization is reported as not found.'
const TENANT_CHILD = `${TENANT_PATH} The named child record must belong to that committee and organization.`

const AUDIT_ATOMIC = (what) => `${what} runs in one tenant transaction that commits persistAtomicAudit with the row.`

const SPECS = {
  'committees/[id]/meetings/route.ts|GET': {
    persona: 'Member of the organization listing the meetings of a committee', role: 'member', mut: 'NOT_MUTATING',
    tenant: TENANT_PATH,
    owner: 'committee_meetings rows of one committee; the committee row names the organization.',
    sens: 'Meeting titles, dates, agenda items, decisions with mover and seconder names, and approved or draft minutes of a committee',
    priv: 'Any member of the organization reads the agenda, decisions and minutes of every meeting of any committee of the organization.',
    does: 'Lists the meetings of one committee of the session organization, newest first, optionally by status, with a caller-chosen limit and offset.',
    status: 'PARTIAL',
    future: 'Restrict meeting reads to the committee members and the officers who oversee the committee, bound the page size, and keep minutes confidential until approved.',
    ev: (a) => [a.imp('mutation', 'listMeetings', '.from(committeeMeetings)'), a.h('defect', 'const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;')],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP', 'DEF-0B5-COMMITTEE-LIST-PAGINATION-UNBOUNDED'],
  },
  'committees/[id]/meetings/route.ts|POST': {
    persona: 'Steward scheduling a committee meeting', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    tenant: TENANT_PATH,
    owner: 'committee_meetings rows of one committee; the meeting names the organization and the creator.',
    sens: 'Meeting title, time, location, virtual link, agenda items, attendee member ids and external guest names and e-mail addresses',
    priv: 'External attendee names, organizations and e-mail addresses are stored; the attendee member ids are not checked against the organization.',
    does: 'Creates a meeting for one committee of the session organization, inserts an attendance row for each listed member id, and audits it atomically.',
    status: 'PARTIAL',
    future: 'Verify every attendee id is a member of the organization and of the committee, and restrict scheduling to the committee chair and secretary or an officer.',
    ev: (a) => [
      a.imp('mutation', 'createMeeting', /tx\.insert\(committeeMeetings\)/),
      a.imp('audit', 'createMeeting', 'await persistAtomicAudit(tx, {'),
      a.imp('defect', 'createMeeting', /attendeeIds\.map\(\(memberId\) =>/),
    ],
    def: ['DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED'],
  },
  'committees/[id]/meetings/[meetingId]/route.ts|GET': {
    persona: 'Member of the organization reading one committee meeting', role: 'member', mut: 'NOT_MUTATING', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'committee_meetings and committee_meeting_attendees rows of one meeting; the attendee rows carry no organization column.',
    sens: 'The full meeting record with decisions and minutes, and the attendee member ids with attendance, lateness and proxy',
    priv: 'Any member of the organization reads the minutes, decisions and attendee list of any meeting of any committee of the organization.',
    does: 'Returns one meeting of the session organization, proven to belong to the committee in the path, with its attendee rows.',
    status: 'PARTIAL',
    future: 'Restrict the meeting read to the committee members and overseeing officers and hold minutes back until approved.',
    ev: (a) => [a.imp('mutation', 'getMeeting', '.from(committeeMeetings)'), a.imp('privacy', 'getMeetingAttendees', '.from(committeeMeetingAttendees)')],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP'],
  },
  'committees/[id]/meetings/[meetingId]/route.ts|PATCH': {
    persona: 'Steward changing a committee meeting', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'committee_meetings rows of one committee; the update statement carries the organization predicate.',
    sens: 'Meeting time, location, status, agenda items, recorded decisions with vote counts and the next meeting date',
    priv: 'Recorded decisions and vote counts can be rewritten; the audit record lists the changed field names and not the values.',
    does: 'Updates a meeting of the session organization with the body fields, excluding the minutes and their approval, and audits the change atomically.',
    status: 'PARTIAL',
    future: 'Freeze decisions, agenda and status once the minutes are approved, and keep the previous values in the audit record.',
    ev: (a) => [
      a.imp('mutation', 'updateMeeting', /\.update\(committeeMeetings\)/),
      a.imp('audit', 'updateMeeting', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'updateMeeting', /eq\(committeeMeetings\.organizationId, organizationId\)/),
      a.imp('defect', 'updateMeeting', /const \{ minutes: _minutes, minutesApprovedBy: _by/),
    ],
    def: ['DEF-0B5-COMMITTEE-DECISIONS-EDITABLE-AFTER-APPROVAL'],
  },
  'committees/[id]/meetings/[meetingId]/attendance/route.ts|GET': {
    persona: 'Member of the organization reading the attendance of a committee meeting', role: 'member', mut: 'NOT_MUTATING', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'committee_meeting_attendees rows of one meeting; the rows carry no organization column.',
    sens: 'Member ids with attended, late, left early, proxy and regrets flags',
    priv: 'Any member of the organization reads who attended, sent regrets or gave a proxy at any committee meeting.',
    does: 'Returns the attendee rows of one meeting of the session organization, proven to belong to the committee in the path.',
    status: 'PARTIAL',
    future: 'Restrict attendance reads to the committee members and overseeing officers.',
    ev: (a) => [a.imp('mutation', 'getMeetingAttendees', '.from(committeeMeetingAttendees)'), a.imp('privacy', 'getMeetingAttendees', '.where(eq(committeeMeetingAttendees.meetingId, meetingId));')],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP'],
  },
  'committees/[id]/meetings/[meetingId]/attendance/route.ts|POST': {
    persona: 'Steward recording who attended a committee meeting', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'committee_meeting_attendees rows of one meeting; ownership of an attendee row is proven through the meeting organization in the statement.',
    sens: 'Member ids with attended, late, left early, proxy and regrets flags',
    priv: 'A proxy name and member ids are stored from the body without a membership check.',
    does: 'Inserts or updates one attendee row per listed member id for a meeting of the session organization, updates the meeting attendee count and audits the batch atomically.',
    status: 'PARTIAL',
    future: 'Verify each member id belongs to the organization and to the committee, and name who may record attendance.',
    ev: (a) => [
      a.imp('mutation', 'recordAttendance', /tx\.insert\(committeeMeetingAttendees\)/),
      a.imp('audit', 'recordAttendance', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'recordAttendance', /eq\(committeeMeetings\.organizationId, organizationId\)/),
      a.imp('defect', 'recordAttendance', '.set(a)'),
    ],
    def: ['DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED'],
  },
  'committees/[id]/meetings/[meetingId]/minutes/route.ts|POST': {
    persona: 'Steward recording the minutes of a committee meeting', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'The minutes column of one committee_meetings row; the update statement carries the organization predicate and refuses a row whose minutes were approved.',
    sens: 'The minutes text of a committee meeting, which can record member names, grievances discussed and decisions',
    priv: 'The minutes text is stored from the body; the audit record names the committee and not the content.',
    does: 'Sets the minutes of an unapproved meeting of the session organization, marks the meeting completed and audits the write atomically; an approved meeting is refused with 409.',
    status: 'PARTIAL',
    future: 'Keep a version history of the draft minutes, and name the secretary of the committee as the recorder.',
    ev: (a) => [
      a.imp('mutation', 'recordMinutes', /\.set\(\{ minutes, status: 'completed'/),
      a.imp('audit', 'recordMinutes', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'recordMinutes', /isNull\(committeeMeetings\.minutesApprovedAt\), eq\(committeeMeetings\.organizationId, organizationId\)/),
    ],
    def: [],
  },
  'committees/[id]/meetings/[meetingId]/minutes/route.ts|PATCH': {
    persona: 'Officer approving the minutes of a committee meeting', role: 'officer', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: TENANT_CHILD,
    owner: 'The approval columns of one committee_meetings row; the update statement carries the organization predicate and requires minutes that are not yet approved.',
    sens: 'The approver user id and approval time of committee minutes',
    priv: 'No personal data beyond the approver user id is written.',
    does: 'Approves recorded, unapproved minutes of a meeting of the session organization, stamps the approver and time and audits the approval atomically.',
    status: 'PARTIAL',
    future: 'Require the approver to differ from the recorder and to be a committee officer, and record the committee vote that approved the minutes.',
    ev: (a) => [
      a.imp('mutation', 'approveMinutes', /minutesApprovedBy: approvedBy,/),
      a.imp('audit', 'approveMinutes', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'approveMinutes', /isNotNull\(committeeMeetings\.minutes\), eq\(committeeMeetings\.organizationId, organizationId\)/),
      a.h('defect', 'const updated = await approveMinutes(meetingId, organizationId, userId!);'),
    ],
    def: ['DEF-0B5-COMMITTEE-MINUTES-NO-SEPARATION-OF-DUTIES'],
  },
  'committees/[id]/action-items/route.ts|GET': {
    persona: 'Member of the organization listing the action items of a committee', role: 'member', mut: 'NOT_MUTATING',
    tenant: TENANT_PATH,
    owner: 'committee_action_items rows of one committee.',
    sens: 'Action item titles, assignees, due dates, priority and status of a committee',
    priv: 'Any member of the organization reads every action item and assignee of any committee of the organization.',
    does: 'Lists the open action items of one committee of the session organization, optionally by status or assignee or with completed items.',
    status: 'PARTIAL',
    future: 'Restrict action item reads to the committee members and the assignee, and bound the result.',
    ev: (a) => [a.imp('mutation', 'listActionItems', '.from(committeeActionItems)'), a.imp('privacy', 'listActionItems', 'conditions.push(eq(committeeActionItems.assignedTo, options.assignedTo));')],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP'],
  },
  'committees/[id]/action-items/route.ts|POST': {
    persona: 'Steward assigning a committee action item', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: `${TENANT_PATH} A meeting named in the body must belong to the committee and organization.`,
    owner: 'committee_action_items rows of one committee; the row names the organization and the creator.',
    sens: 'Action item title, description, assignee user id, due date and priority',
    priv: 'The assignee id is stored from the body without a membership check.',
    does: 'Creates an action item for one committee of the session organization and audits it atomically.',
    status: 'PARTIAL',
    future: 'Verify the assignee is a member of the committee, and notify the assignee through a governed channel.',
    ev: (a) => [
      a.imp('mutation', 'createActionItem', /tx\.insert\(committeeActionItems\)/),
      a.imp('audit', 'createActionItem', 'await persistAtomicAudit(tx, {'),
      a.h('defect', '...body,'),
    ],
    def: ['DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED'],
  },
  'committees/[id]/action-items/[itemId]/route.ts|PATCH': {
    persona: 'Steward updating a committee action item', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_ACTION,
    tenant: TENANT_CHILD,
    owner: 'committee_action_items rows of one committee; the update statement carries the organization predicate.',
    sens: 'Action item status, assignee, due date, completion time and completing user',
    priv: 'The assignee id is stored from the body without a membership check; the audit record lists changed field names and the status.',
    does: 'Updates an action item of the session organization with the body fields except the organization and committee, stamps completion when the status becomes completed and audits atomically.',
    status: 'PARTIAL',
    future: 'Verify the assignee, restrict completion to the assignee and the committee officers, and keep previous values in the audit record.',
    ev: (a) => [
      a.imp('mutation', 'updateActionItem', /\.update\(committeeActionItems\)/),
      a.imp('audit', 'updateActionItem', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'updateActionItem', /eq\(committeeActionItems\.organizationId, organizationId\)/),
    ],
    def: ['DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED'],
  },
  'committees/[id]/documents/route.ts|GET': {
    persona: 'Member of the organization listing the documents linked to a committee', role: 'member', mut: 'NOT_MUTATING',
    tenant: TENANT_PATH,
    owner: 'committee_documents rows of one committee.',
    sens: 'Document titles, categories, file URLs and the uploader of documents linked to a committee',
    priv: 'Any member of the organization reads the file URLs of every document linked to any committee of the organization.',
    does: 'Lists the documents linked to one committee of the session organization, optionally by category or meeting.',
    status: 'PARTIAL',
    future: 'Restrict document links to the committee members, and serve files through the governed document authority and not a stored URL.',
    ev: (a) => [a.imp('mutation', 'listCommitteeDocuments', '.from(committeeDocuments)')],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP'],
  },
  'committees/[id]/documents/route.ts|POST': {
    persona: 'Steward linking a document to a committee', role: 'steward', mut: 'ATOMIC_AUDIT_IN_TRANSACTION', children: CH_MEETING,
    tenant: `${TENANT_PATH} A meeting named in the body must belong to the committee and organization.`,
    owner: 'committee_documents rows of one committee; the row names the organization and the uploader.',
    sens: 'Document title, category, file URL and document id',
    priv: 'The file URL and document id are stored from the body without a document register or host check.',
    does: 'Links a document row to one committee of the session organization and audits it atomically; it uploads no file.',
    status: 'PARTIAL',
    future: 'Verify the document belongs to the organization and is readable by the committee, and refuse a file URL that is not on an allowed storage host.',
    ev: (a) => [
      a.imp('mutation', 'linkDocument', /tx\.insert\(committeeDocuments\)/),
      a.imp('audit', 'linkDocument', 'await persistAtomicAudit(tx, {'),
      a.h('defect', '...body,'),
    ],
    def: ['DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED'],
  },
  'committees/[id]/intelligence/route.ts|GET': {
    persona: 'Steward reading committee intelligence snapshots', role: 'steward', mut: 'NOT_MUTATING',
    tenant: 'The snapshot query carries an organization predicate on the session organization; a committee other than the literal all is proven to belong to the organization first.',
    owner: 'committee_intelligence_snapshots rows of the organization.',
    sens: 'Synthesis titles, summaries, themes, positions and recommendations built from committee minutes, and the source meeting ids',
    priv: 'Any steward reads syntheses built from the minutes of committees the steward may not follow.',
    does: 'Lists the stored synthesis snapshots of the session organization, for one committee or for all of them, newest first, with a caller-chosen limit.',
    status: 'PARTIAL',
    future: 'Restrict snapshot reads to the readers of every source committee and bound the limit.',
    ev: (a) => [
      a.imp('mutation', 'listIntelligenceSnapshots', '.from(committeeIntelligenceSnapshots)'),
      a.imp('tenantScope', 'listIntelligenceSnapshots', 'eq(committeeIntelligenceSnapshots.organizationId, organizationId),'),
      a.h('defect', 'const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;'),
    ],
    def: ['DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP', 'DEF-0B5-COMMITTEE-LIST-PAGINATION-UNBOUNDED'],
  },
  'committees/[id]/intelligence/route.ts|POST': {
    persona: 'Officer requesting a cross-committee synthesis of minutes', role: 'officer', mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    tenant: 'The minutes query carries an organization predicate on the session organization; the committee in the path and every committee named in the body are proven to belong to the organization first.',
    owner: 'committee_intelligence_snapshots rows of the organization; the row names the committee, the source meetings and the requester.',
    sens: 'Completed minutes, decisions and agenda items of the organization committees over a period, summarized into one snapshot',
    priv: 'Minutes of every committee of the organization are gathered into one snapshot readable by every steward.',
    does: 'Gathers the completed minutes of the organization committees for a period, stores a placeholder snapshot whose summary says the AI synthesis is pending, and audits the insert atomically.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    future: 'Return 501 until a synthesis exists, or label the snapshot as a placeholder and exclude it from reads; gather only the committees the requester names.',
    ev: (a) => [
      a.imp('mutation', 'createIntelligenceSnapshot', /tx\.insert\(committeeIntelligenceSnapshots\)/),
      a.imp('audit', 'createIntelligenceSnapshot', 'await persistAtomicAudit(tx, {'),
      a.imp('tenantScope', 'gatherCrossCommitteeMinutes', 'eq(committeeMeetings.organizationId, organizationId),'),
      a.h('tenantScope', 'for (const id of body.committeeIds ?? []) await requireCommitteeScope(organizationId, id);'),
      a.h('behavior', 'summary: `Intelligence synthesis from ${meetings.length} meetings across the period ${body.periodStart} to ${body.periodEnd}. Full AI synthesis pending integration.`,'),
      a.imp('defect', 'gatherCrossCommitteeMinutes', 'if (committeeIds?.length) {'),
    ],
    def: ['DEF-0B5-COMMITTEE-INTELLIGENCE-GATHERS-ALL-COMMITTEES', 'DEF-0B5-COMMITTEE-INTELLIGENCE-PLACEHOLDER-RETURNED-AS-RESULT'],
  },
}

function workspaceFacts(a) {
  const spec = SPECS[`${a.route}|${a.method}`]
  if (!spec) throw new Error(`no Gate 0B.5 committee facts for ${a.route}|${a.method}`)
  const write = spec.mut === 'ATOMIC_AUDIT_IN_TRANSACTION'
  return mk({
    ...ownerBase(a),
    persona: spec.persona,
    authz: authz(spec.role),
    tenant: spec.tenant,
    owner: spec.owner,
    sens: spec.sens,
    priv: spec.priv,
    mut: spec.mut,
    auditDetail: write
      ? AUDIT_ATOMIC(`The service call`)
      : 'A read of committee records; nothing is written and the read is not audited.',
    reqAudit: write
      ? 'Keep the in-transaction audit record and add the authorization decision and the previous values to it.'
      : 'Audit reads of minutes and attendance once the readers are named; they can record member names and grievance matters.',
    does: spec.does,
    status: spec.status,
    future: spec.future,
    ev: [
      ...guards(a, spec.role, spec.children),
      ...spec.ev(a),
    ],
    def: spec.def,
  })
}

const committeeProfile = {
  persona: 'Member reading, and steward maintaining, the standing committees of the organization through the generic CRUD factory',
  owner: 'committees rows of the organization; chairId and secretaryId name the officers, and the row records its creator and updater.',
  sens: 'Committee name, type, mandate, meeting schedule and location, chair and secretary ids, contact e-mail, internal notes and custom fields',
  priv: (method) => (method === 'GET'
    ? 'Any member of the organization reads every committee row, including the internal notes, custom fields and contact e-mail.'
    : method === 'DELETE'
      ? 'The row is archived (status archived) by the fixed administrator delete; only the audit record of the delete remains.'
      : 'Any body field is stored, including chairId, secretaryId, status, currentMemberCount and the notes.'),
  does: (method, _model, floor) => ({
    GET: `Returns committees rows of the organization at a role floor of ${floor}.`,
    POST: `Inserts a committees row from the body at a role floor of ${floor}.`,
    PATCH: `Updates a committees row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Sets status archived on a committees row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Name who may create and change a committee, derive the chair and member count from committee memberships, and keep the internal notes to the committee officers.',
  gate: GATE,
  deps: [9, 13],
  status: () => 'PARTIAL',
  def: (method) => (method === 'GET' ? ['DEF-0B5-COMMITTEE-INTERNAL-NOTES-READ-BY-ANY-MEMBER'] : []),
  extraEv: (a) => [
    a.tbl('privacy', 'committees', /notes: text\(/),
    a.tbl('privacy', 'committees', /contactEmail: /),
  ],
  reqRead: 'Audit reads of committee rows once the notes are restricted to officers.',
}

export function committeeFacts(a, readText) {
  if (COMMITTEE_CRUD_ROUTES.has(a.route)) return crudRecord(a, readText, committeeProfile)
  return workspaceFacts(a)
}

export { SERVICE }
