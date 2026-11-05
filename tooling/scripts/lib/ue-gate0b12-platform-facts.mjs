/**
 * Gate 0B.12 facts: the hand-written platform routes of the final tranche. Fourteen route files, 24 operations: the KPI
 * target routes (create, activate, summary), the legacy tenant and Django diagnostic routes, the queue status route, the
 * organization choices route, the v2 catch-all (five methods), the CUPE vocabulary routes (six), the triage designation
 * routes (list, grant, revoke), the two voice transcription routes and the workspace telemetry route. Every evidence item
 * is produced by `opAuthoring` from the exact handler, the helper or service it calls, or the resolved schema, and is
 * proved again by the validator. This tranche records the source; it repairs nothing and approves no route.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv, GET_WRITES } from './ue-gate0b4-fact-helpers.mjs'
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'

const KPI_CAP = 'UE-OMIT-KPI-TARGET-CONFIGURATION'
const LEGACY_CAP = 'UE-OMIT-LEGACY-COMPATIBILITY-AND-DIAGNOSTIC-ROUTES'
const VOCAB_CAP = 'UE-OMIT-CUPE-VOCABULARY-REFERENCE-DATA'
const VOICE_CAP = 'UE-OMIT-VOICE-TRANSCRIPTION'
const ORG_SESSION_CAP = 'UE-CAP-A-003'
const OPS_CAP = 'UE-OMIT-PLATFORM-OPERATOR-CONTROLS'
const REP_CAP = 'UE-OMIT-REPRESENTATION-PROTOCOL-POLICY'
const PILOT_CAP = 'UE-OMIT-PILOT-PROGRAM-OPERATIONS'

const GATE = {
  [KPI_CAP]: 14,
  [LEGACY_CAP]: 14,
  [VOCAB_CAP]: 14,
  [VOICE_CAP]: 14,
  [ORG_SESSION_CAP]: 1,
  [OPS_CAP]: 9,
  [REP_CAP]: 2,
  [PILOT_CAP]: 14,
}

const D_KPI = 'UE-INST-KPI-TARGET-OWNER-AND-CALCULATION-RULE'
const D_LEGACY = 'UE-INST-LEGACY-COMPATIBILITY-AND-DIAGNOSTIC-ROUTE-DISPOSITION'
const D_VOCAB = 'UE-INST-CUPE-VOCABULARY-AUTHORITY-AND-SERVICE-LEVELS'
const D_VOICE = 'UE-INST-VOICE-RECORDING-CONSENT-RETENTION-AND-PROCESSOR'
const D_QUEUE = 'UE-INST-QUEUE-STATUS-READERS-AND-SERVICE-CREDENTIAL'
const D_LINKING = 'UE-INST-MEMBERSHIP-LINKING-BY-EMAIL-AND-LEGACY-IDENTITY'
const D_TRIAGE = 'UE-INST-TRIAGE-DESIGNATION-ELIGIBILITY-AND-EXPIRY-RECORD'
const D_ROSTER = 'UE-INST-ORGANIZATION-ROSTER-AND-ROLE-GRANT-AUTHORITY'
const D_REPRESENTATION = 'UE-INST-REPRESENTATION-AUTHORITY-SOURCE'

const ANALYTICS_SCHEMA = `${APP}db/schema/analytics.ts`
const TARGETS_CONSOLE = `${APP}components/targets/targets-console.tsx`
const CANONICAL_BOOTSTRAP = `${APP}lib/auth/canonical-bootstrap.ts`
const DEPRECATION = `${APP}lib/api/deprecation.ts`
const USER_ROLE_SELECT = `${APP}components/admin/user-role-select.tsx`
const DUES_REPORTS_PAGE = `${APP}app/[locale]/dashboard/admin/dues/reports/page.tsx`
const CLC_STAFF_PAGE = `${APP}app/[locale]/dashboard/clc/staff/page.tsx`
const CONTROL_PLANE_TELEMETRY = 'apps/control-plane/app/api/control-plane/modules/union-eyes/telemetry/route.ts'
const DESIGNATIONS = `${APP}lib/triage/designations.ts`
const CASE_AUTHORIZATION = `${APP}lib/cases/case-authorization.ts`
const AUTHORITY_REGISTER = `${APP}lib/authority/subordinate-authority-register.ts`
const VOCAB_SOURCE = 'packages/cupe-vocabulary/src/vocabulary.ts'
const VOCAB_HOOK = `${APP}lib/hooks/useCUPEVocabulary.ts`
const VOICE_RECORDER = `${APP}components/voice-recorder.tsx`
const NEW_CLAIM_FORM = `${APP}components/claims/new-claim-form.tsx`
const AZURE_SPEECH = `${APP}lib/azure-speech.ts`
const WORKSPACE_HOOK = `${APP}lib/hooks/use-workspace-telemetry.ts`
const ENTITLEMENTS = `${APP}lib/services/entitlements.ts`

const TARGETS_ROUTE = `${API}targets/route.ts`
const ORG_ROUTE = `${API}users/me/organizations/route.ts`
const V2_ROUTE = `${API}v2/[...path]/route.ts`
const TEST_AUTH_ROUTE = `${API}test-auth/route.ts`
const QUEUE_ROUTE = `${API}union-eyes/queue-status/route.ts`
const VOICE_UPLOAD_ROUTE = `${API}voice/upload/route.ts`

export const ROUTES = new Set([
  'targets/route.ts',
  'targets/[id]/route.ts',
  'targets/summary/route.ts',
  'tenant/current/route.ts',
  'test-auth/route.ts',
  'triage-designations/route.ts',
  'union-eyes/queue-status/route.ts',
  'users/me/organizations/route.ts',
  'v2/[...path]/route.ts',
  'vocabulary/route.ts',
  'vocabulary/case-types/route.ts',
  'vocabulary/priorities/route.ts',
  'vocabulary/roles/route.ts',
  'vocabulary/severities/route.ts',
  'vocabulary/statuses/route.ts',
  'voice/transcribe/route.ts',
  'voice/upload/route.ts',
  'workspace/telemetry/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  PLATFORM_KPI_TARGETS: {
    capabilityId: KPI_CAP,
    domain: 'KPI_TARGET_CONFIGURATION_AND_HEALTH_SUMMARY',
    actor: 'Officer creating and switching on or off a key performance target of the organization, and member reading the target summary on the targets console',
    routes: ['targets/route.ts', 'targets/[id]/route.ts', 'targets/summary/route.ts'],
    evidence: [
      ev(ANALYTICS_SCHEMA, "metricType: text('metric_type').notNull(), // Links to analyticsMetrics.metricType"),
      ev(ANALYTICS_SCHEMA, "calculation: jsonb('calculation').notNull(), // Formula, aggregation method, filters"),
      ev(TARGETS_CONSOLE, "const res = await fetch('/api/targets/summary');"),
    ],
  },
  PLATFORM_ORGANIZATION_CHOICES: {
    capabilityId: ORG_SESSION_CAP,
    domain: 'SIGNED_IN_USER_ORGANIZATION_CHOICES_AND_LEGACY_MEMBERSHIP_LINKING',
    actor: 'Signed-in person choosing which organization to act in after sign-in, and the legacy lineage that links an existing membership row to a new sign-in identity by e-mail address',
    routes: ['users/me/organizations/route.ts'],
    evidence: [
      ev(CANONICAL_BOOTSTRAP, "const flag = process.env.UE_CANONICAL_BOOTSTRAP_V2"),
      ev(CANONICAL_BOOTSTRAP, "throw new Error('UE_CANONICAL_BOOTSTRAP_V2 must be 0 or 1')"),
      ev(ORG_ROUTE, 'Legacy PLATFORM_ADMIN_USER_IDS can still enumerate all organizations when V2 is off.'),
    ],
  },
  PLATFORM_LEGACY_TENANT_CURRENT: {
    capabilityId: LEGACY_CAP,
    domain: 'LEGACY_TENANT_CURRENT_COMPATIBILITY_WRAPPER',
    actor: 'Legacy client expecting the current organization with its name, slug, subscription tier and features',
    routes: ['tenant/current/route.ts'],
    evidence: [
      ev(`${API}tenant/current/route.ts`, ' * Legacy compat wrapper. All new code should use /api/org/current instead.'),
    ],
  },
  PLATFORM_AUTH_GATE_DIAGNOSTIC: {
    capabilityId: LEGACY_CAP,
    domain: 'DJANGO_AUTH_GATE_END_TO_END_DIAGNOSTIC',
    actor: 'Engineer confirming that the session token is accepted by the Django auth backend, calling a diagnostic route in a deployed application',
    routes: ['test-auth/route.ts'],
    evidence: [
      ev(TEST_AUTH_ROUTE, ' * End-to-end auth-gate test'),
      ev(TEST_AUTH_ROUTE, "const DJANGO = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';"),
    ],
  },
  PLATFORM_V2_CATCH_ALL: {
    capabilityId: LEGACY_CAP,
    domain: 'V2_MIRROR_CATCH_ALL_DEPRECATION_RESPONSE',
    actor: 'Client that still calls a removed /api/v2 path, such as the dues report page, the user role selector, the push device manager or the analytics consoles',
    routes: ['v2/[...path]/route.ts'],
    evidence: [
      ev(V2_ROUTE, ' * Catch-all deprecation route for /api/v2/*'),
      ev(DEPRECATION, 'export function goneResponse(deprecatedPath: string, reason: string): NextResponse {'),
      ev(USER_ROLE_SELECT, "const res = await fetch('/api/v2/admin/users/role', {"),
    ],
  },
  PLATFORM_QUEUE_STATUS: {
    capabilityId: OPS_CAP,
    domain: 'BACKGROUND_QUEUE_HEALTH_FOR_THE_CONTROL_PLANE',
    actor: 'Control plane service reading the background queue health of Union Eyes with the service key, and a signed-in user reading the same figures',
    routes: ['union-eyes/queue-status/route.ts'],
    evidence: [
      ev(QUEUE_ROUTE, "const svcKey = process.env.AI_SERVICE_KEY"),
      ev(CONTROL_PLANE_TELEMETRY, "if (EU_SERVICE_KEY) headers['x-service-key'] = EU_SERVICE_KEY"),
    ],
  },
  PLATFORM_TRIAGE_DESIGNATIONS: {
    capabilityId: REP_CAP,
    domain: 'TRIAGE_DESIGNATION_GRANT_LIST_AND_REVOKE',
    actor: 'Organization administrator granting, listing and revoking the explicit, expiring authority of a staff member to see and work the unassigned message or case queue',
    routes: ['triage-designations/route.ts'],
    evidence: [
      ev(DESIGNATIONS, 'export const TRIAGE_MAX_DAYS = 90'),
      ev(AUTHORITY_REGISTER, "record: 'Triage designations (messages and cases)',"),
    ],
  },
  PLATFORM_CUPE_VOCABULARY: {
    capabilityId: VOCAB_CAP,
    domain: 'CUPE_VOCABULARY_REFERENCE_DATA',
    actor: 'Client that loads the case types, priorities with service-level hours, severities, roles with permission flags and statuses with allowed transitions from the vocabulary routes',
    routes: [
      'vocabulary/route.ts',
      'vocabulary/case-types/route.ts',
      'vocabulary/priorities/route.ts',
      'vocabulary/roles/route.ts',
      'vocabulary/severities/route.ts',
      'vocabulary/statuses/route.ts',
    ],
    evidence: [
      ev(VOCAB_SOURCE, ' * v0.1: Hardcoded CUPE defaults loaded at startup.'),
      ev(VOCAB_SOURCE, "{ id: 'critical', label: 'Critical', slaHours: 24, escalationRequired: true }, // 1 day (safety, discrimination)"),
      ev(VOCAB_HOOK, " * Client-side hook for loading and caching CUPE vocabulary from /api/vocabulary"),
    ],
  },
  PLATFORM_VOICE_TRANSCRIPTION: {
    capabilityId: VOICE_CAP,
    domain: 'VOICE_RECORDING_TRANSCRIPTION',
    actor: 'Steward dictating a claim description on the new claim form, and a member uploading an audio file for transcription',
    routes: ['voice/transcribe/route.ts', 'voice/upload/route.ts'],
    evidence: [
      ev(NEW_CLAIM_FORM, '/** Voice transcription is a steward-and-above capability on the API; members never see the control. */'),
      ev(VOICE_RECORDER, 'const response = await fetch("/api/voice/transcribe", {'),
      ev(VOICE_UPLOAD_ROUTE, 'const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper API limit)'),
    ],
  },
  PLATFORM_WORKSPACE_TELEMETRY: {
    capabilityId: PILOT_CAP,
    domain: 'WORKSPACE_CLIENT_USAGE_TELEMETRY',
    actor: 'Signed-in member whose browser reports an allow-listed workspace usage event, and the programme owner who reads workspace usefulness',
    routes: ['workspace/telemetry/route.ts'],
    evidence: [
      ev(`${API}workspace/telemetry/route.ts`, ' *  - No new database table is introduced; events are logged PII-free.'),
      ev(WORKSPACE_HOOK, ' * Emits ONLY the allow-listed workspace events with a PII-free payload.'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_KPI,
    status: 'OUTSTANDING',
    question: 'Which office owns the key performance targets of an organization (who may create one, who may see its calculation and alert recipients, who may switch it off), which stored measurements are the source of each target (the data source and calculation a target declares), and in which direction is a threshold crossed (does a lower figure or a higher figure make a target critical)?',
    sourceState: 'The target routes let an officer create a target with a free-form calculation record and a data source name and switch it on or off, and let any member read every target with its calculation, alert recipients and creator; the summary takes the current value from the latest analytics_metrics row whose metric type text equals the target metric type, applies no data source or calculation, and treats a value at or below a threshold as the worse state. No source names the owner, the source records or the direction rule.',
    softwareOwners: [KPI_CAP],
  },
  {
    id: D_LEGACY,
    status: 'OUTSTANDING',
    question: 'What is the disposition of the legacy compatibility and diagnostic routes (the /api/v2 mirror catch-all, the legacy tenant current wrapper and the Django auth-gate test): are they removed, answered with 410 Gone or 501 for every method, or kept for a stated period, and may a diagnostic route that forwards the session token to a backend ship in a production build?',
    sourceState: 'The v2 catch-all answers every method with HTTP 200 and a deprecation body for any signed-in member, although the file that builds a 410 response (goneResponse) exists and is not called; the legacy tenant wrapper answers 200 with constant null values; the auth-gate test is a plain route that sends the session token to the configured Django address. No source states the sunset action, the replacement for each caller or the production position of the diagnostic.',
    softwareOwners: [LEGACY_CAP],
  },
  {
    id: D_VOCAB,
    status: 'OUTSTANDING',
    question: 'Who owns the CUPE vocabulary (case types, priority service-level hours, severity legal flags, role permission flags and the status transitions with the roles allowed to make them), is it a published institutional standard or a development default, how does a role named in it (chief steward, business agent) relate to the roles the application enforces, and who approves a change?',
    sourceState: 'The vocabulary package holds hard-coded defaults marked version 0.1.0 whose generated timestamp is the time of each call; the routes serve them to any signed-in user as reference data with a public one-hour cache header, and no code found enforces the role or status flags. No source names the owner, the approval or the relation to the enforced roles.',
    softwareOwners: [VOCAB_CAP],
  },
  {
    id: D_VOICE,
    status: 'OUTSTANDING',
    question: 'May a recording of a member or steward describing a claim be sent to an external speech service, on whose consent, under which processor agreement and in which region, is the recording or its transcript retained or discarded, who may transcribe, and is each transcription counted, limited and recorded?',
    sourceState: 'The transcribe route (steward floor) sends the uploaded audio to the Azure speech service with no rate limit, entitlement, consent or audit record; the upload route (member floor) applies a rate limit and an entitlement check and sends the audio to an Azure OpenAI Whisper deployment, and no caller of it exists in the application. No source states the consent, the processor terms, the retention or the readers.',
    softwareOwners: [VOICE_CAP],
  },
  {
    id: D_QUEUE,
    status: 'OUTSTANDING',
    question: 'Who may read the background queue health of Union Eyes (the pending and failed job counts, and the identifier and name of the recent failed tasks), which credential does the control plane present, and is a failed task name or error text an operator-only figure?',
    sourceState: 'The queue status route accepts the shared AI service key in a header or any signed-in session with no role floor, returns the queue counts and the task id and name of recent failures, and answers an error with the error text. No source names the readers or separates the control plane credential from the AI service key.',
    softwareOwners: [OPS_CAP],
  },
  {
    id: D_LINKING,
    status: 'OUTSTANDING',
    question: 'May an existing membership row be re-bound to a new sign-in identity because the e-mail address matches, who verifies that the address belongs to the person, may a row already bound to another identity be re-bound, and what record is kept of the re-binding?',
    sourceState: 'The legacy branch of the organization choices route, entered when UE_CANONICAL_BOOTSTRAP_V2 is not 1, sets user_id on every membership row whose e-mail equals the caller e-mail when the caller has no membership, and on every row of the legacy user id of a profile with that e-mail, with no condition on the row current user id, no verified-address check and no audit record. No source names the linking authority.',
    softwareOwners: [ORG_SESSION_CAP],
  },
  {
    id: D_TRIAGE,
    status: 'OUTSTANDING',
    question: 'Which staff are eligible for a messages designation and which for a cases designation, is the eligibility rule the same for both scopes, and is the end of a lapsed designation recorded as an audited decision of a person or as a system event?',
    sourceState: 'The grant route applies the case assignee eligibility test to a designation of either scope, while the message queue checks the conversation assignee roles when the designation is used; a lapsed designation is closed inside the next grant as revoked by system:expiry with no audit row. No source names the eligibility per scope or the record of expiry.',
    softwareOwners: [REP_CAP],
  },
]

const capabilityFields = {
  parentRegisterId: 'UE-CONV-K-006',
  relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
  sourceStatus: 'PARTIAL',
}

export const CAPABILITIES = [
  {
    id: KPI_CAP,
    ...capabilityFields,
    obligationKey: 'kpi-target-configuration',
    primaryGate: 14,
    dependencyGates: [8, 13],
    actor: 'Officer creating and switching on or off a key performance target of the organization, and the member or staff reading the target summary',
    businessOutcome: 'A key performance target names the stored measurement it is judged against and the direction in which a threshold is crossed, its current value is computed from that measurement and not from an unrelated row, only the office the institution names creates and changes targets, the calculation and alert recipients are readable only by that office, a target that promises an alert sends one, and every change commits with its audit record.',
    apiRoute: 'app/api/targets',
    service: `${APP}app/api/targets/summary/route.ts`,
    sourceFiles: [
      `${APP}app/api/targets/route.ts`,
      `${APP}app/api/targets/[id]/route.ts`,
      `${APP}app/api/targets/summary/route.ts`,
      `${APP}db/schema/analytics.ts`,
      `${APP}components/targets/targets-console.tsx`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/targets/summary/route.ts` }],
    auditEvidence: 'Creating a target and switching it on or off each commit a target.create, target.activate or target.deactivate audit row in the same tenant transaction (persistAtomicAudit on the withRLSContext handle). The summary read is not audited.',
    privacyClassification: 'Target name, description, metric type, data source, calculation record, thresholds, alert flag, alert recipients (user ids or e-mail addresses) and the user id of the creator.',
    gap: 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns the authorization of analytics metrics, engagement summaries and the case metrics report, not the configuration of a target and its health judgement; UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY owns the realtime observability alerts of the platform and sends none for a target; UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Three route files read and write kpi_configurations and no existing capability names those rows. This record closes none of the gaps and names no target owner, which no source states.',
  },
  {
    id: LEGACY_CAP,
    ...capabilityFields,
    obligationKey: 'legacy-compatibility-and-diagnostic-routes',
    primaryGate: 14,
    dependencyGates: [1, 13],
    actor: 'Client still calling a removed or legacy path (the /api/v2 mirror, the legacy tenant current wrapper) and the engineer calling the Django auth-gate diagnostic',
    businessOutcome: 'A route that no longer performs its function answers with a refusal a client cannot mistake for success (410 or 501), never HTTP 200 for a write, a legacy wrapper returns the figures it names or is removed, and a diagnostic that forwards the session token to a backend is not reachable by every signed-in user in a production build.',
    apiRoute: 'app/api/v2, app/api/tenant/current, app/api/test-auth',
    service: `${APP}lib/api/deprecation.ts`,
    sourceFiles: [
      `${APP}app/api/v2/[...path]/route.ts`,
      `${APP}app/api/tenant/current/route.ts`,
      `${APP}app/api/test-auth/route.ts`,
      `${APP}lib/api/deprecation.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/v2/[...path]/route.ts` }],
    auditEvidence: 'The v2 catch-all calls logDeprecatedAccess, which writes an api.deprecated_access audit event with the path and method and no user or organization, outside any data transaction, and swallows a failure. The tenant wrapper and the diagnostic write nothing.',
    privacyClassification: 'The requested path and method, the session user id, the organization id and the presence of a token; the diagnostic returns the body the Django /me/ endpoint answers for the caller.',
    gap: 'UE-OMIT-ROUTE-EXPOSURE-HARDENING owns the contract of unauthenticated routes and edge enforcement; the v2 catch-all and the wrapper require a session and the diagnostic is not on the public list. UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all, and the capability registry records a v2 consumer (the scheduled reports manager) that falls to an empty state because of the catch-all, without owning the catch-all route. Three route files serve the legacy and diagnostic surface and no existing capability names them. This record closes none of the gaps and names no disposition, which no source states.',
  },
  {
    id: VOCAB_CAP,
    ...capabilityFields,
    obligationKey: 'cupe-vocabulary-reference-data',
    primaryGate: 14,
    dependencyGates: [10, 13],
    actor: 'Client loading the case type, priority, severity, role and status vocabulary of the grievance system',
    businessOutcome: 'A vocabulary the application serves as institutional reference data (service-level hours, severity legal flags, the roles that may assign, escalate or settle, the status transitions) is owned and approved by the institution, matches the roles and transitions the application enforces, carries the version and date of the approved text and is cached only as its owner permits.',
    apiRoute: 'app/api/vocabulary',
    service: `${APP}app/api/vocabulary/route.ts`,
    sourceFiles: [
      `${APP}app/api/vocabulary/route.ts`,
      `${APP}app/api/vocabulary/roles/route.ts`,
      `${APP}app/api/vocabulary/statuses/route.ts`,
      'packages/cupe-vocabulary/src/vocabulary.ts',
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/vocabulary/route.ts` }],
    auditEvidence: 'The vocabulary routes write nothing and record nothing; a read of reference data needs no audit record.',
    privacyClassification: 'None: the response is the same hard-coded reference data for every caller and holds no person or organization row.',
    gap: 'UE-CAP-I-001 (gate 10) owns the canonical role names and permissions of the programme, and UE-OMIT-REPRESENTATION-PROTOCOL-POLICY owns the case assignment engine; neither owns a vocabulary package that declares its own roles (chief steward, business agent), service-level hours and status transitions. UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Six route files serve the vocabulary and no existing capability names it. This record closes none of the gaps and names no vocabulary owner, which no source states.',
  },
  {
    id: VOICE_CAP,
    ...capabilityFields,
    obligationKey: 'voice-recording-transcription',
    primaryGate: 14,
    dependencyGates: [8, 13],
    actor: 'Steward dictating a claim description and member uploading an audio file for transcription',
    businessOutcome: 'A recording is sent to an external speech processor only on a decision the institution has made about consent, processor terms and retention, each transcription is counted against the entitlement that meters it, limited per person and recorded, and the response reports what the processor measured.',
    apiRoute: 'app/api/voice',
    service: `${APP}lib/azure-speech.ts`,
    sourceFiles: [
      `${APP}app/api/voice/transcribe/route.ts`,
      `${APP}app/api/voice/upload/route.ts`,
      `${APP}lib/azure-speech.ts`,
      `${APP}components/voice-recorder.tsx`,
    ],
    proof: [{ type: 'path', ref: `${APP}app/api/voice/transcribe/route.ts` }],
    auditEvidence: 'Neither voice route writes an audit record: the transcribe route records nothing, and the upload route logs the failure of the processor call and nothing on success.',
    privacyClassification: 'The audio recording of a member or steward (a spoken description of a claim, which can name a person, an employer and a medical or disciplinary matter), the file name and size, the transcript and its language.',
    gap: 'UE-OMIT-AI-ADVISORY-GOVERNANCE (gate 14) owns advisory AI invoked by stewards, officers and members and the reading of AI usage; neither voice route generates advice, and the transcribe route calls the speech service and not a language model. UE-OMIT-ROUTE-DOMAIN-SCOPE is the undecided catch-all. Two route files transcribe a recording and no existing capability names them. This record closes none of the gaps and names no processor or consent, which no source states.',
  },
]

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE[ownerCapabilityId], severity, title, ...extra })

const KPI_SUMMARY_FIELDS = 'DEF-0B12-PLT-KPI-SUMMARY-GIVES-EVERY-MEMBER-THE-CALCULATION-ALERT-RECIPIENTS-AND-CREATOR-OF-EVERY-TARGET'
const KPI_CURRENT_VALUE = 'DEF-0B12-PLT-KPI-CURRENT-VALUE-IS-THE-LATEST-ROW-OF-THE-METRIC-TYPE-TEXT-NOT-THE-DECLARED-SOURCE-OR-CALCULATION'
const KPI_DIRECTION = 'DEF-0B12-PLT-KPI-HEALTH-TREATS-A-LOWER-FIGURE-AS-WORSE-FOR-EVERY-TARGET'
const KPI_STORED_NOT_APPLIED = 'DEF-0B12-PLT-KPI-CALCULATION-AND-ALERT-FLAG-ARE-STORED-AND-APPLIED-BY-NO-CODE'
const KPI_ITEM_ID = 'DEF-0B12-PLT-KPI-ITEM-ID-IS-NOT-VALIDATED-AND-A-MALFORMED-ID-IS-A-DATABASE-ERROR'
const ORG_RELINK = 'DEF-0B12-PLT-ORGANIZATIONS-GET-REBINDS-EVERY-MEMBERSHIP-ROW-OF-AN-E-MAIL-ADDRESS-TO-THE-CALLER-IN-THE-LEGACY-BRANCH'
const ORG_ENUMERATION = 'DEF-0B12-PLT-ORGANIZATIONS-LEGACY-BRANCH-LISTS-EVERY-ORGANIZATION-TO-A-PLATFORM-ID-AND-LOADS-THE-WHOLE-TABLE-FOR-EVERY-OTHER-CALLER'
const ORG_PII_LOG = 'DEF-0B12-PLT-ORGANIZATIONS-LEGACY-BRANCH-LOGS-THE-FULL-E-MAIL-ADDRESS'
const ORG_TIMESTAMPS = 'DEF-0B12-PLT-ORGANIZATIONS-RESPONSE-FABRICATES-A-CREATION-TIME-FOR-A-ROW-WITHOUT-ONE'
const V2_WRITES = 'DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-FOR-POST-PUT-PATCH-AND-DELETE-SO-A-CALLER-IS-TOLD-A-WRITE-SUCCEEDED'
const V2_READS = 'DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-WITH-A-DEPRECATION-OBJECT-WHERE-A-CALLER-EXPECTS-DATA'
const V2_AUDIT = 'DEF-0B12-PLT-V2-CATCH-ALL-ACCESS-AUDIT-HAS-NO-ACTOR-AND-IS-NOT-AWAITED'
const V2_SUNSET = 'DEF-0B12-PLT-V2-CATCH-ALL-SUNSET-DATE-IS-A-CONSTANT-THAT-CHANGES-NO-ANSWER'
const TENANT_NULLS = 'DEF-0B12-PLT-TENANT-CURRENT-ANSWERS-200-WITH-NULL-NAME-SLUG-AND-TIER-AND-NO-FEATURES'
const TEST_AUTH_OPEN = 'DEF-0B12-PLT-TEST-AUTH-FORWARDS-THE-SESSION-TOKEN-AND-RETURNS-THE-BACKEND-BODY-TO-EVERY-SIGNED-IN-USER'
const QUEUE_ANY_SESSION = 'DEF-0B12-PLT-QUEUE-STATUS-GIVES-ANY-SIGNED-IN-SESSION-THE-QUEUE-COUNTS-AND-RECENT-FAILED-TASK-NAMES'
const QUEUE_ERRORS = 'DEF-0B12-PLT-QUEUE-STATUS-ANSWERS-AUTHENTICATION-FAILURE-AS-503-AND-RETURNS-THE-ERROR-TEXT'
const QUEUE_KEY = 'DEF-0B12-PLT-QUEUE-STATUS-SERVICE-KEY-IS-THE-SHARED-AI-KEY-COMPARED-WITH-A-PLAIN-EQUALITY'
const TRIAGE_ELIGIBILITY = 'DEF-0B12-PLT-TRIAGE-GRANT-APPLIES-THE-CASE-ELIGIBILITY-TEST-TO-A-MESSAGES-DESIGNATION'
const TRIAGE_EXPIRY = 'DEF-0B12-PLT-TRIAGE-LAPSED-DESIGNATION-IS-CLOSED-AS-SYSTEM-EXPIRY-WITH-NO-AUDIT-ROW'
const TRIAGE_DELETE = 'DEF-0B12-PLT-TRIAGE-REVOKE-CARRIES-THE-DESIGNATION-ID-IN-A-DELETE-BODY'
const VOCAB_INSTITUTIONAL = 'DEF-0B12-PLT-VOCABULARY-SERVES-UNSOURCED-SERVICE-LEVEL-HOURS-ROLE-FLAGS-AND-TRANSITIONS-AS-INSTITUTIONAL-REFERENCE-DATA'
const VOCAB_CACHE = 'DEF-0B12-PLT-VOCABULARY-ROUTES-SET-A-PUBLIC-ONE-HOUR-CACHE-ON-A-SIGNED-IN-RESPONSE'
const VOCAB_STAMP = 'DEF-0B12-PLT-VOCABULARY-LAST-UPDATED-IS-THE-TIME-OF-THE-CALL-AND-THE-VERSION-IS-A-CONSTANT'
const VOICE_UNMETERED = 'DEF-0B12-PLT-VOICE-TRANSCRIBE-HAS-NO-RATE-LIMIT-ENTITLEMENT-OR-AUDIT'
const VOICE_DURATION = 'DEF-0B12-PLT-VOICE-TRANSCRIBE-RETURNS-THE-FILE-SIZE-IN-BYTES-AS-THE-DURATION'
const VOICE_DISCLOSURE = 'DEF-0B12-PLT-VOICE-ROUTES-SEND-THE-RECORDING-TO-AN-EXTERNAL-SERVICE-WITH-NO-CONSENT-OR-RECORD'
const VOICE_ENTITLEMENT = 'DEF-0B12-PLT-VOICE-UPLOAD-CHECKS-THE-AI-SEARCH-ENTITLEMENT-AND-CONSUMES-NO-CREDIT'
const TELEMETRY_LOG = 'DEF-0B12-PLT-WORKSPACE-TELEMETRY-LOGS-UNBOUNDED-CLIENT-STRINGS-AND-HAS-NO-LIMIT'

export const DEFECTS = [
  D(KPI_SUMMARY_FIELDS, KPI_CAP, 'MEDIUM',
    'GET /api/targets/summary is configured at the member floor and returns every kpi_configurations row of the organization with the whole row spread into the response (`...cfg`): the calculation record (formula, aggregation and filters), the alert recipients (user ids or e-mail addresses), the id of the creator and the dashboard layout reach any member of the organization, not the officers who create targets, with no field projection and no read audit.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(KPI_CURRENT_VALUE, KPI_CAP, 'MEDIUM',
    'The summary takes the current value of a target from the latest analytics_metrics row of the organization whose metric_type text equals the target metric type (one query per target through the shared database handle) and applies neither the data source (claims, members, financial, custom_query) nor the calculation the target declares, so a target is judged against whatever row carries the same type name, and a row of another unit or period that shares the text is read as the current value; the progress figure divides that value by the target value.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(KPI_DIRECTION, KPI_CAP, 'MEDIUM',
    'computeHealth returns critical when the current value is at or below the critical threshold, at risk when it is at or below the warning threshold and on track otherwise, for every target: a target whose good direction is downward (resolution time, backlog, grievance count) is reported critical when its figure is low and on track when its figure is high, and the route stores no direction.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(KPI_STORED_NOT_APPLIED, KPI_CAP, 'MEDIUM',
    'POST /api/targets stores a free-form calculation record (any key and value, defaulted to a sum), an alertEnabled flag and a data source, and the summary route reads none of the calculation or the data source and no code found reads alertEnabled to send an alert: the insert writes no alertRecipients value at all, so a target created with alertEnabled true promises an alert that no recipient list and no sender exists to deliver.'),
  D(KPI_ITEM_ID, KPI_CAP, 'LOW',
    'PATCH /api/targets/<id> compares the path id with the uuid column kpi_configurations.id without a shape check, so a malformed id raises a database error that the wrapper answers as a 500 instead of a 404, and the route offers no way to edit, rename or delete a target: the only change available after creation is the active flag.'),
  D(ORG_RELINK, ORG_SESSION_CAP, 'HIGH',
    'GET /api/users/me/organizations, in its legacy branch (entered whenever UE_CANONICAL_BOOTSTRAP_V2 is not 1), links membership rows to the caller when the caller has none: it takes the e-mail address from the identity provider user (or the profile row), selects every organization_members row of any organization whose lower-cased e-mail equals it and runs an update that sets user_id to the caller on all of them, with no condition on the current user_id (a row already bound to another person is rewritten), no verified-address check, no role limit, no organization limit and no audit record; if no row carries the e-mail, a second statement sets user_id to the caller on every membership of the legacy user id of any profile that shares the e-mail; the response then lists the organizations and the roles that were taken, and the whole sequence runs inside a GET with the shared database handle.',
    {
      riskCategories: ['GET_WITH_SIDE_EFFECTS'],
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'A signed-in person who has no membership row bound to their user id and whose identity-provider e-mail address equals (ignoring case) the e-mail of membership rows of one or several organizations calls GET /api/users/me/organizations while UE_CANONICAL_BOOTSTRAP_V2 is not 1: the route rewrites user_id on every such row, including rows already bound to another user id, and returns those organizations and the roles of the rewritten rows; the legacy profile fallback rewrites every membership of another user id when a profile with the same e-mail exists.',
        potentialImpact: {
          classes: ['UNAUTHORIZED_MUTATION', 'CROSS_TENANT_DISCLOSURE'],
          description: 'A person whose address matches, or an attacker who registers the same address with the identity provider, takes over the memberships (and the roles, including administrator) that another person holds in every organization where the address appears, displacing the legitimate holder from those organizations, and receives each organization record, with no audit record of the re-binding.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: ORG_ROUTE, quote: '.set({ userId })' },
          { ref: ORG_ROUTE, quote: "if (currentStateContextEnabled()) {" },
        ],
        existingContainment: {
          summary: 'The re-binding runs only in the legacy branch and only when the caller has no membership bound to their own user id; the canonical branch (UE_CANONICAL_BOOTSTRAP_V2 equal to 1) returns before any e-mail lookup. currentStateContextEnabled is true only when the variable equals 1, so an unset variable keeps the legacy branch reachable, and no source in the application proves the variable is 1 in every deployment.',
          evidence: [{ ref: CANONICAL_BOOTSTRAP, quote: "return flag === '1'" }],
        },
        justification: 'The statement that moves the memberships has no condition tying the row to the caller (no unlinked-row predicate, no verified e-mail, no audit), it can rewrite rows of several organizations at once, and the exposure is reached by any signed-in person with the right address, so the legacy branch blocks release until the canonical branch is the only branch or the linking authority is decided and enforced.',
      },
    }),
  D(ORG_ENUMERATION, ORG_SESSION_CAP, 'MEDIUM',
    'In the legacy branch a user id listed in PLATFORM_ADMIN_USER_IDS receives up to 500 organization records (name, slug, type, parent, sector, jurisdiction, description) whatever their memberships, and every other caller causes the route to select the whole organizations table and filter it in memory by the ids and slugs of the caller memberships, so the cost grows with every organization of the platform and the platform list is held by an environment list the application cannot audit.'),
  D(ORG_PII_LOG, ORG_SESSION_CAP, 'LOW',
    'The legacy branch logs the full e-mail address of the caller (email: userEmail) when it links memberships by e-mail and a three-letter preview of it in another line, together with the user id, so a log reader receives the address that the re-binding was made on.'),
  D(ORG_TIMESTAMPS, ORG_SESSION_CAP, 'LOW',
    'The response replaces a missing createdAt or updatedAt of an organization, and a missing joinedAt and createdAt of a membership, with the time of the call (new Date().toISOString()), so a record without a stored time is returned with a time that never existed.'),
  D(V2_WRITES, LEGACY_CAP, 'HIGH',
    'The /api/v2/[...path] catch-all is exported as GET, POST, PUT, PATCH and DELETE by one handler that answers HTTP 200 with a deprecation object for every method and path: the dues report page posts /api/v2/admin/reports/generate and treats a response that is ok as a generated report, the user role selector puts a role change to /api/v2/admin/users/role and shows the toast Role updated on an ok response, and the staff page posts remittance approve and reject to /api/v2/clc/remittances/<id>/approve and /reject and logs Approved remittance on an ok response, while the file that builds a 410 Gone response (goneResponse) exists and the catch-all never calls it, so a write to a removed path is reported to its caller as a success and nothing is written.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any signed-in member (the catch-all requires the member floor) who triggers a client that still writes to a /api/v2 path receives HTTP 200 for the POST, PUT, PATCH or DELETE: the dues report page treats the answer as a generated report, the export button downloads the deprecation JSON as a file named as a report, the role selector confirms a role change that was not made and the remittance approve and reject actions record an approval that was not made.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
          description: 'An administrator is told that a role was changed, a report was generated or a remittance was approved or rejected when no write happened; the person believes a role was granted or removed and a payment decision was made, and the application logs the approval, so the institution acts on an outcome that did not occur.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: V2_ROUTE, quote: "auth: { required: true, minRole: 'member' }," },
          { ref: USER_ROLE_SELECT, quote: "if (!res.ok) throw new Error('Failed to update role');" },
          { ref: CLC_STAFF_PAGE, quote: 'if (!res.ok) throw new Error(`Approve failed: ${res.status}`);' },
        ],
        existingContainment: {
          summary: 'The response carries a deprecated flag in the body and Deprecation and Sunset headers, which a caller that tests only the response status does not read; the server action of the staff page sends no session cookie in the call, so it may be refused by the member floor before it reaches the 200, and no component that imports the role selector was found.',
          evidence: [{ ref: DEPRECATION, quote: "res.headers.set('Deprecation', 'true');" }],
        },
        justification: 'The repository rule is that a capability that is not implemented answers 501 (or 410 for a removed path) and never HTTP 200; the catch-all answers 200 to every write at the member floor and several callers read the 200 as a completed administrative action, so the route blocks release until it answers a refusal for every method.',
      },
    }),
  D(V2_READS, LEGACY_CAP, 'MEDIUM',
    'GET on a removed /api/v2 path answers HTTP 200 with an object whose keys are _deprecated, _message, _sunset and _canonical, where the callers (the push device manager, the social media post composer, the benchmark and scheduled report consoles, the federation remittances and compliance pages) read the body as the list or figures they requested, so a console renders an empty state or no data with no signal that its endpoint was removed.'),
  D(V2_AUDIT, LEGACY_CAP, 'LOW',
    'The catch-all calls logDeprecatedAccess(v2Path, request.method, canonical) with no user id and no organization id and does not await it, and logDeprecatedAccess swallows a failure of the audit write, so the api.deprecated_access event names a path and a method and no actor, and its loss is silent.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(V2_SUNSET, LEGACY_CAP, 'LOW',
    'The deprecation module holds the sunset date as a constant (2026-07-07) that it prints in the body and the Sunset header, and nothing compares it with the current time or changes the answer after it, so the route keeps answering 200 with a sunset that has passed and no removal is scheduled in source.'),
  D(TENANT_NULLS, LEGACY_CAP, 'MEDIUM',
    'GET /api/tenant/current answers HTTP 200 with an org whose name, slug and subscriptionTier are constant null and whose features list is empty, and an availableOrgs list that holds only that same org, so a legacy client that reads the organization name or tier receives a success with no data; the route reads no organization row, and no caller in the application calls it.'),
  D(TEST_AUTH_OPEN, LEGACY_CAP, 'MEDIUM',
    'GET /api/test-auth is a plain route (no wrapper, no role floor, no production guard) that any signed-in user can call: it sends the session token as a bearer to the Django address held in the NEXT_PUBLIC_API_URL build variable (localhost:8000 when unset), returns the status and body of the backend health and /me/ answers, the session user id and organization, whether a token exists and the text of any fetch error (String(e)), so the response discloses backend addresses and error details and the diagnostic ships in every build.'),
  D(QUEUE_ANY_SESSION, OPS_CAP, 'MEDIUM',
    'GET /api/union-eyes/queue-status accepts either the service key header or any signed-in session (requireApiAuth with no role, no organization requirement), and returns the pending, active, failed and retry counts of the whole background queue, the per-queue counts and the task id, task name, status and completion time of the 20 most recent failed tasks, which are platform-wide operational data not scoped to an organization, to a signed-in member.'),
  D(QUEUE_ERRORS, OPS_CAP, 'LOW',
    'The queue status route sends every error, including the refusal that requireApiAuth throws for a caller with no session, through one catch that answers HTTP 503 with availability error and detail String(err), so an unauthenticated call is reported as an outage and the text of the underlying error (a connection string error of the queue backend, for example) is returned to the caller; when no Django address is configured the route answers 200 with availability not_configured and a null queue.'),
  D(QUEUE_KEY, OPS_CAP, 'LOW',
    'The service credential of the route is the AI_SERVICE_KEY environment value, the same key that the AI service uses, compared with the request header by a plain equality (===) and not a constant-time comparison, and the control plane sends it on every telemetry call, so one key opens the queue figures and the AI service and cannot be rotated for one without the other.'),
  D(TRIAGE_ELIGIBILITY, REP_CAP, 'MEDIUM',
    'POST /api/triage-designations passes caseAssigneeEligible (the case policy role that may add an internal note, or ue_case_assignee_authorized in the canonical branch) as the eligibility test for a designation of either scope, while the message queue decides use of a messages designation with the conversation assignee roles (membershipStillEligible), so a messages designation can be refused to a person who is an eligible conversation assignee and granted to a person who is a case assignee and not a conversation assignee, whose designation then grants nothing.'),
  D(TRIAGE_EXPIRY, REP_CAP, 'LOW',
    'grantDesignation closes a lapsed live designation by setting revokedAt to now and revokedBy to the string system:expiry before the new grant, in the same transaction, and writes no audit row for the closure (only the grant is audited), so the end of an expired designation is a data change with no audit record and a revoker value that is not a user.'),
  D(TRIAGE_DELETE, REP_CAP, 'LOW',
    'DELETE /api/triage-designations takes the designation id from a JSON request body (body: revokeSchema), a pattern that HTTP intermediaries and many clients drop or ignore for DELETE, and the route has no path id; no caller in the application sends the request.'),
  D(VOCAB_INSTITUTIONAL, VOCAB_CAP, 'MEDIUM',
    'The vocabulary routes serve, as reference data of the grievance system, hard-coded service-level hours (24 hours for critical, 48 high, 72 medium, 168 low), severity legal-review flags, per-role canAssign, canEscalate and canSettle flags for roles named member, steward, chief_steward, business_agent, officer and admin, and a status machine with the roles allowed to make each transition, from a package whose header calls them defaults, with no cited source, no approval and no relation to the roles the application enforces; the flags are not read by any enforcing code found, and a client that treats them as the institution service levels or permissions would present an unsourced figure as institutional.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(VOCAB_CACHE, VOCAB_CAP, 'LOW',
    'Every vocabulary route sets Cache-Control public with max-age 3600 on a response that is behind a signed-in session, so a shared cache or proxy may store and serve the response to callers without a session for an hour.'),
  D(VOCAB_STAMP, VOCAB_CAP, 'LOW',
    'getCUPEVocabulary sets lastUpdated to the time of the call and version to the constant 0.1.0, so the full vocabulary route reports a last update of now on every request and a version that does not change when the content changes.'),
  D(VOICE_UNMETERED, VOICE_CAP, 'MEDIUM',
    'POST /api/voice/transcribe, at the steward floor, applies no rate limit and no entitlement check and writes no audit record, while the sibling upload route applies a rate limit and an entitlement check: a steward (or a script holding a steward session) can send repeated 25 MB recordings, each up to the 60-second function limit, to the speech service with no count and no record of who transcribed what.'),
  D(VOICE_DURATION, VOICE_CAP, 'LOW',
    'The transcribe response sets duration to audioFile.size (the size of the upload in bytes, with the comment Approximate), so a caller that reads duration receives a number of bytes presented as a length of time.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(VOICE_DISCLOSURE, VOICE_CAP, 'MEDIUM',
    'Both voice routes read the uploaded recording into memory and send it to an external Azure service (the speech service in the transcribe route, an Azure OpenAI Whisper deployment in the upload route), and the recordings are spoken claim descriptions that can name a person, an employer and a medical or disciplinary matter: neither route records a consent, names a processor agreement or region, records the disclosure or states a retention, and the upload route logs the body of a failed processor answer.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),
  D(VOICE_ENTITLEMENT, VOICE_CAP, 'LOW',
    'POST /api/voice/upload checks the ai_search entitlement of the organization (and labels a refusal voice_upload) for a transcription feature, and checkEntitlement only reads settings.credits and consumes none, so the check neither meters the transcription nor reflects a voice entitlement; no caller of the route exists in the application.'),
  D(TELEMETRY_LOG, PILOT_CAP, 'LOW',
    'POST /api/workspace/telemetry accepts the allow-listed event name and logs every allow-listed payload key, of which tab and timestamp are written as the client string with no length bound or format check (route is checked against the static route list), with no rate limit, so a member can write arbitrarily long strings of their choice into the application log at any rate, and the figures the route exists to produce live only in log lines.'),
]

const future = {
  kpiSummary: 'Return the member a projection of the targets that omits the calculation, alert recipients and creator, derive the current value from the declared data source and calculation, store a threshold direction, and audit nothing for a plain read.',
  kpiCreate: 'Validate the calculation against the data sources the summary can compute, store the direction of the thresholds, write the alert recipients or refuse the alert flag until a sender exists, and keep the in-transaction audit.',
  kpiPatch: 'Validate the path id as a uuid, answer 404 for an unknown or other-organization id, and keep the in-transaction audit of the active flag.',
  organizations: 'Remove the legacy branch (make the canonical selection the only branch), or restrict any re-binding to an unlinked row whose e-mail is verified, never rewrite a row bound to another user id, write an audit row in the same transaction and never perform it in a GET.',
  tenant: 'Remove the wrapper or return the organization record it names, and answer 410 for a retired client.',
  testAuth: 'Remove the diagnostic from the production build or put it behind a platform operator role and an environment guard, and never return the backend body or the error text.',
  v2: 'Answer 410 Gone (or 501) for every method and path, never HTTP 200, include the canonical path in the refusal, audit the access with the actor, and remove the catch-all and every caller after the decided sunset.',
  queue: 'Put the figures behind the platform operator floor, give the control plane its own rotated credential compared in constant time, answer 401 for an authentication failure and keep the error text out of the response.',
  triage: 'Decide the eligibility per scope and apply it in the grant, audit the closure of a lapsed designation, and carry the designation id in the path.',
  vocabulary: 'Name the owner and the approval of the vocabulary, source every service-level hour and flag, derive the roles from the enforced roles, serve a private cache header and stamp the response with the approved version and date, or remove the routes.',
  voice: 'Decide consent, processor terms and retention, apply the rate limit, entitlement and audit record of the upload route to the transcribe route, meter each transcription, return the duration the processor measured and keep the failure body out of the log.',
  telemetry: 'Bound the length of every logged string, apply a rate limit and write the events to a store the programme owner can read.',
}

/* ------------------------------------------------------------------------------------------------------------ */
/* KPI targets                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const KPI_SENS = 'Target name, description, metric type, data source, calculation record, thresholds, alert flag, alert recipients and the creator user id'

const kpiBase = (a) => ({
  service: `${a.routeFile} (withApi, kpi_configurations through withRLSContext)`,
  authn: `${SESSION} (withApi, auth required).`,
  gate: GATE[KPI_CAP],
  deps: [8, 13],
  corr: [],
})

function targetsPost(a) {
  return mk({
    ...kpiBase(a),
    persona: 'Officer creating a key performance target on the targets console',
    authz: 'withApi with minRole officer and a zod body (name, metric type, data source, free-form calculation, visualization, thresholds, alert flag): any officer of the organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The insert and the audit row run under withRLSContext with the session organization id, and the row is written with that organization id and the session user id as creator.',
    owner: 'A new kpi_configurations row of the session organization; the audit row is owned by the organization.',
    sens: KPI_SENS,
    priv: 'The response returns the created row in full, including the calculation record and creator id; the audit row records the name, metric type, data source and target value.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The target insert and the target.create audit row (persistAtomicAudit on the withRLSContext transaction handle) commit together; the audit lists the name, metric type, data source and target value.',
    reqAudit: 'Keep the in-transaction audit row and record the calculation and the thresholds it stored.',
    does: 'Requires a user and organization, inserts the target with the body values (thresholds stored as text, the calculation record defaulted to a sum) and the creator, writes the audit row in the same transaction and returns the row.',
    status: 'PARTIAL',
    future: future.kpiCreate,
    dec: [D_KPI],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { minRole: 'officer' },"),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('tenantScope', 'createdBy: userId,'),
      a.h('mutation', '.insert(kpiConfigurations)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('privacy', 'details: { name: body.name, metricType: body.metricType, dataSource: body.dataSource, targetValue: body.targetValue ?? null },'),
      a.h('defect', "calculation: z.record(z.string(), z.unknown()).default({ aggregation: 'sum' }),"),
      a.h('defect', 'alertEnabled: body.alertEnabled,'),
      a.sch('defect', ANALYTICS_SCHEMA, /alertRecipients: jsonb\('alert_recipients'\)/, { symbol: 'kpiConfigurations' }),
    ],
    inf: [
      { claim: 'defect', statement: 'The insert values list has no alertRecipients entry and the schema column alertRecipients is nullable, so no recipient is stored by this route; no other route under /api/targets writes it.' },
    ],
    def: [KPI_STORED_NOT_APPLIED],
  })
}

function targetsPatch(a) {
  return mk({
    ...kpiBase(a),
    persona: 'Officer switching a key performance target on or off on the targets console',
    authz: 'withApi with minRole officer and a zod body holding only isActive: any officer of the organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The update is conditioned on the target id and the session organization id and runs under withRLSContext, so a target of another organization answers 404.',
    owner: 'The kpi_configurations row of the session organization and the audit row of the organization.',
    sens: KPI_SENS,
    priv: 'The response returns the updated row in full including the calculation record and creator id; the audit row records the new active flag only.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The active-flag update and the target.activate or target.deactivate audit row (persistAtomicAudit on the withRLSContext transaction handle) commit together.',
    reqAudit: 'Keep the in-transaction audit row.',
    does: 'Requires a user and organization, updates is_active and updated_at of the target of the session organization, answers 404 when no row matched, writes the audit row and returns the updated row.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: future.kpiPatch,
    dec: [D_KPI],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { minRole: 'officer' },"),
      a.h('tenantScope', 'eq(kpiConfigurations.organizationId, organizationId),'),
      a.h('mutation', '.update(kpiConfigurations)'),
      a.h('mutation', "throw ApiError.notFound('Target');"),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.h('behavior', "action: body.isActive ? 'target.activate' : 'target.deactivate',"),
      a.h('defect', 'eq(kpiConfigurations.id, id),'),
    ],
    inf: [
      { claim: 'defect', statement: 'kpi_configurations.id is a uuid column and the path id is compared without a shape check, so an id that is not a uuid reaches the database comparison.' },
    ],
    def: [KPI_ITEM_ID],
  })
}

function targetsSummary(a) {
  return mk({
    ...kpiBase(a),
    persona: 'Member or staff opening the targets console to see each target with its health',
    authz: 'withApi with minRole member: any signed-in member of the organization reads every target. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The targets and the metric rows are selected through the shared database handle (no withRLSContext) with an explicit organization predicate on both queries, so the isolation rests on those predicates.',
    owner: 'kpi_configurations rows of the session organization joined in code to the latest analytics_metrics row of the same organization with the same metric type text.',
    sens: `${KPI_SENS}, the latest metric value and trend`,
    priv: 'Every member receives the whole kpi_configurations row of every target (calculation, alert recipients, creator, layout) with a health state, a current value, a progress percentage and a trend; no other organization is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of the summary need no audit record once the readable fields are decided.',
    does: 'Selects the targets of the organization ordered by display order, reads the latest analytics_metrics row of the same metric type for each target, computes health, progress and trend, and returns the totals by health and source with the enriched targets.',
    status: 'PARTIAL',
    future: future.kpiSummary,
    dec: [D_KPI],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "{ auth: { minRole: 'member' } },"),
      a.h('tenantScope', '.where(eq(kpiConfigurations.organizationId, organizationId!))'),
      a.h('tenantScope', 'eq(analyticsMetrics.organizationId, organizationId!),'),
      a.h('mutation', 'return { summary, targets: enriched };'),
      a.h('privacy', '...cfg,'),
      a.sch('privacy', ANALYTICS_SCHEMA, /alertRecipients: jsonb\('alert_recipients'\)/, { symbol: 'kpiConfigurations' }),
      a.h('defect', 'eq(analyticsMetrics.metricType, cfg.metricType),'),
      a.local('defect', 'computeHealth', "if (critical != null && currentValue <= critical) return 'critical';"),
      a.sch('defect', ANALYTICS_SCHEMA, "dataSource: text('data_source').notNull(), // 'claims', 'members', 'financial', 'custom_query'", { symbol: 'kpiConfigurations' }),
    ],
    inf: [
      { claim: 'defect', statement: 'The metric query filters on organization and metric_type only: neither the data_source of the target nor its calculation record appears in the query or in any later step of the handler, and one query is issued for each target.' },
    ],
    def: [KPI_SUMMARY_FIELDS, KPI_CURRENT_VALUE, KPI_DIRECTION],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* organization choices                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

function organizationChoices(a) {
  return mk({
    persona: 'Signed-in person choosing the organization to act in after sign-in, and a person whose membership row was created by e-mail before they signed in',
    service: `${a.routeFile} (organization_members and organizations through the shared handle; canonical branch in lib/auth/canonical-organization-selection)`,
    authn: 'Entra session read directly with auth() in the legacy branch (401 when there is no user id); the canonical branch resolves its own choices.',
    cat: 'SESSION_ONLY',
    authz: 'No role floor: any signed-in person calls the route. In the legacy branch a user id that appears in the PLATFORM_ADMIN_USER_IDS list receives every organization (up to 500); every other caller receives the organizations of the membership rows bound to their user id. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No organization context exists yet (the route is the choice of one). Memberships are selected by the caller user id through the shared database handle; the e-mail self-heal selects and updates organization_members rows of every organization by e-mail address, so it is not bounded by any one tenant.',
    owner: 'organization_members rows bound to the caller user id (and, in the self-heal, the rows that carry the caller e-mail or a legacy user id) and the organizations they name.',
    sens: 'Organization id, name, slug, type, parent, sector, jurisdiction and description of each organization, and the membership id, role, primary flag and joined time of each row; the caller e-mail address in the self-heal',
    priv: 'The caller receives their organizations and memberships including the role of each row; when the self-heal runs the caller also takes over the rows that carried their e-mail, and a platform administrator id receives every organization record.',
    mut: 'NONE',
    auditDetail: 'The legacy self-heal updates organization_members.user_id with the shared database handle in a GET and writes no audit record; the only trace is logger lines that include the e-mail address and the counts of rows linked.',
    reqAudit: 'A change of the sign-in identity bound to a membership must be an audited decision in the same transaction as the change and must not happen in a GET.',
    does: 'In the canonical branch returns the canonical organization choices. In the legacy branch reads the caller memberships, and when there are none looks the caller e-mail up in organization_members (re-binding every matching row to the caller) or, if none matches, in profiles for a legacy user id whose memberships it re-binds; it then returns the organizations (all of them for a platform administrator id) and memberships of the caller.',
    status: 'PARTIAL',
    gate: GATE[ORG_SESSION_CAP],
    deps: [1, 13],
    future: future.organizations,
    dec: [D_LINKING, D_ROSTER],
    corr: [GET_WRITES('NONE')],
    ev: [
      a.h('authentication', 'const { userId } = await auth();'),
      a.h('authorization', 'const isAdmin = await isPlatformAdminUser(userId);'),
      a.h('authorization', "if (currentStateContextEnabled()) {"),
      a.h('tenantScope', '.where(eq(organizationMembers.userId, userId));'),
      a.h('mutation', '.update(organizationMembers)'),
      a.h('audit', "logger.info('[/api/users/me/organizations] Linked memberships by email', {"),
      a.h('privacy', 'role: m.role,'),
      a.h('defect', '.where(sql`lower(${organizationMembers.email}) = lower(${userEmail})`);'),
      a.h('defect', '.where(eq(organizationMembers.userId, legacyUserId));'),
      a.h('defect', 'orgs = await db.select().from(organizations).limit(500);'),
      a.h('defect', 'const allOrgs = await db.select().from(organizations);'),
      a.h('defect', 'email: userEmail,'),
      a.h('defect', 'createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),'),
    ],
    inf: [
      { claim: 'defect', statement: 'The update that links by e-mail has the same where clause as the select that precedes it (lower(email) equal to the caller e-mail) and no condition on organization_members.user_id, so rows that are already bound to a user id match and are rewritten.' },
      { claim: 'defect', statement: 'The route is entered by GET and performs its writes with the shared database handle outside any transaction and outside any audit call.' },
    ],
    def: [ORG_RELINK, ORG_ENUMERATION, ORG_PII_LOG, ORG_TIMESTAMPS],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* legacy and diagnostic                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

function tenantCurrent(a) {
  return mk({
    persona: 'Legacy client calling the deprecated tenant current endpoint',
    service: `${a.routeFile} (withApiAuth, resolveOrgIdFromContext)`,
    authn: `${SESSION} (withApiAuth).`,
    cat: 'SESSION_ONLY',
    authz: 'None beyond a signed-in user: withApiAuth applies no role floor, and the handler refuses a missing user id and a user whose organization cannot be resolved to an application organization uuid. A role title is not a kernel decision.',
    tenant: 'The organization id is resolved from the authenticated context by resolveOrgIdFromContext (a uuid of the application, never an Entra group id) and no table is read.',
    owner: 'No stored rows: the response holds the resolved organization id and constant empty values.',
    sens: 'The caller organization id',
    priv: 'The caller receives their own organization id in an org object whose name, slug, tier and features are empty constants.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the handler writes no row and no audit record.',
    reqAudit: 'Reads need no audit record.',
    does: 'Resolves the organization id of the signed-in user and returns it as an org with null name, slug and tier and no features, and as the only entry of availableOrgs, with an X-Deprecated header; a missing organization answers 404.',
    status: 'PARTIAL',
    gate: GATE[LEGACY_CAP],
    deps: [1, 13],
    future: future.tenant,
    dec: [D_LEGACY],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.h('authorization', 'const orgId = await resolveOrgIdFromContext(context, userId);'),
      a.h('tenantScope', 'const orgId = await resolveOrgIdFromContext(context, userId);'),
      a.imp('tenantScope', 'resolveOrgIdFromContext', 'const resolved = await getOrganizationIdForUser(userId);'),
      a.h('mutation', 'const response = NextResponse.json({ org, availableOrgs: [org] });'),
      a.h('defect', 'name: null as string | null,'),
      a.h('defect', /response\.headers\.set\("X-Deprecated"/),
    ],
    inf: [
      { claim: 'defect', statement: 'The route imports no table and no service that reads an organization row, and a search of the application finds no caller of /api/tenant/current other than its own test.' },
    ],
    def: [TENANT_NULLS],
  })
}

function testAuth(a) {
  return mk({
    persona: 'Engineer, or any signed-in user, calling the Django auth-gate diagnostic',
    service: `${a.routeFile} (auth() and a fetch to the Django address)`,
    authn: 'Entra session read directly with auth() (401 with passed false when there is no user id); the session token is then sent to the Django backend.',
    cat: 'SESSION_ONLY',
    authz: 'None beyond a signed-in user: there is no wrapper, no role floor, no environment guard and no allow-list of callers. A role title is not a kernel decision.',
    tenant: 'No table is read. The route returns the session user id and organization id of the caller and the bodies the Django backend answers for the caller token.',
    owner: 'No stored rows: the response is the caller session identifiers and the backend answers.',
    sens: 'Session user id, organization id, whether a token exists, the Django health body, the Django /me/ body of the caller and the text of any fetch error',
    priv: 'The caller receives their own session identifiers and the backend answer for their own token, with the status codes, and any network error text that names the backend address.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record; the token is sent to the backend and the call is not recorded.',
    reqAudit: 'A diagnostic that forwards the session token needs no audit record if it is not reachable in production.',
    does: 'Requires a session, reads the token, calls the Django health endpoint without credentials and the Django /me/ endpoint with the token as a bearer, and returns passed true when /me/ answers 200 with both bodies and the session summary.',
    status: 'PARTIAL',
    gate: GATE[LEGACY_CAP],
    deps: [1, 13],
    future: future.testAuth,
    dec: [D_LEGACY],
    ev: [
      a.h('authentication', 'const { userId, orgId, getToken } = await auth();'),
      a.h('authorization', 'if (!userId) {'),
      a.h('tenantScope', 'orgId: orgId ?? null,'),
      a.h('mutation', 'passed: meStatus === 200,'),
      a.h('privacy', 'me: { status: meStatus, body: meBody },'),
      a.h('behavior', 'headers: { Authorization: `Bearer ${token}` },'),
      a.h('defect', 'meBody = { error: String(e) };'),
      a.h('defect', 'hasToken: !!token,'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route is a plain exported GET with no withApi, withApiAuth or withRoleAuth wrapper, so the only gate is the user id read from auth(); the backend address is the NEXT_PUBLIC_API_URL variable read at module scope.' },
    ],
    def: [TEST_AUTH_OPEN],
  })
}

function v2CatchAll(a) {
  const method = a.method
  const isRead = method === 'GET'
  return mk({
    persona: isRead
      ? 'Client that still reads a removed /api/v2 path and expects the list or figures the old route returned'
      : `Client that still sends a ${method} to a removed /api/v2 path (a report generation, a role change, a remittance decision) and expects the write to have happened`,
    service: `${a.routeFile} (withApi, lib/api/deprecation)`,
    authn: `${SESSION} (withApi, auth required).`,
    authz: 'withApi with minRole member: any signed-in member reaches the catch-all for every method and every path under /api/v2. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No table is read or written: the handler builds the canonical path from the requested path and returns a deprecation object. The organization of the caller is required by the wrapper and never used.',
    owner: 'No stored rows: the response is a constant deprecation object that names the requested path and its canonical replacement.',
    sens: 'The requested path and method; no row of any table',
    priv: 'The caller receives the path it asked for and the canonical path; no row of any table is returned and no write is made.',
    mut: 'NOT_MUTATING',
    nonMutationReason: isRead ? undefined : `The ${method} reaches the catch-all handler, which writes nothing and returns the deprecation object; the write the caller asked for is not performed.`,
    auditDetail: 'The handler calls logDeprecatedAccess without awaiting it, which logs a warning and writes an api.deprecated_access audit event (path, method, canonical path, no user and no organization), outside any data transaction, and ignores its failure; no data is changed.',
    reqAudit: 'The refusal of a removed path needs an access record with the actor; a write to a removed path must be answered with a refusal, not a success.',
    does: `Builds the v2 path from the catch-all segments, logs the deprecated access and answers HTTP 200 with a deprecation object (the _deprecated flag, a message, the sunset, the canonical path) and Deprecation, Sunset and Link headers for this ${method}, whatever the path asks.`,
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    gate: GATE[LEGACY_CAP],
    deps: [13],
    future: future.v2,
    dec: [D_LEGACY],
    ev: [
      a.local('authentication', 'handler', "auth: { required: true, minRole: 'member' },"),
      a.svc('authentication', `${APP}lib/api/with-api.ts`, 'const requireAuth = options.auth?.required !== false', 'withApi'),
      a.local('authorization', 'handler', "auth: { required: true, minRole: 'member' },"),
      a.svc('authorization', `${APP}lib/api/with-api.ts`, 'const minRoleLevel = options.auth?.minRole', 'withApi'),
      a.svc('tenantScope', `${APP}lib/api/with-api.ts`, 'const requireOrg = options.requireOrg ?? requireAuth', 'withApi'),
      a.local('tenantScope', 'handler', 'const canonical = resolveV2Canonical(v2Path);'),
      a.local('mutation', 'handler', 'return deprecatedResponse(v2Path, canonical);'),
      a.local('audit', 'handler', 'logDeprecatedAccess(v2Path, request.method, canonical);'),
      a.svc('audit', `${APP}lib/api/deprecation.ts`, "eventType: 'api.deprecated_access',", 'logDeprecatedAccess'),
      a.svc('behavior', `${APP}lib/api/deprecation.ts`, '{ status: 200 },', 'deprecatedResponse'),
      a.svc('defect', `${APP}lib/api/deprecation.ts`, '{ status: 200 },', 'deprecatedResponse'),
      a.svc('defect', `${APP}lib/api/deprecation.ts`, "}).catch(() => {", 'logDeprecatedAccess'),
    ],
    inf: [
      { claim: 'defect', statement: 'goneResponse in lib/api/deprecation.ts builds a 410 Gone body with the removal phase, and no file imports it in the catch-all or any route; the catch-all is bound to all five methods by assigning one handler to GET, POST, PUT, PATCH and DELETE.' },
      { claim: 'defect', statement: 'The dues report page, the user role selector and the staff remittance actions treat a response that is ok as success: the generate call checks only res.ok, the role selector toasts Role updated after a passing res.ok, and the approve action logs Approved remittance after a passing res.ok.' },
    ],
    def: isRead ? [V2_READS, V2_AUDIT, V2_SUNSET] : [V2_WRITES, V2_AUDIT, V2_SUNSET],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* queue status                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

function queueStatus(a) {
  return mk({
    persona: 'Control plane service reading the background queue health with the service key, or a signed-in user opening the endpoint',
    service: `${a.routeFile} (requireApiAuth or the AI service key, lib/job-queue)`,
    authn: 'The shared AI_SERVICE_KEY in the x-service-key header, or a session checked by requireApiAuth (an error is thrown for no session, which the route turns into a 503).',
    cat: 'EXTERNAL_TRUST',
    authz: 'Either the service key (compared with a plain equality against AI_SERVICE_KEY, and only when that variable is set) or any signed-in session: requireApiAuth is called with no role and no organization requirement, so there is no role floor. A role title is not a kernel decision.',
    tenant: 'None: the figures are those of the whole background queue of the application and are not scoped to an organization; no table is read.',
    owner: 'The platform-wide Celery queue statistics and the 20 most recent failed task records.',
    sens: 'Pending, active, failed and retry counts, per-queue counts, and for each recent failure the task id, task name, status and completion time',
    priv: 'The caller receives the operational state of the whole background queue, including the names of the tasks that failed, whichever organization they belong to.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of queue figures need no audit record once the readers are limited to the platform operator.',
    does: 'Accepts the service key or any signed-in session, answers 200 with availability not_configured when no Django address is configured, otherwise reads the queue statistics and the failed jobs, aggregates the totals and returns them with the recent failures; any error answers 503 with the error text.',
    status: 'PARTIAL',
    gate: GATE[OPS_CAP],
    deps: [13],
    future: future.queue,
    dec: [D_QUEUE],
    ev: [
      a.h('authentication', 'await requireApiAuth()'),
      a.h('authorization', "const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey"),
      a.h('tenantScope', 'const [stats, failed] = await Promise.all(['),
      a.h('mutation', "availability: 'available',"),
      a.h('privacy', 'task_name: f.task_name,'),
      a.h('defect', 'detail: String(err),'),
      a.h('defect', "availability: 'not_configured',"),
    ],
    inf: [
      { claim: 'defect', statement: 'The control plane telemetry route sends the same x-service-key header on its health, metrics and queue status calls (EU_SERVICE_KEY), and the route compares it with AI_SERVICE_KEY, the name that identifies the AI service key.' },
      { claim: 'defect', statement: 'requireApiAuth throws an Error when the session is missing, the throw lands in the route catch block, and that block answers 503; no path of the handler answers 401.' },
    ],
    def: [QUEUE_ANY_SESSION, QUEUE_ERRORS, QUEUE_KEY],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* triage designations                                                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

const triageBase = (a) => ({
  service: `${a.routeFile} (withApi, ${DESIGNATIONS})`,
  authn: `${SESSION} (withApi, auth required).`,
  gate: GATE[REP_CAP],
  deps: [6, 13],
  corr: [],
})

const TRIAGE_SENS = 'Designation id, scope (messages or cases), designee user id, granting administrator user id, grant, expiry and revocation times'

function triageGet(a) {
  return mk({
    ...triageBase(a),
    persona: 'Organization administrator listing the triage designations of the organization',
    authz: 'withApi with minRole admin and then getCaseActor, which refuses a caller whose organization role maps to no case role (a platform role resolves to none): any administrator with a case role. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'getCaseActor resolves the organization of the session and listDesignations filters triage_designations on that organization id inside withRLSContext.',
    owner: 'triage_designations rows of the session organization, newest first, limited to 200.',
    sens: TRIAGE_SENS,
    priv: 'An administrator receives every designation of the organization (live, expired and revoked, up to 200) with the designee, granting administrator and times; no other organization is reachable.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record.',
    reqAudit: 'Reads of the designation list need no audit record.',
    does: 'Resolves the case actor, lists the designations of the organization ordered by grant time with a 200 row limit and returns them.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: future.triage,
    dec: [D_TRIAGE, D_REPRESENTATION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' }"),
      a.h('tenantScope', 'const actor = await getCaseActor();'),
      a.imp('tenantScope', 'getCaseActor', 'const organizationId = await getOrganizationIdForUser(userId)'),
      a.svc('tenantScope', DESIGNATIONS, '.where(eq(triageDesignations.organizationId, actor.organizationId))', 'listDesignations'),
      a.h('mutation', 'return { designations };'),
      a.svc('privacy', DESIGNATIONS, 'grantedBy: r.grantedBy,', 'toDesignation'),
    ],
    def: [],
  })
}

function triagePost(a) {
  return mk({
    ...triageBase(a),
    persona: 'Organization administrator granting a staff member a time-limited triage designation',
    authz: 'withApi with minRole admin, a zod body (scope, designee user id, expiry) and getCaseActor; the service refuses an expiry outside 90 days, a grant to oneself and a designee who is not an eligible assignee (case eligibility test). A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The grant runs under withRLSContext with the actor organization; the live-designation check, the lapse update and the insert carry the actor organization id.',
    owner: 'A new triage_designations row of the session organization and the audit row of the organization.',
    sens: TRIAGE_SENS,
    priv: 'The response returns the created designation; the audit row records the scope, the designee user id and the expiry.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The designation insert and the triage.designation.grant audit row (persistAtomicAudit on the withRLSContext handle) commit together; the closure of a lapsed designation in the same transaction writes no audit row.',
    reqAudit: 'Keep the in-transaction audit row and audit the closure of a lapsed designation.',
    does: 'Checks the expiry window, refuses a self grant, tests the eligibility of the designee, closes a lapsed designation of the same designee and scope, refuses a live duplicate with 409, inserts the designation and the audit row and answers 201; ineligible answers 422.',
    status: 'PARTIAL',
    future: future.triage,
    dec: [D_TRIAGE, D_REPRESENTATION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' }"),
      a.h('authorization', 'case ' + "'self_grant':"),
      a.h('tenantScope', 'const actor = await getCaseActor();'),
      a.imp('tenantScope', 'getCaseActor', 'const organizationId = await getOrganizationIdForUser(userId)'),
      a.svc('tenantScope', DESIGNATIONS, 'organizationId: actor.organizationId,', 'grantDesignation'),
      a.svc('mutation', DESIGNATIONS, '.insert(triageDesignations)', 'grantDesignation'),
      a.svc('audit', DESIGNATIONS, 'await persistAtomicAudit(tx, {', 'grantDesignation'),
      a.svc('audit', DESIGNATIONS, "action: 'triage.designation.grant',", 'grantDesignation'),
      a.svc('privacy', DESIGNATIONS, 'details: { scope: input.scope, designatedUserId: input.userId, expiresAt: input.expiresAt.toISOString() },', 'grantDesignation'),
      a.h('defect', '{ assigneeEligible: (userId) => caseAssigneeEligible(tx, actor, userId) },'),
      a.svc('defect', DESIGNATIONS, "revokedBy: 'system:expiry'", 'grantDesignation'),
      a.svc('defect', DESIGNATIONS, 'if (currentStateContextEnabled()) return sql`public.ue_conversation_assignee_authorized(${userId}, ${organizationId}::uuid) IS TRUE`', 'membershipStillEligible'),
    ],
    inf: [
      { claim: 'defect', statement: 'The route passes the same eligibility callback for the messages scope and the cases scope, and the live-designation predicate that the message queue uses (membershipStillEligible) tests the conversation assignee roles, so the grant and the use of a messages designation apply different tests.' },
    ],
    def: [TRIAGE_ELIGIBILITY, TRIAGE_EXPIRY],
  })
}

function triageDelete(a) {
  return mk({
    ...triageBase(a),
    persona: 'Organization administrator revoking a triage designation',
    authz: 'withApi with minRole admin, a zod body holding the designation id (a guid) and getCaseActor: any administrator with a case role. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'The revoke update is conditioned on the designation id, the actor organization id and a null revocation time, inside withRLSContext, so a designation of another organization answers 404.',
    owner: 'The triage_designations row of the session organization and the audit row of the organization.',
    sens: TRIAGE_SENS,
    priv: 'The response is {revoked:true}; the audit row records the scope and the designee user id.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The revocation update and the triage.designation.revoke audit row (persistAtomicAudit on the withRLSContext handle) commit together.',
    reqAudit: 'Keep the in-transaction audit row.',
    does: 'Resolves the case actor, revokes the live designation with the given id of the organization, answers 404 when none matched, writes the audit row and answers revoked true.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: future.triage,
    dec: [D_TRIAGE, D_REPRESENTATION],
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'admin' }"),
      a.h('tenantScope', 'const actor = await getCaseActor();'),
      a.imp('tenantScope', 'getCaseActor', 'const organizationId = await getOrganizationIdForUser(userId)'),
      a.svc('tenantScope', DESIGNATIONS, 'eq(triageDesignations.organizationId, actor.organizationId)', 'revokeDesignation'),
      a.svc('mutation', DESIGNATIONS, '.update(triageDesignations)', 'revokeDesignation'),
      a.svc('audit', DESIGNATIONS, 'await persistAtomicAudit(tx, {', 'revokeDesignation'),
      a.svc('audit', DESIGNATIONS, "action: 'triage.designation.revoke',", 'revokeDesignation'),
      a.h('defect', 'body: revokeSchema'),
    ],
    def: [TRIAGE_DELETE],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* vocabulary                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const VOCAB_PARTS = {
  'vocabulary/route.ts': { label: 'the complete vocabulary (case types, priorities, severities, roles, statuses, the generated time and the version)', accessor: 'return NextResponse.json(vocabulary, {' },
  'vocabulary/case-types/route.ts': { label: 'the ten case types with their default priority and severity', accessor: 'return NextResponse.json(vocabulary.caseTypes, {' },
  'vocabulary/priorities/route.ts': { label: 'the four priorities with their service-level hours and escalation flags', accessor: 'return NextResponse.json(vocabulary.priorities, {' },
  'vocabulary/roles/route.ts': { label: 'the six roles with their assign, escalate and settle flags', accessor: 'return NextResponse.json(vocabulary.roles, {' },
  'vocabulary/severities/route.ts': { label: 'the four severities with their legal-review flags', accessor: 'return NextResponse.json(vocabulary.severities, {' },
  'vocabulary/statuses/route.ts': { label: 'the twelve statuses with their allowed transitions and the roles allowed to make them', accessor: 'return NextResponse.json(vocabulary.statuses, {' },
}

function vocabularyFacts(a) {
  const part = VOCAB_PARTS[a.route]
  const whole = a.route === 'vocabulary/route.ts'
  return mk({
    persona: 'Signed-in client loading the CUPE vocabulary reference data',
    service: `${a.routeFile} (withApiAuth, @nzila/cupe-vocabulary)`,
    authn: `${SESSION} (withApiAuth).`,
    cat: 'SESSION_ONLY',
    authz: 'None beyond a signed-in user: withApiAuth applies no role floor and no entitlement, and the handler applies none. A role title is not a kernel decision.',
    tenant: 'None: the response is the same hard-coded reference data for every caller and organization; no table is read and the route header states it is not organization scoped.',
    owner: 'No stored rows: the response is the in-code vocabulary of the @nzila/cupe-vocabulary package.',
    sens: 'No person or organization row: service-level hours, severity flags, role permission flags and status transition rules published as reference data',
    priv: `The caller receives ${part.label}; no row of any table is read.`,
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the handler writes no row and no audit record.',
    reqAudit: 'Reads of reference data need no audit record.',
    does: `Loads the hard-coded vocabulary and returns ${part.label} with a public one-hour cache header${whole ? ', stamped with the time of the call and version 0.1.0' : ''}; a failure answers 500.`,
    status: 'PARTIAL',
    gate: GATE[VOCAB_CAP],
    deps: [10, 13],
    future: future.vocabulary,
    dec: [D_VOCAB],
    corr: [],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.h('authorization', 'export const GET = withApiAuth(async (_request: NextRequest) => {'),
      a.h('tenantScope', 'const vocabulary = getCUPEVocabulary();'),
      a.h('mutation', part.accessor),
      a.h('privacy', "'Cache-Control': 'public, max-age=3600'" + (whole ? ', // Cache vocab for 1 hour' : ',')),
    ],
    inf: [
      { claim: 'defect', statement: `${VOCAB_SOURCE} declares the role, priority, severity and status arrays as module constants (CUPE_ROLES, CUPE_PRIORITIES with slaHours, CUPE_SEVERITIES with legal flags, CUPE_STATUSES with transitions) and getCUPEVocabulary returns them unchanged; no institutional document is cited in the package.` },
      { claim: 'defect', statement: 'No file in the application other than the vocabulary hook, the validator in the package and these routes reads the role flags or the status allowed roles, and none of them enforces a permission with them; the roles named business_agent and chief_steward are not among the roles that the withApi minRole levels enforce.' },
    ],
    def: whole ? [VOCAB_INSTITUTIONAL, VOCAB_CACHE, VOCAB_STAMP] : [VOCAB_INSTITUTIONAL, VOCAB_CACHE],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* voice                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

const VOICE_SENS = 'The audio recording of a spoken claim description, its size and type, the transcript text and its language'

function voiceTranscribe(a) {
  return mk({
    persona: 'Steward dictating a claim description on the new claim form',
    service: `${a.routeFile} (withRoleAuth steward, ${AZURE_SPEECH})`,
    authn: `${SESSION} (withRoleAuth).`,
    authz: 'withRoleAuth at the steward floor: any steward or higher of the organization. No rate limit, no entitlement check, no consent and no audit record. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No table is read or written; the organization of the caller is resolved by the wrapper and not used, and the recording is sent to the speech service with no organization identifier.',
    owner: 'No stored rows: the recording is held in memory for the call and the transcript is returned to the caller.',
    sens: VOICE_SENS,
    priv: 'The recording leaves the application for the external speech service; the caller receives the transcript, the language and a duration field that holds the file size.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST transcribes the uploaded audio through the speech service and returns the text; it writes no row and no file in the application.',
    auditDetail: 'The route writes no row and no audit record; the transcription of a person recording is not recorded anywhere.',
    reqAudit: 'Record who transcribed a recording, when and under which consent, and count each transcription against the entitlement that meters it.',
    does: 'Reads the audio and language from the form data, refuses a missing file, a type outside five audio types and a file over 25 MB, sends the audio to the Azure speech recognizer, answers 400 for an empty result and returns the trimmed transcript, the language and the file size as duration.',
    status: 'PARTIAL',
    gate: GATE[VOICE_CAP],
    deps: [8, 13],
    future: future.voice,
    dec: [D_VOICE],
    corr: [],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const POST = withRoleAuth('steward', async (request, _context) => {"),
      a.h('tenantScope', 'const formData = await request.formData();'),
      a.h('mutation', 'const text = await transcribeAudioWithLanguage(buffer, language);'),
      a.h('audit', 'const text = await transcribeAudioWithLanguage(buffer, language);'),
      a.svc('behavior', AZURE_SPEECH, 'const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);', 'transcribeAudioWithLanguage'),
      a.h('privacy', 'text: text.trim(),'),
      a.h('defect', 'duration: audioFile.size, // Approximate'),
      a.h('defect', 'const maxSize = 25 * 1024 * 1024;'),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler imports no rate limiter, no checkEntitlement and no audit helper, whereas the voice upload route in the same directory imports checkRateLimit and checkEntitlement.' },
    ],
    def: [VOICE_UNMETERED, VOICE_DURATION, VOICE_DISCLOSURE],
  })
}

function voiceUpload(a) {
  return mk({
    persona: 'Member uploading an audio file to be transcribed',
    service: `${a.routeFile} (withRoleAuth member, checkRateLimit, checkEntitlement, Azure OpenAI Whisper)`,
    authn: `${SESSION} (withRoleAuth).`,
    authz: 'withRoleAuth at the member floor, then a per-user rate limit and the ai_search entitlement of the organization: any signed-in member of an organization that holds the entitlement. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No table is read or written; the organization id is used only by the entitlement check, and the recording is sent to the Whisper deployment with no organization identifier.',
    owner: 'No stored rows: the recording is forwarded in memory and the transcript is returned to the caller.',
    sens: VOICE_SENS,
    priv: 'The recording leaves the application for the external Whisper service; the caller receives the transcript, the language, the duration the service measured, the segments, the file name, the size and the latency.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST sends the uploaded audio to the Whisper deployment and returns the transcript; it writes no row and no file in the application.',
    auditDetail: 'The route writes no row and no audit record; a failed processor answer is logged with its body and a success is not recorded.',
    reqAudit: 'Record who transcribed a recording, when and under which consent.',
    does: 'Applies the AI rate limit and the ai_search entitlement, reads the file and language from the form data, refuses a missing file, a type outside the allowed audio types and a file over 25 MB, answers 503 when no Whisper endpoint is configured, sends the audio to the deployment and returns the transcript with its measured duration and segments; a processor failure answers 502.',
    status: 'PARTIAL',
    gate: GATE[VOICE_CAP],
    deps: [8, 13],
    future: future.voice,
    dec: [D_VOICE],
    corr: [],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', "export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {"),
      a.h('authorization', "const entitlement = await checkEntitlement(context.organizationId as string, 'ai_search');"),
      a.h('tenantScope', 'const formData = await request.formData();'),
      a.h('mutation', 'const whisperResponse = await fetch(whisperUrl, {'),
      a.h('privacy', 'transcript: transcription.text,'),
      a.h('behavior', 'const rateLimitResult = await checkRateLimit('),
      a.h('defect', "{ error: entitlement.reason, upgradeUrl: entitlement.upgradeUrl, feature: 'voice_upload' },"),
      a.h('defect', 'body: errBody,'),
      a.h('audit', 'body: errBody,'),
      a.svc('defect', ENTITLEMENTS, 'if (balance.tier !== \'enterprise\' && balance.credits <= 0) {', 'checkEntitlement'),
    ],
    inf: [
      { claim: 'defect', statement: 'checkEntitlement reads the credit balance and returns whether it is positive; the route calls no consume function after the transcription, and no caller of /api/voice/upload exists in the application.' },
    ],
    def: [VOICE_DISCLOSURE, VOICE_ENTITLEMENT],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* workspace telemetry                                                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

function workspaceTelemetry(a) {
  return mk({
    persona: 'Signed-in member whose browser reports an allow-listed workspace usage event',
    service: `${a.routeFile} (withRoleAuth member, logger)`,
    authn: `${SESSION} (withRoleAuth).`,
    authz: 'withRoleAuth at the member floor: any signed-in member. The event name is checked against an allow-list and the payload keys against a second allow-list; no rate limit applies. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
    tenant: 'No table is read or written and no organization identifier is logged; the event carries the workspace id, the tab and a static route.',
    owner: 'No stored rows: the event is written to the application log only.',
    sens: 'Event name, workspace id, tab, static route and a client timestamp; no member, case or grievance identifier',
    priv: 'The log line carries no user id and no organization id; only allow-listed keys are logged, with route values limited to a static route list.',
    mut: 'NOT_MUTATING',
    nonMutationReason: 'The POST writes one logger line for an allow-listed event and returns ok; it writes no row, file or state of the application.',
    auditDetail: 'The only effect is a logger.info line for the event; nothing is stored and no audit record is written.',
    reqAudit: 'Usage telemetry needs no audit record; if the programme owner is to read it the events must be stored where they can be queried.',
    does: 'Parses the body, refuses an event name outside the allow-list with 400, keeps only allow-listed string payload keys (route only when it is a known static route) with the canonical workspace id, logs the event with the payload and answers {ok:true}.',
    status: 'PARTIAL',
    gate: GATE[PILOT_CAP],
    deps: [13],
    future: future.telemetry,
    dec: [],
    corr: [],
    ev: [
      ...guardEv(a, 'withRoleAuth'),
      a.h('authorization', 'if (!event || !ALLOWED_EVENTS.has(event)) {'),
      a.local('authorization', 'sanitizePayload', 'if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue; // drop non-allow-listed keys'),
      a.local('tenantScope', 'sanitizePayload', 'safe.workspace = WORKSPACE_ID;'),
      a.h('mutation', 'return NextResponse.json({ ok: true });'),
      a.h('audit', 'logger.info("[workspace/telemetry] event", {'),
      a.local('privacy', 'sanitizePayload', 'if (isAllowedTelemetryRoute(value)) {'),
      a.local('defect', 'sanitizePayload', 'safe[key] = value;'),
    ],
    inf: [
      { claim: 'defect', statement: 'sanitizePayload applies a length or format check to no key: the tab and timestamp strings are copied as sent, and the handler imports no rate limiter.' },
    ],
    def: [TELEMETRY_LOG],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

export const RISK_SCREENS = {}

export function facts(a) {
  const record = applyCrossTenantExposure(build(a), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a) {
  switch (a.route) {
    case 'targets/route.ts': return targetsPost(a)
    case 'targets/[id]/route.ts': return targetsPatch(a)
    case 'targets/summary/route.ts': return targetsSummary(a)
    case 'tenant/current/route.ts': return tenantCurrent(a)
    case 'test-auth/route.ts': return testAuth(a)
    case 'triage-designations/route.ts': return a.method === 'GET' ? triageGet(a) : a.method === 'POST' ? triagePost(a) : triageDelete(a)
    case 'union-eyes/queue-status/route.ts': return queueStatus(a)
    case 'users/me/organizations/route.ts': return organizationChoices(a)
    case 'v2/[...path]/route.ts': return v2CatchAll(a)
    case 'voice/transcribe/route.ts': return voiceTranscribe(a)
    case 'voice/upload/route.ts': return voiceUpload(a)
    case 'workspace/telemetry/route.ts': return workspaceTelemetry(a)
    default:
      if (a.route.startsWith('vocabulary/')) return vocabularyFacts(a)
      throw new Error(`no platform facts for ${a.route}`)
  }
}
