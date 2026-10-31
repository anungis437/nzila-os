/**
 * Gate 0B.9 facts: the OCRA and OCI assessment paths (a canonical alias and a wrapper over the pseudonymous ICRA
 * product that Gate 0B.8 classified) and the onboarding routes (pending-profile CRUD facades, onboarding events,
 * federation discovery, peer benchmarks, smart defaults and clause suggestions). Every evidence item is produced by
 * `opAuthoring` from the exact handler, the helper or service it reaches, or the resolved schema or policy, and is
 * proved again by the validator. This tranche records the source; it repairs nothing and approves nothing.
 */
import { applyCrossTenantExposure } from './ue-gate0b9-exposure.mjs'
import { posix } from 'node:path'
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, opAuthoring, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'
import { facts as icraFacts } from './ue-gate0b8-icra-integrations-facts.mjs'

const ICRA_CAP = 'UE-OMIT-ICRA-PUBLIC-ASSESSMENT'
const BILLING_CAP = 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING'
const ONBOARDING_CAP = 'UE-OMIT-ORGANIZATION-ONBOARDING'
const GATE = 14

const SMART = `${APP}lib/utils/smart-onboarding.ts`
const ROLE_MW = `${APP}lib/role-middleware.ts`
const ORG_MW = `${APP}lib/organization-middleware.ts`
const EVENT_BUS = `${APP}lib/events/event-bus.ts`
const DB_FILE = `${APP}db/db.ts`
const RATE_LIMITER = `${APP}lib/rate-limiter.ts`
const CRUD_GOVERNANCE_FILE = `${APP}lib/api/crud-governance.ts`
const PENDING_PROFILES = `${APP}db/schema/domains/member/pending-profiles.ts`
const PILOT_EVENTS = `${APP}db/schema/domains/pilot/pilot-events.ts`
const SHARED_CLAUSES = `${APP}db/schema/domains/agreements/shared-library.ts`
const RLS_FOUNDATION = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const RLS_ROUND58 = `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`
const EVENTS_ROUTE = `${API}onboarding/events/route.ts`
const SELF_SERVE = `${APP}components/onboarding/SelfServeOnboarding.tsx`

export const ROUTES = new Set([
  'oci/assessment/route.ts',
  'oci/intake/route.ts',
  'oci/report/[assessmentId]/route.ts',
  'oci/results/[id]/route.ts',
  'ocra/[assessmentId]/answer/route.ts',
  'ocra/[assessmentId]/claim/route.ts',
  'ocra/[assessmentId]/profile/route.ts',
  'ocra/[assessmentId]/submit/route.ts',
  'ocra/checkout/route.ts',
  'ocra/email-results/route.ts',
  'ocra/report/[assessmentId]/route.ts',
  'ocra/results/[id]/route.ts',
  'ocra/start/route.ts',
  'ocra/submit/route.ts',
  'ocra/telemetry/route.ts',
  'onboarding/discover-federation/route.ts',
  'onboarding/events/route.ts',
  'onboarding/peer-benchmarks/route.ts',
  'onboarding/readiness/route.ts',
  'onboarding/route.ts',
  'onboarding/smart-defaults/route.ts',
  'onboarding/suggest-clauses/route.ts',
  'onboarding/transfers/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  ASM_OCRA_ICRA_ALIASES: {
    capabilityId: ICRA_CAP,
    domain: 'OCRA_CANONICAL_ALIAS_OF_ICRA_ASSESSMENT',
    actor: 'Anonymous respondent, or signed-in user holding a claim token, reaching the pseudonymous continuity assessment through the canonical OCRA path names that re-export the ICRA handlers',
    routes: [
      'ocra/start/route.ts', 'ocra/submit/route.ts', 'ocra/telemetry/route.ts', 'ocra/checkout/route.ts', 'ocra/email-results/route.ts',
      'ocra/results/[id]/route.ts', 'ocra/report/[assessmentId]/route.ts',
      'ocra/[assessmentId]/answer/route.ts', 'ocra/[assessmentId]/claim/route.ts', 'ocra/[assessmentId]/profile/route.ts', 'ocra/[assessmentId]/submit/route.ts',
    ],
    evidence: [
      ev(`${API}ocra/start/route.ts`, ' * Canonical `/api/ocra/start` route. Re-exports the legacy'),
      ev(`${API}ocra/start/route.ts`, " * `/api/icra/start` handlers verbatim so both surfaces serve identical"),
      ev(`${API}ocra/report/[assessmentId]/route.ts`, ' * route file (not re-exported). The handler itself is reused from the ICRA'),
    ],
  },
  ASM_OCI_ASSESSMENT_WRAPPERS: {
    capabilityId: ICRA_CAP,
    domain: 'OCI_WRAPPER_OVER_OCRA_ASSESSMENT',
    actor: 'Anonymous respondent reaching the pseudonymous continuity assessment through the OCI path names, which wrap the OCRA alias handlers behind a placeholder organization-access function',
    routes: ['oci/intake/route.ts', 'oci/assessment/route.ts', 'oci/results/[id]/route.ts', 'oci/report/[assessmentId]/route.ts'],
    evidence: [
      ev(`${API}oci/intake/route.ts`, "import { GET as DelegateGET, POST as DelegatePOST } from '../../ocra/start/route';"),
      ev(`${API}oci/intake/route.ts`, 'function requireOrgAccess(_request: Request): boolean {'),
      ev(`${API}oci/assessment/route.ts`, "import { POST as DelegatePOST } from '../../ocra/submit/route';"),
    ],
  },
  ASM_ONBOARDING_PENDING_PROFILES: {
    capabilityId: BILLING_CAP,
    domain: 'ONBOARDING_PATHS_OVER_PRE_SIGNUP_MEMBERSHIP_PROFILES',
    actor: 'Platform operator holding pre-signup membership profiles (Whop membership and usage credits) reached through the onboarding root path and its readiness alias, and the onboarding form that posts to the root path',
    routes: ['onboarding/route.ts', 'onboarding/readiness/route.ts'],
    evidence: [
      ev(PENDING_PROFILES, 'export const pendingProfilesTable = pgTable("pending_profiles", {'),
      ev(PENDING_PROFILES, '  whopMembershipId: text("whop_membership_id"),'),
      ev(`${API}onboarding/route.ts`, ' * CRUD collection route for pendingProfilesTable'),
      ev(`${API}onboarding/readiness/route.ts`, "import { GET as DelegateGET, POST as DelegatePOST } from '../route';"),
    ],
  },
  ASM_ONBOARDING_EVENTS: {
    capabilityId: ONBOARDING_CAP,
    domain: 'ONBOARDING_MILESTONE_EVENT_RECORDING',
    actor: 'Steward or higher of an organization recording an organization-created, user-invited or role-assigned onboarding milestone as a pilot event with an audit row, directly or through the transfers path',
    routes: ['onboarding/events/route.ts', 'onboarding/transfers/route.ts'],
    evidence: [
      ev(`${API}onboarding/events/route.ts`, "eventType: z.enum(['org_created', 'user_invited', 'role_assigned']),"),
      ev(PILOT_EVENTS, 'export const pilotEvents = pgTable('),
      ev(`${API}onboarding/transfers/route.ts`, "import { POST as DelegatePOST } from '../events/route';"),
    ],
  },
  ASM_ONBOARDING_PEER_DISCOVERY: {
    capabilityId: ONBOARDING_CAP,
    domain: 'ONBOARDING_FEDERATION_DISCOVERY_AND_PEER_BENCHMARKS',
    actor: 'Officer discovering candidate parent federations, and member reading peer benchmarks for an organization named in the request, during organization onboarding',
    routes: ['onboarding/discover-federation/route.ts', 'onboarding/peer-benchmarks/route.ts'],
    evidence: [
      ev(SMART, ' * Auto-detect potential parent federation based on province, sector, and size'),
      ev(SMART, ' * Get benchmarks comparing organization to peers and national averages'),
      ev(`${API}onboarding/peer-benchmarks/route.ts`, ' * GET /api/onboarding/peer-benchmarks?organizationId=xxx'),
    ],
  },
  ASM_ONBOARDING_RECOMMENDATIONS: {
    capabilityId: ONBOARDING_CAP,
    domain: 'ONBOARDING_SMART_DEFAULTS_AND_CLAUSE_SUGGESTIONS',
    actor: 'Member reading suggested size-based defaults, and officer reading suggested shared clauses for an organization named in the request, during organization onboarding',
    routes: ['onboarding/smart-defaults/route.ts', 'onboarding/suggest-clauses/route.ts'],
    evidence: [
      ev(SMART, ' * Generate smart defaults for rate limits and features based on org size/type'),
      ev(SMART, ' * Suggest relevant clauses from parent federation and peer organizations'),
      ev(`${API}onboarding/smart-defaults/route.ts`, ' * - Suggested integrations'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const DEF_OCI_WRAPPER = 'DEF-0B9-ASM-OCI-PATHS-WRAP-THE-OCRA-HANDLERS-BEHIND-AN-ORG-ACCESS-FUNCTION-THAT-RETURNS-TRUE-FOR-EVERY-REQUEST'
const DEF_OCRA_EMAIL = 'DEF-0B9-ASM-OCRA-EMAIL-RESULTS-PATH-MAILS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS-WITH-NO-DISCLOSURE-DECISION'
const DEF_TARGET_ORG = 'DEF-0B9-ASM-PEER-BENCHMARKS-AND-CLAUSE-SUGGESTIONS-TAKE-THE-TARGET-ORGANIZATION-FROM-THE-REQUEST-AND-NEVER-COMPARE-IT-TO-THE-SESSION'
const DEF_FEDERATION_DIRECTORY = 'DEF-0B9-ASM-FEDERATION-DISCOVERY-LISTS-FEDERATIONS-AND-CONGRESSES-BY-NAME-AND-MEMBER-COUNT-WITH-NO-ORGANIZATION-PREDICATE'
const DEF_SWALLOWED = 'DEF-0B9-ASM-ONBOARDING-LOOKUP-LIBRARY-SWALLOWS-EVERY-FAILURE-INTO-AN-EMPTY-SUCCESS-RESPONSE'
const DEF_FEDERATION_SCORE = 'DEF-0B9-ASM-FEDERATION-MATCH-IGNORES-THE-SECTOR-AND-REPORTS-SIMILAR-SIZE-FOR-ANY-RATIO'
const DEF_CLAUSE_SCORE = 'DEF-0B9-ASM-CLAUSE-RELEVANCE-SCORES-SHARING-LEVELS-AND-SOURCE-NAMES-THAT-THE-ROW-LEVEL-POLICIES-WITHHOLD'
const DEF_NATIONAL_AVERAGE = 'DEF-0B9-ASM-NATIONAL-AVERAGE-BENCHMARK-FALLS-BACK-TO-HARD-CODED-LITERALS-WITH-NO-INDICATION'
const DEF_SMART_DEFAULTS = 'DEF-0B9-ASM-SMART-DEFAULTS-ARE-A-LITERAL-TABLE-OF-FEATURES-AND-INTEGRATIONS-NO-OTHER-CODE-DEFINES-OR-READS'
const DEF_AUDIT_BUS = 'DEF-0B9-ASM-ONBOARDING-AUDIT-EVENTS-ARE-EMITTED-ON-AN-IN-PROCESS-BUS-WITH-NO-SUBSCRIBER'
const DEF_EVENTS_ASSERTED = 'DEF-0B9-ASM-ONBOARDING-EVENTS-RECORD-CALLER-ASSERTED-MILESTONES-AS-EVENT-AND-AUDIT-ROWS-WITHOUT-PERFORMING-OR-VERIFYING-THEM'
const DEF_EVENTS_METADATA = 'DEF-0B9-ASM-ONBOARDING-EVENT-METADATA-IS-UNBOUNDED-AND-OVERWRITES-THE-STORED-TARGET-AND-ROLE'
const DEF_TRANSFERS = 'DEF-0B9-ASM-ONBOARDING-TRANSFERS-PATH-IS-THE-EVENT-RECORDER-BEHIND-A-PLACEHOLDER-ORG-ACCESS-FUNCTION'
const DEF_ROOT_PENDING = 'DEF-0B9-ASM-ONBOARDING-ROOT-IS-PENDING-PROFILES-REFUSED-BY-GOVERNANCE-WHILE-THE-ONBOARDING-FORM-POSTS-TO-IT'
const DEF_ROOT_ORG_SCOPE = 'DEF-0B9-ASM-ONBOARDING-ROOT-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES'
const DEF_READINESS = 'DEF-0B9-ASM-ONBOARDING-READINESS-IS-THE-PENDING-PROFILES-ROUTE-BEHIND-A-PLACEHOLDER-ORG-ACCESS-FUNCTION'

export const DEFECTS = [
  D(DEF_OCI_WRAPPER, ICRA_CAP, 'MEDIUM',
    'The four OCI routes (intake, assessment, results and report) are wrappers over the OCRA alias handlers, which re-export the ICRA handlers, and each wrapper calls a local requireOrgAccess function that returns the literal true for every request and, for the intake and assessment POST, a validateMutationBoundary whose schema checks only that request.method is a string, so the 401 and 400 branches are unreachable and the file reads as an organization access check over a flow that is in fact anonymous and authorized only by the assessment bearer capability; the OCI paths add a third public name for the same handlers, with the same limits, consent gaps and defects, and no behaviour of their own.'),
  D(DEF_OCRA_EMAIL, ICRA_CAP, 'MEDIUM',
    'The OCRA e-mail results path re-exports the ICRA e-mail results handler, which accepts any syntactically valid address typed by the caller, with no proof that the caller controls it, and sends a branded message from the platform through the e-mail provider that embeds the caller 30-day bearer capability in the link fragment, so any holder of a capability (the start path issues one to anyone) can make the platform mail the capability link to a third party under a second public path name, limited only by the per-process in-memory allowance, and no decision names who may receive an assessment link.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),
  D(DEF_TARGET_ORG, ONBOARDING_CAP, 'HIGH',
    'The peer benchmarks route (member floor) takes the organization to benchmark from the organizationId query parameter and the clause suggestions route (officer floor) takes it from the organizationId body field, and both handlers destructure the session organization as an unused underscore variable and never compare it with the requested id, so the library reads whichever organizations row the request names (and, for benchmarks, the member counts of its peers) and the only boundary left is the row-level-security policy on the organizations table, which the route cannot show was applied to the connection it ran on; a request that names another organization returns that organization data wherever the policy does not hide the row.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any member of any organization can call the peer benchmarks route and any officer can call the clause suggestions route with an organization id of their choice, because both handlers discard the session organization and pass the requested id to the library; what comes back depends only on which organizations rows the database context lets the query see.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'Where the policy does not hide the requested organization, a member of one organization would read another organization member count, its peer average and percentile, and a clause list shaped by its sector, province and hierarchy path, which are organization data that the caller session does not entitle them to.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/onboarding/peer-benchmarks/route.ts', quote: "export const GET = withRoleAuth('member' as MemberRole, async (request, context) => {" },
          { ref: 'apps/union-eyes/app/api/onboarding/peer-benchmarks/route.ts', quote: "const reqOrgId = searchParams.get('organizationId');" },
          { ref: 'apps/union-eyes/app/api/onboarding/suggest-clauses/route.ts', quote: 'const { organizationId: reqOrgId } = validation.data;' },
        ],
        existingContainment: {
          summary: 'The organizations table carries a direct organization policy so that a tenant transaction sees only its own row, and the db import used by the library resolves to the active tenant transaction, so with a connection role that the policy constrains the lookup of another organization finds no row and the library returns an empty list.',
          evidence: [
            { ref: 'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql', quote: "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row" },
            { ref: 'apps/union-eyes/db/db.ts', quote: 'const activeTenantDb = getActiveTenantDb();' },
          ],
        },
        blockingCondition: 'The database role that runs these queries is not constrained by the organizations policy (a role with BYPASSRLS, a superuser, or a connection that does not carry the tenant context the policy expects), or the organizations policy is relaxed to expose hierarchy or peer rows.',
        justification: 'The routes themselves enforce nothing about whose organization is named and any member or officer can reach them, so the exposure rests entirely on a database policy that the source does not prove is applied to the connection in use; the harm is real disclosure of another organization data if that single control does not hold, which is a condition of the deployment and not of the route, so release is blocked wherever the connection role can read organizations rows other than the caller own.',
      },
    }),
  D(DEF_FEDERATION_DIRECTORY, ONBOARDING_CAP, 'MEDIUM',
    'The federation discovery route (officer floor) passes a province, a sector and a member-count estimate from the body to a query over every active organization of type federation or congress, ordered by member count and limited to 10, with no organization predicate, and returns each match with its id, name, organization type, province and member count, so an officer of any organization is offered a directory of other organizations by design, and the only thing that narrows it is the organizations row-level-security policy that lets a tenant transaction see its own row; no source decides what a prospective affiliate may see of a federation.',
    { riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'] }),
  D(DEF_SWALLOWED, ONBOARDING_CAP, 'MEDIUM',
    'The functions behind federation discovery, peer benchmarks and clause suggestions wrap their whole body in a try that logs the error and returns an empty array, and the peer benchmark and clause suggestion lookups throw Organization not found for an id they cannot see before that catch, so a database failure, an unknown or invisible organization id and a genuine absence of matches all reach the route as an empty list and are answered 200 with success true and a total of 0, and the caller cannot tell a refused or failed lookup from an empty result.'),
  D(DEF_FEDERATION_SCORE, ONBOARDING_CAP, 'MEDIUM',
    'The federation matching function accepts a sector and never reads it (the route documents matching on sector and the filters use only organization type, status and province), adds the reason Similar size category whenever both member counts exist whatever their ratio (the score term is the ratio times 20, but the reason is pushed for a ratio of 0.001 as for 0.9), and awards fixed weights of 40, 30, 20 and 10 points, so the matchScore and matchReasons shown to the officer as grounds for choosing a parent federation are literals that do not follow from the data they name.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_CLAUSE_SCORE, ONBOARDING_CAP, 'MEDIUM',
    'The clause suggestion scorer awards 40 points to federation-shared clauses and 50 to congress-level templates and lists the source organization name from the sourceOrganization relation, while the shared clause library policy deliberately gives federation and congress sharing levels no visibility beyond owner, shared-with or public and the organizations policy lets a tenant see only its own row, so those weights can apply only to rows the policy shows (owned, shared with the organization or public), every other source name resolves to Unknown, the sector and province bonuses are added to rows that the filters already restricted to the same sector and province, and the relevance reasons shown to the officer describe a federation hierarchy the data access does not provide.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_NATIONAL_AVERAGE, ONBOARDING_CAP, 'MEDIUM',
    'The peer benchmark function obtains the national average through fetchNationalAverage, which returns the literal table from getFallbackAverage (member count 2500, per-capita rate 45, staff 8, budget 1250000, grievance resolution 45 days) when CLC_API_KEY is unset, when the CLC API answers 404 or an unexpected body, and on any thrown error, and the route returns it as nationalAverage with no flag that it is a fallback; the peer average is computed as a sum divided by the count of peers with a positive member count, which is 0 divided by 0 when every peer has none, and nationalAverage falls back to the peer average when null.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_SMART_DEFAULTS, ONBOARDING_CAP, 'MEDIUM',
    'The smart defaults route returns recommended features, suggested integrations and suggested API, document and storage limits from literal tables keyed on an unvalidated organizationType query value (any unknown value falls back to the local table) and a member count taken with parseInt (NaN, zero and negative values are treated as the default of 100), and the feature and integration names, for example benchmark-suite, cross-federation-collaboration, inter-union-messaging, provincial-lrb, wage-data and microsoft-365, appear in no other source file of the repository while no code reads the suggested limits, so the response presents hard-coded suggestions as intelligent defaults for capabilities that no route, registry or limiter defines.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_AUDIT_BUS, ONBOARDING_CAP, 'MEDIUM',
    'The federation discovery, peer benchmarks and clause suggestions routes record their audit trail with eventBus.emit(AppEvents.AUDIT_LOG, ...) after the work is done, an in-memory event bus whose only retained state is a 1000-entry history, and no code anywhere in the application subscribes to system.audit_log, so no audit row is ever written for these reads of other organization data, the emitted event carries no organization id of the actor, and the comment Emit audit event describes a record that does not exist.',
    { riskCategories: ['AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_EVENTS_ASSERTED, ONBOARDING_CAP, 'MEDIUM',
    'The onboarding events route lets any steward or higher write a pilot event and an atomic audit row named onboarding.event.org_created, onboarding.event.user_invited or onboarding.event.role_assigned for a targetUserId and role that are free strings in the body, without creating the organization, sending an invitation or changing any role and without checking that the target user belongs to the organization or that the role exists, so the pilot event table and the audit log hold attestations that a milestone happened which the caller merely asserted.'),
  D(DEF_EVENTS_METADATA, ONBOARDING_CAP, 'LOW',
    'The onboarding events payload accepts metadata as an unbounded record of unknown values and the handler spreads it after targetUserId and role when it builds the stored pilot event metadata, so a caller can overwrite the targetUserId and role of the event row with different values than the ones the audit row records, and the same unbounded object is written twice (event metadata and audit details) with no size or key limit.'),
  D(DEF_TRANSFERS, ONBOARDING_CAP, 'MEDIUM',
    'The onboarding transfers path advertises a transfer operation but is a wrapper that calls the onboarding events recorder behind a requireOrgAccess function that returns the literal true and a validateMutationBoundary that checks only that request.method is a string, so a POST to /api/onboarding/transfers records an org_created, user_invited or role_assigned event for the session organization (the event type enum has no transfer value) and the unreachable 401 and 400 branches read as an access check that is not there; the transfers page route only redirects to the pilot onboarding dashboard.'),
  D(DEF_ROOT_PENDING, BILLING_CAP, 'MEDIUM',
    'The onboarding root route is the generic CRUD factory over pending_profiles, the pre-signup profile table keyed by e-mail with the Whop membership id and usage credits, which the CRUD governance table lists as DENIED, so every GET and POST answers 403 before any query, while the SelfServeOnboarding component posts the organization name, type, province, plan and terms acceptance to /api/onboarding and navigates to the dashboard only when the response is ok (a refusal is silent), so the onboarding form has no route that can accept it and the path name does not describe the table behind it.'),
  D(DEF_ROOT_ORG_SCOPE, BILLING_CAP, 'HIGH',
    'The onboarding root route sets orgScoped true over pending_profiles, which has no organization column, so the factory adds no tenant predicate: a GET at the support_agent floor would list the pre-signup e-mail, Whop membership id, billing cycle and credit balances of every organization and a POST at the steward floor would insert a profile from the request body; the DENIED entry in the CRUD governance table is the only barrier, and the continuity inheritance route is a second path over the same table, so one governance entry guards both.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'The onboarding root route and its readiness alias are reachable by a support_agent (read) or a steward (write) of any organization, but the CRUD governance table lists pending_profiles as DENIED, so the factory refuses every read and write with 403 before any query and no row is returned or written today.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'If the governance entry changes, the pre-signup e-mail addresses, Whop membership identifiers, billing cycle dates and credit balances of every organization would be listable by any support_agent and insertable by any steward, because orgScoped on a table with no organization column filters nothing.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/onboarding/route.ts', quote: "readRole: 'support_agent'," },
          { ref: 'apps/union-eyes/app/api/onboarding/route.ts', quote: "writeRole: 'steward'," },
        ],
        existingContainment: {
          summary: 'pending_profiles is in the DENIED list of the CRUD governance table and the generic factory calls assertCrudRead and assertCrudWrite, which refuse a DENIED table with 403 before any query or insert.',
          evidence: [
            { ref: 'apps/union-eyes/lib/api/crud-governance.ts', quote: "'external_accounts', 'security_events', 'poll_votes', 'wcb_claims', 'member_employment', 'pending_profiles'," },
            { ref: 'apps/union-eyes/lib/api/crud-governance.ts', quote: "if (gate.class === 'DENIED' || (gate.class === 'SUBJECT_OWNED' && !gate.hasOwnerColumn)) throw ApiError.forbidden(REFUSAL)" },
          ],
        },
        blockingCondition: 'The pending_profiles entry is removed from the DENIED list of the CRUD governance table, or any route serves the table through the generic factory with orgScoped on a table that has no organization column.',
        justification: 'The table has no organization column so the route can never scope a read to a tenant, and one governance entry is the only thing between a role-floor caller and every organization pre-signup payment identifiers; no row is exposed while the entry stands, so the harm needs the entry to change, which makes the disposition conditional on that change and not on any property of the caller.',
      },
    }),
  D(DEF_READINESS, BILLING_CAP, 'MEDIUM',
    'The onboarding readiness path advertises an onboarding readiness check but is a wrapper that calls the onboarding root handlers, the generic CRUD factory over pending_profiles, behind a requireOrgAccess function that returns the literal true and a validateMutationBoundary that checks only that request.method is a string, so no readiness is computed anywhere, every GET and POST is refused 403 by the DENIED governance entry, and the unreachable 401 and 400 branches read as an access check that is not there.'),
]

export const CAPABILITIES = [
  {
    id: ONBOARDING_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'organization-onboarding-assistance',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Steward or officer of an organization being onboarded, reading discovery, benchmark, default and clause suggestions and recording onboarding milestones',
    businessOutcome: 'An organization being onboarded sees only what the institution has decided a new organization may see of federations, peers and shared clauses, every lookup is bounded to the caller own organization or to a declared public directory, a suggestion states the data and the basis it rests on, a failed lookup is reported as a failure, and an onboarding milestone is recorded only for something that happened and is audited with the change.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/onboarding (discover-federation, events, transfers, peer-benchmarks, smart-defaults, suggest-clauses)',
    service: SMART,
    sourceFiles: [
      SMART,
      `${APP}app/api/onboarding/events/route.ts`,
      `${APP}app/api/onboarding/discover-federation/route.ts`,
      `${APP}app/api/onboarding/peer-benchmarks/route.ts`,
      `${APP}app/api/onboarding/suggest-clauses/route.ts`,
      `${APP}app/api/onboarding/smart-defaults/route.ts`,
      PILOT_EVENTS,
    ],
    proof: [{ type: 'path', ref: SMART }],
    auditEvidence: 'The events route commits persistAtomicAudit with the pilot event in one tenant transaction. Federation discovery, peer benchmarks and clause suggestions emit an event on an in-process bus that nothing subscribes to, so they leave no audit row, and smart defaults writes nothing.',
    privacyClassification: 'Organization names, types, provinces and member counts of other organizations, peer averages and percentiles, shared clause titles and types with source organization names, and free-text onboarding event metadata naming a target user and role.',
    gap: 'No existing capability names the onboarding assistance routes. UE-OMIT-FEDERATION-LOCAL-HIERARCHY owns the federation record, affiliates, remittances and the grievance benchmark served under the federations and locals paths for a federation officer, not the lookups a prospective affiliate runs before any affiliation exists; UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION concerns platform operators reading across organizations; UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns analytics reports over operational tables; and UE-OMIT-AI-ADVISORY-GOVERNANCE owns routes whose purpose is a model call, which these deterministic literal-table suggestions are not. The onboarding event recorder writes the pilot event table, which no existing capability names.',
  },
]

export const DECISIONS = [
  {
    id: 'UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE',
    status: 'OUTSTANDING',
    question: 'What may an organization being onboarded see of other organizations (the federations and congresses it could join, the member counts of its peers, the clauses other organizations shared), and is any of it a declared public directory or does each item need the other organization to opt in?',
    sourceState: 'Federation discovery lists federations and congresses by name, province and member count to any officer, peer benchmarks compute averages over other organizations, and clause suggestions list shared clauses with source organization names; the handlers apply no organization predicate and rely on row-level-security policies that show a tenant only its own organization row. No adopted decision names what a prospective affiliate may see.',
    softwareOwners: [ONBOARDING_CAP],
  },
  {
    id: 'UE-INST-ONBOARDING-RECOMMENDATION-BASIS',
    status: 'OUTSTANDING',
    question: 'What data and what institutional rule may an onboarding suggestion (a parent federation match, a peer benchmark, a national average, a recommended feature or integration, a suggested limit) rest on, and how must a suggestion that rests on a fallback or a literal be labelled?',
    sourceState: 'Match scores, relevance scores, feature lists, integration lists and suggested limits are literal weights and tables in lib/utils/smart-onboarding.ts, and the national averages fall back to hard-coded numbers when the CLC API is not configured; the responses carry no indication of the basis. No adopted decision names the source of any of them.',
    softwareOwners: [ONBOARDING_CAP],
  },
  {
    id: 'UE-INST-ONBOARDING-EVENT-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Who may attest that an organization was created, a user was invited or a role was assigned during onboarding, must the attestation be produced by the action itself and not asserted by a caller, and who reads those events?',
    sourceState: 'The onboarding events route lets any steward or higher record these milestones for free-text target user and role values without performing or verifying the action, and the transfers path is a wrapper over the same recorder. No adopted decision names the attesting office or the readers of the events.',
    softwareOwners: [ONBOARDING_CAP],
  },
]

/* ------------------------------------------------------------------------------------------------------------ */
/* risk screens                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

const CHECKOUT_SCREEN = {
  EXTERNAL_DISCLOSURE_WITHOUT_DECISION: {
    reason: 'The only values sent to the external payment service are the assessment id, the tier id and a product label as session metadata plus the price lines; no answer, organization context or respondent field is sent, so no protected assessment content is disclosed.',
    evidence: [{ ref: `${API}icra/checkout/route.ts`, quote: 'icra_assessment_id: assessmentId,' }],
  },
}

const REPORT_SCREEN = {
  SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: {
    reason: 'The PDF is rendered only for a caller who presents the assessment bearer capability, and the response is private and not cached, so the derived report reaches the holder of the source assessment and not another party.',
    evidence: [{ ref: `${API}icra/report/[assessmentId]/route.ts`, quote: "'Cache-Control': 'private, no-store'," }],
  },
}

const LIMITER_SCREEN = {
  EXTERNAL_DISCLOSURE_WITHOUT_DECISION: {
    reason: 'The only external-service match in the reachable code is the rate limiter, whose lines naming OpenAI are comments about other limit presets; the call the route makes sends only a counter key made of the limiter identifier and the user id to the Redis store, so no organization data or request field leaves the platform.',
    evidence: [{ ref: RATE_LIMITER, quote: 'const redisKey = `ratelimit:${identifier}:${key}`;' }],
  },
}

export const RISK_SCREENS = {
  'onboarding/discover-federation/route.ts|POST': LIMITER_SCREEN,
  'onboarding/peer-benchmarks/route.ts|GET': LIMITER_SCREEN,
  'onboarding/suggest-clauses/route.ts|POST': LIMITER_SCREEN,
  'ocra/checkout/route.ts|POST': CHECKOUT_SCREEN,
  'ocra/report/[assessmentId]/route.ts|GET': REPORT_SCREEN,
  'oci/report/[assessmentId]/route.ts|GET': REPORT_SCREEN,
}

/* ------------------------------------------------------------------------------------------------------------ */
/* OCRA aliases and OCI wrappers: the ICRA records read through the chain                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const existsVia = (readText) => (file) => {
  try {
    readText(file)
    return true
  } catch {
    return false
  }
}

const importedSpecOf = (text) => text.match(/(?:export\s*\{[^}]*\}|import\s*\{[^}]*\})\s*from\s*'(\.[^']*)'/)?.[1]

const routeOfSpec = (fromFile, spec) => `${posix.normalize(posix.join(posix.dirname(fromFile), spec))}.ts`.slice(API.length)

/** The ICRA route file behind an OCRA alias or an OCI wrapper, followed through each import or re-export. */
function icraRouteBehind(route, readText) {
  let current = route
  for (let hop = 0; hop < 4 && !current.startsWith('icra/'); hop += 1) {
    const spec = importedSpecOf(readText(`${API}${current}`))
    if (!spec) throw new Error(`${current} neither re-exports nor imports a handler`)
    current = routeOfSpec(`${API}${current}`, spec)
  }
  if (!current.startsWith('icra/')) throw new Error(`${route} does not lead to an ICRA route`)
  return current
}

/**
 * Presents the ICRA authoring helpers to the Gate 0B.8 record builders for an alias route. A statement that the ICRA
 * route proves is re-cited as service implementation reached through the alias chain, so every quote is checked
 * against the file it actually comes from and that file must be reachable from the alias by imports.
 */
function icraProxy(a, readText, icraRoute, delegateSymbol) {
  const icra = opAuthoring(`${icraRoute}|${a.method}`, readText, existsVia(readText))
  const quoteOf = (item) => item.quote
  return {
    route: icra.route,
    method: a.method,
    routeFile: icra.routeFile,
    region: icra.region,
    h: (claim, pattern) => a.svc(claim, icra.routeFile, quoteOf(icra.h(claim, pattern)), a.method),
    local: (claim, symbol, pattern) => a.svc(claim, icra.routeFile, quoteOf(icra.local(claim, symbol, pattern)), symbol),
    imp: (claim, symbol, pattern) => {
      const item = icra.imp(claim, symbol, pattern)
      return a.svc(claim, item.ref, item.quote, item.symbol === 'default' ? undefined : item.symbol)
    },
    svc: a.svc,
    sch: a.sch,
    tbl: (...args) => icra.tbl(...args),
    tableText: icra.tableText,
    grab: icra.grab,
    definedIn: icra.definedIn,
  }
}

function aliasRecord(a, readText, kind) {
  const icraRoute = icraRouteBehind(a.route, readText)
  const delegateSymbol = kind === 'oci' ? (a.method === 'GET' ? 'DelegateGET' : 'DelegatePOST') : undefined
  const record = icraFacts(icraProxy(a, readText, icraRoute, delegateSymbol), readText)
  const icraFile = `${API}${icraRoute}`
  const chain = kind === 'oci'
    ? `${API}${a.route} (${a.method}) wraps the OCRA alias, which re-exports ${icraFile} (${a.method})`
    : `${API}${a.route} (${a.method}) re-exports ${icraFile} (${a.method})`
  record.serviceOwner = chain
  const evidence = [...record.evidence]
  if (kind === 'ocra') {
    evidence.push(
      a.h('authentication', /export\s*\{/),
      a.h('authorization', /export\s*\{/),
      a.h('behavior', /export\s*\{/),
    )
    record.implementedBehavior = `The route file only re-exports the ICRA ${a.method} handler, so it does exactly what ${icraRoute} does under the canonical OCRA path name. ${record.implementedBehavior}`
  } else {
    const delegate = a.method === 'GET' ? 'DelegateGET' : 'DelegatePOST'
    evidence.push(
      a.local('authorization', 'requireOrgAccess', 'return true;'),
      a.h('authorization', 'if (!requireOrgAccess(request)) {'),
      a.h('authentication', `return ${delegate}(request as never`),
    )
    if (a.method === 'POST' && a.route !== 'oci/report/[assessmentId]/route.ts') {
      evidence.push(a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'))
    }
    record.authorizationDetail = `${record.authorizationDetail} The OCI wrapper adds requireOrgAccess, which returns true for every request, so it contributes no decision.`
    record.implementedBehavior = `The route wraps the OCRA alias handler (which re-exports ${icraRoute}) behind a placeholder access function and ${a.method === 'POST' && a.route !== 'oci/results/[id]/route.ts' ? 'a method-string check, then delegates unchanged. ' : 'delegates unchanged. '}${record.implementedBehavior}`
    record.defects = [...new Set([...record.defects, DEF_OCI_WRAPPER])]
  }
  record.evidence = evidence
  if (kind === 'ocra' && a.route === 'ocra/email-results/route.ts') record.defects = [...new Set([...record.defects, DEF_OCRA_EMAIL])]
  return record
}

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding: shared evidence                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const base = (a) => ({ service: `${API}${a.route} (${a.method})` })

const ROLE_AUTHN = 'Authenticated session resolved by withRoleAuth, which delegates to withOrganizationAuth (requireUser, then the canonical organization context of the session).'
const ROLE_TENANT_SESSION = 'The session organization comes from withOrganizationAuth, which runs the handler inside withRLSContext for that organization; the handler then discards it (const { userId, organizationId: _organizationId } = context) and the organization the library reads comes from the request.'
const RLS_ONLY = 'The only tenant boundary is row-level security: the organizations table carries a direct organization policy (a tenant sees only its own row) and the db import resolves to the active tenant transaction; the route itself applies no predicate and compares nothing with the session organization.'

const roleEv = (a, routeLine) => [
  a.h('authorization', routeLine),
  a.imp('authentication', 'withRoleAuth', 'return withOrganizationAuth<T>(async (request, orgContext, params) => {'),
  a.imp('authorization', 'withRoleAuth', 'if (!hasRolePermission(member.role as MemberRole, requiredRole)) {'),
  a.svc('authentication', ORG_MW, 'const baseUser = await requireUser()', 'withOrganizationAuth'),
  a.svc('tenantScope', ORG_MW, 'return await withRLSContext({ organizationId }, async () => {', 'withOrganizationAuth'),
]

const rlsEv = (a) => [
  a.sch('tenantScope', RLS_FOUNDATION, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
  a.svc('tenantScope', DB_FILE, 'const activeTenantDb = getActiveTenantDb();'),
]

const rateLimitEv = (a) => [
  a.h('defect', 'const rateLimit = await checkRateLimit(userId, RATE_LIMITS.ONBOARDING);'),
  a.svc('defect', RATE_LIMITER, "identifier: 'onboarding',"),
]

const auditBusEv = (a) => [
  a.h('audit', 'eventBus.emit(AppEvents.AUDIT_LOG, {'),
  a.svc('audit', EVENT_BUS, "AUDIT_LOG: 'system.audit_log',"),
  a.svc('defect', EVENT_BUS, 'private readonly maxHistorySize = 1000;', 'EventBus'),
]

const COMPUTE_AUDIT_CORR = {
  field: 'audit',
  manifest: 'audit AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE',
  actual: 'The route writes no row and emits its audit event on an in-process bus that nothing subscribes to, so no audit record is written, atomically or otherwise.',
}

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding/discover-federation                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

const discoverFederationPost = (a) => mk({
  ...base(a),
  persona: 'Officer of an organization being onboarded asking which federations or congresses could be its parent',
  authn: ROLE_AUTHN,
  authz: 'withRoleAuth with an officer floor: the member record of the session organization must hold officer or a higher role (a super_admin or admin of the platform organization also passes); a per-user limit of 30 per hour applies. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: `${ROLE_TENANT_SESSION} The query lists federation and congress organizations with no organization predicate. ${RLS_ONLY}`,
  owner: 'No row is written. The response lists organizations rows of type federation or congress that the database context lets the query see.',
  sens: 'Organization id, name, type, province and member count of each matching federation or congress, and the province, sector and member-count estimate the officer typed',
  priv: 'Names and member counts of other organizations are returned to an officer of any organization; the request values (province, sector, estimate) are written to the application log and to the emitted event.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The handler reads organizations rows, scores them in memory and returns the list; it inserts, updates and deletes nothing, and its audit event is emitted on an in-process bus.',
  auditDetail: 'No row is written. The handler emits an audit event with eventBus.emit(AppEvents.AUDIT_LOG, ...) after the lookup; the bus has no subscriber for that event, so no audit record is persisted.',
  reqAudit: 'Persist an audit row for each discovery lookup with the session organization and officer once the institution decides what a prospective affiliate may see, in the same store as other audit records.',
  does: 'Applies a per-user limit, validates the province, the optional sector and a positive integer member-count estimate, queries active organizations of type federation or congress in the province ordered by member count (limit 10), scores each match with fixed weights, logs the request and emits an audit event, and returns the matches with their scores and reasons; any failure inside the lookup returns an empty list that the route answers as success with zero suggestions.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Decide what a prospective affiliate may see of a federation, serve it from a declared directory with an organization-independent mandate instead of a tenant read, report a failed lookup as a failure, state the basis of any match score, and persist the audit row with the session organization.',
  dec: ['UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE', 'UE-INST-ONBOARDING-RECOMMENDATION-BASIS'],
  ev: [
    ...roleEv(a, "export const POST = withRoleAuth('officer' as MemberRole, async (request, context) => {"),
    a.h('tenantScope', 'const { userId, organizationId: _organizationId } = context;'),
    ...rlsEv(a),
    a.h('mutation', 'const suggestions = await autoDetectParentFederation('),
    a.svc('mutation', SMART, 'const potentialParents = await db.query.organizations.findMany({', 'autoDetectParentFederation'),
    a.svc('behavior', SMART, 'return suggestions.sort((a, b) => b.matchScore - a.matchScore);', 'autoDetectParentFederation'),
    a.svc('privacy', SMART, 'memberCount: org.memberCount || 0,', 'autoDetectParentFederation'),
    a.svc('defect', SMART, "eq(organizations.organizationType, 'federation'),", 'autoDetectParentFederation'),
    a.svc('defect', SMART, "matchReasons.push(`Similar size category`);", 'autoDetectParentFederation'),
    a.svc('defect', SMART, "logger.error('Failed to auto-detect parent federation', { error });", 'autoDetectParentFederation'),
    ...auditBusEv(a),
    ...rateLimitEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'autoDetectParentFederation declares a sector parameter and its filters, scoring and reasons never read it; only the province, the organization type and status, the CLC flag and the member count are used, although the route header lists the industry sector as a matching input.' },
    { claim: 'defect', statement: 'A repository search for AUDIT_LOG finds the constant in lib/events/event-bus.ts and the three emit calls in the onboarding routes only; no eventBus.on registration names it.' },
  ],
  def: [DEF_FEDERATION_DIRECTORY, DEF_FEDERATION_SCORE, DEF_SWALLOWED, DEF_AUDIT_BUS],
  corr: [
    { field: 'mutating', manifest: 'mutating true, audit AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE', actual: 'The POST returns a computed list and writes no row.' },
    COMPUTE_AUDIT_CORR,
  ],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding/peer-benchmarks                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const peerBenchmarksGet = (a) => mk({
  ...base(a),
  persona: 'Member of an organization reading how a named organization compares with its peers and a national average',
  authn: ROLE_AUTHN,
  authz: 'withRoleAuth with a member floor: any member record of the session organization passes (a super_admin or admin of the platform organization also passes); a per-user limit of 30 per hour applies. The organization to benchmark is the organizationId query parameter and is never compared with the session organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: `${ROLE_TENANT_SESSION} ${RLS_ONLY}`,
  owner: 'No row is written. The response is built from the organizations row named in the query and the member counts of up to 20 peer organizations that the database context lets the query see.',
  sens: 'The member count of the named organization, the average and percentile of its peers, a national average, and the categories of the benchmarks',
  priv: 'The caller receives the member count of whichever organization the query names, and an average over other organizations member counts, subject only to the row-level-security policy.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row. It emits an audit event with eventBus.emit(AppEvents.AUDIT_LOG, ...) that records the requested organization id; the bus has no subscriber for that event, so no audit record is persisted.',
  reqAudit: 'Persist an audit row for each benchmark read that names the session organization and the requested organization once the institution decides what an organization may compare itself with.',
  does: 'Applies a per-user limit, requires the organizationId query parameter, calls getPeerBenchmarks for it (organization row, peers of the same type, province, sector and size within a factor of three, a national average from the CLC API or a literal fallback), logs the request, emits an audit event and returns the benchmark list and its categories; a lookup that fails or finds no organization returns an empty list that is answered as success.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session and refuse a different id, state the peer set and the basis of the national figure in the response, mark a fallback value as such, report a failed lookup as a failure and persist the audit row.',
  dec: ['UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE', 'UE-INST-ONBOARDING-RECOMMENDATION-BASIS'],
  ev: [
    ...roleEv(a, "export const GET = withRoleAuth('member' as MemberRole, async (request, context) => {"),
    a.h('tenantScope', "const reqOrgId = searchParams.get('organizationId');"),
    a.h('tenantScope', 'const { userId, organizationId: _organizationId } = context;'),
    ...rlsEv(a),
    a.svc('tenantScope', SMART, 'where: eq(organizations.id, organizationId),', 'getPeerBenchmarks'),
    a.h('mutation', 'const benchmarks = await getPeerBenchmarks(reqOrgId);'),
    a.svc('mutation', SMART, 'const peers = await db.query.organizations.findMany({', 'getPeerBenchmarks'),
    a.svc('behavior', SMART, 'const peerAverage = peerCounts.reduce((a, b) => a + b, 0) / peerCounts.length;', 'getPeerBenchmarks'),
    a.svc('privacy', SMART, 'yourValue: org.memberCount,', 'getPeerBenchmarks'),
    a.svc('defect', SMART, 'nationalAverage: nationalAverage ?? Math.round(peerAverage),', 'getPeerBenchmarks'),
    a.svc('defect', SMART, 'memberCount: 2500,', 'getFallbackAverage'),
    a.svc('defect', SMART, 'return fallbacks[metric] || 0;', 'getFallbackAverage'),
    a.svc('defect', SMART, "logger.error('Failed to get peer benchmarks', { error });", 'getPeerBenchmarks'),
    a.svc('defect', SMART, "throw new Error('Organization not found');", 'getPeerBenchmarks'),
    ...auditBusEv(a),
    ...rateLimitEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The route destructures organizationId from the session context under the name _organizationId and never reads it; the only organization used downstream is reqOrgId from the query string, which is non-empty but not validated as a UUID or compared with the session organization.' },
    { claim: 'defect', statement: 'A benchmark is produced only when peerIds is non-empty, and findPeerOrganizations reads other organizations rows through the same db import, so under a policy that shows a tenant only its own organization row the peer list is empty and the benchmark list is empty.' },
  ],
  def: [DEF_TARGET_ORG, DEF_SWALLOWED, DEF_NATIONAL_AVERAGE, DEF_AUDIT_BUS],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding/suggest-clauses                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const suggestClausesPost = (a) => mk({
  ...base(a),
  persona: 'Officer of an organization being onboarded asking which shared clauses suit a named organization',
  authn: ROLE_AUTHN,
  authz: 'withRoleAuth with an officer floor: the member record of the session organization must hold officer or a higher role (a super_admin or admin of the platform organization also passes); a per-user limit of 30 per hour applies. The organization is the organizationId body field and is never compared with the session organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: `${ROLE_TENANT_SESSION} The clause lookup also reads shared_clause_library, whose policy shows a tenant the clauses it owns, those shared with it and public ones. ${RLS_ONLY}`,
  owner: 'No row is written. The response lists shared_clause_library rows (title, type, source organization name, sharing level and a score) selected by the sector, province and hierarchy path of the organization named in the body.',
  sens: 'Clause titles, types, sharing levels and the names of the source organizations, selected by the sector, province and hierarchy path of the named organization',
  priv: 'The caller learns the sector, province and hierarchy-based selection of whichever organization the body names, subject only to the row-level-security policies, and receives source organization names of clauses it can see.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The handler reads the organization and shared clause library rows, scores them in memory and returns the list; it inserts, updates and deletes nothing, and its audit event is emitted on an in-process bus.',
  auditDetail: 'No row is written. The handler emits an audit event with eventBus.emit(AppEvents.AUDIT_LOG, ...) that records the requested organization id; the bus has no subscriber for that event, so no audit record is persisted.',
  reqAudit: 'Persist an audit row for each suggestion lookup that names the session organization and the requested organization once the institution decides who may read shared clauses and their sources.',
  does: 'Applies a per-user limit, validates the organizationId as a GUID, calls suggestRelevantClauses (organization row, then up to 50 public, federation or congress clauses filtered by sector, province and hierarchy path, scored with fixed weights and cut to 20), logs the request, emits an audit event and returns the suggestions with the top score; a failed or empty lookup returns an empty list that is answered as success.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session and refuse a different id, state the basis of each relevance score, report a failed lookup as a failure, and persist the audit row; decide with the institution how federation and congress sharing is resolved before ranking by it.',
  dec: ['UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE', 'UE-INST-ONBOARDING-RECOMMENDATION-BASIS'],
  ev: [
    ...roleEv(a, "export const POST = withRoleAuth('officer' as MemberRole, async (request, context) => {"),
    a.h('tenantScope', 'const { organizationId: reqOrgId } = validation.data;'),
    a.h('tenantScope', 'const { userId, organizationId: _organizationId } = context;'),
    ...rlsEv(a),
    a.sch('tenantScope', RLS_ROUND58, "-- 'public'. 'federation'/'congress' sharing levels are deliberately NOT"),
    a.sch('tenantScope', SHARED_CLAUSES, 'sourceOrganizationId: uuid("source_organization_id")', { resolvesExport: 'sharedClauseLibrary' }),
    a.h('mutation', 'const suggestions = await suggestRelevantClauses(reqOrgId);'),
    a.svc('mutation', SMART, 'const relevantClauses = await db.query.sharedClauseLibrary.findMany({', 'suggestRelevantClauses'),
    a.svc('behavior', SMART, 'return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);', 'suggestRelevantClauses'),
    a.svc('privacy', SMART, "sourceOrgName: (clause.sourceOrganization as any)?.name || 'Unknown',", 'suggestRelevantClauses'),
    a.svc('defect', SMART, "relevanceReasons.push('Federation-shared');", 'suggestRelevantClauses'),
    a.svc('defect', SMART, "relevanceReasons.push('Congress-level template');", 'suggestRelevantClauses'),
    a.svc('defect', SMART, 'filters.push(eq(sharedClauseLibrary.province, org.provinceTerritory.toUpperCase()));', 'suggestRelevantClauses'),
    a.svc('defect', SMART, "logger.error('Failed to suggest relevant clauses', { error });", 'suggestRelevantClauses'),
    a.svc('defect', SMART, "throw new Error('Organization not found');", 'suggestRelevantClauses'),
    ...auditBusEv(a),
    ...rateLimitEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The body schema accepts any GUID as organizationId and the handler never reads the session organization, so the organization whose sector, province and hierarchy path select the clauses is chosen by the caller.' },
    { claim: 'defect', statement: 'The filters list is a conjunction of sharing level, sector, province and, when a hierarchy path exists, source organization in that path, so every returned row already matches the sector and province for which the scorer then adds 25 and 15 points.' },
  ],
  def: [DEF_TARGET_ORG, DEF_CLAUSE_SCORE, DEF_SWALLOWED, DEF_AUDIT_BUS],
  corr: [
    { field: 'mutating', manifest: 'mutating true, audit AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE', actual: 'The POST returns a computed list and writes no row.' },
    COMPUTE_AUDIT_CORR,
  ],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding/smart-defaults                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const smartDefaultsGet = (a) => mk({
  ...base(a),
  persona: 'Member of an organization reading suggested limits, features and integrations for an organization type and size typed in the query',
  authn: ROLE_AUTHN,
  authz: 'withRoleAuth with a member floor: any member record of the session organization passes (a super_admin or admin of the platform organization also passes). No limiter is applied. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: `${ROLE_TENANT_SESSION} The route reads no table: the response is a pure function of the query values.`,
  owner: 'No record: the response is computed from literal tables in lib/utils/smart-onboarding.ts and the organizationType and memberCount query values.',
  sens: 'Suggested API, document and storage limits, feature names and integration names for an organization type and size; no personal or organization data is read',
  priv: 'No personal or organization data is read or returned; the organization type and member count the caller typed are written to the application log.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of literal tables: nothing is written and no audit record is needed.',
  reqAudit: 'No audit record is needed for a computation over literals; if the defaults become a stored configuration, audit the change with the row.',
  does: 'Reads the organizationType (default local) and memberCount (parseInt, treated as 100 when absent, zero, negative or not a number) query values, selects a size category and returns the suggested limits, recommended features and suggested integrations from literal tables, falling back to the local table for any unknown type, with the typed values echoed in the metadata.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: 'Validate the type and member count, derive the suggestion from feature and integration registries that exist, name the basis of each suggested limit, and do not present literals as intelligent defaults.',
  dec: ['UE-INST-ONBOARDING-RECOMMENDATION-BASIS'],
  ev: [
    ...roleEv(a, "export const GET = withRoleAuth('member' as MemberRole, async (request, context) => {"),
    a.h('tenantScope', 'const { userId, organizationId: _organizationId } = context;'),
    a.h('mutation', 'const defaults = getSmartDefaults(organizationType, memberCount);'),
    a.h('behavior', 'const memberCount = memberCountStr ? parseInt(memberCountStr, 10) : undefined;'),
    a.svc('behavior', SMART, 'suggestedRateLimits: rateLimits[sizeCategory],', 'getSmartDefaults'),
    a.svc('privacy', SMART, "recommendedFeatures: featuresByType[organizationType] || featuresByType.local,", 'getSmartDefaults'),
    a.h('defect', "const organizationType = searchParams.get('organizationType') || 'local';"),
    a.svc('defect', SMART, 'const memberCount = estimatedMemberCount || 100;', 'getSmartDefaults'),
    a.svc('defect', SMART, "'cross-federation-collaboration',", 'getSmartDefaults'),
    a.svc('defect', SMART, "congress: ['clc-api', 'statistics-canada', 'provincial-lrb'],", 'getSmartDefaults'),
    a.svc('defect', SMART, "local: ['google-workspace', 'microsoft-365', 'zoom'],", 'getSmartDefaults'),
  ],
  inf: [
    { claim: 'defect', statement: 'A repository search finds benchmark-suite, cross-federation-collaboration, inter-union-messaging, provincial-lrb and microsoft-365 only in lib/utils/smart-onboarding.ts, and suggestedRateLimits only in that file and its test, so no registry, route or limiter defines or reads the suggested names and limits.' },
  ],
  def: [DEF_SMART_DEFAULTS],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding/events and transfers                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const eventsBase = (a) => ({
  ...base(a),
  authz: 'withOrganizationAuth resolves the session organization, then the handler requires hasMinRole(steward): a steward, officer or admin of the session organization may record the event, and a refusal is answered 403. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization from withOrganizationAuth and is never read from the body; the insert and the audit row run inside withRLSContext for that organization and write that organization id.',
  owner: 'pilot_events rows of the session organization (user id of the actor, a server-built session id, the event type and a metadata object) and the audit row written with each.',
  sens: 'The acting user id, the event type, and a target user id, role and free-form metadata that the caller typed',
  priv: 'The target user id, role and metadata the caller typed are stored in the event row and again in the audit details; nothing checks that the target is a person of the organization.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The pilot_events insert and persistAtomicAudit (onboarding.event.<type>) run on the same transaction handle inside withRLSContext, so the event cannot commit without its audit row.',
  reqAudit: 'Keep the in-transaction audit row, and record it only for an action that the system performed, with the target and role checked against the organization.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Produce the milestone event from the action that performs it (organization creation, invitation, role grant), validate the target and role against the organization, bound the metadata, and name the office that may attest an onboarding event.',
  dec: ['UE-INST-ONBOARDING-EVENT-AUTHORITY'],
})

const eventsPost = (a) => mk({
  ...eventsBase(a),
  persona: 'Steward or higher of an organization recording an organization-created, user-invited or role-assigned onboarding milestone',
  authn: 'Authenticated session resolved by withOrganizationAuth (requireUser, then the canonical organization context of the session).',
  does: 'Requires a steward or higher role, validates the body (an event type from three values, an optional target user id and role as free strings, and an optional metadata record), inserts a pilot_events row for the session organization and writes the audit row onboarding.event.<type> on the same transaction, returning ok with the event type; no organization is created, no invitation sent and no role changed by the call.',
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', "const canEmit = await hasMinRole('steward');"),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', 'await withRLSContext({ organizationId }, async (tx) => {'),
    a.tbl('tenantScope', 'pilotEvents', /organizationId: uuid\("organization_id"\)\.notNull\(\),/),
    a.h('mutation', '.insert(pilotEvents)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', 'action: `onboarding.event.${parsed.data.eventType}`,'),
    a.h('privacy', 'metadata: parsed.data.metadata ?? {},'),
    a.local('defect', 'payloadSchema', 'metadata: z.record(z.string(), z.unknown()).optional(),'),
    a.h('defect', '...(parsed.data.metadata ?? {}),'),
    a.h('defect', 'targetUserId: parsed.data.targetUserId,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler reads no user, membership or role table before the insert: targetUserId and role are passed from the validated body to the event metadata and the audit details unchanged.' },
  ],
  def: [DEF_EVENTS_ASSERTED, DEF_EVENTS_METADATA],
  corr: [],
})

const transfersPost = (a) => mk({
  ...eventsBase(a),
  persona: 'Steward or higher of an organization using the onboarding transfers path, which records an onboarding event',
  authn: 'Authenticated session resolved by withOrganizationAuth in the delegated onboarding events handler; the wrapper adds only a requireOrgAccess placeholder that returns true.',
  authz: `${eventsBase(a).authz} The wrapper guard requireOrgAccess always returns true and the method-string check always passes, so they contribute nothing.`,
  does: 'Runs the onboarding events POST unchanged after the placeholder guard and a check that the request has a method string, so a POST to the transfers path validates the event body, inserts a pilot_events row for the session organization and writes the audit row on the same transaction; no transfer of members, data or ownership is performed or recorded, and the event type enum has no transfer value.',
  ev: [
    a.local('authorization', 'requireOrgAccess', 'return true;'),
    a.h('authorization', 'if (!requireOrgAccess(request)) {'),
    a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'),
    a.h('authentication', 'return DelegatePOST(request as never, context as never);'),
    a.svc('authentication', EVENTS_ROUTE, 'export const POST = withOrganizationAuth(async (request, context) => {', 'POST'),
    a.svc('authorization', EVENTS_ROUTE, "const canEmit = await hasMinRole('steward');", 'POST'),
    a.svc('tenantScope', EVENTS_ROUTE, 'await withRLSContext({ organizationId }, async (tx) => {', 'POST'),
    a.svc('mutation', EVENTS_ROUTE, '.insert(pilotEvents)', 'POST'),
    a.svc('audit', EVENTS_ROUTE, 'await persistAtomicAudit(tx, {', 'POST'),
    a.svc('behavior', EVENTS_ROUTE, 'action: `onboarding.event.${parsed.data.eventType}`,', 'POST'),
    a.svc('defect', EVENTS_ROUTE, 'targetUserId: parsed.data.targetUserId,', 'POST'),
    a.svc('defect', `${API}onboarding/events/route.ts`, "eventType: z.enum(['org_created', 'user_invited', 'role_assigned']),", 'payloadSchema'),
  ],
  inf: [
    { claim: 'defect', statement: 'The transfers page route redirects to the pilot onboarding dashboard and carries no transfer logic, and the wrapper imports only the events POST, so nothing named transfer is recorded by the path.' },
  ],
  def: [DEF_TRANSFERS, DEF_EVENTS_ASSERTED, DEF_EVENTS_METADATA],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* onboarding root and readiness: pending_profiles through the CRUD factory                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const pendingProfilesProfile = {
  persona: 'Platform support agent or organization steward reaching, through the onboarding path, the pre-signup profile table that holds membership purchase identifiers',
  owner: 'pending_profiles rows: a pre-signup profile keyed by a unique e-mail address with the Whop membership id, billing cycle dates and usage credits; the table has no organization column and no owner column.',
  sens: 'Pre-signup e-mail address, Whop user and membership identifiers, plan duration, billing cycle dates and credit balances',
  priv: (m) => (m === 'GET'
    ? 'No row is read: pending_profiles is DENIED in the CRUD governance table so the read is refused with 403 before any query. Were the entry lifted, the support_agent floor would list the pre-signup e-mail and payment identifiers of every organization because the table has no organization column.'
    : 'No row is written: the write is refused with 403. Were the entry lifted, a steward of any organization could insert a pre-signup profile carrying a Whop membership id and usage credits.'),
  does: (m, _model, floor) => (m === 'GET'
    ? `Would list pending_profiles rows at a role floor of ${floor}; because the table is DENIED the factory refuses the read with 403 and returns nothing. The path is named onboarding but the table is the pre-signup membership profile.`
    : `Would insert a pending_profiles row from the body at a role floor of ${floor}; because the table is DENIED the factory refuses the write with 403. The onboarding form posts organization details to this path, which this table cannot store.`),
  future: 'Give the onboarding form a route with its own table, organization binding and authority decision, and retire the alias; if pending_profiles is ever served it must be a platform-staff route with an organization-independent mandate and an audited write.',
  gate: GATE,
  deps: [9, 13],
  decisions: ['UE-INST-PLATFORM-CONTRACT-AUTHORITY', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  def: () => [DEF_ROOT_PENDING],
  reqRead: 'No audit record is needed for a refused read; audit reads of pre-signup payment identifiers if a platform route ever serves them.',
}

function rootRecord(a, readText) {
  const record = crudRecord(a, readText, pendingProfilesProfile)
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? DEF_ROOT_ORG_SCOPE : id)))]
  if (a.method === 'POST') {
    record.inferences.push({ claim: 'defect', statement: `${SELF_SERVE} posts the organization name, type, province, plan and terms acceptance with fetch('/api/onboarding', ...) and navigates only when the response is ok; the route does not import that component, so this is a caller observation and not route behavior.` })
  }
  return record
}

/** Presents the onboarding root route to the CRUD record builder for the readiness wrapper that delegates to it. */
function rootProxy(a, readText) {
  const root = opAuthoring(`onboarding/route.ts|${a.method}`, readText, existsVia(readText))
  return {
    route: root.route,
    method: a.method,
    routeFile: root.routeFile,
    region: root.region,
    h: (claim, pattern) => a.svc(claim, root.routeFile, root.h(claim, pattern).quote),
    local: (claim, symbol, pattern) => a.local(claim, symbol, pattern),
    imp: (claim, symbol, pattern) => {
      const item = root.imp(claim, symbol, pattern)
      return a.svc(claim, item.ref, item.quote, item.symbol === 'default' ? undefined : item.symbol)
    },
    svc: a.svc,
    sch: a.sch,
    tbl: (...args) => root.tbl(...args),
    tableText: root.tableText,
    grab: root.grab,
    definedIn: root.definedIn,
  }
}

function readinessRecord(a, readText) {
  const delegate = a.method === 'GET' ? 'DelegateGET' : 'DelegatePOST'
  const record = crudRecord(rootProxy(a, readText), readText, { ...pendingProfilesProfile, def: () => [DEF_ROOT_PENDING, DEF_READINESS] })
  record.defects = [...new Set(record.defects.map((id) => (id === 'DEF-0B4-CRUD-ORG-SCOPE-NO-OP-ON-TABLE-WITHOUT-ORG-COLUMN' ? DEF_ROOT_ORG_SCOPE : id)))]
  record.serviceOwner = `${API}${a.route} (${a.method}) wraps ${API}onboarding/route.ts (${a.method}), the generic CRUD factory over pending_profiles`
  record.authorizationDetail = `${record.authorizationDetail} The readiness wrapper adds requireOrgAccess, which returns true for every request${a.method === 'POST' ? ' and a method-string check that always passes' : ''}, so it contributes no decision.`
  record.implementedBehavior = `The path is named readiness but computes no readiness: it calls the onboarding root handler unchanged. ${record.implementedBehavior}`
  record.evidence.push(
    a.local('authorization', 'requireOrgAccess', 'return true;'),
    a.h('authorization', 'if (!requireOrgAccess(request)) {'),
    a.h('authentication', `return ${delegate}(request as never, context as never);`),
  )
  if (a.method === 'POST') {
    record.evidence.push(a.local('authorization', 'validateMutationBoundary', 'return MutationBoundarySchema.safeParse({ method: request.method }).success;'))
  }
  return record
}

/* ------------------------------------------------------------------------------------------------------------ */

const ONBOARDING = {
  'onboarding/discover-federation/route.ts|POST': discoverFederationPost,
  'onboarding/peer-benchmarks/route.ts|GET': peerBenchmarksGet,
  'onboarding/suggest-clauses/route.ts|POST': suggestClausesPost,
  'onboarding/smart-defaults/route.ts|GET': smartDefaultsGet,
  'onboarding/events/route.ts|POST': eventsPost,
  'onboarding/transfers/route.ts|POST': transfersPost,
}

function build(a, readText) {
  if (a.route.startsWith('ocra/')) return aliasRecord(a, readText, 'ocra')
  if (a.route.startsWith('oci/')) return aliasRecord(a, readText, 'oci')
  if (a.route === 'onboarding/route.ts') return rootRecord(a, readText)
  if (a.route === 'onboarding/readiness/route.ts') return readinessRecord(a, readText)
  const builder = ONBOARDING[`${a.route}|${a.method}`]
  if (!builder) throw new Error(`no Gate 0B.9 assessments-onboarding facts for ${a.route}|${a.method}`)
  return builder(a)
}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}
