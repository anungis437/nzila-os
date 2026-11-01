/**
 * Gate 0B.4 facts: calendars, calendar events and external calendar provider connections. Every evidence item is
 * produced by `opAuthoring` from the exact handler or the resolved schema, and is proved again by the validator.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b4-crud.mjs'
import { APP, GET_WRITES, LOW_ROLE, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const DEPS = [1, 13]
const CRYPTO = `${APP}lib/external-calendar-sync/token-crypto.ts`
const GOOGLE = `${APP}lib/external-calendar-sync/google-calendar-service.ts`
const MICROSOFT = `${APP}lib/external-calendar-sync/microsoft-calendar-service.ts`
const GUARD = `${APP}lib/api-auth-guard.ts`
const CONNECTION_TABLE = 'externalCalendarConnections'

export const CALENDAR_ROUTES = new Set([
  'calendar-sync/connections/[id]/route.ts', 'calendar-sync/connections/[id]/sync/route.ts', 'calendar-sync/connections/route.ts',
  'calendar-sync/google/auth/route.ts', 'calendar-sync/google/callback/route.ts', 'calendar-sync/microsoft/auth/route.ts', 'calendar-sync/microsoft/callback/route.ts',
  'calendar/events/[id]/route.ts', 'calendar/events/route.ts', 'calendars/[id]/events/route.ts', 'calendars/[id]/route.ts', 'calendars/route.ts',
])

const D = (id, gate, severity, title) => ({ id, gate, severity, title })
export const CALENDAR_DEFECTS = [
  D('DEF-0B4-CALENDAR-OAUTH-STATE-IS-USER-ID', 14, 'HIGH', 'The Google and Microsoft authorization routes pass the session user id as the OAuth state and the callbacks compare the returned state with that same id, and accept a callback with no state at all, so the state is neither unguessable nor single-use and gives no protection against a forged callback.'),
  D('DEF-0B4-CALENDAR-CALLBACK-GET-WRITES-TOKENS-NO-AUDIT', 14, 'HIGH', 'The provider callbacks are GET handlers that exchange a code and insert or update the connection row holding the provider tokens, and neither the callback nor the member-floor wrapper writes an audit record for the connection, so a state-changing GET leaves no audit evidence.'),
  D('DEF-0B4-CALENDAR-TOKEN-PLAINTEXT-FALLBACK', 14, 'MEDIUM', 'encryptCalendarToken returns the token unencrypted when no encryption key is configured outside production, and decryptCalendarToken returns any value without the encryption prefix as it is, so a database written without the key holds provider tokens in clear text and never fails.'),
  D('DEF-0B4-CALENDAR-CONNECTION-ROW-RETURNS-TOKENS', 14, 'HIGH', 'The connection collection and item reads select the whole external_calendar_connections row, so the stored accessToken and refreshToken values are returned to the browser of the connection owner.'),
  D('DEF-0B4-CALENDAR-CONNECTION-CRUD-WRITES-AROUND-OAUTH', 14, 'HIGH', 'A steward can create or update a connection through the generic factory with any provider, providerAccountId, accessToken and refreshToken, stored as supplied and unencrypted, and an update can reassign userId, so the OAuth flow and the token encryption can be bypassed and a connection can be handed to another user.'),
  D('DEF-0B4-CALENDAR-SYNC-ANY-MEMBER-CONNECTION', 14, 'HIGH', 'The connection sync route selects the connection by id and organization only, with no userId predicate and no role above organization membership, so any member can run an import or export through another member provider account.'),
  D('DEF-0B4-CALENDAR-SYNC-NO-PERSONAL-CALENDAR-CHECK', 14, 'HIGH', 'The sync route proves that the local calendar and event are in the organization but not that the caller owns a personal calendar or may read a personal event, so a member can import into or export from another member personal calendar.'),
  D('DEF-0B4-CALENDAR-SYNC-AUDIT-NOT-ATOMIC', 14, 'MEDIUM', 'The sync records intent and outcome through performAuditedOperation around an external provider call, and the connection update runs inside that operation without the audit record; the record is not committed with the state change.'),
  D('DEF-0B4-CALENDAR-ITEM-LOCKED-CHECK-INERT', 14, 'HIGH', 'The calendar item route supplies lockedAuthCheck to reject another member personal calendar, but the factory invokes it only when beforeUpdate or mergeJsonColumns is configured and never on delete, and the route configures neither, so a steward can still update or delete another member personal calendar.'),
  D('DEF-0B4-CALENDAR-EVENTS-PERSONAL-CALENDAR-LEAK', 14, 'HIGH', 'The calendar events routes filter events by calendar id and organization or by organization alone and never consult calendars.isPersonal or ownerId, which calendar_events does not carry, so a member reads events of another member personal calendar through calendars/[id]/events and staff read every personal event through calendar/events.'),
  D('DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED', 14, 'MEDIUM', 'Event create and update store a caller-supplied calendarId without verifying that the calendar belongs to the organization or is visible to the caller; the foreign key checks only that a calendar row exists.'),
]

const connectionProfile = {
  owner: 'external_calendar_connections rows owned by one user within one organization; they hold provider access and refresh tokens.',
  sens: 'Calendar provider connection with access token, refresh token, provider account and provider e-mail',
  priv: (method) => (method === 'GET'
    ? 'The whole row, including the accessToken and refreshToken columns, is returned in the response to the connection owner.'
    : 'Any body field is stored, including provider, providerAccountId, accessToken, refreshToken and, on update, userId, bypassing the OAuth flow and the token encryption.'),
  does: (method, _model, floor) => ({
    GET: `Returns the caller own external_calendar_connections rows (ownerColumn userId), complete with token columns, at a role floor of ${floor}.`,
    POST: `Inserts an external_calendar_connections row with the body fields and userId forced to the session user at a role floor of ${floor}.`,
    PATCH: `Updates the caller own connection row with any body field except the primary key and organization at a role floor of ${floor}.`,
  })[method],
  future: 'Create and change connections only through the audited OAuth flow, never return token columns, encrypt tokens under a required key, and let a member at the member floor manage only their own connection.',
  gate: GATE,
  deps: DEPS,
  extraEv: (a, model) => [
    a.tbl('privacy', CONNECTION_TABLE, /accessToken: text\('access_token'\)/),
    ...(a.method === 'GET' ? [a.imp('privacy', 'crudRoutes', /db\.select\(\)\.from\(table\)/)] : []),
    ...(a.method === 'POST' ? [a.h('authorization', 'beforeCreate: (values, { userId }) => ({ ...values, userId }),')] : []),
    a.imp('defect', 'crudRoutes', 'conditions.push(eq(ownerCol, userId));'),
  ],
  def: (method) => [
    ...(method === 'GET' ? ['DEF-0B4-CALENDAR-CONNECTION-ROW-RETURNS-TOKENS'] : ['DEF-0B4-CALENDAR-CONNECTION-CRUD-WRITES-AROUND-OAUTH']),
  ],
}

const eventProfile = {
  owner: 'calendar_events rows of the organization, linked to a calendar by calendarId and optionally to a claim, case number or member.',
  sens: 'Event titles, locations, attendees, case numbers and member identifiers; events of a personal calendar are private to its owner',
  priv: (method) => (method === 'GET'
    ? 'Callers below steward are held to rows whose memberId equals the session user id; staff read every event in the organization, including events on another member personal calendar, because the event row carries no personal-calendar attribute.'
    : 'Any body field is stored, including calendarId, memberId, claimId and caseNumber, with no check that the calendar is the caller own or shared.'),
  does: (method, _model, floor) => ({
    GET: `Returns calendar_events rows for the organization at a role floor of ${floor}; callers below steward see only rows whose memberId equals the session user id.`,
    POST: `Inserts a caller-supplied calendar_events row, including calendarId, at a role floor of ${floor}.`,
    PATCH: `Updates a calendar_events row with any body field, including calendarId, at a role floor of ${floor}.`,
    DELETE: `Sets status archived on a calendar_events row at the fixed administrator floor of the generic delete; the status enum defines no archived value (${floor}).`,
  })[method],
  future: 'Resolve event visibility through the calendar the event belongs to, verify calendarId against the organization and the caller, and return personal-calendar events only to their owner.',
  gate: GATE,
  deps: DEPS,
  extraEv: (a) => [
    a.tbl('privacy', 'calendarEvents', /memberId: text\('member_id'\)/),
    a.tbl('privacy', 'calendarEvents', /calendarId: uuid\('calendar_id'\)\.notNull\(\)\.references\(\(\) => calendars\.id/),
    a.tbl('privacy', 'calendarEvents', /organizationId:/, { absentColumns: ['isPersonal', 'ownerId'] }),
    a.sch('privacy', LOW_ROLE, "const OWNER_COLUMNS = ['userId', 'memberId'] as const"),
  ],
  def: () => ['DEF-0B4-CALENDAR-EVENTS-PERSONAL-CALENDAR-LEAK', 'DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED'],
}

const calendarProfile = {
  owner: 'calendars rows of the organization; a personal calendar belongs to the member in ownerId and a shared calendar to the organization.',
  sens: 'Calendar names and descriptions; a personal calendar is private to its owner',
  priv: (method) => ({
    POST: 'ownerId is forced to the session user, but every other body field is stored, including isPersonal.',
    PATCH: 'Any body field is stored, including ownerId and isPersonal, so a steward can hand a calendar to another member or turn a personal calendar into a shared one; the personal-calendar check the route supplies is never run.',
    DELETE: 'The personal-calendar check the route supplies is never run on delete, so a steward can remove another member personal calendar.',
  })[method],
  does: (method, _model, floor) => ({
    POST: `Inserts a calendars row with ownerId set to the session user at a role floor of ${floor}.`,
    PATCH: `Updates a calendars row with any body field except the primary key and organization at a role floor of ${floor}.`,
    DELETE: `Removes a calendars row at the fixed administrator floor of the generic delete (${floor}).`,
  })[method],
  future: 'Decide calendar visibility and change authority from the owner and the sharing state, run the personal-calendar check on every write path, and keep ownerId and isPersonal out of the writable body.',
  gate: GATE,
  deps: DEPS,
  extraEv: (a) => [
    a.tbl('privacy', 'calendars', /isPersonal: boolean\('is_personal'\)/),
    ...(a.method === 'POST' ? [a.h('authorization', 'beforeCreate: (values, ctx) => ({ ...values, ownerId: ctx.userId }),')] : []),
    ...(a.method === 'PATCH'
      ? [
          a.h('defect', 'lockedAuthCheck: async (existing, ctx) => {'),
          a.imp('defect', 'crudRoutes', 'if (opts.beforeUpdate || mergeJsonColumns.length > 0) {'),
          a.imp('defect', 'crudRoutes', 'if (opts.lockedAuthCheck) {'),
        ]
      : []),
    ...(a.method === 'DELETE' ? [a.h('defect', 'lockedAuthCheck: async (existing, ctx) => {')] : []),
  ],
  def: (method) => (method === 'POST' ? [] : ['DEF-0B4-CALENDAR-ITEM-LOCKED-CHECK-INERT']),
}

const CALENDAR_INFERENCE_DELETE = {
  claim: 'defect',
  statement: 'The generic delete handler of the factory contains no call to lockedAuthCheck; the factory text shows the hook is invoked only inside the PATCH transaction that runs for beforeUpdate or mergeJsonColumns, so no delete path reads it.',
}

const CONTROL_CORRECTION = (actual) => ({ field: 'control', manifest: 'GENERIC_CRUD_ROLE_FLOOR', actual })

const roleAuthEv = (a, role) => [
  ...guardEv(a, 'withRoleAuth'),
  a.h('authorization', `withRoleAuth('${role}'`),
  a.imp('audit', 'withRoleAuth', 'const _deprecatedAutoAudit = _isAdminRole || _isOfficerRole;'),
]

const withApiEv = (a, role) => [...guardEv(a, 'withApi'), a.h('authorization', `minRole: '${role}'`)]

const oauthAuth = (provider, a) => ({
  persona: 'Organization member connecting their own calendar account',
  service: `${APP}lib/external-calendar-sync/${provider}-calendar-service.ts`,
  authn: 'Authenticated session resolved by withRoleAuth.',
  authz: "withRoleAuth('member'): any authenticated organization member. A role title is not a kernel decision, and there is no check that the user may connect an external account.",
  tenant: 'The authorization URL carries no organization; the callback binds the connection to the session organization.',
  owner: 'The member own provider authorization; nothing is stored by this request.',
  sens: 'OAuth authorization redirect carrying the session user id as the state value',
  priv: 'The session user id is placed in the provider authorization URL as the OAuth state, so it is visible to the provider and in browser history.',
  mut: 'NOT_MUTATING',
  auditDetail: 'The route writes no row and no audit record; withRoleAuth audits only admin and officer tiers.',
  reqAudit: 'Record the connection attempt with the user and provider when the flow starts, and bind the state to the session with a single-use value.',
})

const CALENDAR_FACTS = {
  'calendar-sync/connections/[id]/sync/route.ts|POST': (a) => mk({
    persona: 'Organization member running a provider sync for a calendar connection',
    service: `${APP}app/api/calendar-sync/connections/[id]/sync/route.ts`,
    authn: 'Authenticated session resolved by withOrganizationAuth (requireUser).',
    authz: 'withOrganizationAuth: any authenticated member of the canonical organization. No role floor, no ownership of the connection and no ownership of the local calendar is checked. A role title is not a kernel decision.',
    tenant: 'The connection, local calendar and event are selected with the session organizationId; the connection is not held to the session userId.',
    owner: 'external_calendar_connections rows owned by the connecting user; the local calendar and events belong to the organization or, for a personal calendar, to its owner.',
    sens: 'Provider access to a member calendar, imported and exported event titles, attendees and times',
    priv: 'Any member can import events from, or export an event to, a provider account connected by another member of the organization, and into or out of another member personal calendar.',
    mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'performAuditedOperation records the intent before the provider call and the outcome afterwards; it is separate from the connection update and the imported rows.',
    reqAudit: 'Commit the sync outcome and the connection update with their audit record, and record which member acted for which connection owner.',
    does: 'Selects an active connection by id and organization, checks the local calendar and event are in the organization, then imports events from or exports an event to the provider and stamps the connection as synced.',
    status: 'PARTIAL',
    gate: GATE,
    deps: DEPS,
    future: 'Allow a sync only by the connection owner, prove the local calendar is visible to that owner, and commit the outcome atomically with its audit record.',
    ev: [
      ...guardEv(a, 'withOrganizationAuth'),
      a.h('tenantScope', 'eq(externalCalendarConnections.organizationId, organizationId),'),
      a.h('defect', 'eq(externalCalendarConnections.isActive, true),'),
      a.h('tenantScope', 'eq(calendars.organizationId, organizationId),'),
      a.h('mutation', '.update(externalCalendarConnections)'),
      a.h('audit', 'results = await performAuditedOperation('),
      a.h('audit', "action: 'calendar_sync.connection.sync',"),
      a.imp('audit', 'performAuditedOperation', 'export async function performAuditedOperation'),
      a.tbl('privacy', 'calendars', /isPersonal: boolean\('is_personal'\)/),
    ],
    def: ['DEF-0B4-CALENDAR-SYNC-ANY-MEMBER-CONNECTION', 'DEF-0B4-CALENDAR-SYNC-NO-PERSONAL-CALENDAR-CHECK', 'DEF-0B4-CALENDAR-SYNC-AUDIT-NOT-ATOMIC'],
    corr: [{ field: 'audit', manifest: 'AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the provider call; it is not committed with the state change.' }],
  }),

  'calendar-sync/google/auth/route.ts|GET': (a) => mk({
    ...oauthAuth('google', a),
    does: 'Builds the Google authorization URL with the session user id as the OAuth state and redirects the browser to it.',
    gate: GATE,
    deps: DEPS,
    future: 'Mint an unguessable single-use state bound to the session, restrict who may connect an account, and audit the start of the flow.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('behavior', 'const authUrl = getAuthorizationUrl(userId)'),
      a.svc('defect', GOOGLE, 'state: userId,', 'getAuthorizationUrl'),
      a.h('mutation', 'return NextResponse.redirect(authUrl)'),
    ],
    def: ['DEF-0B4-CALENDAR-OAUTH-STATE-IS-USER-ID'],
  }),

  'calendar-sync/microsoft/auth/route.ts|GET': (a) => mk({
    ...oauthAuth('microsoft', a),
    does: 'Builds the Microsoft authorization URL with the session user id as the OAuth state and redirects the browser to it; a missing client configuration answers 503.',
    gate: GATE,
    deps: DEPS,
    future: 'Mint an unguessable single-use state bound to the session, restrict who may connect an account, and audit the start of the flow.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('behavior', 'const authUrl = await getAuthorizationUrl(userId);'),
      a.svc('defect', MICROSOFT, 'state: userId,', 'getAuthorizationUrl'),
      a.h('mutation', 'return NextResponse.redirect(authUrl);'),
    ],
    def: ['DEF-0B4-CALENDAR-OAUTH-STATE-IS-USER-ID'],
  }),
}

const callbackFacts = (provider) => (a) => mk({
  persona: 'Organization member completing the provider authorization of their own calendar account',
  service: `${APP}app/api/calendar-sync/${provider}/callback/route.ts`,
  authn: 'Authenticated session resolved by withRoleAuth.',
  authz: "withRoleAuth('member'): any authenticated organization member. The OAuth state is compared with the session user id only when a state is supplied, so it does not authenticate the callback. A role title is not a kernel decision.",
  tenant: 'The connection is looked up and written with the session userId and organizationId.',
  owner: 'external_calendar_connections rows owned by the connecting user; they hold encrypted provider access and refresh tokens.',
  sens: 'Provider access token, refresh token, provider account and e-mail',
  priv: 'The provider access and refresh tokens are exchanged for the authorization code and stored; the tokens are stored in clear text when no encryption key is configured outside production.',
  mut: 'NONE',
  auditDetail: 'The GET inserts or updates the connection row holding the provider tokens and writes no audit record; withRoleAuth audits only admin and officer tiers.',
  reqAudit: 'Make the callback a state-changing request with an atomic audit record of the connection, bound to a single-use state.',
  does: `Exchanges the ${provider} authorization code for tokens and inserts or updates the caller own connection row, then redirects to the calendar page.`,
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: DEPS,
  future: 'Complete the connection through an audited state-changing request bound to a single-use state, encrypt tokens under a required key, and do not accept a callback without state.',
  ev: [
    ...roleAuthEv(a, 'member'),
    a.h('tenantScope', 'eq(externalCalendarConnections.organizationId, organizationId),'),
    a.h('authorization', 'if (state && state !== userId) {'),
    a.h('mutation', 'await db.insert(externalCalendarConnections).values({'),
    a.h('mutation', '.update(externalCalendarConnections)'),
    a.h('privacy', 'accessToken: encryptCalendarToken(tokens.accessToken),'),
    a.svc('defect', CRYPTO, 'return token', 'encryptCalendarToken'),
    a.svc('defect', CRYPTO, 'return token', 'decryptCalendarToken'),
  ],
  def: ['DEF-0B4-CALENDAR-CALLBACK-GET-WRITES-TOKENS-NO-AUDIT', 'DEF-0B4-CALENDAR-OAUTH-STATE-IS-USER-ID', 'DEF-0B4-CALENDAR-TOKEN-PLAINTEXT-FALLBACK'],
  corr: [GET_WRITES('NOT_APPLICABLE:READ')],
})

CALENDAR_FACTS['calendar-sync/google/callback/route.ts|GET'] = callbackFacts('google')
CALENDAR_FACTS['calendar-sync/microsoft/callback/route.ts|GET'] = callbackFacts('microsoft')

const personalCalendarRead = (a, extra) => mk({
  persona: 'Organization member reading calendars',
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  authz: "withApi auth.minRole 'member'. The handler itself, not a kernel decision, decides which personal calendars the member sees.",
  ...extra,
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: DEPS,
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of calendar records need no audit record unless a calendar is shared outside its owner.',
})

CALENDAR_FACTS['calendars/route.ts|GET'] = (a) => personalCalendarRead(a, {
  tenant: 'The query is scoped to the session organization and, for personal calendars, to the session user.',
  owner: 'calendars rows of the organization; a personal calendar belongs to ownerId.',
  sens: 'Calendar names and descriptions; a personal calendar is private to its owner',
  priv: 'Shared calendars and the session user own personal calendars are returned; another member personal calendar is filtered out.',
  does: 'Lists calendars of the organization that are shared or personal to the session user, ordered by name.',
  future: 'Keep the personal-calendar filter and move visibility into the kernel decision once calendar sharing authority is named.',
  ev: [
    ...withApiEv(a, 'member'),
    a.h('tenantScope', 'eq(calendars.organizationId, organizationId!)'),
    a.h('privacy', 'or(eq(calendars.isPersonal, false), eq(calendars.ownerId, userId))!'),
    a.h('mutation', 'db.select().from(calendars)'),
    a.tbl('privacy', 'calendars', /isPersonal: boolean\('is_personal'\)/),
  ],
  corr: [CONTROL_CORRECTION('A hand-written withApi handler, not the generic CRUD factory; the factory is used only for POST on this file.')],
})

CALENDAR_FACTS['calendars/[id]/route.ts|GET'] = (a) => personalCalendarRead(a, {
  tenant: 'The calendar is selected by id and the session organizationId.',
  owner: 'calendars rows of the organization; a personal calendar belongs to ownerId.',
  sens: 'Calendar names and descriptions; a personal calendar is private to its owner',
  priv: 'A personal calendar of another member answers not found; a shared calendar of the organization is returned in full.',
  does: 'Returns one calendar of the organization by id, answering not found for another member personal calendar.',
  future: 'Keep the personal-calendar denial and move visibility into the kernel decision once calendar sharing authority is named.',
  ev: [
    ...withApiEv(a, 'member'),
    a.h('tenantScope', 'eq(calendars.organizationId, organizationId!)'),
    a.h('privacy', 'if (row.isPersonal && row.ownerId !== userId) throw ApiError.notFound'),
    a.h('mutation', 'db.select().from(calendars)'),
    a.tbl('privacy', 'calendars', /isPersonal: boolean\('is_personal'\)/),
  ],
  corr: [CONTROL_CORRECTION('A hand-written withApi handler, not the generic CRUD factory; the factory is used only for PATCH and DELETE on this file.')],
})

CALENDAR_FACTS['calendars/[id]/events/route.ts|GET'] = (a) => personalCalendarRead(a, {
  tenant: 'Events are filtered by the calendar id and, when an organization is present, by the session organizationId; the calendar itself is never read.',
  owner: 'calendar_events rows of the organization, linked to a calendar by calendarId.',
  sens: 'Event titles, locations, attendees, case numbers and member identifiers; events of a personal calendar are private to its owner',
  priv: 'Every event of the named calendar in the organization is returned to any member, including events on another member personal calendar, because the handler never reads calendars.isPersonal or ownerId.',
  does: 'Lists a page of calendar_events rows for the calendar id in the path, newest first, with a total count.',
  future: 'Resolve the calendar and its visibility to the caller before listing its events.',
  ev: [
    ...withApiEv(a, 'member'),
    a.h('tenantScope', 'conditions.push(eq(calendarEvents.organizationId, organizationId));'),
    a.h('mutation', 'db.select().from(calendarEvents)'),
    a.tbl('privacy', 'calendarEvents', /organizationId:/, { absentColumns: ['isPersonal', 'ownerId'] }),
  ],
  def: ['DEF-0B4-CALENDAR-EVENTS-PERSONAL-CALENDAR-LEAK'],
  corr: [],
})

const CRUD_PROFILES = new Map([
  ['calendar-sync/connections/route.ts', connectionProfile],
  ['calendar-sync/connections/[id]/route.ts', connectionProfile],
  ['calendar/events/route.ts', eventProfile],
  ['calendar/events/[id]/route.ts', eventProfile],
  ['calendars/route.ts', calendarProfile],
  ['calendars/[id]/route.ts', calendarProfile],
])

export function calendarFacts(a, readText) {
  const direct = CALENDAR_FACTS[`${a.route}|${a.method}`]
  if (direct) return direct(a)
  const profile = CRUD_PROFILES.get(a.route)
  if (!profile) throw new Error(`no calendar facts for ${a.route}|${a.method}`)
  const record = crudRecord(a, readText, profile)
  if (a.route === 'calendars/[id]/route.ts' && a.method === 'DELETE') record.inferences = [...record.inferences, CALENDAR_INFERENCE_DELETE]
  return record
}
