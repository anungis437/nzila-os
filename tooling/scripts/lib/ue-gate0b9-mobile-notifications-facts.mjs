/**
 * Facts: mobile device registration, push routes, in-app notifications, negotiations and meeting rooms (Gate 0B.9).
 * Four of the mobile and push paths are the generic CRUD factory over tables that are not what the path names (push
 * "subscribe" and "unsubscribe" create push campaign rows, "mobile/notifications" lists the scheduled-notification
 * queue, not the inbox), the device and in-app notification routes are hand-written withApi handlers with their own
 * predicates, and the negotiations and meeting-room paths are the generic factory over bargaining and room tables.
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the
 * resolved schema, and is proved again by the validator. This tranche records the source; it repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const MOBILE = 'UE-OMIT-MOBILE-DEVICES-AND-IN-APP-NOTIFICATIONS'
const CALENDAR = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const BARGAINING = 'UE-OMIT-BARGAINING-RECORDS'

const GATE = {
  [MOBILE]: 11,
  [CALENDAR]: 14,
  [BARGAINING]: 14,
}

export const ROUTES = new Set([
  'meeting-rooms/[id]/bookings/route.ts',
  'meeting-rooms/route.ts',
  'mobile/devices/route.ts',
  'mobile/notifications/route.ts',
  'mobile/push/subscribe/route.ts',
  'mobile/push/unsubscribe/route.ts',
  'mobile/sync/route.ts',
  'negotiations/route.ts',
  'notifications/[id]/route.ts',
  'notifications/count/route.ts',
  'notifications/mark-all-read/route.ts',
  'notifications/route.ts',
  'notifications/test/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

const NOTIF_SCHEMA = `${APP}db/schema/notifications-schema.ts`
const PUSH_SCHEMA = `${APP}db/schema/push-notifications.ts`
const MOBILE_SCHEMA = `${APP}db/schema/mobile-devices-schema.ts`
const CALENDAR_SCHEMA = `${APP}db/schema/calendar-schema.ts`
const NEGOTIATION_SCHEMA = `${APP}db/schema/bargaining-negotiations-schema.ts`
const SYNC_ROUTE = `${API}mobile/sync/route.ts`

export const GROUPS = {
  MOB_NOTIFICATION_INBOX: {
    capabilityId: MOBILE,
    domain: 'IN_APP_NOTIFICATION_INBOX',
    actor: 'Member reading, marking read and deleting their own in-app notifications, and steward addressing a notification to a member of the organization or sending themself a test notification',
    routes: [
      'notifications/route.ts',
      'notifications/[id]/route.ts',
      'notifications/count/route.ts',
      'notifications/mark-all-read/route.ts',
      'notifications/test/route.ts',
    ],
    evidence: [
      ev(NOTIF_SCHEMA, "export const inAppNotifications = pgTable('in_app_notifications', {"),
      ev(`${API}notifications/route.ts`, ' * In-app notifications — list and create.'),
      ev(`${API}notifications/test/route.ts`, ' * Creates a test notification for the authenticated user. Steward-only.'),
      ev(`${APP}components/notifications/notifications-console.tsx`, "await fetch('/api/notifications/mark-all-read', { method: 'POST' });"),
    ],
  },
  MOB_DEVICE_REGISTRATION: {
    capabilityId: MOBILE,
    domain: 'MOBILE_DEVICE_REGISTRATION_AND_SYNC_PATHS',
    actor: 'Member registering and listing the mobile devices of their own account for push delivery and sync, and steward registering a push device through the generic device collection',
    routes: ['mobile/devices/route.ts', 'mobile/sync/route.ts'],
    evidence: [
      ev(PUSH_SCHEMA, "'push_devices',"),
      ev(MOBILE_SCHEMA, "export const mobileDevices = pgTable('mobile_devices', {"),
      ev(SYNC_ROUTE, ' * POST /api/mobile/sync — register a new mobile device'),
      ev(`${APP}components/mobile/SyncStatus.tsx`, "const response = await fetch('/api/mobile/sync', {"),
      ev(`${API}notifications/device/route.ts`, 'Devices are registered through /api/mobile/devices, which stores the token under'),
    ],
  },
  MOB_PUSH_CAMPAIGN_FACADES: {
    capabilityId: MOBILE,
    domain: 'PUSH_SUBSCRIPTION_PATHS_OVER_PUSH_CAMPAIGN_ROWS',
    actor: 'Member whose browser subscribes to or unsubscribes from push delivery through paths named subscribe and unsubscribe, and steward whose request stores a push campaign row',
    routes: ['mobile/push/subscribe/route.ts', 'mobile/push/unsubscribe/route.ts'],
    evidence: [
      ev(PUSH_SCHEMA, ' * Push notification campaigns'),
      ev(`${API}mobile/push/subscribe/route.ts`, ' * CRUD collection route for pushNotifications'),
      ev(`${API}mobile/push/unsubscribe/route.ts`, ' * CRUD collection route for pushNotifications'),
      ev(`${APP}lib/mobile/push-notifications.ts`, "await fetch('/api/mobile/push/subscribe', {"),
      ev(`${APP}lib/mobile/push-notifications.ts`, "await fetch('/api/mobile/push/unsubscribe', {"),
    ],
  },
  MOB_SCHEDULED_NOTIFICATION_QUEUE_FACADE: {
    capabilityId: MOBILE,
    domain: 'MOBILE_NOTIFICATIONS_PATH_OVER_SCHEDULED_NOTIFICATION_QUEUE',
    actor: 'Member reading their own, and steward reading and writing the organization, scheduled notification rows through a path named mobile notifications',
    routes: ['mobile/notifications/route.ts'],
    evidence: [
      ev(NOTIF_SCHEMA, "export const notifications = pgTable('notifications', {"),
      ev(NOTIF_SCHEMA, "type: text('type').notNull(), // deadline_reminder, deadline_missed, etc."),
      ev(`${API}mobile/notifications/route.ts`, ' * CRUD collection route for notifications'),
    ],
  },
  MOB_BARGAINING_NEGOTIATIONS_ALIAS: {
    capabilityId: BARGAINING,
    domain: 'NEGOTIATIONS_PATH_ALIAS_OF_BARGAINING_NEGOTIATIONS',
    actor: 'Member reading, and steward creating, collective-bargaining negotiation records through a top-level negotiations path that repeats the bargaining negotiations collection',
    routes: ['negotiations/route.ts'],
    evidence: [
      ev(NEGOTIATION_SCHEMA, 'export const negotiations = pgTable("negotiations", {'),
      ev(`${API}negotiations/route.ts`, ' * CRUD collection route for negotiations'),
      ev(`${API}bargaining/negotiations/route.ts`, ' * CRUD collection route for negotiations'),
    ],
  },
  MOB_CALENDAR_MEETING_ROOMS: {
    capabilityId: CALENDAR,
    domain: 'MEETING_ROOM_COLLECTION',
    actor: 'Member reading, and steward creating, the meeting rooms of the organization together with their booking rules',
    routes: ['meeting-rooms/route.ts'],
    evidence: [
      ev(CALENDAR_SCHEMA, "export const meetingRooms = pgTable('meeting_rooms', {"),
      ev(`${API}meeting-rooms/route.ts`, ' * CRUD collection route for meetingRooms'),
    ],
  },
  MOB_CALENDAR_MEETING_ROOM_BOOKINGS_PATCH: {
    capabilityId: CALENDAR,
    domain: 'MEETING_ROOM_BOOKINGS_PATH_PATCH_OVER_MEETING_ROOM_ITEM',
    actor: 'Steward updating a meeting room row through a path named for the bookings of the room',
    routes: ['meeting-rooms/[id]/bookings/route.ts'],
    methods: ['PATCH'],
    evidence: [
      ev(CALENDAR_SCHEMA, "export const roomBookings = pgTable('room_bookings', {"),
      ev(`${API}meeting-rooms/[id]/bookings/route.ts`, ' * CRUD item route for meetingRooms'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE[ownerCapabilityId], severity, title, ...extra })

const DEF = 'DEF-0B9-MOB-'
const NOTIFICATION_READS_SWALLOW = `${DEF}NOTIFICATION-READS-ANSWER-200-WITH-NO-NOTIFICATIONS-WHEN-THE-QUERY-FAILS`
const NOTIFICATION_NO_SENDER = `${DEF}STEWARD-NOTIFICATION-IS-STORED-WITHOUT-A-SENDER-AND-WITH-UNBOUNDED-UNVALIDATED-CONTENT`
const NOTIFICATION_PATCH = `${DEF}NOTIFICATION-PATCH-READ-FLAG-IS-UNVALIDATED-AND-READ-AT-IS-NOT-CLEARED`
const NOTIFICATION_TEST = `${DEF}NOTIFICATION-TEST-ROUTE-EXERCISES-NO-DELIVERY-CHANNEL-AND-LEAVES-A-PERMANENT-ROW`
const DEVICE_FLOOR = `${DEF}PUSH-DEVICE-REGISTRATION-REQUIRES-A-STEWARD-SO-A-MEMBER-DEVICE-IS-REFUSED`
const DEVICE_REGISTRIES = `${DEF}TWO-DEVICE-TABLES-NO-ROUTE-REMOVES-A-DEVICE-AND-NO-SENDER-READS-EITHER`
const DEVICE_TOKEN_ROWS = `${DEF}DEVICE-ROWS-ARE-RETURNED-WHOLE-WITH-THE-PUSH-TOKEN-AND-SECURITY-FLAGS`
const SYNC_NAME = `${DEF}SYNC-PATH-REGISTERS-A-DEVICE-AND-SYNCS-NOTHING-AND-ITS-ONLY-CALLER-ALWAYS-FAILS`
const SYNC_REREGISTER = `${DEF}DEVICE-REREGISTRATION-KEEPS-THE-OLD-ORGANIZATION-AND-CONSTRAINT-CLASHES-ANSWER-500`
const PUSH_FACADE = `${DEF}PUSH-SUBSCRIBE-AND-UNSUBSCRIBE-ARE-PUSH-CAMPAIGN-CRUD-AND-STORE-NO-SUBSCRIPTION`
const PUSH_READ = `${DEF}PUSH-CAMPAIGN-ROWS-ARE-READABLE-BY-EVERY-MEMBER-WITH-TARGETING-AND-DEVICE-IDS`
const PUSH_FORGED = `${DEF}PUSH-CAMPAIGN-CREATE-ACCEPTS-SENT-STATUS-AND-DELIVERY-COUNTERS-AND-NOTHING-SENDS`
const MOBILE_QUEUE_PATH = `${DEF}MOBILE-NOTIFICATIONS-PATH-SERVES-THE-SCHEDULED-QUEUE-TABLE-NOT-THE-INBOX`
const MOBILE_QUEUE_CREATE = `${DEF}MOBILE-NOTIFICATIONS-CREATE-ADDRESSES-ANY-USER-ID-AND-STORES-A-CALLER-CHOSEN-SENT-STATE`
const NEGOTIATION_ALIAS = `${DEF}NEGOTIATIONS-PATH-REPEATS-THE-BARGAINING-NEGOTIATIONS-COLLECTION`
const NEGOTIATION_STRIKE = `${DEF}NEGOTIATION-CREATE-LETS-A-STEWARD-RECORD-STRIKE-VOTE-MANDATE-AND-COST-CEILING-WITH-NO-SOURCE-RECORD`
const ROOM_RULES = `${DEF}MEETING-ROOM-BOOKING-RULES-ARE-STORED-BUT-NO-ROUTE-OR-SERVICE-ENFORCES-A-BOOKING`
const ROOM_PATCH = `${DEF}MEETING-ROOM-BOOKINGS-PATH-PATCH-EDITS-THE-ROOM-ROW-NOT-A-BOOKING`

export const DECISIONS = [
  {
    id: 'UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES',
    status: 'OUTSTANDING',
    question: 'Which offices may address an in-app or push notification to one member or to a group of members, in whose name does it appear to the recipient, may a member opt out of push and in-app notices by class, and which office owns the registry of member devices, including what happens to a device row when the device passes to another account or the member leaves the organization?',
    sourceState: 'The notification create route lets any steward address any member of the organization with a caller-written title, message, link and payload and stores no sender; the generic push routes named subscribe and unsubscribe store a campaign row and never a subscription or an opt-out; two device tables (push_devices and mobile_devices) are written by two different routes and no route removes or deactivates either; no source names an office that may send, a class that a member may refuse, or a retention rule for device tokens, and the notification dispatcher is recorded as NOT_IMPLEMENTED pending a communications wave.',
    softwareOwners: [MOBILE],
  },
]

export const CAPABILITIES = [
  {
    id: MOBILE,
    parentRegisterId: 'UE-CONV-I-002',
    relatedRegisterIds: ['UE-CONV-K-006', 'UE-CONV-K-007'],
    obligationKey: 'mobile-devices-and-in-app-notifications',
    primaryGate: GATE[MOBILE],
    dependencyGates: [9, 13],
    actor: 'Member keeping the inbox of in-app notifications and the devices registered for push and sync under their own account, and steward addressing a notification to a member',
    businessOutcome: 'A member reads, marks and deletes only their own notifications, a notification shows who sent it and is addressed only by an office the institution names, a member can register and remove their own device and opt out of push, a push or sync path stores what its name says, and every state change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/notifications, app/api/mobile/devices, app/api/mobile/sync, app/api/mobile/push, app/api/mobile/notifications',
    service: `${APP}app/api/notifications/route.ts`,
    sourceFiles: [
      `${APP}app/api/notifications/route.ts`,
      `${APP}app/api/notifications/[id]/route.ts`,
      `${APP}app/api/mobile/sync/route.ts`,
      `${APP}app/api/mobile/devices/route.ts`,
      `${APP}db/schema/notifications-schema.ts`,
      `${APP}db/schema/push-notifications.ts`,
      `${APP}db/schema/mobile-devices-schema.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/notifications/route.ts` }],
    auditEvidence: 'The in-app notification writes and the device registration commit persistAtomicAudit in the same tenant transaction as the row; the generic device, push campaign and scheduled notification writes commit the factory audit record with the row; the audit names the fields or the recipient and type, never the notification text; reads are not audited.',
    privacyClassification: 'In-app notification titles, messages, links and payloads addressed to a member, push device tokens and device security flags, and scheduled notification rows that name a related grievance, claim or deadline.',
    gap: 'No existing capability names the member notification inbox or the device registry. UE-OMIT-COMMUNICATIONS-CAMPAIGN-DELIVERY owns the delivery status of newsletter campaigns read from newsletter tables, UE-OMIT-COMMUNICATIONS-SMS owns SMS message, campaign and conversation tables, UE-CAP-I-002 owns member conversations on the kernel message contract, UE-CAP-I-001 is the frozen persona-journey programme, and UE-OMIT-DELIVERY-EVIDENCE owns proof of delivery, none of which read or write in_app_notifications, notifications, push_devices, push_notifications or mobile_devices. The gate follows its communications siblings (11) because the dispatcher is registered as a communications-truth dependency; which office owns member notification senders and the device registry stays the outstanding decision UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES.',
  },
]

export const DEFECTS = [
  D(NOTIFICATION_READS_SWALLOW, MOBILE, 'MEDIUM',
    'The notification list GET wraps its three queries in a try block whose catch logs and returns an empty notifications array, unreadCount 0 and zero totals as a normal 200 (the comment says the in_app_notifications table may lack expected columns), and a non-numeric page parameter becomes NaN, fails the query and takes the same path; the count GET catches every error with an empty catch and returns count 0; so a failed read is shown to the member as no notifications and no unread items, and the dashboard top bar that calls the count route cannot tell the two apart.'),
  D(NOTIFICATION_NO_SENDER, MOBILE, 'MEDIUM',
    'The notification create POST lets a steward insert a row for any non-deleted member of the organization with a caller-written title, message, type, action label, action url and data object taken from an unvalidated body (no schema, no length or shape bound, an unparsable expiresAt becomes an Invalid Date that fails at insert and answers 500), and in_app_notifications has no created-by or sender column and the insert sets none, so the recipient sees a steward-authored message in the same inbox and with the same presentation as a system notification; the acting steward appears only in the audit record, whose details hold the recipient and type but not the text, and nothing limits which members or how often.'),
  D(NOTIFICATION_PATCH, MOBILE, 'LOW',
    'The notification PATCH reads read from the body without a schema: a value that is truthy but not a boolean (such as the string false) sets readAt to now and stores the text in the boolean column, a value PostgreSQL cannot parse as a boolean fails at the update and answers 500, and setting read to false never clears readAt, so the stored read timestamp can contradict the flag; the audit record stores the raw read value that was sent.'),
  D(NOTIFICATION_TEST, MOBILE, 'LOW',
    'The notification test POST inserts one in-app row for the calling steward with a fixed title and the message that it verifies that the notification setup is working correctly, but it calls no push, e-mail or SMS channel and reads no device or preference, so a success proves only that a database row was written; every call adds another row with no expiry and no de-duplication, and the response is the stored row, not a delivery result.'),
  D(DEVICE_FLOOR, MOBILE, 'MEDIUM',
    'The push device collection reads at the member floor and restricts a read to the caller own profile, but its POST requires the steward floor, so a member (the only person who holds the phone) is refused with 403 when the retired /api/notifications/device route sends them to /api/mobile/devices to register; for a steward the insert copies every body field into push_devices apart from the forced profileId (enabled, quiet hours, timezone, lastActiveAt, id, createdAt), an unknown platform value fails the push_platform enum and a user without a profiles row fails the foreign key, both as 500.'),
  D(DEVICE_REGISTRIES, MOBILE, 'MEDIUM',
    'Devices are kept in two unrelated tables: push_devices (written by the generic device route) and mobile_devices (written by the sync route), each with its own token, preference and active columns, and neither route exports a PATCH or DELETE or has an item route, so a device or token can never be disabled, archived or removed by its owner or an administrator, a device that passes to another account is refused with 409 by the ownership check on every later registration, and the only code that reads either table for delivery (services/fcm-service.ts over push_devices and lib/mobile/mobile-engine.ts over mobile_devices) is imported by no route, worker or script outside its tests.'),
  D(DEVICE_TOKEN_ROWS, MOBILE, 'LOW',
    'The mobile sync GET selects every column of mobile_devices and the POST returns the inserted row, and the device collection GET and POST return the whole push_devices row, so each response carries the device push token (a delivery credential for that device) together with the jailbreak flag, compliance issues, last compliance check and metadata columns; the rows are limited to the caller own devices, but nothing projects the token or the security flags out of a response that a browser or script can read.'),
  D(SYNC_NAME, MOBILE, 'MEDIUM',
    'The /api/mobile/sync route lists and registers mobile devices and synchronizes nothing: it never touches the mobile_sync_queue table that the mobile engine defines, and its POST refuses a body without deviceToken, deviceId and platform, while the only in-repository caller, the Sync now button in SyncStatus, posts just deviceId (or the text unknown) and platform pwa with no deviceToken, so that request is always answered 400 and the control reports an error whatever the device state.'),
  D(SYNC_REREGISTER, MOBILE, 'MEDIUM',
    'When the same user posts an existing deviceId the sync POST updates deviceToken, appVersion, osVersion and lastActiveAt but not organizationId, so a user who registers the device while acting in a second organization receives the row still bound to the first organization (the GET filters by the current organization and will not list it) while the audit record is written for the second one; a deviceToken already held by a different deviceId, and a platform, name or version longer than its varchar column, are not checked and surface as raw database constraint failures answered 500.'),
  D(PUSH_FACADE, MOBILE, 'MEDIUM',
    'The /api/mobile/push/subscribe and /api/mobile/push/unsubscribe routes are the same crudRoutes configuration over push_notifications, the push campaign table: the browser client posts the PushSubscription (endpoint and keys) to subscribe and { endpoint } to unsubscribe, neither of which names the NOT NULL campaign columns, so a steward request fails at insert and answers 500 and a member request is refused 403 at the steward floor, no subscription or opt-out is ever stored or removed, and the client never inspects the status, so it marks the browser subscribed after subscribe and unsubscribed after unsubscribe although the server did nothing.'),
  D(PUSH_READ, MOBILE, 'MEDIUM',
    'The push campaign GET paths return the push_notifications rows of the organization to any member (member read floor, no owner column, and the table has no user column for the low-role guard to apply), including draft and scheduled campaigns with their name, title and body, targeting (target type, target criteria with roles, statuses, tags and custom fields, topics), the uuid array of targeted push_devices rows, delivery counters and the creating user id, so every member can read unpublished union campaigns and how they are aimed.'),
  D(PUSH_FORGED, MOBILE, 'MEDIUM',
    'The push campaign POST copies the whole request body into push_notifications at the steward floor, so a steward can create a row with status sent, sentAt, targetType all and any totalTargeted, totalSent, totalDelivered, totalClicked and totalDismissed values, and the row then reads as a delivered campaign with engagement figures although no route, worker or script that is imported by the application sends a push (services/fcm-service.ts has no importer outside its tests) and no push_deliveries row exists.'),
  D(MOBILE_QUEUE_PATH, MOBILE, 'MEDIUM',
    'The /api/mobile/notifications route is the generic factory over the notifications table (the scheduled deadline-reminder queue: type, priority, related entity, scheduled time and send status), not the in_app_notifications inbox that /api/notifications serves, so a mobile client that lists notifications receives a different dataset with no read flag or read route; a member sees only their own rows but a steward or above reads every user scheduled notification of the organization, with message text and the related grievance, claim or deadline reference.'),
  D(MOBILE_QUEUE_CREATE, MOBILE, 'MEDIUM',
    'The scheduled-notification POST copies the body into the notifications table at the steward floor with no check that the target userId is a member of the organization (the sibling /api/notifications POST makes that check), so a steward can store a row addressed to any user id string, set its status to sent and its sentAt, priority and related entity, and that row reads as a delivered notification although the notification-processing cron that would send scheduled rows answers 501 NOT_IMPLEMENTED.'),
  D(NEGOTIATION_ALIAS, BARGAINING, 'LOW',
    'The top-level /api/negotiations route is a second copy of the /api/bargaining/negotiations collection: the crudRoutes configuration over the negotiations table is identical in both files (member read, steward write, organization scoped, no blockedPatchFields), so the same confidential negotiation records are reachable by two paths and a role, confidentiality or field restriction added to one path leaves the other open.'),
  D(NEGOTIATION_STRIKE, BARGAINING, 'MEDIUM',
    'The negotiation POST lets a steward store strikeVotePassed, strikeVoteDate, strikeVoteYesPercent, mandateExpiry, estimatedCost, maximumCost, status and confidentialityLevel from the request body, and the route reads no vote, poll, mandate or costing record to verify them, so a steward-typed strike-vote result or cost ceiling is stored as the negotiation record and is then returned to every member by the member-floor GET.'),
  D(ROOM_RULES, CALENDAR, 'MEDIUM',
    'meeting_rooms rows store requiresApproval, allowedUserRoles, blockedDates, operatingHours, min and max booking duration and advanceBookingDays, and the room routes let stewards set them, but no route reads or writes room_bookings and the only booking code, lib/services/calendar-service.ts, returns true from checkRoomAvailability and builds an in-memory booking with the comment that production would insert into room_bookings, so a room configured to require approval or to exclude a role enforces neither and a booking is never stored.'),
  D(ROOM_PATCH, CALENDAR, 'MEDIUM',
    'A PATCH sent to /api/meeting-rooms/[id]/bookings updates the meeting_rooms row whose id is the path value at the steward floor, copying every body field except the primary key and the organization (status, isActive, requiresApproval, allowedUserRoles, blockedDates, contact person, e-mail and phone, imageUrl, metadata, createdAt), and reads or changes no room_bookings row, so a client that patches a booking changes the room itself and a booking id addresses nothing.'),
]

/* ------------------------------------------------------------------------------------------------------------ */
/* shared text                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

const SENDERS_DECISION = ['UE-INST-MEMBER-NOTIFICATION-SENDERS-AND-DEVICES']

const NOTIF_TABLE = (a, claim, pattern) => a.tbl(claim, 'inAppNotifications', pattern)

const inboxBase = (a) => ({
  service: `${API}${a.route} (${a.method} via withApi) over in_app_notifications`,
  authn: `${SESSION} (withApi with an authenticated session and an organization context).`,
  gate: 11,
  deps: [13],
  status: 'PARTIAL',
  dec: SENDERS_DECISION,
})

const OWN_ROWS = 'in_app_notifications rows keyed by user_id (text) and organization_id: title, message, type, action label and url, a free data object, read flag and read time, creation and expiry time; the table has no sender or created-by column.'
const OWN_SENS = 'Notification titles, messages, links and payloads addressed to a member, which can name a grievance, a deadline, a thread or any text a steward typed'

/* ------------------------------------------------------------------------------------------------------------ */
/* notifications                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

const notificationsListGet = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member reading their own in-app notifications, page by page',
  authz: 'withApi with a member role floor (auth minRole member). The rows are held to the session user id and organization id; a role title is not a kernel decision and no office is named as the reader of a member inbox.',
  tenant: 'Real predicate: the where clause ANDs the session user id and the session organization id (the dashboard sends an organizationId query parameter that the handler never reads). The query uses the shared db handle with those explicit predicates, not a row-level-security transaction.',
  owner: OWN_ROWS,
  sens: OWN_SENS,
  priv: 'The member receives only their own unexpired notifications with unread count and pagination; a query failure is returned as an empty list, not as an error.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of a member own inbox need no audit record; a failed read must be reported as a failure and not as an empty inbox.',
  does: 'Reads page and limit (limit capped at 100) and the unreadOnly and type filters, selects the unexpired in_app_notifications rows of the session user and organization newest first with a total and an unread count, and returns them; any error is logged and answered as 200 with no notifications and zero counts.',
  future: 'Answer a failed query with an error status, validate page and limit as integers, and keep the user and organization predicates.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(inAppNotifications.userId, userId!),'),
    a.h('tenantScope', 'eq(inAppNotifications.organizationId, organizationId!),'),
    NOTIF_TABLE(a, 'tenantScope', /organizationId: uuid\('organization_id'\)/),
    a.h('mutation', '.from(inAppNotifications)'),
    a.h('behavior', 'const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get(\'limit\') || \'50\')));'),
    a.h('defect', '// in_app_notifications table may lack expected columns'),
    a.h('defect', 'notifications: [],'),
    a.h('defect', "const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));"),
  ],
  inf: [
    { claim: 'defect', statement: 'Math.max(1, parseInt(x)) is NaN when parseInt returns NaN, so offset is NaN, the select throws and the catch returns the empty page with the requested page number; no branch returns a non-200 status for a database or parameter failure.' },
  ],
  def: [NOTIFICATION_READS_SWALLOW],
  corr: [],
})

const notificationsCreatePost = (a) => mk({
  ...inboxBase(a),
  persona: 'Steward addressing an in-app notification to a member of the organization',
  authz: 'withApi with a steward role floor (auth minRole steward) and a recipient check: the target user must be a non-deleted organization member of the session organization (404 otherwise). A role floor is not a kernel decision and no office is named as one that may notify members.',
  tenant: 'Real predicate: the recipient lookup and the insert both use the session organization id inside a row-level-security transaction opened with it; the recipient is chosen by the caller body but must belong to that organization.',
  owner: OWN_ROWS,
  sens: OWN_SENS,
  priv: 'The recipient later reads the steward-written title, message, link and data in their own inbox; the response returns the stored row to the steward and the audit record holds the recipient id and type, not the text.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The notification insert and persistAtomicAudit (notification.create, details recipientUserId and type) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit record and add the sender, the notification class and a content reference so the recipient and the institution can tell who addressed whom.',
  does: 'Requires userId, title and message in the body, checks that the target user is a non-deleted member of the session organization, inserts the notification with the typed type (default info), action label, action url, data and optional expiry, writes the audit record in the same transaction and returns the row; a missing field answers 400 and an unknown recipient 404.',
  future: 'Validate the body with a schema that bounds every field and the data object, store the sender and a notification class, restrict who may address members to the office the institution names, and bound how often.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', 'eq(organizationMembers.organizationId, organizationId),'),
    a.h('tenantScope', 'eq(organizationMembers.userId, targetUserId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.insert(inAppNotifications)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', "throw ApiError.badRequest('userId, title, and message are required');"),
    a.h('defect', 'const { userId: targetUserId, title, message, type, actionLabel, actionUrl, data, expiresAt } ='),
    a.h('defect', 'expiresAt: expiresAt ? new Date(expiresAt) : undefined,'),
    a.tbl('defect', 'inAppNotifications', /pgTable\('in_app_notifications'/, { absentColumns: ['createdBy', 'senderId', 'sentBy'] }),
  ],
  inf: [
    { claim: 'defect', statement: 'The route declares no body schema in its withApi options, so ctx.body is the raw parsed JSON cast to a type; no length, URL, enum or object-shape check is applied to title, message, type, actionLabel, actionUrl or data before the insert.' },
  ],
  def: [NOTIFICATION_NO_SENDER],
  corr: [],
})

const notificationItemGet = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member reading one of their own in-app notifications by id',
  authz: 'withApi with a member role floor (auth minRole member). The read is held to the session user id; a role title is not a kernel decision.',
  tenant: 'The where clause ANDs the path id with the session user id; it carries no organization predicate and uses the shared db handle, so a user who belongs to two organizations can read a notification of the other organization by id; the row is always the caller own.',
  owner: OWN_ROWS,
  sens: OWN_SENS,
  priv: 'The member receives their own notification row, including its data object; another user id never matches, so a guessed id returns 404.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of a member own notification need no audit record.',
  does: 'Selects the in_app_notifications row whose id is the path id and whose user id is the session user and returns it, or answers 404 when none matches.',
  future: 'Keep the user predicate and add the organization predicate used by PATCH and DELETE so the item routes agree.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', '.where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))'),
    NOTIF_TABLE(a, 'tenantScope', /organizationId: uuid\('organization_id'\)/),
    a.h('mutation', '.from(inAppNotifications)'),
    a.h('behavior', "throw ApiError.notFound('Notification');"),
  ],
  inf: [],
  def: [],
  corr: [],
})

const notificationItemPatch = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member marking one of their own in-app notifications read or unread',
  authz: 'withApi with a member role floor (auth minRole member). The update is held to the session user id and organization id; a role title is not a kernel decision.',
  tenant: 'Real predicate: the update ANDs the path id, the session user id and the session organization id inside a row-level-security transaction opened with that organization, so another user or organization row matches nothing (404).',
  owner: OWN_ROWS,
  sens: OWN_SENS,
  priv: 'The updated notification row is returned to its owner; the audit record stores the read value that was sent.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The notification update and persistAtomicAudit (notification.update, details read) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit record; a read marker is low risk and needs no further content.',
  does: 'Takes read from the body, sets read and, when truthy, readAt to now, updates the row of the session user and organization for the path id and writes the audit record in the same transaction; an empty update answers 400 and no match 404.',
  future: 'Validate read as a boolean with a schema and clear readAt when read is false.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(inAppNotifications.userId, userId),'),
    a.h('tenantScope', 'eq(inAppNotifications.organizationId, organizationId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.update(inAppNotifications)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', "throw ApiError.badRequest('No updatable fields supplied');"),
    a.h('defect', 'const { read } = (body as { read?: boolean }) || {};'),
    a.h('defect', 'updateData.readAt = new Date();'),
  ],
  inf: [
    { claim: 'defect', statement: 'No branch of the handler sets readAt to null, and the body is a raw parsed value cast to { read?: boolean }; a string value passes the read !== undefined test and the truthy test.' },
  ],
  def: [NOTIFICATION_PATCH],
  corr: [],
})

const notificationItemDelete = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member deleting one of their own in-app notifications',
  authz: 'withApi with a member role floor (auth minRole member). The delete is held to the session user id and organization id; a role title is not a kernel decision.',
  tenant: 'Real predicate: the delete ANDs the path id, the session user id and the session organization id inside a row-level-security transaction opened with that organization.',
  owner: OWN_ROWS,
  sens: OWN_SENS,
  priv: 'The notification row is removed for its owner; the response returns success true and the audit record names the id and no content.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The notification delete and persistAtomicAudit (notification.delete) commit in one RLS transaction opened with the session organization; the audit keeps no copy of the deleted text.',
  reqAudit: 'Keep the in-transaction audit record.',
  does: 'Deletes the in_app_notifications row of the session user and organization for the path id, writes the audit record in the same transaction and returns success true; no match answers 404.',
  future: 'Keep the user and organization predicates and the in-transaction audit record.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(inAppNotifications.userId, userId),'),
    a.h('tenantScope', 'eq(inAppNotifications.organizationId, organizationId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.delete(inAppNotifications)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', "return { success: true };"),
  ],
  inf: [],
  def: [],
  corr: [],
})

const notificationsCountGet = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member whose top bar asks how many notifications are unread',
  authz: 'withApi with a member role floor (auth minRole member). The count is held to the session user id and organization id; a role title is not a kernel decision.',
  tenant: 'Real predicate: the count ANDs the session user id, the session organization id, the unread flag and the expiry test, through the shared db handle with those explicit predicates.',
  owner: OWN_ROWS,
  sens: 'A count of the caller own unread notifications',
  priv: 'The member receives one integer about their own inbox; any error is returned as 0.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'A count needs no audit record; a failed count must not read as zero.',
  does: 'Counts the unexpired unread in_app_notifications rows of the session user and organization and returns { count }; an empty catch returns { count: 0 } for any failure.',
  future: 'Report a failed count as an error status instead of zero.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(inAppNotifications.userId, userId!),'),
    a.h('tenantScope', 'eq(inAppNotifications.organizationId, organizationId!),'),
    NOTIF_TABLE(a, 'tenantScope', /organizationId: uuid\('organization_id'\)/),
    a.h('mutation', '.from(inAppNotifications)'),
    a.h('behavior', 'return { count: result?.count ?? 0 };'),
    a.h('defect', '} catch {'),
    a.h('defect', 'return { count: 0 };'),
  ],
  inf: [],
  def: [NOTIFICATION_READS_SWALLOW],
  corr: [],
})

const markAllReadPost = (a) => mk({
  ...inboxBase(a),
  persona: 'Signed-in member marking every unread notification of their own inbox read',
  authz: 'withApi with a member role floor (auth minRole member). The update is held to the session user id and organization id; a role title is not a kernel decision.',
  tenant: 'Real predicate: the update ANDs the session user id, the session organization id and read false inside a row-level-security transaction opened with that organization; no id or user comes from the request.',
  owner: OWN_ROWS,
  sens: 'The read state of the caller own notifications',
  priv: 'Only the caller own unread rows change; the response returns success and the number updated, and the audit record keeps the count, not the notifications.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The bulk update and persistAtomicAudit (notification.mark_all_read, details count) commit in one RLS transaction opened with the session organization; no audit record is written when no row changed.',
  reqAudit: 'Keep the in-transaction audit record.',
  does: 'Sets read true and readAt now on every unread in_app_notifications row of the session user and organization, writes the audit record in the same transaction when at least one row changed and returns success true with the updated count.',
  future: 'Keep the user and organization predicates and the in-transaction audit record.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(inAppNotifications.userId, userId),'),
    a.h('tenantScope', 'eq(inAppNotifications.organizationId, organizationId),'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.update(inAppNotifications)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', 'return { success: true, updated: updated.length };'),
  ],
  inf: [],
  def: [],
  corr: [],
})

const notificationsTestPost = (a) => mk({
  ...inboxBase(a),
  persona: 'Steward creating a test notification for themself to see the inbox work',
  authz: 'withApi with a steward role floor (auth minRole steward). The recipient is always the session user, never a body value, so the route cannot address another member; a role floor is not a kernel decision.',
  tenant: 'Real predicate: the insert writes the session user id and organization id inside a row-level-security transaction opened with that organization; nothing comes from the body.',
  owner: OWN_ROWS,
  sens: 'A fixed test notification addressed to the caller; no protected content',
  priv: 'The steward receives the stored row, whose text is constant; no other person is addressed and nothing leaves the database.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The test notification insert and persistAtomicAudit (notification.test_create) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit record; a test row should carry an expiry so it does not accumulate.',
  does: 'Inserts one in_app_notifications row for the session user and organization with the fixed title Test Notification, the fixed message, type info and the action label Dismiss, writes the audit record in the same transaction and returns the row; no push, e-mail or SMS channel is called.',
  future: 'Either test a real delivery channel and report its result, or label the row as a test, give it an expiry and keep it out of the unread count.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', 'userId,'),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.insert(inAppNotifications)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', "title: 'Test Notification',"),
    a.h('defect', "message: 'This is a test notification to verify your notification setup is working correctly.',"),
  ],
  inf: [
    { claim: 'defect', statement: 'The route file imports only withApi, ApiError, withRLSContext, persistAtomicAudit and the inAppNotifications table; no push, e-mail, SMS or preference module is imported or called.' },
  ],
  def: [NOTIFICATION_TEST],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* mobile devices and sync                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const syncBase = (a) => ({
  service: `${SYNC_ROUTE} (${a.method} via withApi) over mobile_devices`,
  authn: `${SESSION} (withApi with an authenticated session and an organization context).`,
  gate: 11,
  deps: [13],
  status: 'PARTIAL',
  dec: SENDERS_DECISION,
})

const MOBILE_OWN = 'mobile_devices rows keyed by user_id and nullable organization_id: device token and device id (globally unique), platform, name, model, OS and app version, push flags, compliance and jailbreak flags and metadata.'
const MOBILE_SENS = 'Device push token (a delivery credential), device identifier, platform, device name and model, OS and app version, jailbreak flag, compliance issues and metadata'

const syncGet = (a) => mk({
  ...syncBase(a),
  persona: 'Signed-in member listing the mobile devices registered to their own account in the current organization',
  authz: 'withApi with a member role floor (auth minRole member). The read is held to the session user id and organization id; a role title is not a kernel decision.',
  tenant: 'Real predicate: the where clause ANDs the session user id and the session organization id; both come from the session and not from the request. The query uses the shared db handle with those explicit predicates.',
  owner: MOBILE_OWN,
  sens: MOBILE_SENS,
  priv: 'The member receives every column of their own device rows, including the push token, the jailbreak flag and the compliance issues; no other user device is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of a member own device list need no audit record; the response should not return the push token or the security flags.',
  does: 'Selects every mobile_devices row of the session user and organization and returns the array; nothing is synchronized, whatever the path name says.',
  future: 'Project only the fields a client needs, leave the push token and the security flags out, and bound the list.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.h('tenantScope', 'eq(mobileDevices.userId, userId),'),
    a.h('tenantScope', 'eq(mobileDevices.organizationId, organizationId),'),
    a.h('mutation', '.from(mobileDevices)'),
    a.h('behavior', 'return devices;'),
    a.h('defect', '.select()'),
    a.tbl('defect', 'mobileDevices', /deviceToken: varchar\('device_token'/),
    a.tbl('defect', 'mobileDevices', /isJailbroken: boolean\('is_jailbroken'\)/),
  ],
  inf: [
    { claim: 'defect', statement: 'The route file imports the mobileDevices table only; it imports neither the mobile_sync_queue table nor any queue or sync service, so no offline data is read or reconciled by a route named sync.' },
  ],
  def: [SYNC_NAME, DEVICE_TOKEN_ROWS, DEVICE_REGISTRIES],
  corr: [],
})

const syncPost = (a) => mk({
  ...syncBase(a),
  persona: 'Signed-in member registering a mobile device to their own account for push delivery',
  authz: 'withApi with a member role floor (auth minRole member) plus an ownership check: assertDeviceNotOwnedByAnotherUser refuses a device id that already belongs to another user with 409, and the upsert update carries a user predicate. A role title is not a kernel decision.',
  tenant: 'The user id and organization id come from the session and are stamped on the insert inside a row-level-security transaction opened with that organization; the ownership lookup selects by deviceId, which is globally unique; the conflict update does not set organizationId.',
  owner: MOBILE_OWN,
  sens: MOBILE_SENS,
  priv: 'The member receives the stored device row including the push token; the audit record keeps the platform and device id.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The device insert or update and persistAtomicAudit (mobile.device.register, details platform and deviceId) commit in one RLS transaction opened with the session organization.',
  reqAudit: 'Keep the in-transaction audit record and add the organization of the stored row so a re-registration is attributed correctly.',
  does: 'Requires deviceToken, deviceId and platform in the body, refuses a device id owned by another user with 409, upserts the mobile_devices row for the session user (on conflict updating the token, versions and last-active time where the row belongs to the user), writes the audit record in the same transaction and returns the row; a missing field answers 400.',
  future: 'Validate the body and the varchar bounds, update the organization on re-registration or refuse it, answer a token clash as 409, and provide a route that removes or deactivates a device.',
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'member' },"),
    a.local('authorization', 'assertDeviceNotOwnedByAnotherUser', "throw ApiError.conflict('This device is already registered to another account');"),
    a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
    a.h('tenantScope', 'setWhere: eq(mobileDevices.userId, userId),'),
    a.h('mutation', '.insert(mobileDevices)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', "throw ApiError.badRequest('deviceToken, deviceId, and platform are required');"),
    a.h('defect', 'target: mobileDevices.deviceId,'),
    a.h('defect', 'lastActiveAt: new Date(),'),
    a.tbl('defect', 'mobileDevices', /deviceToken: varchar\('device_token'/),
    a.tbl('defect', 'mobileDevices', /platform: varchar\('platform'/),
  ],
  inf: [
    { claim: 'defect', statement: 'The set object of onConflictDoUpdate lists deviceToken, appVersion, osVersion and lastActiveAt; organizationId is not among them, so an existing row keeps its first organization, while the audit record is written with the organization of the current request.' },
    { claim: 'defect', statement: 'deviceToken carries its own unique constraint in the schema and the conflict target names only deviceId, so a new device id with a token already stored raises a unique violation that no branch of the handler maps to a status.' },
    { claim: 'defect', statement: 'The only caller found, components/mobile/SyncStatus.tsx, posts deviceId and platform without deviceToken, so the required-field check answers 400 for it.' },
  ],
  def: [SYNC_NAME, SYNC_REREGISTER, DEVICE_TOKEN_ROWS, DEVICE_REGISTRIES],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* generic CRUD profiles                                                                                         */
/* ------------------------------------------------------------------------------------------------------------ */

const deviceProfile = {
  persona: 'Member reading, and steward registering, push devices of their own profile through the generic device collection',
  owner: 'push_devices rows (device token, platform, device name and model, OS and app version, enabled flag, quiet hours, timezone) keyed by profile_id (the user) and organization_id; every read is held to profile_id equal to the session user at every role.',
  sens: 'Push device token (a delivery credential for the device), platform, device name and model, OS and app version, quiet hours and timezone',
  priv: (method) => (method === 'GET'
    ? 'The caller receives only their own push_devices rows (the owner column filter applies at every role), each with the device token and quiet hours; no other member device is returned.'
    : 'The stored row, with the device token, is returned to the steward; profileId is forced to the session user by the beforeCreate hook and every other body field, including enabled and quiet hours, is stored as sent; the audit record lists field names only.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Lists the push_devices rows of the organization whose profile_id is the session user at a role floor of ${floor}, 50 per page, newest first.`
    : `Inserts a push_devices row for the session organization at a role floor of ${floor} with profileId forced to the session user and every other body field copied; a member is refused 403 before any write, and an unknown platform or a missing profile row fails at insert.`),
  future: 'Let a member register and remove their own device (write floor member with the owner forced), project the token out of responses, validate the body, and reconcile with the second device table.',
  gate: 11,
  deps: [13],
  status: () => 'PARTIAL',
  decisions: SENDERS_DECISION,
  def: (method) => (method === 'GET' ? [DEVICE_TOKEN_ROWS, DEVICE_REGISTRIES] : [DEVICE_FLOOR, DEVICE_TOKEN_ROWS, DEVICE_REGISTRIES]),
  extraEv: (a) => [
    a.tbl('privacy', 'pushDevices', /deviceToken: text\('device_token'\)\.notNull\(\)\.unique\(\),/),
    a.tbl('defect', 'pushDevices', /quietHoursStart: time\('quiet_hours_start'\)/),
    ...(a.method === 'POST'
      ? [a.h('defect', 'beforeCreate: (values, { userId }) => buildPushDeviceCreateValues(values, userId),'), a.local('behavior', 'buildPushDeviceCreateValues', 'return { ...values, profileId: userId };')]
      : []),
  ],
  reqRead: 'Reads of a member own device rows need no audit record; the token should not be returned.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file declares writeRole steward and readRole member; the retired /api/notifications/device route directs callers to /api/mobile/devices to register, so the registration path named for members is refused to them at the floor.' },
  ],
}

const pushCampaignProfile = {
  persona: 'Member whose browser posts a push subscription, or an unsubscribe request, to a path that is the push campaign collection; steward whose request would store a campaign row',
  owner: 'push_notifications rows of the organization: campaign name, title and body, targeting (target type, criteria, device id array, topics), schedule and status, delivery counters and the creating user id; no subscription endpoint or key is stored by any column.',
  sens: 'Push campaign titles and bodies, targeting criteria (roles, statuses, tags, custom fields), targeted device ids, delivery counters and the creating user id',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the push campaign rows of the organization, drafts and scheduled campaigns included, with targeting criteria, the targeted device id array, delivery counters and the creating user id; no member subscription exists in the returned data.'
    : 'A push campaign row is stored from the body and returned; the browser push subscription (endpoint and keys) the client sends is not stored by any column and an unsubscribe request removes nothing; the audit record lists field names only.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of push_notifications campaign rows of the organization at a role floor of ${floor}; it lists no subscription and no opt-out, whatever the path says.`
    : `Inserts a push_notifications campaign row from the request body at a role floor of ${floor}; the NOT NULL name, title, body and target type are not in a push subscription or unsubscribe body, so the client request fails at insert (steward) or is refused 403 (member), and no subscription is created or removed.`),
  future: 'Give subscribe and unsubscribe their own handlers over a subscription table owned by the caller (member floor, owner forced, endpoint and keys protected), move push campaigns to a route with an authorized sender, and have the client check the response.',
  gate: 11,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: SENDERS_DECISION,
  def: (method) => (method === 'GET' ? [PUSH_FACADE, PUSH_READ] : [PUSH_FACADE, PUSH_FORGED]),
  extraEv: (a) => [
    a.tbl('privacy', 'pushNotifications', /targetCriteria: jsonb\('target_criteria'\)/),
    a.tbl('privacy', 'pushNotifications', /deviceIds: uuid\('device_ids'\)\.array\(\)/),
    a.tbl('defect', 'pushNotifications', /totalDelivered: integer\('total_delivered'\)/),
    a.tbl('defect', 'pushNotifications', /status: pushNotificationStatusEnum\('status'\)/),
  ],
  reqRead: 'Audit reads of campaign drafts once the offices that may read them are named.',
  inferences: () => [
    { claim: 'defect', statement: 'lib/mobile/push-notifications.ts posts JSON.stringify(subscription) to subscribe and { endpoint } to unsubscribe, awaits the fetch without reading response.ok and then sets isSubscribed in state; the route file imports crudRoutes and the pushNotifications table only.' },
    { claim: 'defect', statement: 'services/fcm-service.ts is the only module that sends over push_devices and push_deliveries, and no route, worker, script or page imports it; only its test files and the storage-authority notes name it.' },
  ],
}

const scheduledQueueProfile = {
  persona: 'Member reading their own, and steward reading and writing every user, scheduled notification row through a path named mobile notifications',
  owner: 'notifications rows (scheduled deadline-reminder queue) keyed by user_id (text) and organization_id: type, title, message, priority, related entity type and id, scheduled time, send status and sent time; this is not the in_app_notifications inbox.',
  sens: 'Scheduled notification titles and messages with the related grievance, claim or deadline type and id, addressed to a named user',
  priv: (method) => (method === 'GET'
    ? 'A member receives only their own scheduled notification rows (the low-role guard holds callers below steward to their own user id); a steward or above receives every user scheduled notification row of the organization with message text and the related entity reference.'
    : 'The stored scheduled notification row is returned to the steward and then read by the addressed user; the audit record lists field names only.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of notifications rows (the scheduled queue) of the organization at a role floor of ${floor}, held to the caller own user id below steward; it reads no in_app_notifications row and has no read flag.`
    : `Inserts a notifications row from the request body at a role floor of ${floor}, for any userId string, with the status, sent time, priority and related entity the caller types; no member check is made and nothing is sent.`),
  future: 'Retire the path or serve the member inbox from in_app_notifications; take scheduled rows to the deadline system that owns them, check the addressed user belongs to the organization and keep status and sent time server-owned.',
  gate: 11,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: SENDERS_DECISION,
  def: (method) => (method === 'GET' ? [MOBILE_QUEUE_PATH] : [MOBILE_QUEUE_PATH, MOBILE_QUEUE_CREATE]),
  extraEv: (a) => [
    a.tbl('privacy', 'notifications', /relatedEntityId: text\('related_entity_id'\)/),
    a.tbl('defect', 'notifications', /status: notificationScheduleStatusEnum\('status'\)/),
    a.tbl('defect', 'notifications', /sentAt: timestamp\('sent_at'\)/),
  ],
  reqRead: 'Audit steward reads of other users scheduled notifications once the offices that may read them are named.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file imports the notifications table, not inAppNotifications; the member inbox routes under /api/notifications import inAppNotifications, so the two paths read different tables.' },
    { claim: 'defect', statement: 'app/api/cron/process-notifications/route.ts throws ApiError.notImplemented and the capability registry records UE-CRON-PROCESS-NOTIFICATIONS as NOT_IMPLEMENTED pending a real notification dispatcher, so no code sends a scheduled row.' },
  ],
}

const negotiationProfile = {
  persona: 'Member reading, and steward creating, collective-bargaining negotiation records through a top-level negotiations path',
  owner: 'negotiations rows of the organization: parties, key dates, issues with notes, strike vote result, mandate expiry, estimated and maximum cost, progress summary, confidentiality level and status.',
  sens: 'Bargaining positions, key issues with notes, strike-vote result and percentage, mandate expiry, cost estimate and ceiling, and progress summary',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the negotiation rows of the organization including the strike-vote result, the mandate expiry, the estimated and maximum cost and the key issues with notes; the confidentiality level column is returned and never applied.'
    : 'The stored negotiation row is returned; strike-vote, mandate and cost fields are stored as typed; the audit record lists field names only.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of negotiations rows of the organization at a role floor of ${floor}; confidentialityLevel does not filter any row.`
    : `Inserts a negotiations row for the session organization from the request body at a role floor of ${floor}; no office that holds bargaining authority is checked and no vote or costing record is consulted.`),
  future: 'Retire the duplicate path, hold negotiation reads and writes to the offices that hold bargaining authority for the organization, apply confidentialityLevel on read, and take strike-vote and mandate fields from their source records.',
  gate: 14,
  deps: [10, 13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: (method) => (method === 'GET' ? ['DEF-0B3-BARGAINING-NEGOTIATION-RECORDS-MEMBER-READ', NEGOTIATION_ALIAS] : [NEGOTIATION_ALIAS, NEGOTIATION_STRIKE]),
  extraEv: (a) => [
    a.tbl('privacy', 'negotiations', /strikeVoteYesPercent: decimal\("strike_vote_yes_percent"/),
    a.tbl('privacy', 'negotiations', /maximumCost: decimal\("maximum_cost"/),
    a.tbl('defect', 'negotiations', /confidentialityLevel: varchar\("confidentiality_level"/),
    a.tbl('defect', 'negotiations', /strikeVotePassed: boolean\("strike_vote_passed"\)/),
  ],
  reqRead: 'Audit reads of negotiation rows once the offices that hold bargaining authority are named.',
  inferences: () => [
    { claim: 'defect', statement: 'app/api/negotiations/route.ts and app/api/bargaining/negotiations/route.ts configure crudRoutes with the same table, tags, orgScoped, readRole and writeRole and neither lists blockedPatchFields; the storage-authority notes list both paths as reaching the negotiations table.' },
  ],
}

const meetingRoomProfile = {
  persona: 'Member reading, and steward creating or changing, meeting rooms of the organization with their booking rules',
  owner: 'meeting_rooms rows of the organization: name, building, floor, address, capacity, equipment, status, approval requirement, allowed roles, blocked dates, operating hours, booking duration rules and room contact person, e-mail and phone; bookings are room_bookings rows that no route reads or writes.',
  sens: 'Meeting room name, building address, capacity, equipment, booking rules and the contact person identifier, e-mail and phone',
  priv: (method) => (method === 'GET'
    ? 'Any member receives the meeting room rows of the organization, including the room address, booking rules and the contact person identifier, e-mail and phone; no booking is returned.'
    : method === 'PATCH'
      ? 'The updated meeting room row is returned; the body can change any column other than the primary key and organization; the audit record lists field names only; no booking is read or changed.'
      : 'The stored meeting room row is returned; booking rules are stored as typed; the audit record lists field names only.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns a page of meeting_rooms rows of the organization at a role floor of ${floor}.`
    : method === 'PATCH'
      ? `Updates the meeting_rooms row of the organization whose id is the path value at a role floor of ${floor}, copying every body field except the primary key and organization; room_bookings is not read, so a booking id addresses nothing.`
      : `Inserts a meeting_rooms row for the session organization from the request body at a role floor of ${floor}, including approval, role and date rules that no booking code enforces.`),
  future: method => (method === 'PATCH'
    ? 'Give the bookings path its own handlers over room_bookings with a booker or approver condition, or retire the path, and block room status and booking-rule columns from a generic patch.'
    : 'Build the booking route over room_bookings and have it enforce the approval, role, date and duration rules before a room is shown as bookable; decide with the institution who may configure rooms.'),
  gate: 14,
  deps: [13],
  status: () => 'PARTIAL',
  def: (method) => (method === 'PATCH' ? [ROOM_PATCH, ROOM_RULES] : [ROOM_RULES]),
  extraEv: (a) => [
    a.tbl('defect', 'meetingRooms', /requiresApproval: boolean\('requires_approval'\)/),
    a.tbl('defect', 'meetingRooms', /allowedUserRoles: jsonb\('allowed_user_roles'\)/),
    a.tbl('privacy', 'meetingRooms', /contactEmail: text\('contact_email'\)/),
  ],
  reqRead: 'Reads of room rows need no audit record; changes to booking rules should be audited with the rooms they affect.',
  inferences: () => [
    { claim: 'defect', statement: 'No route file under app/api imports the roomBookings table; the only module that names room_bookings in code is lib/services/calendar-service.ts, whose booking functions return an in-memory object or true without a query.' },
  ],
}

const meetingRoomRecord = (a, readText) => {
  const profile = { ...meetingRoomProfile, future: meetingRoomProfile.future(a.method) }
  return crudRecord(a, readText, profile)
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

export function facts(a, readText) {
  const { route, method } = a
  switch (route) {
    case 'notifications/route.ts':
      return method === 'GET' ? notificationsListGet(a) : notificationsCreatePost(a)
    case 'notifications/[id]/route.ts':
      return method === 'GET' ? notificationItemGet(a) : method === 'PATCH' ? notificationItemPatch(a) : notificationItemDelete(a)
    case 'notifications/count/route.ts':
      return notificationsCountGet(a)
    case 'notifications/mark-all-read/route.ts':
      return markAllReadPost(a)
    case 'notifications/test/route.ts':
      return notificationsTestPost(a)
    case 'mobile/sync/route.ts':
      return method === 'GET' ? syncGet(a) : syncPost(a)
    case 'mobile/devices/route.ts':
      return crudRecord(a, readText, deviceProfile)
    case 'mobile/push/subscribe/route.ts':
    case 'mobile/push/unsubscribe/route.ts':
      return crudRecord(a, readText, pushCampaignProfile)
    case 'mobile/notifications/route.ts':
      return crudRecord(a, readText, scheduledQueueProfile)
    case 'negotiations/route.ts':
      return crudRecord(a, readText, negotiationProfile)
    case 'meeting-rooms/route.ts':
    case 'meeting-rooms/[id]/bookings/route.ts':
      return meetingRoomRecord(a, readText)
    default:
      throw new Error(`no mobile-notifications facts for ${route}`)
  }
}
