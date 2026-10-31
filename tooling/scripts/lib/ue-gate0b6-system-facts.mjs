/**
 * Gate 0B.6 facts for the system routes: the Resend delivery webhook, the public contact form, the continuity aliases,
 * the deprecation registry, the retired emergency dashboard and seven scheduler-invoked cron handlers.
 *
 * None of the 21 operations was previously owned. The cron handlers are real handlers, not the registered stubs, so
 * the STUB_501 rule never covered them. Each is owned by the capability whose obligation its writes fulfil (documents,
 * privacy retention, calendar connections, finance, alerts, deadlines, the shared wage dataset); the cross-cutting cron
 * defects (a GET that runs the job, no scheduler in the repository, an edge check that differs from the route check)
 * belong to UE-OMIT-MAIN-APP-CRONS. No business-continuity feature exists in the source, and no capability is created
 * for one: the continuity paths are aliases of other routes and an outstanding decision records the missing owner.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, GET_WRITES, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const SECRET = `${APP}lib/api/secret-compare.ts`
const WITH_RLS = `${APP}lib/db/with-rls-context.ts`
const INTAKE = `${APP}lib/documents/intake-lifecycle.ts`
const GEO = `${APP}services/geofence-privacy-service.ts`
const GEO_SCHEMA = `${APP}db/schema/geofence-privacy-schema.ts`
const PERCAP = `${APP}services/clc/per-capita-calculator.ts`
const WAGE = `${APP}lib/services/external-data/wage-enrichment-service.ts`
const WAGE_SCHEMA = `${APP}db/schema/wage-benchmarks-schema.ts`
const OBS = `${APP}services/observability/realtime-alerting-service.ts`
const GOOGLE = `${APP}lib/external-calendar-sync/google-calendar-service.ts`
const API_GUARD = `${APP}lib/api-auth-guard.ts`
const EVENT_BUS = `${APP}lib/events/event-bus.ts`
const PILOT = `${APP}lib/pilot-metrics.ts`
const GUARD = `${APP}lib/public-intake/guard.ts`
const CRM = `${APP}lib/services/crm-service.ts`
const CAMPAIGNS = `${APP}db/schema/domains/communications/campaigns.ts`
const RECONCILIATION = `${APP}lib/services/delivery-reconciliation.ts`
const DOCUMENTS_SCHEMA = `${APP}db/schema/documents-schema.ts`
const PENDING_PROFILES = `${APP}db/schema/pending-profiles-schema.ts`
const CALENDAR_SCHEMA = `${APP}db/schema/calendar-schema.ts`
const CLAIMS_SCHEMA = `${APP}db/schema/claims-schema.ts`
const ALERTING_SCHEMA = `${APP}db/schema/domains/infrastructure/alerting.ts`
const PER_CAPITA_SCHEMA = `${APP}db/schema/domains/infrastructure/clc-per-capita.ts`
const DEPRECATION = `${APP}lib/api/deprecation.ts`
const EMERGENCY = `${APP}lib/emergency/not-implemented.ts`
const REGISTRY = `${APP}lib/reality/capability-registry.ts`
const CASE_LIFECYCLE = `${APP}lib/workflow/case-lifecycle.ts`
const CONTACT_FORM = `${APP}app/(marketing)/contact/contact-form.tsx`

const DELIVERY = 'UE-OMIT-DELIVERY-EVIDENCE'
const EXPOSURE = 'UE-OMIT-ROUTE-EXPOSURE-HARDENING'
const DOCS = 'UE-CAP-F-002'
const BILLING = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
const SCAFFOLD = 'UE-CAP-H-001'
const CALENDAR = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const DATASET = 'UE-OMIT-CBA-INTELLIGENCE-DATASET'
const PRIVACY = 'UE-OMIT-PRIVACY-RIGHTS'
const FINANCE = 'UE-OMIT-FINANCE-UNAVAILABLE'
const ALERTS = 'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY'
const DEADLINES = 'UE-OMIT-DEADLINE-OVERDUE'
const CRONS = 'UE-OMIT-MAIN-APP-CRONS'

const GATES = {
  [DELIVERY]: 11, [EXPOSURE]: 14, [DOCS]: 6, [BILLING]: 14, [CALENDAR]: 14, [DATASET]: 14, [PRIVACY]: 6, [FINANCE]: 5,
  [ALERTS]: 14, [DEADLINES]: 10, [CRONS]: 9,
}

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const D = (id, severity, ownerCapabilityId, title) => ({ id, gate: GATES[ownerCapabilityId], severity, title, ownerCapabilityId })

const CONTINUITY_DECISION = 'UE-INST-BUSINESS-CONTINUITY-RECORDS-OWNER'

export const DECISIONS = [
  {
    id: CONTINUITY_DECISION,
    status: 'OUTSTANDING',
    question: 'Which office owns the organization business-continuity, archive and succession (inheritance) records, what do those records contain, who may read them and how long must they be kept?',
    sourceState: 'The continuity archives and docs paths are aliases of the document repository route, and the continuity inheritance path is the generic CRUD factory over the pending_profiles table, which holds pre-signup membership payment data and is refused by the CRUD governance table. No schema table, service, screen or capability-registry entry names a continuity plan, archive or succession record, so no source states what the obligation is or who holds it.',
    softwareOwners: [DOCS, BILLING],
  },
]

export const DEFECTS = [
  D('DEF-0B6-SYS-RESEND-UNMATCHED-EVENTS-ACKNOWLEDGED-AND-DROPPED', 'MEDIUM', DELIVERY, 'The Resend webhook looks the event up by provider message id and, when no message_log row carries it, logs a warning and still answers 200, so the provider does not retry and the delivery, bounce or complaint event is lost; an event that arrives before the sender has stored the provider message id is lost the same way.'),
  D('DEF-0B6-SYS-RESEND-STATUS-OVERWRITTEN-BY-OUT-OF-ORDER-EVENTS', 'MEDIUM', DELIVERY, 'The webhook sets message_log.status to the status of whichever event arrives last with no ordering rule, so a late sent, delivered or opened event overwrites a bounced, failed or complained status, and it updates in place a table whose schema comment declares it an immutable delivery log with no updatedAt.'),
  D('DEF-0B6-SYS-RESEND-REDELIVERY-DOUBLE-COUNTS-STATS', 'MEDIUM', DELIVERY, 'The Svix message id is used only as a detail of the delivery-ledger row: the failed, unsubscribed and complained branches increment the campaign statistics on every redelivery of the same event, and the statistics are rewritten as a whole object from a value read earlier in the transaction, so a retry or a concurrent event changes the counters wrongly.'),
  D('DEF-0B6-SYS-RESEND-SUPPRESSION-UPDATES-ONLY-ONE-PREFERENCE-ROW', 'MEDIUM', DELIVERY, 'A complaint or suppression event updates the existing communication_preferences row of the one organization and recipient on the message log row, never inserts one and never writes a consent record or touches the distribution-list subscriptions, so a recipient with no preference row stays emailable while the audit record says the suppression was applied, and the same address is not suppressed in any other organization.'),
  D('DEF-0B6-SYS-RESEND-LEDGER-CALLBACK-OUTSIDE-TRANSACTION', 'LOW', DELIVERY, 'The delivery-ledger callback runs after the message_log transaction has committed and its result (recorded, duplicate, unmatched, ambiguous) is ignored, so a ledger failure answers 500 after the message_log, statistics and suppression have already changed and the provider retry repeats them, and an unmatched or ambiguous ledger event is acknowledged without a trace.'),
  D('DEF-0B6-SYS-RESEND-MESSAGE-ID-LOOKUP-UNINDEXED-AND-NOT-UNIQUE', 'LOW', DELIVERY, 'message_log.provider_message_id has neither an index nor a unique constraint, yet every webhook event selects by it with limit 1 under the system role, so each event scans the table and, if two rows ever carried the same id, the organization that receives the event is arbitrary.'),

  D('DEF-0B6-SYS-CONTACT-ACKNOWLEDGES-SUBMISSION-WITH-NOTHING-STORED', 'MEDIUM', EXPOSURE, 'The public contact route has no local store: it forwards the submission to HubSpot and answers ok true even when HUBSPOT_API_KEY is unset or the upsert fails (both return null and the handler skips the deal), so a visitor is told the message was received when no record of it exists anywhere but a log line that omits the message text.'),
  D('DEF-0B6-SYS-CONTACT-RATE-LIMIT-KEYED-ON-FORGEABLE-ADDRESS-NO-BOT-CHALLENGE', 'MEDIUM', EXPOSURE, 'The only control on the public contact route is a 20-per-hour limit keyed on cf-connecting-ip, x-real-ip or the first x-forwarded-for value, all request headers a caller can set unless an edge strips them, and the route has no captcha, honeypot or origin check, so a script can rotate the header and flood the CRM with contacts and deals.'),
  D('DEF-0B6-SYS-CONTACT-UNBOUNDED-FIELDS-AND-EMAIL-LOGGED', 'LOW', EXPOSURE, 'Only the message field has a length bound on the public contact form: first name, last name, organization, role and inquiry type are unbounded strings forwarded to HubSpot (limited only by the 16 KiB body cap), and the visitor e-mail address and organization are written to the application log at info level.'),

  D('DEF-0B6-SYS-CONTINUITY-ALIASES-ARE-THE-DOCUMENT-REPOSITORY-WITH-PLACEHOLDER-GUARD', 'MEDIUM', DOCS, 'The continuity archives and docs paths are byte-identical wrappers that re-export the document repository handlers behind a placeholder requireOrgAccess that always returns true and a mutation boundary that only checks that a method string exists: no archive, retention, continuity-plan or succession behaviour exists behind the names, a POST uploads an ordinary document, and the dead unauthorized branch reads as an access check that is not there.'),
  D('DEF-0B6-SYS-CONTINUITY-LIST-UNBOUNDED-AND-FILTERED-AFTER-FETCH', 'LOW', DOCS, 'The document repository list that the continuity paths serve has no row limit and no page, returns every non-deleted document row of the organization joined to its links, then runs a case-access lookup for each grievance-linked row and applies the linkedCase filter and the visibility policy in memory, so the cost grows with the size of the organization document store.'),

  D('DEF-0B6-SYS-INHERITANCE-IS-PENDING-PROFILES-REFUSED-BY-GOVERNANCE', 'MEDIUM', BILLING, 'The continuity inheritance path advertises succession records but is the generic CRUD factory over pending_profiles, the pre-signup profile table holding the e-mail, Whop membership id and usage credits, which the CRUD governance table lists as DENIED, so every read and write answers 403 and no inheritance record can be read or written.'),
  D('DEF-0B6-SYS-INHERITANCE-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES', 'HIGH', BILLING, 'The inheritance route sets orgScoped true over pending_profiles, which has no organization column, so the factory adds no tenant predicate; the support_agent read floor and the DENIED governance entry are the only barriers, and lifting the governance entry would list the pre-signup e-mail and payment identifiers of every organization.'),

  D('DEF-0B6-SYS-DEPRECATION-REGISTRY-NAMES-MISSING-REPLACEMENTS-AND-STALE-SUNSET', 'MEDIUM', EXPOSURE, 'The deprecation registry served to every member names canonical replacements that have no route (/api/billing/reports, /api/strike/fund and /api/messages/[id]), repeats the sunset instant 2026-07-07 as a literal instead of the SUNSET_DATE constant, promises removal after that instant although routes it lists (payments webhook stripe, messaging preferences, financial vendors) still exist, and gives no sign that the list is hand-maintained.'),

  D('DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES', 'MEDIUM', CRONS, 'The document-intake reaper, external-data-sync, location-retention and monthly-per-capita handlers export the same function as GET and POST, so a GET (the method a scheduler, browser prefetch or monitoring probe issues) expires intakes, deletes stored objects and location data, calls external providers or writes per-capita remittances while the route manifest records the GET as a read.'),
  D('DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY', 'MEDIUM', CRONS, 'No scheduler entry in the repository invokes the document-intake reaper, external-data-sync, monthly-per-capita, observability-alerts or sla-watchdog handlers: apps/union-eyes/vercel.json schedules only calendar-sync and the ue-v2 apps.bicep cron job calls only deadline-reminders, so the jobs run only if an operator wires a trigger outside the source.'),
  D('DEF-0B6-SYS-CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK', 'MEDIUM', CRONS, 'The two handlers listed in CRON_API_ROUTES (external-data-sync and monthly-per-capita) are first checked in proxy.ts against CRON_SECRET only with a plain !== comparison and the x-cron-secret header only, while the handler accepts CRON_SECRET_KEY first, a Bearer value too, and compares with timingSafeEqual; where only CRON_SECRET_KEY is set the edge refuses a correct caller, and the edge check is not constant time.'),

  D('DEF-0B6-SYS-CALENDAR-SYNC-SCHEDULE-ENTRY-DOES-NOT-MATCH-ROUTE-CONTRACT', 'MEDIUM', CALENDAR, 'The only scheduler entry for calendar-sync (vercel.json, every 15 minutes) names the path with no method or secret, while the route exports POST only and verifyCronAuth reads only the x-cron-secret header, so a trigger that issues GET or presents the secret as a Bearer value is refused and no connection is synced.'),
  D('DEF-0B6-SYS-CALENDAR-SYNC-SWALLOWED-EVENT-ERRORS-COUNTED-AS-IMPORTED', 'MEDIUM', CALENDAR, 'The Google and Microsoft event import loops catch and discard the error of each event, and the cancelled-event handler discards its own error but the caller still adds one to the deleted count, so a failed event is missing from the local calendar while the connection is marked synced, the audit record reports the counts and the response shows no failure.'),
  D('DEF-0B6-SYS-CALENDAR-SYNC-FIRST-PAGE-ONLY-AND-NO-CLAIM-OF-DUE-CONNECTIONS', 'MEDIUM', CALENDAR, 'The Google import asks for at most 2500 events in one list call and never follows nextPageToken, and the cron never passes the stored sync token, so events beyond the first page are not imported while the connection is marked synced; the due list is selected without a lock or claim and nextSyncAt moves only at the end of each connection, so an overlapping run repeats the same provider calls.'),

  D('DEF-0B6-SYS-REAPER-OBJECTS-PAST-RETRY-LIMIT-ARE-ABANDONED-UNREPORTED', 'LOW', DOCS, 'The intake object finalizer selects only rows whose deletion_attempts are below INTAKE_MAX_DELETION_ATTEMPTS, so an abandoned object whose deletion keeps failing is never selected again after the limit, stays in storage, and the response reports only the failures of the current run.'),

  D('DEF-0B6-SYS-EXTERNAL-DATA-SYNC-FAILURES-ANSWER-HTTP-200-AND-LOG-COMPLETED', 'MEDIUM', DATASET, 'The external-data-sync handler returns a plain object in every case, including the outer failure branch that sets success false, so the response is HTTP 200 whatever fails, and each sync method writes the external_data_sync_log row as completed even when records failed and never stores the collected error list, so the log does not show a partial or failed run.'),
  D('DEF-0B6-SYS-EXTERNAL-DATA-SYNC-CONTRIBUTIONS-WRITE-OUTSIDE-SYSTEM-CONTEXT', 'MEDIUM', DATASET, 'syncContributionRates (and its sync-log rows) selects, updates and inserts through the plain tenant db handle while the wage, union-density and COLA methods run inside withSystemContext, so the contribution-rate part of the scheduled job runs without the system authority the other three parts were given and does not commit with a system transaction.'),

  D('DEF-0B6-SYS-LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY', 'HIGH', PRIVACY, 'The 24-hour member location retention is enforced only by the location-retention handler, whose comments say it runs hourly, but no scheduler entry in the repository invokes it (vercel.json lists only calendar-sync and apps.bicep only deadline-reminders), so expired location points and geofence events are deleted only if an operator wires a trigger outside the source.'),
  D('DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION', 'MEDIUM', PRIVACY, 'The deletion log written by the retention job records the run time as both the oldest and the newest deleted record date instead of the real dates, carries no organization, no list of affected members and no audit_log record, and the location tables have no organization column, so the evidence of what was deleted cannot show whose data or from when.'),
  D('DEF-0B6-SYS-LOCATION-RETENTION-BATCH-UNBOUNDED-IN-ONE-TRANSACTION', 'LOW', PRIVACY, 'The retention job loads every expired user id from both tables without a limit and deletes user by user inside one system transaction, so a backlog (for example after the job did not run) is one long transaction holding locks on the live location tables.'),

  D('DEF-0B6-SYS-PER-CAPITA-CRON-WRITES-A-DOMAIN-DECLARED-NOT-IMPLEMENTED', 'MEDIUM', FINANCE, 'The monthly per-capita job inserts and recalculates per_capita_remittances rows and marks them overdue for every organization with a parent, while the capability registry records the affiliate remittance capability (UE-FIN-AFFILIATE-REMITTANCES) as NOT_IMPLEMENTED and asks for a qualified model with institutional recipients, so remittance amounts and overdue states are produced without that model or any named financial officer decision.'),
  D('DEF-0B6-SYS-PER-CAPITA-CRON-REPORTS-SUCCESS-AND-SWALLOWS-ORG-FAILURES', 'MEDIUM', FINANCE, 'The per-capita handler returns success true whatever the counts, the calculation catch block drops an organization whose calculation failed without a log or a count, the save step counts a failed write in errors with no record of which organization, and the handler runs markOverdueRemittances a second time after processMonthlyPerCapita already ran it, so the top-level overdueMarked value is the second sweep (normally zero) rather than the number marked.'),

  D('DEF-0B6-SYS-OBSERVABILITY-SWEEP-RECORDS-EMAIL-SUCCESS-WITHOUT-SENDING', 'HIGH', ALERTS, 'The observability sweep writes each alert execution with status success, channels email and in_app and executionTimeMs 1, but the e-mail leg is only a notification_tracking row with status pending that no sender reads (notification-service names the table only in a comment and the process-notifications cron is a 501 stub), so the execution history shows an e-mail alert as delivered that was never sent.'),
  D('DEF-0B6-SYS-OBSERVABILITY-SWEEP-ALERT-HAS-NO-HUMAN-RECIPIENT', 'MEDIUM', ALERTS, 'The in-app alert is addressed to the pseudo-user system:observability-alerts and the tracking row names no recipient, and the alert rule is created with no recipient list, so no organization administrator is the target of an SLA-risk, ingestion-failure or payment-failure alert.'),
  D('DEF-0B6-SYS-OBSERVABILITY-SWEEP-NO-DEDUPE-REPEATS-EVERY-RUN', 'MEDIUM', ALERTS, 'Each run counts the last 60 minutes and, because the rule frequency is every_occurrence and no earlier execution is consulted, emits a new execution, tracking row, in-app row and audit record for the same condition on every run, so a single failure window produces repeated alerts and unbounded rows.'),

  D('DEF-0B6-SYS-SLA-WATCHDOG-EVENTS-HAVE-NO-SUBSCRIBER', 'HIGH', DEADLINES, 'The SLA watchdog emits sla_breached, sla_at_risk and sla_breach_risk on the in-process event bus under claim_events, an in-memory bus that drops an event with no subscriber, and no code subscribes to claim_events, so no steward, notification or record is produced for an overdue claim; the response counts breached and at-risk claims as though they had been handled.'),
  D('DEF-0B6-SYS-SLA-CLOCK-RESTARTS-ON-ANY-CLAIM-UPDATE', 'MEDIUM', DEADLINES, 'The deadline is computed from claims.updated_at (falling back to created_at) as though it were the time of the last status change, and the claims table has no status-changed column, so any edit of a claim restarts its SLA clock and a claim that is touched often never breaches.'),
  D('DEF-0B6-SYS-SLA-WATCHDOG-UNBOUNDED-SCAN-AND-UNAWAITED-DUPLICATE-METRICS', 'LOW', DEADLINES, 'The watchdog selects every non-terminal claim of every organization with no limit, recomputes each deadline twice, and hands per-organization pilot metrics to promises it does not await, each recorded with no idempotency key as a metric insert and a separate audit insert, so a run answers before the writes finish and a run every minute adds new metric rows each time.'),
]

export const CAPABILITIES = []

const group = (capabilityId, domain, actor, routes, evidence) => ({ capabilityId, domain, actor, routes, evidence })

export const GROUPS = {
  COMMUNICATIONS_PROVIDER_CALLBACKS: group(DELIVERY, 'COMMUNICATIONS_PROVIDER_CALLBACKS',
    'Message delivery pipeline receiving provider events (sent, delivered, opened, clicked, bounced, failed, suppressed, complained) for campaign messages',
    ['communications/webhooks/resend/route.ts'], [
      ev(CAMPAIGNS, "export const messageLog = pgTable('message_log', {"),
      ev(CAMPAIGNS, ' * Immutable delivery log for all sent messages'),
      ev(RECONCILIATION, 'export async function recordProviderCallback(input: {'),
    ]),
  PUBLIC_CONTACT_INTAKE: group(EXPOSURE, 'PUBLIC_CONTACT_INTAKE',
    'Anonymous visitor to the marketing site sending a contact request to the product team',
    ['contact/route.ts'], [
      ev(CONTACT_FORM, "const res = await fetch('/api/contact', {"),
      ev(GUARD, ' * Bounded controls for the few routes that must accept writes without a session (UE-CONV-K-008 public allowlist).'),
      ev(CRM, ' * Provides CRM operations for Union-Eyes: contact upsert, deal creation,'),
    ]),
  CONTINUITY_DOCUMENT_ALIASES: group(DOCS, 'CONTINUITY_DOCUMENT_ALIASES',
    'Member and representative document custodian reaching the document repository through continuity archive and docs paths',
    ['continuity/archives/route.ts', 'continuity/docs/route.ts'], [
      ev(DOCUMENTS_SCHEMA, "export const documents = pgTable('documents', {"),
      ev(`${APP}app/api/documents/repository/route.ts`, 'export const GET = withOrganizationAuth(async (request, context) => {'),
    ]),
  CONTINUITY_PENDING_PROFILES: group(BILLING, 'CONTINUITY_PENDING_PROFILES',
    'Platform operator holding pre-signup membership profiles (Whop membership and usage credits) reached through the continuity inheritance path',
    ['continuity/inheritance/route.ts'], [
      ev(PENDING_PROFILES, 'export const pendingProfilesTable = pgTable("pending_profiles", {'),
      ev(PENDING_PROFILES, '  whopMembershipId: text("whop_membership_id"),'),
    ]),
  API_DEPRECATION_REGISTRY: group(EXPOSURE, 'API_DEPRECATION_REGISTRY',
    'Member or integrator reading which API routes are deprecated and what replaces them',
    ['deprecations/route.ts'], [
      ev(DEPRECATION, "const SUNSET_DATE = new Date('2026-07-07T00:00:00Z');"),
      ev(DEPRECATION, 'export const DEPRECATED_ROUTE_MAP: DeprecatedRouteMapping[] = ['),
    ]),
  EMERGENCY_RETIRED_SCAFFOLD: group(SCAFFOLD, 'EMERGENCY_RETIRED_SCAFFOLD',
    'Caller reaching the emergency preparedness dashboard, a retired scaffold that answers HTTP 501',
    ['emergency/dashboard/route.ts'], [
      ev(EMERGENCY, 'export function emergencyNotImplemented(): NextResponse {'),
      ev(REGISTRY, "id: 'UE-EMERGENCY-DECLARATION',"),
    ]),
  CRON_CALENDAR_SYNC: group(CALENDAR, 'CRON_CALENDAR_SYNC',
    'Scheduled job runner importing events for every due external calendar connection',
    ['cron/calendar-sync/route.ts'], [
      ev(CALENDAR_SCHEMA, "export const externalCalendarConnections = pgTable('external_calendar_connections', {"),
      ev(GOOGLE, 'export async function importGoogleEvents('),
    ]),
  CRON_DOCUMENT_INTAKE_REAPER: group(DOCS, 'CRON_DOCUMENT_INTAKE_REAPER',
    'Scheduled job runner expiring lapsed document upload intakes and deleting abandoned stored objects',
    ['cron/document-intake-reaper/route.ts'], [
      ev(DOCUMENTS_SCHEMA, "export const documentIntakes = pgTable('document_intakes', {"),
      ev(INTAKE, 'export async function runIntakeReaper('),
    ]),
  CRON_EXTERNAL_DATA_SYNC: group(DATASET, 'CRON_EXTERNAL_DATA_SYNC',
    'Scheduled job runner refreshing the shared Statistics Canada wage, union density, cost-of-living and contribution-rate reference data',
    ['cron/external-data-sync/route.ts'], [
      ev(WAGE_SCHEMA, 'export const wageBenchmarks = pgTable("wage_benchmarks", {'),
      ev(WAGE_SCHEMA, 'export const externalDataSyncLog = pgTable("external_data_sync_log", {'),
    ]),
  CRON_LOCATION_RETENTION: group(PRIVACY, 'CRON_LOCATION_RETENTION',
    'Scheduled job runner deleting expired member location points and geofence events under the 24-hour retention rule',
    ['cron/location-retention/route.ts'], [
      ev(GEO_SCHEMA, 'export const locationTracking = pgTable("location_tracking", {'),
      ev(GEO_SCHEMA, 'export const locationDeletionLog = pgTable("location_deletion_log", {'),
    ]),
  CRON_MONTHLY_PER_CAPITA: group(FINANCE, 'CRON_MONTHLY_PER_CAPITA',
    'Scheduled job runner calculating monthly per-capita remittances owed by affiliated organizations and marking overdue ones',
    ['cron/monthly-per-capita/route.ts'], [
      ev(PER_CAPITA_SCHEMA, 'export const perCapitaRemittances = pgTable('),
      ev(REGISTRY, "title: 'CLC / National / federation affiliate remittances',"),
    ]),
  CRON_OBSERVABILITY_ALERTS: group(ALERTS, 'CRON_OBSERVABILITY_ALERTS',
    'Scheduled job runner checking SLA-risk, ingestion-failure and payment-failure signals and emitting alert executions and notifications',
    ['cron/observability-alerts/route.ts'], [
      ev(ALERTING_SCHEMA, "export const alertExecutions = pgTable('alert_executions', {"),
      ev(OBS, 'export async function runRealtimeObservabilitySweep(): Promise<EmitResult> {'),
    ]),
  CRON_SLA_WATCHDOG: group(DEADLINES, 'CRON_SLA_WATCHDOG',
    'Scheduled job runner checking open claims against service-level deadlines and signalling at-risk and breached claims',
    ['cron/sla-watchdog/route.ts'], [
      ev(CLAIMS_SCHEMA, 'export const claimStatusEnum = pgEnum("claim_status", ['),
      ev(CASE_LIFECYCLE, 'export function getSLADeadlineHours(state: LifecycleState, priority: CasePriority): number {'),
    ]),
}

export const ROUTES = new Set(Object.values(GROUPS).flatMap((g) => g.routes))

const CRON_AUTHN = 'Cron secret: withApi auth { cron: true } reads x-cron-secret or the Authorization bearer value and compares it with CRON_SECRET_KEY (falling back to CRON_SECRET) through secretsEqual, which hashes both values with SHA-256 and compares them with timingSafeEqual; no user session is used.'
const CRON_AUTHZ = 'The cron secret is the only check: an unset or empty secret makes secretsEqual return false so the route fails closed with a refusal, and any caller holding the secret may run the job at any time. There is no role, organization or kernel decision.'

const WITH_API = `${APP}lib/api/with-api.ts`

const hh = (a, claim, pattern) => {
  try {
    return a.h(claim, pattern)
  } catch (error) {
    try { return a.local(claim, 'handler', pattern) } catch { throw error }
  }
}

const aliasedHandler = (a) => !/withApi\(/.test(a.region)

const withApiCronEv = (a) => {
  const config = hh(a, 'authentication', 'auth: { cron: true },')
  const secretEv = [
    a.svc('authorization', SECRET, 'if (!expected) return false'),
    a.svc('authentication', SECRET, 'return timingSafeEqual(left, right)'),
  ]
  if (aliasedHandler(a)) {
    return [
      config,
      hh(a, 'authorization', 'auth: { cron: true },'),
      a.svc('authentication', WITH_API, "const xCronHeader = request.headers.get('x-cron-secret');"),
      a.svc('authentication', WITH_API, 'if (!secretsEqual(cronSecret, expected)) {'),
      a.svc('authorization', WITH_API, 'if (requireCron) {'),
      ...secretEv,
    ]
  }
  return [
    config,
    a.imp('authentication', 'withApi', "const xCronHeader = request.headers.get('x-cron-secret');"),
    a.imp('authentication', 'withApi', 'if (!secretsEqual(cronSecret, expected)) {'),
    a.imp('authorization', 'withApi', 'if (requireCron) {'),
    ...secretEv,
  ]
}

const SYSTEM_TX_QUOTE = 'const result = await systemContextStorage.run(tx, () => operation(tx))'
const GET_WRITE_VOCABULARY = 'The record value NONE is the only value the read-method vocabulary offers for a GET that writes; it does not say that no audit record is made.'

const base = (a) => ({ service: `${APP}app/api/${a.route}`, dec: [] })

const cronAliasCorrection = GET_WRITES('NOT_APPLICABLE:READ')

/* ------------------------------------------------------------------------------------------------------------ */
/* communications/webhooks/resend                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

const resendWebhook = (a) => mk({
  ...base(a),
  persona: 'Resend (the e-mail provider) delivering signed Svix webhook events about messages the platform sent, called by the provider rather than by a user',
  authn: 'Provider signature: the route requires RESEND_API_KEY and RESEND_WEBHOOK_SECRET (503 when either is unset, so it fails closed), requires the svix-id, svix-timestamp and svix-signature headers (400 when missing) and verifies the raw body through resend.webhooks.verify (401 when verification throws). No user session is used.',
  cat: 'EXTERNAL_TRUST',
  authz: 'The Svix signature over the raw body is the only check and it grants the right to change delivery state of any message log row the event names. The comparison and the timestamp tolerance are performed inside resend.webhooks.verify, library code that is not part of the repository source; the route itself compares nothing and keeps no replay store. There is no role or kernel decision.',
  tenant: 'The organization is not read from the event: the handler runs under withSystemContext and selects the message_log row by provider message id alone, then takes organizationId, campaignId and recipientId from that row and carries the organization into every later update. The event therefore cannot name an organization, but the row it matches decides which one is changed.',
  owner: 'message_log rows (status, delivery, open, click and bounce times, error message, metadata), the stats object of the campaigns row they belong to, and communication_preferences rows of the recipient of the organization the log row names.',
  sens: 'Recipient delivery status and timestamps, bounce and failure reasons, complaint and suppression events, and the recipient e-mail preference and unsubscribe reason',
  priv: 'No data is returned beyond received and the event type. The handler writes the recipient e-mail preference (emailEnabled false, globally unsubscribed with reason complaint or suppressed) from a signed provider event; a complaint therefore changes a person consent state without that person acting.',
  mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
  auditDetail: 'Inside one withSystemContext transaction the handler updates message_log, rewrites the campaign stats and, for a complaint or suppression, updates the preference and commits persistAtomicAudit (communications.email_suppression.apply) with the row; the status and statistics changes of delivery, open, click, bounce and failure events write no audit record, and the delivery-ledger row is inserted after the transaction by recordProviderCallback, outside it.',
  reqAudit: 'Record every state change a provider event causes (status, counters, suppression) with the provider event id in the same transaction, include the delivery-ledger row in it, and keep the in-transaction suppression audit.',
  does: 'Verifies the Svix signature, ignores non-email and unmapped events, finds the message_log row by provider message id (logging and acknowledging 200 when there is none), sets its status to the event status and the first-seen time, increments campaign statistics, applies a complaint or suppression to the existing communication_preferences row with an atomic audit record, then calls recordProviderCallback for sent, delivered, bounced, failed, suppressed and complained events and answers received.',
  status: 'PARTIAL',
  gate: 11,
  deps: [9, 13],
  future: 'Store the Svix event id and reject a repeat, apply events by a monotonic status order, hold the provider message id unique and indexed, hold unmatched events for a retry instead of acknowledging them, upsert the suppression with a consent record across the recipient lists and organizations, and commit the delivery-ledger row with the rest.',
  dec: ['UE-INST-COMMUNICATIONS-CAMPAIGN-OWNER'],
  ev: [
    hh(a, 'authentication', "const svixId = request.headers.get('svix-id');"),
    hh(a, 'authentication', "return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });"),
    a.local('authentication', 'verifyWebhookSignature', 'return resend.webhooks.verify({'),
    hh(a, 'authorization', 'event = verifyWebhookSignature(resend, webhookSecret, {'),
    hh(a, 'authorization', "return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 503 });"),
    hh(a, 'tenantScope', '.where(eq(messageLog.providerMessageId, providerMessageId))'),
    hh(a, 'tenantScope', 'organizationId: messageLog.organizationId,'),
    a.imp('tenantScope', 'withSystemContext', SYSTEM_TX_QUOTE),
    hh(a, 'mutation', '.update(communicationPreferences)'),
    hh(a, 'mutation', '.update(messageLog)'),
    hh(a, 'audit', 'await persistAtomicAudit(tx, {'),
    hh(a, 'audit', "action: 'communications.email_suppression.apply',"),
    hh(a, 'behavior', 'logger.warn(\'[resend-webhook] No message_log row for provider message\', {'),
    hh(a, 'behavior', 'await recordProviderCallback({'),
    hh(a, 'defect', 'status: mapping.status,'),
    hh(a, 'defect', 'shouldIncrementStat = true;'),
    hh(a, 'defect', 'let nextStats = incrementStat(campaign.stats, mapping.statKey);'),
    hh(a, 'defect', 'webhookId: svixId,'),
    a.svc('defect', RECONCILIATION, 'if (facts.length === 0) return \'unmatched\'', 'recordProviderCallback'),
    a.svc('defect', RECONCILIATION, "eventTimestamp: new Date(),", 'recordProviderCallback'),
    a.tbl('defect', 'messageLog', /createdAt: timestamp\('created_at', \{ withTimezone: true \}\)\.defaultNow\(\)\.notNull\(\),/),
    a.tbl('defect', 'messageLog', /providerMessageId: varchar\('provider_message_id', \{ length: 255 \}\),/),
    a.tbl('defect', 'messageLog', /statusIdx: index\('idx_message_log_status'\)\.on\(table\.status\),/),
    a.tbl('privacy', 'communicationPreferences', /emailEnabled: boolean\('email_enabled'\)\.default\(true\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'When no message_log row matches, the handler runs logger.warn and returns from the transaction callback, and the code after it returns the received response with status 200 and no error, so the provider treats the event as accepted and does not retry; the sender stores providerMessageId on the log row only after the send call returns, so an event that arrives first finds no row.' },
    { claim: 'defect', statement: 'updates.status is assigned mapping.status for every mapped event and no condition compares it with logRow.status or an event order, so the last event to arrive wins; the message_log table comment says it is an immutable delivery log with no updatedAt, while the handler updates it in place.' },
    { claim: 'defect', statement: 'The failed, unsubscribed and complained branches set shouldIncrementStat to true unconditionally, the svix-id is passed only to recordProviderCallback as webhookId, and no store of seen svix ids is read before the transaction, so a redelivered event increments the same statistic again; the counters are read in the transaction and written back as a whole object with no row lock.' },
    { claim: 'defect', statement: 'The suppression statement is an update with a where clause on organization id and user id and no insert, the route imports no consent_records or newsletter_list_subscribers table, and the unsubscribe route (an upsert with a consent record) is the contrast; when no preference row exists the update changes zero rows and persistAtomicAudit still records that the suppression was applied.' },
    { claim: 'defect', statement: 'recordProviderCallback is called after withSystemContext has returned, so the message_log transaction is already committed; the returned value (recorded, duplicate, ignored, unmatched, ambiguous) is not read, and a thrown error leaves the handler without a response status of its own, so the provider retries and repeats the committed changes.' },
    { claim: 'defect', statement: 'The message_log index list names organization, campaign, recipient, status, sent and created time only; provider_message_id has no index and no unique modifier, and the lookup selects it with limit 1, so duplicate ids would not be detected and the first physical row would receive the event.' },
  ],
  def: [
    'DEF-0B6-SYS-RESEND-UNMATCHED-EVENTS-ACKNOWLEDGED-AND-DROPPED',
    'DEF-0B6-SYS-RESEND-STATUS-OVERWRITTEN-BY-OUT-OF-ORDER-EVENTS',
    'DEF-0B6-SYS-RESEND-REDELIVERY-DOUBLE-COUNTS-STATS',
    'DEF-0B6-SYS-RESEND-SUPPRESSION-UPDATES-ONLY-ONE-PREFERENCE-ROW',
    'DEF-0B6-SYS-RESEND-LEDGER-CALLBACK-OUTSIDE-TRANSACTION',
    'DEF-0B6-SYS-RESEND-MESSAGE-ID-LOOKUP-UNINDEXED-AND-NOT-UNIQUE',
    'DEF-0B5-TRACKING-STATS-READ-MODIFY-WRITE-UNAUDITED',
    'DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE',
  ],
  corr: [{ field: 'audit', manifest: 'audit ATOMIC', actual: 'The suppression and the message_log update commit atomically with persistAtomicAudit for the complaint and suppression branches only; status, counter, open, click, bounce and failure changes write no audit record and the delivery-ledger row is inserted after the transaction.' }],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* contact                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const contactPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous visitor to the marketing site submitting the contact form',
  authn: 'None: the route has no session and is not on the public-route allowlist; guardPublicIntake is the only control and it identifies the caller by a request-header address, not an identity.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. guardPublicIntake applies a per-address rate limit (20 per hour, refusing when the limiter is unavailable in production), a 16 KiB body cap and strict JSON parsing, and nothing else decides who may submit.',
  tenant: 'None: the route reads and writes no organization data. The organization field is a free-text company name the visitor types, not a tenant reference, and nothing in the handler resolves a tenant.',
  owner: 'No platform record: the submission is forwarded to HubSpot (a contact upsert and a deal) and written to the application log; nothing is stored in the platform database.',
  sens: 'Visitor first name, last name, e-mail address, organization, job role, inquiry type and a message of up to 2000 characters (500 sent to the deal)',
  priv: 'Visitor personal data is sent to the third-party CRM and the e-mail address, organization and inquiry type are logged at info level; the message text is not logged. The response returns only ok true.',
  mut: 'NONE',
  auditDetail: 'The route writes no database row and no audit record; the external CRM contact and deal it creates are recorded only by logger.info lines in the route and in the CRM service.',
  reqAudit: 'Keep a local record of each submission (time, address bucket, fields, CRM outcome) so a lost or rejected CRM call is not the only evidence the visitor wrote.',
  does: 'Applies the public intake guard, validates the fields with zod, logs the submission, upserts a HubSpot contact and, when that returns an id, creates a deal carrying the first 500 characters of the message; it answers ok true even when HubSpot is unconfigured or the upsert fails, 400 for invalid input and 500 for any other error.',
  status: 'PARTIAL',
  gate: 14,
  deps: [9, 13],
  future: 'Store the submission locally before forwarding, return failure when it could not be recorded, key the limiter on a trusted client address, add a bot challenge, bound every field and stop logging the visitor e-mail address.',
  ev: [
    hh(a, 'authentication', "const intake = await guardPublicIntake(request, { bucket: 'write' });"),
    a.imp('authentication', 'guardPublicIntake', 'const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)'),
    hh(a, 'authorization', 'if (!intake.ok) return intake.response;'),
    a.svc('authorization', GUARD, "write: { limit: 20, window: 3600, identifier: 'public-intake-write' },"),
    hh(a, 'tenantScope', 'const { firstName, lastName, email, organization, role, inquiryType, message } = body;'),
    hh(a, 'mutation', 'const contactId = await upsertContact({'),
    hh(a, 'mutation', 'return NextResponse.json({ ok: true });'),
    hh(a, 'audit', "logger.info('contact_form:submitted', { email, organization, inquiryType });"),
    hh(a, 'behavior', 'const body = contactSchema.parse(raw);'),
    hh(a, 'privacy', "logger.info('contact_form:submitted', { email, organization, inquiryType });"),
    hh(a, 'defect', '...(message ? { ue_message: message.slice(0, 500) } : {}),'),
    a.svc('defect', CRM, "logger.warn('HUBSPOT_API_KEY not set — CRM sync disabled')", 'getClient'),
    a.svc('defect', CRM, 'if (!hs) return null', 'upsertContact'),
    a.svc('defect', GUARD, "const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')", 'clientAddress'),
    a.svc('defect', GUARD, "return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'", 'clientAddress'),
    a.svc('defect', GUARD, 'const config: RateLimitConfig = { ...PUBLIC_INTAKE_BUCKETS[options.bucket], failOpen: process.env.NODE_ENV !== \'production\' }', 'guardPublicIntake'),
  ],
  inf: [
    { claim: 'defect', statement: 'upsertContact returns null when HUBSPOT_API_KEY is unset or the CRM call fails and the handler only branches on the id for the deal; the next statement returns ok true on every path that did not throw, and the route imports no database module, so an unconfigured or failing CRM leaves no stored submission while the visitor is told it succeeded.' },
    { claim: 'defect', statement: 'The route reads no captcha token, honeypot field or Origin header and the schema bounds only message with max(2000); the limiter key is built from three request headers (cf-connecting-ip, x-real-ip, the first x-forwarded-for value) that the platform trusts without proof that an edge overwrote them, and the 0B.1 register records /api/contact as intentionally public yet absent from the public-route allowlists.' },
  ],
  def: [
    'DEF-0B6-SYS-CONTACT-ACKNOWLEDGES-SUBMISSION-WITH-NOTHING-STORED',
    'DEF-0B6-SYS-CONTACT-RATE-LIMIT-KEYED-ON-FORGEABLE-ADDRESS-NO-BOT-CHALLENGE',
    'DEF-0B6-SYS-CONTACT-UNBOUNDED-FIELDS-AND-EMAIL-LOGGED',
    'DEF-0B1-ALLOWLIST-DRIFT',
  ],
  corr: [{ field: 'audit', manifest: 'NOT_APPLICABLE:NO_WRITES_FOUND', actual: 'The POST writes a contact and a deal to the external HubSpot CRM and a log line, so writes exist even though no platform table is written.' }],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* continuity archives and docs: aliases of the document repository                                              */
/* ------------------------------------------------------------------------------------------------------------ */

const REPOSITORY_GET = 'export const GET = withOrganizationAuth(async (request, context) => {'
const REPOSITORY_POST = 'export const POST = withOrganizationAuth(async (request, context) => {'

const continuityBase = (a) => ({
  ...base(a),
  persona: 'Member or representative using a continuity archive or continuity document path that the document repository route serves',
  authn: 'Session resolved by withOrganizationAuth in the delegated document repository handler; the alias adds only a requireOrgAccess placeholder that returns true.',
  authz: 'The delegated handler requires the grievance_case_suite entitlement and a member role floor (hasMinRole member). The alias guard requireOrgAccess always returns true, so it contributes nothing; case-linked documents are further filtered by getEffectiveCaseAccess and the document governance policy. A role floor is not a kernel decision.',
  tenant: 'The delegated handler scopes the query to the session organization (documents.organizationId equals organizationId and deletedAt is null) and the insert writes the session organization.',
  owner: 'documents, document_versions and document_links rows of the organization; nothing in the alias names an archive, a plan or a succession record.',
  sens: 'Document titles, file names, document types, privacy labels, uploader ids, linked case ids and, on upload, the file reference and content hash',
  status: 'FACADE_OVER_GENERIC_TABLE',
  gate: 6,
  deps: [9, 13],
  dec: [CONTINUITY_DECISION],
  def: [
    'DEF-0B6-SYS-CONTINUITY-ALIASES-ARE-THE-DOCUMENT-REPOSITORY-WITH-PLACEHOLDER-GUARD',
  ],
})

const continuityGet = (a) => mk({
  ...continuityBase(a),
  priv: 'Document titles, privacy labels and linked case ids of the organization are returned to members the visibility policy admits; the uploader id is withheld from members below steward. The keyword filter searches stored document text before the policy removes rows, which is not visible in the response.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the delegated handler writes no row and no audit record, and the alias adds none.',
  reqAudit: 'Reads of documents carrying privilege or medical labels should be audited once the readers of continuity records are named.',
  does: 'Returns the document repository list of the session organization, filtered by the visibility policy, through the continuity path: the call runs the document repository GET unchanged, so no archive or continuity filter exists and the list has no limit.',
  future: 'Remove the alias or build a continuity records route with its own authority decision, retention and archive behaviour; until then it must not be named as a continuity feature, and the list must be bounded.',
  ev: [
    a.local('authorization', 'requireOrgAccess', 'return true;'),
    hh(a, 'authorization', 'if (!requireOrgAccess(request)) {'),
    a.imp('authentication', 'GET', REPOSITORY_GET),
    a.imp('authorization', 'GET', "const canRead = await hasMinRole('member');"),
    a.imp('authorization', 'GET', "await requireEntitlement(organizationId, 'grievance_case_suite');"),
    a.imp('tenantScope', 'GET', 'const conditions = [eq(documents.organizationId, organizationId), sql`${documents.deletedAt} IS NULL`];'),
    a.imp('mutation', 'GET', '.orderBy(desc(documents.updatedAt));'),
    a.imp('behavior', 'GET', 'const effective = await getEffectiveCaseAccess({'),
    a.imp('privacy', 'GET', 'const { uploadedBy: uploaderId, ...withoutUploader } = row;'),
    a.imp('defect', 'GET', '.where(and(...conditions))'),
    hh(a, 'defect', 'return DelegateGET(request as never, context as never);'),
  ],
  inf: [
    { claim: 'defect', statement: 'The delegated list query ends at orderBy with no limit or offset, applies linkedCase and the visibility policy after the rows are fetched, and awaits getEffectiveCaseAccess per grievance-linked row; the alias passes the request through unchanged and the route file imports no other module, so no continuity behaviour is added.' },
  ],
  def: [
    'DEF-0B6-SYS-CONTINUITY-ALIASES-ARE-THE-DOCUMENT-REPOSITORY-WITH-PLACEHOLDER-GUARD',
    'DEF-0B6-SYS-CONTINUITY-LIST-UNBOUNDED-AND-FILTERED-AFTER-FETCH',
  ],
  corr: [],
})

const continuityPost = (a) => mk({
  ...continuityBase(a),
  priv: 'The uploaded document reference, title, privacy label and sensitivity flags are stored for the organization; the response returns the created document row to the uploader.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The delegated handler commits the document, its first version, its link and persistAtomicAudit (document.upload) in one RLS transaction; the alias adds no audit record of its own.',
  reqAudit: 'Keep the in-transaction document.upload record and add the authority decision that allowed a continuity filing once that obligation is defined.',
  does: 'Runs the document repository POST unchanged after the placeholder guard and a check that the request has a method string: it validates the upload body, checks case access for case-linked filings, resolves the stored blob or intake, and inserts the document, version and link with an atomic audit record. A POST to a continuity path therefore uploads an ordinary document.',
  future: 'Remove the alias or define the continuity record, its authority and retention; replace the placeholder guard and the method-string check, which prove nothing, with a real authority decision.',
  ev: [
    a.local('authorization', 'requireOrgAccess', 'return true;'),
    hh(a, 'authorization', 'if (!requireOrgAccess(request)) {'),
    a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'),
    a.imp('authentication', 'POST', REPOSITORY_POST),
    a.imp('authorization', 'POST', "const canUpload = await hasMinRole('member');"),
    a.imp('authorization', 'POST', "await requireEntitlement(organizationId, 'grievance_case_suite');"),
    a.imp('tenantScope', 'POST', 'created = await withRLSContext({ organizationId }, async (tx) => {'),
    a.imp('mutation', 'POST', '.insert(documents)'),
    a.imp('audit', 'POST', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'POST', "action: 'document.upload',"),
    hh(a, 'defect', 'return DelegatePOST(request as never, context as never);'),
  ],
  inf: [
    { claim: 'defect', statement: 'validateMutationBoundary parses an object built from request.method, which is always a string, so the schema cannot fail; requireOrgAccess returns the literal true, so the 401 branch is unreachable; the route imports nothing but the delegated handlers and zod.' },
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* continuity inheritance: pending_profiles through the CRUD factory                                             */
/* ------------------------------------------------------------------------------------------------------------ */

const inheritanceProfile = {
  persona: 'Platform support agent or organization steward reaching, through the continuity inheritance path, the pre-signup profile table that holds membership purchase identifiers',
  owner: 'pending_profiles rows: a pre-signup profile keyed by a unique e-mail address with the Whop membership id and usage credits; the table has no organization column and no owner column.',
  sens: 'Pre-signup e-mail address, Whop membership identifier and usage credits',
  priv: (m) => (m === 'GET'
    ? 'No row is read: pending_profiles is DENIED in the CRUD governance table so the read is refused with 403 before any query. Were the entry lifted, the support_agent floor would list the pre-signup e-mail and payment identifiers of every organization because the table has no organization column.'
    : 'No row is written: the write is refused with 403. Were the entry lifted, a steward of any organization could insert a pre-signup profile carrying a Whop membership id and usage credits.'),
  does: (m, _model, floor) => (m === 'GET'
    ? `Would list pending_profiles rows at a role floor of ${floor}; because the table is DENIED the factory refuses the read with 403 and returns nothing. The path name says inheritance but the table is the pre-signup membership profile.`
    : `Would insert a pending_profiles row from the body at a role floor of ${floor}; because the table is DENIED the factory refuses the write with 403. The path name says inheritance but the table is the pre-signup membership profile.`),
  future: 'Remove the alias or build a succession record with its own table, organization column and authority decision; if pending_profiles is ever served it must be a platform-staff route with an organization-independent mandate and an audited write.',
  gate: 14,
  deps: [9, 13],
  decisions: ['UE-INST-PLATFORM-CONTRACT-AUTHORITY', CONTINUITY_DECISION],
  def: () => ['DEF-0B6-SYS-INHERITANCE-IS-PENDING-PROFILES-REFUSED-BY-GOVERNANCE'],
  reqRead: 'No audit record is needed for a refused read; audit reads of pre-signup payment identifiers if a platform route ever serves them.',
}

const inheritanceRecord = (a, readText) => {
  const record = crudRecord(a, readText, inheritanceProfile)
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? 'DEF-0B6-SYS-INHERITANCE-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES' : id)))]
  return record
}

/* ------------------------------------------------------------------------------------------------------------ */
/* deprecations and emergency                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const deprecationsGet = (a) => mk({
  ...base(a),
  persona: 'Member of any organization or integrator reading the registry of deprecated API routes',
  authn: 'Authenticated session resolved by withApi with auth required true.',
  authz: "withApi with minRole member: a role floor of member for the session organization. A role title is not a kernel decision.",
  tenant: 'withApi requires an organization for an authenticated route, and the handler then reads no table: the registry is a static array shared by every organization.',
  owner: 'No record: the response is the in-code DEPRECATED_ROUTE_MAP array and two literals.',
  sens: 'Deprecated and canonical route paths with a reason and a phase number; no personal or organization data',
  priv: 'No personal data is read or returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of a static array; nothing is written and no audit record is needed.',
  reqAudit: 'No audit record is needed for a static registry read.',
  does: 'Returns the DEPRECATED_ROUTE_MAP array, its length, the literal sunset instant 2026-07-07T00:00:00Z and a note that listed routes return Deprecation headers and will be removed after the sunset date. The registry names replacements, some of which have no route.',
  status: 'PARTIAL',
  gate: 14,
  deps: [9],
  future: 'Generate the registry from the routes that exist, verify every canonical path resolves, read the sunset from the same constant the headers use, and update or retire entries whose sunset has passed.',
  ev: [
    ...guardEv(a, 'withApi'),
    hh(a, 'authorization', "auth: { required: true, minRole: 'member' },"),
    hh(a, 'mutation', 'deprecated_routes: DEPRECATED_ROUTE_MAP,'),
    hh(a, 'behavior', "_note: 'Routes listed here return Deprecation headers and will be fully removed after the sunset date.',"),
    hh(a, 'defect', "sunset: '2026-07-07T00:00:00Z',"),
    a.imp('defect', 'DEPRECATED_ROUTE_MAP', /canonical: '\/api\/billing\/reports'/),
    a.imp('defect', 'DEPRECATED_ROUTE_MAP', /canonical: '\/api\/strike\/fund'/),
    a.imp('defect', 'DEPRECATED_ROUTE_MAP', /canonical: '\/api\/messages\/\[id\]'/),
    a.imp('defect', 'DEPRECATED_ROUTE_MAP', /deprecated: '\/api\/financial\/vendors', canonical: 'REMOVED'/),
  ],
  inf: [
    { claim: 'defect', statement: 'No route directory exists under apps/union-eyes/app/api for billing/reports, strike/fund (only strike/funds) or messages/[id] (messages holds queue, retention-policy and threads), and the route files of payments/webhooks/stripe, messaging/preferences and financial/vendors that the registry lists as deprecated or removed are still present; the sunset literal is typed again in the route although deprecation.ts defines SUNSET_DATE with the same value.' },
  ],
  def: ['DEF-0B6-SYS-DEPRECATION-REGISTRY-NAMES-MISSING-REPLACEMENTS-AND-STALE-SUNSET'],
  corr: [],
})

const emergencyDashboardGet = (a) => mk({
  ...base(a),
  persona: 'Any authenticated caller opening the emergency preparedness dashboard',
  authn: 'Authenticated session resolved by withApiAuth; the handler is reached only after the session check.',
  cat: 'REFUSED_501',
  authz: 'withApiAuth with no role argument: any authenticated user reaches the handler, which refuses every request with HTTP 501. The route registers no role check, no organization and no kernel decision.',
  tenant: 'None: the handler resolves no organization and reads no table, because it returns the not-implemented refusal immediately.',
  owner: 'No record: the emergency declaration capability has no persisted state.',
  sens: 'None returned: the response is a fixed refusal message that states that nothing was declared, granted, sent or collected.',
  priv: 'No personal data is read or returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'The handler writes nothing and records no audit record; the refusal is the whole behaviour.',
  reqAudit: 'No audit record is needed for a refusal; an emergency declaration, when built, must record its activation and every grant in the same transaction as the state change.',
  does: 'Answers HTTP 501 with success false and the code NOT_IMPLEMENTED for every authenticated request; the earlier hard-coded preparedness and compliance figures were removed and no data is invented.',
  status: 'HONEST_501',
  gate: 8,
  deps: [13],
  future: 'Keep the 501 until an emergency declaration capability exists with persisted state, an authority decision and an audited lifecycle; do not link to the dashboard from navigation while it refuses.',
  ev: [
    ...guardEv(a, 'withApiAuth'),
    hh(a, 'authorization', 'export const GET = withApiAuth(async () => emergencyNotImplemented())'),
    hh(a, 'tenantScope', 'export const GET = withApiAuth(async () => emergencyNotImplemented())'),
    a.imp('mutation', 'emergencyNotImplemented', '{ status: 501 },'),
    a.imp('behavior', 'emergencyNotImplemented', "{ success: false, error: { code: 'NOT_IMPLEMENTED', message: EMERGENCY_NOT_IMPLEMENTED_MESSAGE } },"),
  ],
  def: [],
  corr: [{ field: 'control', manifest: 'ROLE_TITLE_CHECK', actual: 'The route uses withApiAuth, which requires a session and names no role, and the handler then refuses with HTTP 501, so no role title is checked.' }],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: calendar-sync                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

const calendarSyncPost = (a) => mk({
  ...base(a),
  persona: 'Scheduled job runner (every 15 minutes in vercel.json) importing events for every active, due Google or Microsoft calendar connection of every organization',
  authn: 'Cron secret: withApiAuth with cronAuth true requires the x-cron-secret header to equal CRON_SECRET_KEY (falling back to CRON_SECRET) through secretsEqual (SHA-256 digests compared with timingSafeEqual); an unset secret makes the check return false so the route fails closed with 401. No user session is used (requireAuth is false).',
  cat: 'EXTERNAL_TRUST',
  authz: 'The cron secret is the only check and it permits importing events into every organization; there is no role, organization or kernel decision. Only the x-cron-secret header is read, unlike the withApi cron routes, which also accept a Bearer value.',
  tenant: 'The due list spans every organization under withSystemContext (the union_eyes_system role) with active, enabled and due predicates and a limit of at most 100; each connection then runs in its own system transaction with the organization of the connection row, and a mapped local calendar is accepted only when its organizationId equals that organization.',
  owner: 'external_calendar_connections rows (sync times, status, error text), calendars and calendar_events rows of the organization, imported from the connection provider account of the member who connected it.',
  sens: 'External calendar event titles, times, attendees and locations imported from member provider accounts, provider sync state and provider error messages',
  priv: 'Imported provider events are written into organization calendars and provider error text is stored on the connection and returned in the cron response to the caller holding the secret.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'For each connection the imported events, the connection sync state and persistAtomicAudit (calendar_sync.connection.sync) commit together in one system transaction, because the module-level db handle the import services use is routed to that transaction; a failure rolls the connection back and a second transaction records the failure state with its own atomic audit record.',
  reqAudit: 'Keep the in-transaction audit record per connection and add the per-event failures to it so a partial import is visible.',
  does: 'Selects up to the requested limit (default 25, at most 100) of due Google or Microsoft connections, imports events for each mapping through the provider service in one system transaction per connection, sets lastSyncAt and nextSyncAt and records a synced audit record, or marks the connection failed with the error and a retry time; it answers a success envelope with counts and the failures.',
  status: 'PARTIAL',
  gate: 14,
  deps: [9, 13],
  future: 'Claim due connections under a lock, follow provider paging and the stored sync token, record per-event failures instead of discarding them, and give the scheduler a method and secret header the route accepts.',
  ev: [
    hh(a, 'authentication', '}, { cronAuth: true, requireAuth: false })'),
    ...guardEv(a, 'withApiAuth'),
    a.imp('authorization', 'withApiAuth', 'if (!verifyCronAuth(request)) {'),
    a.svc('authentication', API_GUARD, "const cronSecret = request.headers.get('x-cron-secret');", 'verifyCronAuth'),
    a.svc('authorization', API_GUARD, 'if (!expectedSecret) {', 'verifyCronAuth'),
    a.svc('authorization', API_GUARD, 'return secretsEqual(cronSecret ?? \'\', expectedSecret);', 'verifyCronAuth'),
    a.svc('authentication', SECRET, 'return timingSafeEqual(left, right)'),
    hh(a, 'tenantScope', '// The due list spans every organization, which only system authority may read.'),
    hh(a, 'tenantScope', 'const dueConnections = await withSystemContext(async (tx) =>'),
    a.local('tenantScope', 'processConnection', 'eq(calendars.organizationId, connection.organizationId),'),
    a.imp('tenantScope', 'withSystemContext', SYSTEM_TX_QUOTE),
    hh(a, 'mutation', '.limit(limit)'),
    a.local('mutation', 'processConnection', '.update(externalCalendarConnections)'),
    a.local('audit', 'processConnection', 'await persistAtomicAudit(tx, {'),
    a.local('audit', 'processConnection', "action: 'calendar_sync.connection.sync',"),
    hh(a, 'behavior', 'await recordFailure(connection, message)'),
    a.local('behavior', 'processConnection', "syncStatus: 'synced',"),
    a.svc('defect', GOOGLE, 'params.maxResults = 2500;', 'importGoogleEvents'),
    a.svc('defect', GOOGLE, 'const response = await calendar.events.list(params);', 'importGoogleEvents'),
    a.svc('defect', GOOGLE, '} catch (_error) {', 'importGoogleEvents'),
    a.svc('defect', GOOGLE, 'deletedCount++;', 'importGoogleEvents'),
    a.svc('defect', GOOGLE, '} catch (_error) {', 'handleDeletedGoogleEvent'),
  ],
  inf: [
    { claim: 'defect', statement: 'vercel.json lists /api/cron/calendar-sync with a schedule and no method or header, the route file exports POST only, and verifyCronAuth reads x-cron-secret and no Authorization header, so a trigger that issues GET or sends the secret as a Bearer value does not reach the handler.' },
    { claim: 'defect', statement: 'importGoogleEvents calls events.list once with maxResults 2500 and never reads nextPageToken, the route passes timeMin and timeMax and no syncToken, the per-event and cancelled-event catch blocks are empty, and deletedCount is incremented after the cancelled-event handler returns whether or not it succeeded; the due-list select takes no row lock and nextSyncAt is written only after the whole connection is processed.' },
  ],
  def: [
    'DEF-0B6-SYS-CALENDAR-SYNC-SCHEDULE-ENTRY-DOES-NOT-MATCH-ROUTE-CONTRACT',
    'DEF-0B6-SYS-CALENDAR-SYNC-SWALLOWED-EVENT-ERRORS-COUNTED-AS-IMPORTED',
    'DEF-0B6-SYS-CALENDAR-SYNC-FIRST-PAGE-ONLY-AND-NO-CLAIM-OF-DUE-CONNECTIONS',
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: document-intake-reaper                                                                                  */
/* ------------------------------------------------------------------------------------------------------------ */

const reaperBase = (a) => ({
  ...base(a),
  persona: 'Scheduled job runner expiring lapsed document upload intakes and deleting the stored objects of cancelled and expired ones',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CRON_AUTHZ,
  tenant: 'The expiry and finalization queries run under withSystemContext across every organization by design; every update and audit record then carries the organization of the intake row, and the object key is read from the row, never from the request.',
  owner: 'document_intakes rows (status, object state, deletion attempts and error) and the stored objects behind them; accepted intakes are not selectable.',
  sens: 'Upload intake state and storage keys of every organization; the response carries only counts',
  priv: 'No personal data is returned; the job deletes storage objects of abandoned uploads and records a sanitized error on the intake row.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: 6,
  deps: [9, 13],
  future: 'Give the job a POST-only trigger, report intakes that exhausted their deletion attempts, and keep the lock, state machine and per-state audit records.',
  ev: [
    ...withApiCronEv(a),
    a.svc('tenantScope', WITH_RLS, SYSTEM_TX_QUOTE, 'withSystemContext'),
    a.svc('tenantScope', INTAKE, '.for(\'update\', { skipLocked: true });', 'expireDueIntakes'),
    a.svc('mutation', INTAKE, '.update(documentIntakes)', 'expireDueIntakes'),
    a.svc('audit', INTAKE, "action: 'document.intake.expire',", 'expireDueIntakes'),
    a.svc('behavior', INTAKE, 'await storage.remove(claimed.key);', 'finalizeIntakeObjects'),
    a.svc('behavior', INTAKE, "action: 'document.intake.object_deleted',", 'finalizeIntakeObjects'),
    a.svc('defect', INTAKE, 'sql`${documentIntakes.deletionAttempts} < ${INTAKE_MAX_DELETION_ATTEMPTS}`,', 'finalizeIntakeObjects'),
  ],
  inf: [
    { claim: 'defect', statement: 'The candidate select requires deletionAttempts below INTAKE_MAX_DELETION_ATTEMPTS and the failure branch increments the attempts, so a row that reaches the limit is never selected again; the report counts only this run, and no code in the handler lists or alerts on rows at the limit.' },
  ],
  def: ['DEF-0B6-SYS-REAPER-OBJECTS-PAST-RETRY-LIMIT-ARE-ABANDONED-UNREPORTED'],
})

const reaperPost = (a) => mk({
  ...reaperBase(a),
  priv: 'No personal data is returned; the job deletes storage objects of abandoned uploads and records a sanitized error on the intake row.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'Each expiry commits the status change and persistAtomicAudit (document.intake.expire) in one system transaction under the system reaper actor, and each object outcome commits the object state and an audit record (object_deleted or object_deletion_failed) in a later transaction; the storage deletion itself is outside any database transaction and is bracketed by the deletion_pending claim.',
  reqAudit: 'Keep the per-state audit records and the claim before the storage call; add the intake age and the key hash to the object_deleted record.',
  does: 'Expires up to 200 open intakes past their expiry under a skip-locked row lock, then claims up to 100 cancelled or expired intakes whose object is still present, deletes exactly the key the row records, and records deleted or deletion_failed with an audit record; it returns the counts expired, objectsDeleted, deletionFailed and skipped.',
})

const reaperGet = (a) => mk({
  ...reaperBase(a),
  mut: 'NONE',
  auditDetail: `A GET that writes: the GET export is the POST handler, so it expires intakes and deletes stored objects, and each state change commits its own persistAtomicAudit record in the service transaction. ${GET_WRITE_VOCABULARY}`,
  reqAudit: 'Keep the per-state in-transaction audit records and give the job a POST-only trigger so a probe or prefetch cannot run it.',
  does: 'Runs the same reaper as the POST: expires lapsed open intakes and deletes the stored objects of cancelled and expired intakes, returning the counts, when called with GET.',
  ev: [
    ...reaperBase(a).ev,
    a.svc('mutation', INTAKE, 'await storage.remove(claimed.key);', 'finalizeIntakeObjects'),
    hh(a, 'defect', 'async () => ({ ...(await runIntakeReaper(blobIntakeStorage)) }),'),
  ],
  def: ['DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES', 'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY', 'DEF-0B6-SYS-REAPER-OBJECTS-PAST-RETRY-LIMIT-ARE-ABANDONED-UNREPORTED'],
  corr: [cronAliasCorrection],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: external-data-sync                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const extSyncBase = (a) => ({
  ...base(a),
  persona: 'Scheduled job runner refreshing the shared Statistics Canada wage, union density, cost-of-living and contribution-rate reference data',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CRON_AUTHZ} The route is also listed in CRON_API_ROUTES, so the edge checks the secret first.`,
  tenant: 'None by organization, by design: the wage, density, cost-of-living and contribution tables are global reference data with no organization column, and the job writes them for every organization at once; the wage, density and COLA parts run in withSystemContext, the contribution part does not.',
  owner: 'wage_benchmarks, union_density, cost_of_living_data and contribution_rates rows and external_data_sync_log rows; global rows with no organization.',
  sens: 'Published statistical wage, density, cost-of-living and EI and CPP contribution figures and sync log rows; no member or organization data',
  priv: 'No personal data is read, written or returned; the response carries counts and the error strings of failed sources.',
  status: 'PARTIAL',
  gate: 14,
  deps: [9, 13],
  future: 'Return a failure status when a source fails, record failed and partial runs in the sync log, run every part under the system role, bound the schedule to the documented monthly and weekly cadence, and give the job a POST-only trigger.',
  dec: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...withApiCronEv(a),
    a.sch('tenantScope', WAGE_SCHEMA, /pgTable\(/, { symbol: 'wageBenchmarks', absentColumns: ['organizationId'] }),
    a.svc('tenantScope', WAGE, 'return withSystemContext(async (tx) => {', 'WageEnrichmentService.syncWageData'),
    hh(a, 'mutation', 'const wageResults = await wageEnrichmentService.syncWageData({'),
    hh(a, 'mutation', 'const contributionResults = await wageEnrichmentService.syncContributionRates();'),
    a.svc('behavior', WAGE, 'await db.insert(externalDataSyncLog).values({', 'WageEnrichmentService.createSyncLog'),
    a.svc('defect', WAGE, 'async syncContributionRates(year?: number): Promise<SyncResult> {', 'WageEnrichmentService.syncContributionRates'),
    a.svc('defect', WAGE, 'await db.insert(contributionRates).values({', 'WageEnrichmentService.syncContributionRates'),
    a.svc('defect', WAGE, "status: 'completed',", 'WageEnrichmentService.syncWageData'),
    a.svc('defect', WAGE, 'success: recordsFailed === 0,', 'WageEnrichmentService.syncWageData'),
    hh(a, 'defect', 'results.summary.success = results.errors.length === 0;'),
    hh(a, 'defect', "summary: { totalProcessed: 0, totalInserted: 0, totalUpdated: 0, totalFailed: 0, success: false, duration: Date.now() - startTime },"),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler returns the results object or the failure object as a plain return value, and withApi wraps a plain return in an HTTP 200 envelope, so a failed run answers 200 with success false; the update of the sync log row sets status completed in the success path whatever recordsFailed holds and passes no error list, so the log row cannot show a partial run.' },
    { claim: 'defect', statement: 'syncWageData, syncUnionDensity and syncCOLAData wrap their work in withSystemContext, while syncContributionRates calls createSyncLog, db.select, db.update and db.insert directly with no withSystemContext, so the contribution part of the job uses the module-level tenant db handle.' },
    { claim: 'defect', statement: 'proxy.ts lists /api/cron/external-data-sync in CRON_API_ROUTES and compares the x-cron-secret header with process.env.CRON_SECRET using !==, while the handler reads CRON_SECRET_KEY first and accepts a Bearer value, and the ue-v2 apps.bicep defines CRON_SECRET_KEY for the application, so the edge may refuse a caller the handler would accept and the edge comparison is not constant time.' },
  ],
})

const extSyncPost = (a) => mk({
  ...extSyncBase(a),
  mut: 'NONE',
  auditDetail: 'The job writes external_data_sync_log rows as its own run record and inserts or updates the wage, density, COLA and contribution rows; it writes no audit_log record, the sync log stores no error list and marks a run with failed records as completed, and the contribution part is outside the system transaction of the other parts.',
  reqAudit: 'Record each run (source, counts, failures, status) in the same system transaction as the rows it writes and mark a run with failures as partial or failed.',
  does: 'Runs four syncs in sequence against Statistics Canada (wages for 19 NOC codes at national geography, union density, COLA for the last three years and contribution rates), collects each failure into an errors list, sets summary.success to whether the list is empty, and returns the results object; any unexpected failure returns a failure object, and every case answers HTTP 200.',
  def: [
    'DEF-0B6-SYS-EXTERNAL-DATA-SYNC-FAILURES-ANSWER-HTTP-200-AND-LOG-COMPLETED',
    'DEF-0B6-SYS-EXTERNAL-DATA-SYNC-CONTRIBUTIONS-WRITE-OUTSIDE-SYSTEM-CONTEXT',
    'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY',
    'DEF-0B6-SYS-CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK',
  ],
  ev: [
    ...extSyncBase(a).ev,
    a.svc('audit', WAGE, 'await db.update(externalDataSyncLog)', 'WageEnrichmentService.updateSyncLog'),
    a.svc('defect', WITH_API, "const expected = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';"),
  ],
  corr: [],
})

const extSyncGet = (a) => mk({
  ...extSyncBase(a),
  mut: 'NONE',
  auditDetail: `A GET that writes: the GET export is the POST handler, so it calls Statistics Canada and inserts or updates the shared reference tables and the sync log; no audit_log record is written. ${GET_WRITE_VOCABULARY}`,
  reqAudit: 'Record each run in the sync log in the same transaction as the rows it writes and give the job a POST-only trigger.',
  does: 'Runs the same four-source sync as the POST when called with GET, which the file comment describes as the scheduled method; it fetches external data and writes the shared reference tables.',
  ev: [
    ...extSyncBase(a).ev,
    a.svc('mutation', WAGE, 'await db.insert(contributionRates).values({', 'WageEnrichmentService.syncContributionRates'),
    a.svc('audit', WAGE, 'await db.update(externalDataSyncLog)', 'WageEnrichmentService.updateSyncLog'),
    a.svc('defect', WITH_API, "const expected = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';"),
  ],
  def: [
    'DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES',
    'DEF-0B6-SYS-EXTERNAL-DATA-SYNC-FAILURES-ANSWER-HTTP-200-AND-LOG-COMPLETED',
    'DEF-0B6-SYS-EXTERNAL-DATA-SYNC-CONTRIBUTIONS-WRITE-OUTSIDE-SYSTEM-CONTEXT',
    'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY',
    'DEF-0B6-SYS-CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK',
  ],
  corr: [cronAliasCorrection],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: location-retention                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const locationBase = (a) => ({
  ...base(a),
  persona: 'Scheduled job runner enforcing the 24-hour retention of member location points and geofence events',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CRON_AUTHZ,
  tenant: 'None by organization: location_tracking and geofence_events have no organization column and the job deletes every member row whose expires_at has passed, under withSystemContext, so retention covers all members of all organizations; no organization predicate exists or is possible.',
  owner: 'location_tracking and geofence_events rows of every member (expired rows only) and one location_deletion_log row per run that deleted anything.',
  sens: 'Member latitude, longitude, accuracy and altitude points and geofence entry and exit events; the deletion log holds a count and run time only',
  priv: 'Location history is permanently deleted once expired; the job returns only the two deletion counts. The deletion log does not say whose data was deleted or from what dates.',
  status: 'PARTIAL',
  gate: 6,
  deps: [9, 13],
  future: 'Give the job a POST-only trigger and a scheduler entry, record the real oldest and newest deleted dates and the affected member count, attribute each deletion to an organization, write an audit record in the same transaction and bound each run.',
  ev: [
    ...withApiCronEv(a),
    hh(a, 'tenantScope', 'async () => ({'),
    a.svc('tenantScope', WITH_RLS, SYSTEM_TX_QUOTE, 'withSystemContext'),
    a.sch('tenantScope', GEO_SCHEMA, /pgTable\(/, { symbol: 'locationTracking', absentColumns: ['organizationId'] }),
    a.svc('mutation', GEO, '.delete(locationTracking)', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('audit', GEO, 'await tx.insert(locationDeletionLog).values({', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('behavior', GEO, '.where(lte(locationTracking.expiresAt, now));', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('behavior', GEO, 'deletionReason: "24-hour retention policy (automatic cleanup)",', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('defect', GEO, 'oldestRecordDate: now,', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('defect', GEO, 'newestRecordDate: now,', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.svc('defect', GEO, 'for (const userId of userIds) {', 'GeofencePrivacyService.deleteExpiredLocationData'),
    a.sch('defect', GEO_SCHEMA, /oldestRecordDate: timestamp\("oldest_record_date"\),/, { symbol: 'locationDeletionLog' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The delete loop assigns the run time now to oldestRecordDate and newestRecordDate although the select read no recorded_at value, and the insert carries no organization or member list; location_deletion_log has no organization column, so the log cannot be attributed to an organization or show the span it deleted.' },
    { claim: 'defect', statement: 'The route comment says the job runs hourly, but apps/union-eyes/vercel.json lists only /api/cron/calendar-sync and infrastructure/bicep/ue-v2/modules/apps.bicep calls only /api/cron/deadline-reminders, so nothing in the repository invokes this handler and expired rows persist until a trigger outside the source calls it.' },
    { claim: 'defect', statement: 'The two selects have no limit and collect every expired user id; the per-user deletes all run on the one system transaction passed by the route, so a backlog is one transaction.' },
  ],
  def: ['DEF-0B6-SYS-LOCATION-RETENTION-HAS-NO-SCHEDULER-IN-REPOSITORY', 'DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION', 'DEF-0B6-SYS-LOCATION-RETENTION-BATCH-UNBOUNDED-IN-ONE-TRANSACTION'],
})

const locationPost = (a) => mk({
  ...locationBase(a),
  mut: 'NONE',
  auditDetail: 'Every per-user delete and the location_deletion_log insert commit or roll back together in the system transaction, so evidence of a deletion cannot be lost on failure; the log row is a deletion record, not an audit_log record, and it carries fabricated oldest and newest dates and no organization.',
  reqAudit: 'Write an audit_log record per run in the same transaction, naming the real oldest and newest deleted dates and the number of affected members.',
  does: 'Selects member ids with expired location points and geofence events, deletes each member expired rows from both tables in one system transaction and, when any row was deleted, inserts one location_deletion_log row; it returns the two deleted counts.',
})

const locationGet = (a) => mk({
  ...locationBase(a),
  mut: 'NONE',
  auditDetail: `A GET that deletes: the GET export is the POST handler, so it permanently deletes expired location rows, with the deletion log insert in the same transaction and no audit_log record. ${GET_WRITE_VOCABULARY}`,
  reqAudit: 'Give the retention job a POST-only trigger and write an audit_log record per run in the same transaction.',
  does: 'Runs the same retention as the POST when called with GET: it deletes expired member location points and geofence events and records one deletion log row.',
  ev: [...locationBase(a).ev, hh(a, 'defect', 'export const GET = handler;')],
  def: [...locationBase(a).def, 'DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES'],
  corr: [cronAliasCorrection],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: monthly-per-capita                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const perCapitaBase = (a) => ({
  ...base(a),
  persona: 'Scheduled job runner calculating per-capita remittances owed by every active organization with a parent and a configured rate, and marking late ones overdue',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CRON_AUTHZ} The route is also listed in CRON_API_ROUTES, so the edge checks the secret first.`,
  tenant: 'The job reads every active organization with a parent and writes per_capita_remittances rows for each, each write under withSystemContext with the remitting organization as organization_id and every audit record attributed to that organization; the fan-out is by design a cross-organization system operation and every update carries the organization predicate.',
  owner: 'per_capita_remittances rows owned by the remitting organization, naming the receiving parent organization, month, year, member counts, rate, total and status.',
  sens: 'Per-capita member counts and amounts owed between affiliated organizations, and good-standing member counts per organization',
  priv: 'No personal member data is returned; member counts and monetary amounts owed by each organization are computed and stored, and the response returns the totals of the run.',
  status: 'PARTIAL',
  gate: 5,
  deps: [9, 13],
  future: 'Hold the job until the affiliate remittance model and the financial officer decision exist, report failed organizations instead of success true, return the number marked overdue once, and give the job a POST-only trigger.',
  ev: [
    ...withApiCronEv(a),
    a.svc('tenantScope', PERCAP, 'organizationId: calc.fromOrganizationId,', 'savePerCapitaRemittances'),
    a.svc('tenantScope', WITH_RLS, SYSTEM_TX_QUOTE, 'withSystemContext'),
    hh(a, 'mutation', 'const result = await processMonthlyPerCapita();'),
    a.svc('mutation', PERCAP, '.update(perCapitaRemittances)', 'markOverdueRemittances'),
    a.svc('audit', PERCAP, 'await persistAtomicAudit(tx, {', 'markOverdueRemittances'),
    a.svc('audit', PERCAP, "action: 'per_capita.remittance.mark_overdue',", 'markOverdueRemittances'),
    a.svc('audit', PERCAP, "action: existing ? 'per_capita.remittance.recalculate' : 'per_capita.remittance.calculate',", 'savePerCapitaRemittances'),
    a.svc('behavior', PERCAP, "if (existing.status !== 'pending') return false;", 'savePerCapitaRemittances'),
    hh(a, 'defect', 'const overdueCount = await markOverdueRemittances();'),
    a.svc('defect', PERCAP, 'const overdueMarked = await markOverdueRemittances();'),
    hh(a, 'defect', 'success: true,'),
    a.svc('defect', PERCAP, '} catch (_error) {'),
    a.svc('defect', PERCAP, 'errors++', 'savePerCapitaRemittances'),
    a.sch('scope', PER_CAPITA_SCHEMA, /perCapitaRemittances = pgTable\(/),
  ],
  inf: [
    { claim: 'defect', statement: 'The capability registry (lib/reality/capability-registry.ts) records UE-FIN-AFFILIATE-REMITTANCES, titled CLC / National / federation affiliate remittances, with state NOT_IMPLEMENTED and notes that a qualified model with institutional recipients, payable and receivable recognition and acknowledgment is required, while this job inserts and updates per_capita_remittances rows for those affiliates.' },
    { claim: 'defect', statement: 'The handler returns success true as a literal after both calls return; processMonthlyPerCapita catches nothing but rethrows, calculateAllPerCapita discards a failed organization in an empty catch, savePerCapitaRemittances only increments errors, and processMonthlyPerCapita already ran markOverdueRemittances, so the top-level overdueMarked is the second sweep and the true count is in calculation.overdueMarked.' },
    { claim: 'defect', statement: 'proxy.ts lists /api/cron/monthly-per-capita in CRON_API_ROUTES and compares the x-cron-secret header with process.env.CRON_SECRET using !==, while the handler reads CRON_SECRET_KEY first and accepts a Bearer value, and neither vercel.json nor apps.bicep schedules this path.' },
  ],
  dec: [],
})

const PER_CAPITA_DEFECTS = [
  'DEF-0B6-SYS-PER-CAPITA-CRON-WRITES-A-DOMAIN-DECLARED-NOT-IMPLEMENTED',
  'DEF-0B6-SYS-PER-CAPITA-CRON-REPORTS-SUCCESS-AND-SWALLOWS-ORG-FAILURES',
  'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY',
  'DEF-0B6-SYS-CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK',
]

const perCapitaPost = (a) => mk({
  ...perCapitaBase(a),
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'Each organization remittance insert or recalculation commits with persistAtomicAudit (per_capita.remittance.calculate or recalculate) in one system transaction, and the overdue sweep updates the pending rows of one organization and commits persistAtomicAudit (per_capita.remittance.mark_overdue) in the same transaction; an organization whose write fails is counted in errors without a record.',
  reqAudit: 'Keep the in-transaction records and add a run record listing the organizations calculated, skipped and failed.',
  does: 'Calculates remittances for the current month for every active organization with a parent and a positive per-capita rate, inserts or recalculates a pending remittance per organization (a submitted, paid or overdue one is left alone), marks pending remittances past the grace period overdue, then runs the overdue sweep again; it answers success true with the counts.',
  def: PER_CAPITA_DEFECTS,
})

const perCapitaGet = (a) => mk({
  ...perCapitaBase(a),
  mut: 'NONE',
  auditDetail: `A GET that writes: the GET export is the POST handler, so it inserts and updates per_capita_remittances rows for every remitting organization, each with its own persistAtomicAudit record in the service transaction. ${GET_WRITE_VOCABULARY}`,
  reqAudit: 'Keep the in-transaction records and give the job a POST-only trigger.',
  does: 'Runs the same monthly calculation as the POST when called with GET, which the file comment describes as the scheduled method: it writes remittance rows and marks late ones overdue.',
  def: [...PER_CAPITA_DEFECTS, 'DEF-0B6-SYS-CRON-GET-ALIASES-RUN-STATE-CHANGES'],
  corr: [cronAliasCorrection],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: observability-alerts                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const observabilityAlertsPost = (a) => mk({
  ...base(a),
  persona: 'Scheduled job runner checking the last 60 minutes of SLA-risk predictions, failed ingestion batches and failed payments of every organization and emitting alerts',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CRON_AUTHZ,
  tenant: 'Three aggregate queries run under withSystemContext across every organization and group by organization_id; each signal then creates the rule, execution, notification and audit record under that organization id, and no tenant data other than counts leaves the service.',
  owner: 'alert_rules, alert_executions, notification_tracking and in_app_notifications rows of each organization that has a signal, and the audit record of each emitted alert.',
  sens: 'Per-organization counts of high-risk SLA breach predictions, failed ingestion batches and failed payments in the last hour, and the alert text',
  priv: 'No personal data is returned; the response carries the number of emitted alerts by kind. The in-app alert is addressed to a pseudo-user and the tracking row names no recipient.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'Each emitted alert commits persistAtomicAudit (observability.alert.emit) in the sweep system transaction, and the rule, execution, tracking and in-app writes go through the module-level db handle that is routed to that transaction; the route also writes a separate auditLog event (SYSTEM_SECURITY_ALERT) after the sweep, which is not part of the transaction.',
  reqAudit: 'Keep the in-transaction alert audit record and record the recipients each alert was addressed to and whether each channel delivered.',
  does: 'Counts SLA-breach predictions of 0.80 or more, failed or partial ingestion batches and failed platform payments in the last 60 minutes per organization, creates a realtime alert rule per organization and kind if absent, writes for every signal an alert execution marked success with channels email and in_app and executionTimeMs 1, a pending notification tracking row and an in-app notification for a pseudo-user, audits it, then records a separate security audit event and returns the counts.',
  status: 'PARTIAL',
  gate: 14,
  deps: [9, 11, 13],
  future: 'Record an execution as success only after the channel has delivered, address alerts to named organization recipients, suppress a repeat of the same condition within the window, wire a sender for the tracking rows, and give the scheduler an entry.',
  dec: ['UE-INST-OBSERVABILITY-ALERT-OWNER'],
  ev: [
    ...withApiCronEv(a),
    a.svc('tenantScope', WITH_RLS, SYSTEM_TX_QUOTE, 'withSystemContext'),
    a.svc('tenantScope', OBS, 'GROUP BY organization_id', 'runRealtimeObservabilitySweep'),
    a.svc('mutation', OBS, '.insert(alertExecutions)', 'emitSignal'),
    a.svc('mutation', OBS, 'await db.insert(notificationTracking).values({', 'emitSignal'),
    a.svc('audit', OBS, 'await persistAtomicAudit(tx, {', 'emitSignal'),
    a.svc('audit', OBS, "action: 'observability.alert.emit',", 'emitSignal'),
    hh(a, 'audit', 'await auditLog({'),
    a.svc('behavior', OBS, "AND created_at >= NOW() - INTERVAL '60 minutes'", 'runRealtimeObservabilitySweep'),
    a.svc('defect', OBS, "status: 'success',", 'emitSignal'),
    a.svc('defect', OBS, 'executionTimeMs: 1,', 'emitSignal'),
    a.svc('defect', OBS, "channels: ['email', 'in_app'],", 'emitSignal'),
    a.svc('defect', OBS, "status: 'pending',", 'emitSignal'),
    a.svc('defect', OBS, "userId: 'system:observability-alerts',", 'emitSignal'),
    a.svc('defect', OBS, "frequency: 'every_occurrence',", 'getOrCreateRealtimeRule'),
    a.svc('defect', OBS, 'for (const signal of signals) {', 'runRealtimeObservabilitySweep'),
  ],
  inf: [
    { claim: 'defect', statement: 'actionsExecuted names email and in_app and the execution is inserted with status success and a literal executionTimeMs 1 before the notification rows are written; the e-mail leg is a notification_tracking row with status pending, notification-service names that table only in a comment (it sends from notification_queue) and the process-notifications cron answers HTTP 501, so no code in the repository sends the e-mail the execution says was executed.' },
    { claim: 'defect', statement: 'The in-app notification takes userId from a string literal, the tracking row sets no user or recipient field, and the rule is created with no recipient configuration, so no organization member is the recipient; and no select of earlier alert_executions precedes the insert, so the same 60-minute count produces a new set of rows on every run while the rule frequency is every_occurrence.' },
  ],
  def: [
    'DEF-0B6-SYS-OBSERVABILITY-SWEEP-RECORDS-EMAIL-SUCCESS-WITHOUT-SENDING',
    'DEF-0B6-SYS-OBSERVABILITY-SWEEP-ALERT-HAS-NO-HUMAN-RECIPIENT',
    'DEF-0B6-SYS-OBSERVABILITY-SWEEP-NO-DEDUPE-REPEATS-EVERY-RUN',
    'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY',
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* cron: sla-watchdog                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const slaWatchdogPost = (a) => mk({
  ...base(a),
  persona: 'Scheduled job runner (documented as every minute) checking every open claim of every organization against its service-level deadline',
  authn: CRON_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CRON_AUTHZ,
  tenant: 'The claim select runs under withSystemContext across every organization with a status predicate only; each emitted event and each per-organization metric then carries the organization id of the claim, and the job writes no tenant table.',
  owner: 'claims rows (read only) of every organization, in-process claim_events events, and pilot metric rows of organizations with an active union-eyes pilot.',
  sens: 'Claim ids, numbers, statuses, priorities, assignees and computed SLA deadlines of every organization, carried in event payloads, and per-organization breach and compliance counts',
  priv: 'No personal data is returned; the response carries the scanned, at-risk and breached counts, and event payloads carry the assignee id and claim number onto an in-process bus.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The handler writes no tenant table: it selects claims, emits events on an in-process bus and hands pilot metric counts to a service that records them only for organizations with an active pilot.',
  auditDetail: 'The handler writes no row and no audit record of its own; the pilot metric service inserts a metric row and a separate audit_log row as two statements for organizations with an active pilot, and the run is otherwise visible only as a logger.info line.',
  reqAudit: 'Record each breach or at-risk detection as a durable row and notification with the claim id, in one transaction, so the detection is not an event that can be dropped.',
  does: 'Selects every claim not closed, resolved or rejected, computes each deadline from the claim updated time, priority and lifecycle state, emits sla_breached or sla_at_risk and sla_breach_risk events on the in-process event bus, aggregates counts per organization, fires pilot metric writes without awaiting them and returns the scanned, at-risk and breached counts.',
  status: 'PARTIAL',
  gate: 10,
  deps: [9, 13],
  future: 'Persist detections and notify the assigned steward, compute the deadline from a status-changed time, bound the scan, await or queue the metric writes with an idempotency key, and give the scheduler an entry.',
  ev: [
    ...withApiCronEv(a),
    hh(a, 'tenantScope', 'const activeClaims = await withSystemContext(async () =>'),
    a.imp('tenantScope', 'withSystemContext', SYSTEM_TX_QUOTE),
    hh(a, 'tenantScope', "organizationId: c.organizationId ?? undefined,"),
    hh(a, 'mutation', ".where(sql`${claims.status} NOT IN ('closed', 'resolved', 'rejected')`),"),
    hh(a, 'audit', "logger.info('SLA watchdog run complete', {"),
    hh(a, 'behavior', 'eventBus.emit('),
    hh(a, 'behavior', "recordUnionEyesSlaWatchdog(orgId, counts.breached, counts.atRisk, watchdogTraceId).catch("),
    a.svc('behavior', PILOT, 'if (!pilotId) return', 'emitUnionEyesMetric'),
    hh(a, 'defect', 'const changedAt = c.updatedAt ?? c.createdAt ?? now'),
    a.svc('defect', EVENT_BUS, "logger.debug('No subscribers for event', { eventType });"),
    a.svc('defect', EVENT_BUS, 'private subscribers = new Map<string, Set<EventSubscription>>();'),
    a.tbl('defect', 'claims', /updatedAt: timestamp\("updated_at", \{ withTimezone: true \}\)\.defaultNow\(\)/),
    hh(a, 'defect', "const watchdogTraceId = `sla-watchdog:${now.toISOString()}`"),
  ],
  inf: [
    { claim: 'defect', statement: 'emit stores the event in the in-memory history and returns with a debug log when the type has no subscribers; the only eventBus.on registrations in apps/union-eyes (lib/events/pilot-event-listeners.ts) are for claim.created, claim.updated, user.logged_in and member.status_changed, and claim_events is emitted by this route and by lib/workflow-engine.ts but subscribed by nothing, so a breach produces no stored row and no notification.' },
    { claim: 'defect', statement: 'slaDeadline receives changedAt, which the loop sets from updatedAt, and the claims table defines updated_at (default now) and no status-changed column, so any update of the row moves the clock; the loop and the per-organization aggregation each recompute the same deadlines for every claim.' },
    { claim: 'defect', statement: 'recordUnionEyesSlaWatchdog and recordUnionEyesSlaCompliance are called without await and with .catch, the route passes no idempotency key and the pilot metric service inserts the metric row and a separate audit_log row as two statements, so the response can return before the writes finish and every run inserts new metric rows for organizations with an active pilot.' },
  ],
  def: [
    'DEF-0B6-SYS-SLA-WATCHDOG-EVENTS-HAVE-NO-SUBSCRIBER',
    'DEF-0B6-SYS-SLA-CLOCK-RESTARTS-ON-ANY-CLAIM-UPDATE',
    'DEF-0B6-SYS-SLA-WATCHDOG-UNBOUNDED-SCAN-AND-UNAWAITED-DUPLICATE-METRICS',
    'DEF-0B6-SYS-CRON-ROUTES-HAVE-NO-SCHEDULER-IN-REPOSITORY',
  ],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */

const FACTS = {
  'communications/webhooks/resend/route.ts|POST': resendWebhook,
  'contact/route.ts|POST': contactPost,
  'continuity/archives/route.ts|GET': continuityGet,
  'continuity/archives/route.ts|POST': continuityPost,
  'continuity/docs/route.ts|GET': continuityGet,
  'continuity/docs/route.ts|POST': continuityPost,
  'deprecations/route.ts|GET': deprecationsGet,
  'emergency/dashboard/route.ts|GET': emergencyDashboardGet,
  'cron/calendar-sync/route.ts|POST': calendarSyncPost,
  'cron/document-intake-reaper/route.ts|GET': reaperGet,
  'cron/document-intake-reaper/route.ts|POST': reaperPost,
  'cron/external-data-sync/route.ts|GET': extSyncGet,
  'cron/external-data-sync/route.ts|POST': extSyncPost,
  'cron/location-retention/route.ts|GET': locationGet,
  'cron/location-retention/route.ts|POST': locationPost,
  'cron/monthly-per-capita/route.ts|GET': perCapitaGet,
  'cron/monthly-per-capita/route.ts|POST': perCapitaPost,
  'cron/observability-alerts/route.ts|POST': observabilityAlertsPost,
  'cron/sla-watchdog/route.ts|POST': slaWatchdogPost,
}

export function facts(a, readText) {
  const id = `${a.route}|${a.method}`
  if (a.route === 'continuity/inheritance/route.ts') return inheritanceRecord(a, readText)
  const build = FACTS[id]
  if (!build) throw new Error(`no Gate 0B.6 system facts for ${id}`)
  return build(a)
}
