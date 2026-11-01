/**
 * Gate 0B.10 facts: the pilot routes. They cover the public pilot application intake and the platform-tier review of an
 * application (organization verification and rebinding, commercial terms approval, the commercial state transition, the
 * proposal, package, artifact, intelligence, timeline and reference profile outputs), the pilot usage telemetry routes
 * (events, feedback, champions, friction, metrics, conversion readiness), the pilot enrollment and onboarding checklist
 * routes, the demo-data and CUPE bootstrap routes and the platform pilot overview. Every evidence item is produced by
 * `opAuthoring` from the exact handler, the helper or service it reaches, or the resolved schema or policy, and is proved
 * again by the validator. This tranche records the source; it repairs nothing and approves nothing.
 */
import { applyCrossTenantExposure } from './ue-gate0b10-exposure.mjs'
import { mk } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const APPLICATION_CAP = 'UE-OMIT-PILOT-APPLICATION-COMMERCIALIZATION'
const PROGRAM_CAP = 'UE-OMIT-PILOT-PROGRAM-OPERATIONS'
const ENUMERATION_CAP = 'UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION'
const GATE = 14

const OWNERSHIP = `${APP}lib/pilot/pilot-ownership.ts`
const TERMS = `${APP}lib/pilot/commercial-terms-authority.ts`
const WAVE1 = `${APP}lib/pilot/commercialization-wave1.ts`
const PILOT_MUTATION = `${APP}lib/pilot/pilot-mutation.ts`
const RESPONSES = `${APP}lib/pilot/responses-authority.ts`
const DEMO_DATA = `${APP}lib/pilot/cape-demo-data.ts`
const DEMO_RUNTIME = `${APP}lib/config/pilot-demo-runtime.ts`
const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`
const AUTH_GUARD = `${APP}lib/api-auth-guard.ts`
const PUBLIC_ROUTES = `${APP}lib/public-routes.ts`
const CRM = `${APP}lib/services/crm-service.ts`
const SIGNALS = `${APP}lib/services/pilot-signals.ts`
const FRICTION = `${APP}lib/services/pilot-friction.ts`
const METRICS = `${APP}lib/services/pilot-metrics.ts`
const TRACKING = `${APP}lib/services/pilot-tracking.ts`
const WITH_API = `${APP}lib/api/with-api.ts`
const MARKETING_SCHEMA = `${APP}db/schema/domains/marketing.ts`
const PILOT_EVENTS = `${APP}db/schema/domains/pilot/pilot-events.ts`
const PILOT_FEEDBACK = `${APP}db/schema/domains/pilot/pilot-feedback.ts`
const PILOT_ONBOARDING = `${APP}db/schema/domains/pilot/pilot-onboarding.ts`
const PILOT_DEMO_SEEDS = `${APP}db/schema/domains/pilot/pilot-demo-seeds.ts`
const PILOT_ENROLLMENTS = `${APP}db/schema/domains/pilot/pilot-enrollments.ts`
const RLS_ROUND58 = `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`
const APPLY_ROUTE = `${API}pilot/apply/route.ts`
const ID_ROUTE = `${API}pilot/apply/[id]/route.ts`
const BOOTSTRAP_ROUTE = `${API}pilot/bootstrap/cupe/route.ts`
const ONBOARDING_ROUTE = `${API}pilot/onboarding/route.ts`
const BOOTSTRAP_FIXTURE = 'fixtures/cupe/pilot-org/cupe-pilot-setup.json'

export const ROUTES = new Set([
  'pilot/apply/[id]/approve-commercial-terms/route.ts',
  'pilot/apply/[id]/artifacts/route.ts',
  'pilot/apply/[id]/commercial-transition/route.ts',
  'pilot/apply/[id]/commercialization-timeline/route.ts',
  'pilot/apply/[id]/intelligence/route.ts',
  'pilot/apply/[id]/package-export/route.ts',
  'pilot/apply/[id]/proposal/route.ts',
  'pilot/apply/[id]/rebind-organization/route.ts',
  'pilot/apply/[id]/reference-profile/route.ts',
  'pilot/apply/[id]/route.ts',
  'pilot/apply/[id]/verify-organization/route.ts',
  'pilot/apply/route.ts',
  'pilot/bootstrap/cupe/route.ts',
  'pilot/champions/route.ts',
  'pilot/current/route.ts',
  'pilot/demo-data/route.ts',
  'pilot/events/route.ts',
  'pilot/feedback/route.ts',
  'pilot/friction/route.ts',
  'pilot/metrics/route.ts',
  'pilot/onboarding/route.ts',
  'pilot/overview/route.ts',
  'pilot/readiness/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  PIL_APPLICATION_INTAKE_AND_RECORD: {
    capabilityId: APPLICATION_CAP,
    domain: 'PILOT_APPLICATION_PUBLIC_INTAKE_AND_APPLICATION_RECORD',
    actor: 'Anonymous prospective union submitting a pilot application, a platform-tier reader listing applications, and a steward of the organization the application claims (or a platform-tier actor) reading and amending the application record',
    routes: ['pilot/apply/route.ts', 'pilot/apply/[id]/route.ts'],
    evidence: [
      ev(PUBLIC_ROUTES, "'/api/pilot/apply', // Public pilot-program lead-intake form (POST only; GET requires system_admin, checked in the route handler itself)"),
      ev(APPLY_ROUTE, ' * CRUD collection route for pilot applications'),
      ev(ID_ROUTE, ' * CRUD item route for pilot applications'),
      ev(MARKETING_SCHEMA, "verifiedOrganizationId: uuid('verified_organization_id').references(() => organizations.id, { onDelete: 'set null' }),"),
    ],
  },
  PIL_APPLICATION_VERIFICATION_AND_TERMS: {
    capabilityId: APPLICATION_CAP,
    domain: 'PILOT_APPLICATION_ORGANIZATION_BINDING_COMMERCIAL_TERMS_AND_STATE_TRANSITION',
    actor: 'Platform-tier administrator binding a pilot application to an organization, correcting the binding, approving its commercial terms and moving it through the commercial states that create a contract, an invoice and a subscription',
    routes: [
      'pilot/apply/[id]/verify-organization/route.ts',
      'pilot/apply/[id]/rebind-organization/route.ts',
      'pilot/apply/[id]/approve-commercial-terms/route.ts',
      'pilot/apply/[id]/commercial-transition/route.ts',
    ],
    evidence: [
      ev(`${API}pilot/apply/[id]/verify-organization/route.ts`, ' * Platform-only binding of a pilot application to a verified organization'),
      ev(`${API}pilot/apply/[id]/approve-commercial-terms/route.ts`, ' * Platform-only approval of a pilot application\'s commercial terms (PR'),
      ev(`${API}pilot/apply/[id]/commercial-transition/route.ts`, "const FINANCIAL_TARGET_STATES: CommercialState[] = ['contract_sent', 'invoice_issued', 'subscription_active'];"),
      ev(OWNERSHIP, 'export const PILOT_PLATFORM_ACCESS_MIN_LEVEL: number = ROLE_HIERARCHY.system_admin;'),
    ],
  },
  PIL_APPLICATION_PROPOSAL_AND_REFERENCE_OUTPUTS: {
    capabilityId: APPLICATION_CAP,
    domain: 'PILOT_APPLICATION_PROPOSAL_PACKAGE_ARTIFACT_INTELLIGENCE_TIMELINE_AND_REFERENCE_OUTPUTS',
    actor: 'Steward of the organization an application claims, or a platform-tier actor, reading and persisting the generated proposal, package export, artifact versions, intelligence notes, timeline and reference profile of a pilot application',
    routes: [
      'pilot/apply/[id]/proposal/route.ts',
      'pilot/apply/[id]/package-export/route.ts',
      'pilot/apply/[id]/artifacts/route.ts',
      'pilot/apply/[id]/intelligence/route.ts',
      'pilot/apply/[id]/commercialization-timeline/route.ts',
      'pilot/apply/[id]/reference-profile/route.ts',
    ],
    evidence: [
      ev(WAVE1, 'export function buildProposalPackage('),
      ev(`${API}pilot/apply/[id]/package-export/route.ts`, "'# Pilot Package Export',"),
      ev(`${API}pilot/apply/[id]/reference-profile/route.ts`, ": 'Pilot Sponsor',"),
      ev(PILOT_MUTATION, 'export async function withLockedPilotMutation<T>('),
    ],
  },
  PIL_USAGE_TELEMETRY_AND_FEEDBACK: {
    capabilityId: PROGRAM_CAP,
    domain: 'PILOT_USAGE_EVENT_RECORDING_FEEDBACK_AND_DERIVED_ENGAGEMENT_SIGNALS',
    actor: 'Member recording a pilot usage event or ease-of-use feedback for their own organization, and an administrator reading pilot feedback, champion, friction, engagement metric and conversion signals',
    routes: [
      'pilot/events/route.ts',
      'pilot/feedback/route.ts',
      'pilot/champions/route.ts',
      'pilot/friction/route.ts',
      'pilot/metrics/route.ts',
      'pilot/readiness/route.ts',
    ],
    evidence: [
      ev(PILOT_EVENTS, 'export const pilotEvents = pgTable('),
      ev(SIGNALS, 'export async function detectChampions('),
      ev(SIGNALS, 'export async function assessConversionReadiness('),
      ev(FRICTION, 'export async function getFrictionReport('),
      ev(METRICS, 'export async function getPilotMetrics('),
      ev(PILOT_FEEDBACK, 'export const pilotFeedback = pgTable('),
    ],
  },
  PIL_ENROLMENT_AND_ONBOARDING_CHECKLIST: {
    capabilityId: PROGRAM_CAP,
    domain: 'PILOT_ENROLLMENT_METRICS_AND_ONBOARDING_CHECKLIST',
    actor: 'Officer of an enrolled organization reading its pilot metrics and reading or toggling its pilot onboarding checklist',
    routes: ['pilot/current/route.ts', 'pilot/onboarding/route.ts'],
    evidence: [
      ev(PILOT_ENROLLMENTS, 'export const pilotEnrollments = pgTable('),
      ev(PILOT_ONBOARDING, 'export const pilotChecklistItems = pgTable('),
      ev(ONBOARDING_ROUTE, 'const CHECKLIST_ITEM_IDS = ['),
    ],
  },
  PIL_DEMO_DATA_AND_BOOTSTRAP: {
    capabilityId: PROGRAM_CAP,
    domain: 'PILOT_DEMO_DATA_SEEDING_AND_CUPE_ORGANIZATION_BOOTSTRAP',
    actor: 'Officer seeding or purging a fictional demo dataset in their own organization, and platform-tier administrator bootstrapping or resetting the CUPE pilot organization from a fixture, in a runtime whose NZILA_MODE is pilot or demo',
    routes: ['pilot/demo-data/route.ts', 'pilot/bootstrap/cupe/route.ts'],
    evidence: [
      ev(DEMO_RUNTIME, "const DEMO_MUTATION_MODES = ['pilot', 'demo'] as const"),
      ev(DEMO_DATA, 'export function generateDemoGrievances(organizationId: string) {'),
      ev(PILOT_DEMO_SEEDS, 'export const pilotDemoSeeds = pgTable('),
      ev(BOOTSTRAP_ROUTE, "action: 'pilot.bootstrap.cupe',"),
    ],
  },
  PIL_PLATFORM_PILOT_OVERVIEW: {
    capabilityId: ENUMERATION_CAP,
    domain: 'PLATFORM_PILOT_OVERVIEW_ACROSS_ENROLLED_ORGANIZATIONS',
    actor: 'Platform administrator or officer of the platform organization reading adoption, engagement and case figures of every actively enrolled pilot organization',
    routes: ['pilot/overview/route.ts'],
    evidence: [
      ev(`${API}pilot/overview/route.ts`, '.where(eq(pilotEnrollments.status, "active"));'),
      ev(`${API}pilot/overview/route.ts`, 'return NextResponse.json({ organizations: orgMetrics });'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const DEF_TRANSITION = 'DEF-0B10-PIL-COMMERCIAL-TRANSITION-RECORDS-SIGNED-ACTIVE-CONTRACTS-AND-ISSUED-INVOICES-WITH-NO-COUNTERPART-ACCEPTANCE-AND-ADVANCES-STATE-WHEN-EFFECTS-ARE-ONLY-STAGED'
const DEF_PLATFORM_TIER = 'DEF-0B10-PIL-PLATFORM-TIER-OF-THE-PILOT-ROUTES-IS-ANY-ROLE-TITLE-AT-OR-ABOVE-SYSTEM-ADMIN-LEVEL-AND-NOT-A-PLATFORM-MANDATE'
const DEF_CLAIM_OWNER = 'DEF-0B10-PIL-APPLICATION-OWNERSHIP-BEFORE-VERIFICATION-RESTS-ON-THE-ORGANIZATION-ID-THE-ANONYMOUS-APPLICANT-TYPED-INTO-THE-FORM'
const DEF_RATE_KEY = 'DEF-0B10-PIL-PUBLIC-APPLICATION-RATE-LIMIT-IS-KEYED-ON-THE-FIRST-FORWARDED-FOR-VALUE-THE-CLIENT-CAN-SUPPLY'
const DEF_HUBSPOT = 'DEF-0B10-PIL-PUBLIC-APPLICATION-SENDS-THE-TYPED-CONTACT-TO-HUBSPOT-WITH-NO-PROOF-OF-THE-ADDRESS-AND-NO-CONSENT-DECISION'
const DEF_RESPONSES_UNBOUNDED = 'DEF-0B10-PIL-PUBLIC-APPLICATION-RESPONSES-OBJECT-AND-ASSESSMENT-PASSTHROUGH-HAVE-NO-SIZE-OR-DEPTH-BOUND'
const DEF_SIGNALS = 'DEF-0B10-PIL-PROPOSAL-SCORES-AND-CUSTOMER-SUCCESS-SIGNALS-ARE-COMPUTED-FROM-THE-APPLICANT-SELF-ASSESSED-READINESS-SCORE-AND-THE-STAGE-REACHED'
const DEF_VERIFY = 'DEF-0B10-PIL-ORGANIZATION-VERIFICATION-CHECKS-ONLY-THAT-THE-TARGET-ORGANIZATION-ROW-EXISTS-AND-RECORDS-NO-PROOF-OR-REASON'
const DEF_APPROVE_TERMS = 'DEF-0B10-PIL-COMMERCIAL-TERMS-ARE-SET-BY-ONE-ADMINISTRATOR-FROM-A-TYPED-MEMBER-COUNT-AND-AMOUNT-WITH-NO-APPLICANT-ACCEPTANCE'
const DEF_UNBOUNDED_TEXT = 'DEF-0B10-PIL-PILOT-WRITE-ROUTES-CAST-THE-JSON-BODY-WITHOUT-A-SCHEMA-AND-STORE-CALLER-TEXT-IN-AN-UNBOUNDED-JSONB-COLUMN'
const DEF_NO_AUDIT_WRITES = 'DEF-0B10-PIL-ARTIFACT-INTELLIGENCE-AND-REFERENCE-WRITES-COMMIT-NO-AUDIT-ROW-THOUGH-THE-MANIFEST-DECLARES-ATOMIC-AUDIT'
const DEF_REFERENCE = 'DEF-0B10-PIL-REFERENCE-PROFILE-PRESENTS-A-DEFAULT-TESTIMONIAL-A-SIX-HOUR-FLOOR-AND-SCORE-DERIVED-FIGURES-AS-PILOT-OUTCOMES-AND-STORES-THEM-AS-A-VERSIONED-CASE-STUDY'
const DEF_TELEMETRY_XT = 'DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION-NAMED-IN-THE-QUERY-AT-AN-ADMIN-FLOOR-AND-RETURN-PER-USER-IDS-THROUGH-THE-BARE-DB-IMPORT'
const DEF_EVENTS_ASSERTED = 'DEF-0B10-PIL-USAGE-EVENTS-ARE-CALLER-ASSERTED-AND-DRIVE-THE-CHAMPION-AND-CONVERSION-SIGNALS-WITHOUT-ANY-CHECK-THAT-THE-ACTION-HAPPENED'
const DEF_BOOTSTRAP_RESET = 'DEF-0B10-PIL-CUPE-BOOTSTRAP-RESET-DELETES-ALL-GRIEVANCES-MEMBERS-AND-CHECKLIST-ROWS-OF-THE-ORGANIZATION-AT-THE-FIXTURE-SLUG-WITH-NO-DEMO-MARKER'
const DEF_BOOTSTRAP_REPORT = 'DEF-0B10-PIL-CUPE-BOOTSTRAP-REPORTS-WORKSITES-IT-NEVER-WRITES-AND-LITERAL-ONBOARDING-COUNTS-FOR-CHECKLIST-IDS-THE-ONBOARDING-ROUTE-DOES-NOT-READ'
const DEF_DEMO_DATA = 'DEF-0B10-PIL-DEMO-DATA-INSERTS-FICTIONAL-GRIEVANCES-AND-NAMED-FEDERAL-EMPLOYERS-INTO-THE-LIVE-TABLES-WITH-NO-ROW-MARKER-AND-DELETES-BY-NUMBER-AND-EMAIL-PATTERN'
const DEF_PILOT_METRICS = 'DEF-0B10-PIL-PILOT-ADOPTION-ENGAGEMENT-AND-RESOLUTION-FIGURES-ARE-ROW-UPDATE-PROXIES-AND-OPEN-CASE-AGE-WITH-STORED-FIGURES-AS-FALLBACK'
const DEF_CHECKLIST_ASSERTED = 'DEF-0B10-PIL-ONBOARDING-CHECKLIST-ITEMS-ARE-TOGGLED-BY-THE-CALLER-WITH-NO-CHECK-THAT-THE-STEP-HAPPENED'
const DEF_OVERVIEW = 'DEF-0B10-PIL-PILOT-OVERVIEW-LISTS-EVERY-ENROLLED-ORGANIZATION-WITH-ITS-FIGURES-TO-ANY-OFFICER-OF-THE-PLATFORM-ORGANIZATION'
const DEF_CURRENT_SYSTEM = 'DEF-0B10-PIL-PILOT-CURRENT-READS-THE-SESSION-ORGANIZATION-UNDER-THE-SYSTEM-CONTEXT-SO-THE-EXPLICIT-PREDICATE-IS-THE-ONLY-SCOPE'
const DEF_FEEDBACK_COMMENT = 'DEF-0B10-PIL-PILOT-FEEDBACK-COMMENT-IS-UNVALIDATED-AND-UNBOUNDED-AND-IS-RETURNED-RAW-WITH-THE-USER-ID'

const roleActivation = (route, quote) => ({ ref: `apps/union-eyes/app/api/${route}`, quote })

export const DEFECTS = [
  D(DEF_TRANSITION, APPLICATION_CAP, 'HIGH',
    'The commercial transition route lets one platform-tier administrator move a pilot application through contract_sent, contract_signed, invoice_issued and subscription_active, and it inserts a commercial contract (pending_approval, then set to active with signedAt the moment contract_signed is posted, with no signature, acceptance or counterpart step), a platform invoice with status issued for the approved pilot amount and an active organization subscription for the verified organization, while a pilot status of approved, active or completed is written from the state alone; when the billing account, the draft contract or the plan is missing the route only pushes a note that the effect was staged (for example No billing account found; monetization side effects were staged only) and still commits the new commercial state, status, score history and an atomic audit row that names the target state, so the record, the response and the history say the contract was signed or the invoice issued when no contract, invoice or subscription row was written.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Only a caller whose resolved role is at or above the system_admin level can post a transition, and the application must already be bound to an organization and, for the contract, invoice and subscription states, carry terms approved by a second administrator; within that set a single administrator can mark a contract signed and issue an invoice to the bound organization without any acceptance by that organization.',
        potentialImpact: {
          classes: ['FINANCIAL_INTEGRITY', 'FALSE_ATTESTATION_OR_OUTCOME', 'UNAUTHORIZED_MUTATION'],
          description: 'An organization could be invoiced and shown as holding an active contract or subscription that it never accepted, and the commercial state, pilot status and audit trail would state a signature and outcome that no counterpart gave, or state a signed or issued step when only a note was staged and nothing was written.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          roleActivation('pilot/apply/[id]/commercial-transition/route.ts', "const canAccess = await hasMinRole('system_admin');"),
          roleActivation('pilot/apply/[id]/commercial-transition/route.ts', "status: 'active',"),
          roleActivation('pilot/apply/[id]/commercial-transition/route.ts', 'signedAt: now,'),
        ],
        existingContainment: {
          summary: 'The route refuses callers below the system_admin level, refuses an application whose organization is not bound, requires approved commercial terms (approved by an administrator other than the one who bound the organization) before any financial state, and commits the effects with an atomic audit row in one transaction.',
          evidence: [
            { ref: 'apps/union-eyes/app/api/pilot/apply/[id]/commercial-transition/route.ts', quote: "const FINANCIAL_TARGET_STATES: CommercialState[] = ['contract_sent', 'invoice_issued', 'subscription_active'];" },
            { ref: 'apps/union-eyes/lib/pilot/commercial-terms-authority.ts', quote: 'if (pilot.verifiedBy && pilot.verifiedBy === approvedBy) {' },
          ],
        },
        blockingCondition: 'The platform operator uses the transition route to issue a pilot contract, invoice or subscription to an organization, or a contract state or an issued or active record is relied on as evidence that the organization accepted the terms.',
        justification: 'The harm needs an operator to run the financial states against a real organization, which the role floor and the two-administrator terms approval limit to a small actor set, so the route is not open to every caller; but nothing in the route or the schema records that the counterpart accepted a contract or an invoice, and a missing billing account still advances the recorded state, so the route must not be used to issue financial artifacts to an organization until an acceptance step and an honest staged outcome exist.',
      },
    }),
  D(DEF_PLATFORM_TIER, APPLICATION_CAP, 'MEDIUM',
    'The pilot platform tier (applications list, verify-organization, rebind-organization, approve-commercial-terms, commercial-transition and the cross-organization branch of every per-application route) is decided by hasMinRole(system_admin) and by an actor level at or above PILOT_PLATFORM_ACCESS_MIN_LEVEL, which is ROLE_HIERARCHY.system_admin (200), and the hierarchy places platform staff titles such as support_agent (218) and data_analyst (215) above that level, so any account whose resolved role title is one of those titles, or whose user id is in PLATFORM_ADMIN_USER_IDS in the legacy mode, passes every platform check and may read every application with the contact details, bind it to any organization and approve terms; the gate is a role title and no platform-staff mandate or kernel decision backs it.'),
  D(DEF_CLAIM_OWNER, APPLICATION_CAP, 'MEDIUM',
    'Before a platform administrator binds an application, the effective owner is responses.organizationId, a value the anonymous applicant typed into the public form (the only reserved key sanitizeResponsesForPublicCreate leaves in place), so an applicant can name any organization id and thereby decide whose stewards pass the same-organization check on the item routes (read, PATCH of non-reserved fields including readinessScore, memberCount and the organization and contact fields, and the artifact, intelligence and reference-profile writes), which lets a submitter place an application and its generated content in the workspace of an organization that never received it.'),
  D(DEF_RATE_KEY, APPLICATION_CAP, 'MEDIUM',
    'The public application route buckets its only abuse control, 5 submissions per hour, on the first comma-separated value of the x-forwarded-for header, then x-real-ip, then the literal unknown, and no bot challenge, e-mail proof or captcha is read, so wherever the platform edge does not overwrite that header a caller can send a new value with every request and submit without bound, each submission also creating a HubSpot contact and deal; the limiter fails closed only when Redis is unavailable.'),
  D(DEF_HUBSPOT, APPLICATION_CAP, 'MEDIUM',
    'After the insert the public application route awaits upsertContact and createDeal, which send the typed contact name, e-mail address, phone number, organization name, member count and organization type and a deal named for the organization to HubSpot whenever HUBSPOT_API_KEY is set, for any syntactically valid address the submitter typed, with no proof that the submitter controls it, no consent text stored or shown and no decision naming who may receive the contact; the submitter response does not say that the contact is shared.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),
  D(DEF_RESPONSES_UNBOUNDED, APPLICATION_CAP, 'LOW',
    'The public application schema bounds every named field but accepts responses as z.record(z.string(), z.unknown()) and assessment as a passthrough object, with no key count, depth or serialized size limit, and stores responses (minus the reserved keys other than organizationId) in a JSONB column that every later read, proposal, timeline and export returns, so an anonymous submitter can store an arbitrarily large document that the platform-tier list and all per-application reads must serialize.'),
  D(DEF_SIGNALS, APPLICATION_CAP, 'MEDIUM',
    'The proposal, artifact version, package export, reference profile and commercial transition outputs state adoption, activity, champion and risk scores, a renewal and expansion likelihood, an opportunity tier and a qualification, all computed by calculateCommercialSignals and the qualification functions from readinessScore (the applicant self-assessment, typed on the public form or amended by a steward PATCH, and treated as 55 when absent), the stage the administrator reached in the commercial sequence, and memberCount, with championScore and activityScore taken from responses keys that no route writes, so the figures read as measured pilot customer success signals when no pilot activity is an input.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_VERIFY, APPLICATION_CAP, 'MEDIUM',
    'The verify-organization route binds a pilot application to the organization id in the body after bindPilotOrganization checks only that an organizations row with that id exists and that the application is not bound to a different one, and then stamps verifiedBy and verifiedAt; no applicant e-mail domain, contact membership, document or other proof that the applicant belongs to or speaks for the organization is compared or recorded, no reason is required, and the audit row is written under the target organization, so the field named verified states an administrator selection and not a verification.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_APPROVE_TERMS, APPLICATION_CAP, 'MEDIUM',
    'The approve-commercial-terms route stores the member count as typed by the administrator, an optional subscription plan and a pilot amount that is either the typed number (any value from 0.01 to 9999999999.99) or the lower bound of a price band, as verifiedMemberCount, verifiedPilotAmount and verifiedSubscriptionPlanId on the application with the approver and time, and these values later become the contract value, invoice total and subscription; the only second-person control is that the approver differs from the administrator who bound the organization, no source for the member count or the amount is recorded, and no representative of the applicant organization accepts the terms.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_UNBOUNDED_TEXT, APPLICATION_CAP, 'LOW',
    'The commercial transition, artifacts, intelligence and reference-profile POST handlers cast request.json() to a TypeScript type with no schema, and persist the caller strings (reason, source, notes, milestone, lessonLearned, objectionRaised, requestedFeature, deploymentBlocker, stakeholder and note) with no length bound into the responses JSONB column and, for the transition, into the audit details; the intelligence handler appends to arrays on every call, so a steward of the claimed organization or a platform-tier actor can grow the column without limit and every later read, proposal and timeline serializes it.'),
  D(DEF_NO_AUDIT_WRITES, APPLICATION_CAP, 'MEDIUM',
    'The artifacts, intelligence and reference-profile POST handlers write through withLockedPilotMutation, which locks the application and merges the response keys with a single UPDATE and writes no audit row, and the routes write none, so a steward of the claimed organization or a platform-tier actor can add artifact versions, intelligence notes (lessons, objections, requested features, blockers and stakeholder sentiment) and reference snapshots to a pilot application with no durable record of who did so, although the coverage manifest declares these writes atomically audited.'),
  D(DEF_REFERENCE, APPLICATION_CAP, 'HIGH',
    'The reference profile route builds a testimonial, a case study and a benchmark dataset for a pilot application where the testimonial quote is a response key a steward or the applicant can set (referenceTestimonialQuote, authored and role keys are not reserved) or else the literal text that the organization established a repeatable pilot operating cadence with measurable adoption growth, attributed to the application contact name with the role Pilot Sponsor, the time saved is Math.max(6, Math.round(adoptionRate * 0.18)) hours a week (never below 6), and adoption, engagement and health come from a pilot_metrics row or else from the synthetic proposal signals and a 100 minus risk figure; the case study titled as 90-day pilot outcomes and the benchmark record are persisted by POST as a versioned snapshot with a checksum, so quoted words, hours saved and outcomes that no pilot customer said or measured are stored as reference material for the organization with no attestation or consent step.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A steward of the organization an application claims, or a platform-tier actor, can read the generated reference profile and persist it as a versioned snapshot; the output is returned to that caller and stored in the application, and no route, page or message in the repository publishes it to a third party.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'PRIVACY_OR_CONSENT', 'DATA_QUALITY'],
          description: 'A fabricated testimonial in a named contact words, an invented hours-saved figure and score-derived adoption and health numbers would be presented as pilot outcomes and, if used in a case study or benchmark, would state customer results and a quotation that no customer gave or consented to.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          roleActivation('pilot/apply/[id]/reference-profile/route.ts', "const canAccess = await hasMinRole('steward');"),
          roleActivation('pilot/apply/[id]/reference-profile/route.ts', 'estimatedHoursPerWeek: Math.max(6, Math.round(adoptionRate * 0.18)),'),
          roleActivation('pilot/apply/[id]/reference-profile/route.ts', ": 'Pilot Sponsor',"),
        ],
        existingContainment: {
          summary: 'The routes require the steward floor and the ownership check, the snapshot is stored in the application row and returned only to the authorized caller, and the repository contains no caller that sends the profile, case study or benchmark dataset outside the organization.',
          evidence: [
            { ref: 'apps/union-eyes/app/api/pilot/apply/[id]/reference-profile/route.ts', quote: 'const denied = await enforcePilotOwnership(payload.application);' },
            { ref: 'apps/union-eyes/lib/pilot/pilot-mutation.ts', quote: 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));' },
          ],
        },
        blockingCondition: 'The generated reference profile, case study or benchmark dataset is shown to a prospect, published, attached to a proposal or sent outside the organization, or a customer-facing page is built that reads the stored reference versions.',
        justification: 'The output is invented in part and stored as a case study, but it stays inside the application row and the authorized caller today, so the impact needs a publication step that no code takes; the testimonial text and hours-saved figure are not measured or attested and must not be shown to a third party as a customer result until a customer attestation and consent step exist.',
      },
    }),
  D(DEF_TELEMETRY_XT, PROGRAM_CAP, 'HIGH',
    'The champions, friction, metrics and conversion-assessment routes (admin floor) read the organization from the organizationId query parameter and never compare it with the session organization, then call services that run raw SQL over pilot_events through the bare db import filtered only by that id, returning per-user ids with case, update and active-day counts (champions), user ids with the date of the last login or case (friction, full report), unique-user, case and update counts with a daily active user trend (metrics) and the counts that decide a conversion flag (readiness); an administrator of any organization can therefore read the usage telemetry of any organization whose id they know, and the only boundary left is a row-level-security policy that applies only when the request runs under the canonical tenant context.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY', 'RLS_ASSUMED_FROM_DB_CLIENT'],
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'An administrator of any organization can request champions, friction, metrics or conversion figures for any organization id; in the canonical bootstrap mode the wrapper opens a tenant transaction for the caller organization so the pilot_events policy hides the other organization rows, and in the legacy mode nothing opens a tenant transaction so the queries run on the pool connection with only the explicit id predicate.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'Where the connection is not constrained by the pilot_events policy, an administrator of one organization would read another organization member user ids with case and update counts, last login dates, unique-user counts, daily active user trend and conversion readiness counts, which is another union activity data and personal behavioural data the caller session does not entitle them to.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          roleActivation('pilot/champions/route.ts', "export const GET = withRoleAuth('admin', async (req) => {"),
          roleActivation('pilot/champions/route.ts', 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
          roleActivation('pilot/friction/route.ts', 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
        ],
        existingContainment: {
          summary: 'In the canonical bootstrap mode withApiAuth runs the handler inside withRLSContext for the caller organization and the pilot_events table carries a direct organization policy, so a query for another organization finds no rows; the deployment descriptor for the production container app sets that mode.',
          evidence: [
            { ref: 'apps/union-eyes/lib/api/with-api.ts', quote: 'return withRLSContext({ organizationId: resolvedOrganizationId }, runHandler);' },
            { ref: 'apps/union-eyes/db/migrations/20260910_rls_enforcement_expansion_round58.sql', quote: "PERFORM ue_create_direct_org_rls_policy('pilot_events', 'organization_id', FALSE);" },
            { ref: 'infrastructure/bicep/ue-v2/modules/apps.bicep', quote: "{ name: 'UE_CANONICAL_BOOTSTRAP_V2', value: '1' }" },
          ],
        },
        justification: 'The routes themselves enforce nothing about whose organization is named, any administrator of any organization reaches them and the data is per-user behavioural telemetry from another tenant; the confinement rests on a row-level policy that applies only under the canonical bootstrap mode, which the code treats as off by default and the pilot environment descriptor does not set, so the cross-tenant read is reachable as the application is written and the pilot environment is a place it is not contained.',
      },
    }),
  D(DEF_EVENTS_ASSERTED, PROGRAM_CAP, 'MEDIUM',
    'The pilot events route lets any member write a pilot_events row of any of 25 event types (including case_created, update_added, first_case_created, org_created, user_invited and role_assigned) with an unbounded metadata object, through a bare-db insert with no audit, and for case_created and update_added only reads metadata.caseId without checking that the case exists or belongs to the organization; the champion detection (3 cases, 5 updates, 5 active days), the conversion readiness flag (3 active users in 14 days, 10 cases, 5 updates, 5 active days), the friction lists and the engagement metrics are computed purely from these rows, so a member can make an organization appear to hold champions and a conversion-ready pilot without creating a case.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_BOOTSTRAP_RESET, PROGRAM_CAP, 'HIGH',
    'The CUPE bootstrap route (system_admin floor, allowed when NZILA_MODE is pilot or demo) resolves the target organization by the slug in a fixture file (cupe-local-123) and, when the body sets reset, deletes every grievance, every organization_members row and every pilot_checklist_items row of that organization with predicates on the organization id alone, with no demo marker, row-origin check, dry run, confirmation or backup, and then re-inserts fixture members (including roles such as admin and president under fixed fixture user ids) and grievances with onConflictDoNothing, so if the organization at that slug holds real grievances or members in a pilot or demo runtime the reset destroys them and the audit row records only the counts the fixture attempted.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'A caller at or above the system_admin level, in a runtime whose NZILA_MODE is pilot or demo, can reset the organization found at the fixture slug; the pilot and the CUPE demo environment descriptors both set those modes, and the route is rate limited and writes an atomic audit row.',
        potentialImpact: {
          classes: ['AVAILABILITY_OR_DATA_LOSS', 'UNAUTHORIZED_MUTATION'],
          description: 'Real grievance records, member rows and checklist state of the organization that owns the slug would be hard-deleted without recovery by one request, and fixture members with elevated organization roles would be seeded under user ids that are literal strings in the repository.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          roleActivation('pilot/bootstrap/cupe/route.ts', "auth: { minRole: 'system_admin' },"),
          roleActivation('pilot/bootstrap/cupe/route.ts', 'await tx.delete(grievances).where(eq(grievances.organizationId, orgId));'),
          { ref: 'infrastructure/gitops/environments/pilot.yml', quote: '- name: NZILA_MODE' },
        ],
        existingContainment: {
          summary: 'The route requires the system_admin level, refuses unless NZILA_MODE is pilot or demo, takes the slug from a repository fixture and not from the request, applies a write rate limit and writes an atomic audit row for the reset.',
          evidence: [
            { ref: 'apps/union-eyes/lib/config/pilot-demo-runtime.ts', quote: "const DEMO_MUTATION_MODES = ['pilot', 'demo'] as const" },
            { ref: 'apps/union-eyes/app/api/pilot/bootstrap/cupe/route.ts', quote: 'runtimeMode = assertPilotDemoMutationRuntime();' },
          ],
        },
        blockingCondition: 'The organization at the fixture slug holds records that were not created by the bootstrap in a runtime whose NZILA_MODE is pilot or demo, or the bootstrap is run against a pilot environment that serves a real organization.',
        justification: 'The reset is an operator action behind a role floor and a runtime mode gate, and the slug is fixed, so an arbitrary organization cannot be named; but the delete predicate is the organization id alone and the pilot mode is the mode of the real pilot deployment, so the data loss is real wherever the slug belongs to a live organization, and the route cannot tell seeded rows from real ones.',
      },
    }),
  D(DEF_BOOTSTRAP_REPORT, PROGRAM_CAP, 'MEDIUM',
    'The CUPE bootstrap response reports seeded.worksites as the number of worksites in the fixture although the handler never inserts a worksite, increments membersInserted and casesInserted once per attempted insert even when onConflictDoNothing skipped the row, and returns onboarding checklistInitialized, completed 3 and pending 2 as literals for five checklist ids (org_profile_configured, team_invited, first_case_created, sla_watchdog_enabled and billing_connected) while the onboarding route reads and toggles only seven different ids (org-seeded, users-invited and others), so the seeded rows are never shown by the checklist route, a toggle of a seeded id answers 404, and the same literals and counts are written into the audit details.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_DEMO_DATA, PROGRAM_CAP, 'MEDIUM',
    'The demo-data route (officer floor, pilot or demo runtime) inserts four employers named for real federal departments with e-mail addresses on real government domains (lr-demo@tbs-sct.gc.ca and others) and fictional grievances with named grievants into the employers and grievances tables of the officer organization, the same tables that hold real records, with no demo marker column on either row (only a GRV-DEMO- number prefix and an lr-demo@ address prefix), so the seeded cases are counted as cases managed by the pilot metrics and listed with real grievances, and the purge deletes every row of the organization whose grievance number starts with GRV-DEMO- or whose employer e-mail starts with lr-demo@ whether or not the seed created it.'),
  D(DEF_PILOT_METRICS, PROGRAM_CAP, 'MEDIUM',
    'The pilot current and overview routes report organizerAdoptionRate and memberEngagementRate as the share of organization_members rows whose updated_at falls in the last 30 days (any edit of the row counts as activity), report avgTimeToResolution as the mean of COALESCE(resolved_at, NOW()) minus created_at over grievances created in the last 30 days, so an unresolved case counts as resolved at the moment of the request, count seeded demo grievances in casesManaged, and replace a figure with the stored pilot_enrollments value when no live row exists, with no indication in the response that the figure is a proxy or a stored fallback.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_CHECKLIST_ASSERTED, PROGRAM_CAP, 'MEDIUM',
    'The onboarding checklist PATCH lets any officer mark any of seven steps (contracts-uploaded, employers-imported, integrations-configured, export-verified and others) completed or reopened with a boolean in the body and stamps completedBy and completedAt, and writes a pilot.checklist_completed audit row when all seven are true, without checking that a contract was uploaded, employers were imported, an integration was configured or an export was verified, so the checklist state, isComplete flag and audit trail record asserted steps.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_OVERVIEW, ENUMERATION_CAP, 'MEDIUM',
    'The pilot overview route (officer floor) admits a platform administrator identity or, in the legacy mode, any member of the platform organization (DEFAULT_ORGANIZATION_ID) holding the officer role title, then under withSystemContext lists every actively enrolled organization with its id, name, slug, enrollment date, adoption and engagement rates, cases managed, resolution time, health score and milestones, running three queries for each enrollment and with no pagination, so the cross-organization aggregate is reachable by an officer role title of one organization and no platform-staff mandate or read audit exists.',
    { riskCategories: ['ANALYTICS_CROSSES_BOUNDARY'] }),
  D(DEF_CURRENT_SYSTEM, PROGRAM_CAP, 'LOW',
    'The pilot current route resolves the session organization with withOrganizationAuth and then runs its enrollment, milestone, member and grievance reads inside withSystemContext, so the row-level policies that scope pilot_enrollments, pilot_milestones, organization_members and grievances to the caller organization do not apply and the explicit eq(organizationId) and the interpolated organization id in the two SQL statements are the only scope.'),
  D(DEF_FEEDBACK_COMMENT, PROGRAM_CAP, 'LOW',
    'The pilot feedback POST validates easeRating, category and trigger but passes comment from the body unvalidated and unbounded (any JSON value, no length limit) into pilot_feedback.comment, and the administrator GET returns the ten most recent rows with select() including userId and the raw comment to any administrator of the organization, so free text and the identity of the member who wrote it are returned without a length bound or an anonymity decision.'),
]

export const CAPABILITIES = [
  {
    id: APPLICATION_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'pilot-application-intake-and-commercialization',
    primaryGate: GATE,
    dependencyGates: [9, 13],
    actor: 'Prospective union applying for a pilot, and the platform-tier administrator who binds the application to an organization, approves commercial terms and moves the application through the commercial states',
    businessOutcome: 'A pilot application is created only with proof that the submitter controls the contact it names, its owner is an organization verified against that proof by an office with a stated mandate, the commercial terms are accepted by the applicant organization before any contract, invoice or subscription is created, every state it records corresponds to a row that was written, and generated proposals, packages and reference material state what was measured and attested.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/pilot/apply (intake, [id], verify-organization, rebind-organization, approve-commercial-terms, commercial-transition, proposal, package-export, artifacts, intelligence, commercialization-timeline, reference-profile)',
    service: OWNERSHIP,
    sourceFiles: [
      OWNERSHIP,
      TERMS,
      WAVE1,
      PILOT_MUTATION,
      RESPONSES,
      APPLY_ROUTE,
      ID_ROUTE,
      `${API}pilot/apply/[id]/commercial-transition/route.ts`,
      `${API}pilot/apply/[id]/reference-profile/route.ts`,
    ],
    proof: [{ type: 'path', ref: OWNERSHIP }],
    auditEvidence: 'Organization binding, rebinding, commercial terms approval and the commercial transition each commit persistAtomicAudit with their write in one transaction, and the generic application PATCH is audited by the CRUD factory in the same tenant transaction. The public application insert, and the artifact, intelligence and reference-profile writes, write no audit row.',
    privacyClassification: 'Applicant contact name, e-mail address and phone number, organization name, member count, jurisdictions, challenges and goals typed by an anonymous submitter, the organization bound to the application, commercial terms and the contract, invoice and subscription identifiers they produce, and generated scores, proposals and reference material.',
    gap: 'No existing capability owns the pre-account sales pipeline. UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING owns the platform subscription and invoicing of one organization that already holds a billing account, not the public intake of a prospective union, the claim and verification of its organization, the commercial state sequence that precedes the account, or the proposal and reference material generated for it; UE-OMIT-ORGANIZATION-ONBOARDING owns the assistance an organization receives once it exists; UE-OMIT-PLATFORM-OPERATOR-CONTROLS owns platform operations such as the pilot status switch, not application review; and UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns reports over operational tables, not generated sales artifacts.',
  },
  {
    id: PROGRAM_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'pilot-program-operations',
    primaryGate: GATE,
    dependencyGates: [9, 13],
    actor: 'Member, officer or administrator of an organization enrolled in the pilot, and the platform-tier administrator who bootstraps the CUPE pilot organization',
    businessOutcome: 'Usage telemetry, feedback and the signals derived from them are recorded only for what happened, are readable only for the reader own organization, and state their basis; the onboarding checklist and the figures shown to an enrolled organization correspond to work that was done and to live records; and demo data and bootstrap resets can never alter or remove a real record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/pilot (events, feedback, champions, friction, metrics, readiness, current, onboarding, demo-data, bootstrap/cupe)',
    service: SIGNALS,
    sourceFiles: [
      SIGNALS,
      FRICTION,
      METRICS,
      TRACKING,
      DEMO_DATA,
      DEMO_RUNTIME,
      `${API}pilot/events/route.ts`,
      `${API}pilot/current/route.ts`,
      ONBOARDING_ROUTE,
      BOOTSTRAP_ROUTE,
    ],
    proof: [{ type: 'path', ref: SIGNALS }],
    auditEvidence: 'Feedback, the onboarding checklist, demo data seeding and purge, and the CUPE bootstrap each commit persistAtomicAudit with their write in one transaction. The usage event insert writes no audit row, and the telemetry reads write none.',
    privacyClassification: 'Per-user pilot usage events (user id, session id, event type and free metadata), per-user champion and friction lists, member ease-of-use feedback with free text and user id, organization member counts and role-based activity, onboarding checklist state, and fixture member names, e-mail addresses and roles.',
    gap: 'No existing capability names the pilot program. UE-OMIT-ORGANIZATION-ONBOARDING owns the onboarding assistance lookups and the onboarding event recorder under the onboarding path, not the pilot usage telemetry, feedback, conversion signals, enrollment metrics, onboarding checklist or the demo and bootstrap seeding of an organization; UE-OMIT-PLATFORM-OPERATOR-CONTROLS owns the platform pilot status switch under the admin path; UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns analytics reports over operational tables, not event-derived pilot signals; and UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION owns only the platform-wide overview read.',
  },
]

export const DECISIONS = [
  {
    id: 'UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION',
    status: 'OUTSTANDING',
    question: 'What proof binds an anonymous pilot applicant to an organization, which office may attest that binding, and what access, if any, may an applicant-typed organization claim give the stewards of that organization before the binding exists?',
    sourceState: 'The public application form accepts responses.organizationId from an unauthenticated submitter and that claim decides which organization stewards pass the same-organization check on the application until a platform administrator binds an organization by id; the binding checks only that the organization exists and records the administrator, with no applicant proof. No adopted decision names the proof or the attesting office.',
    softwareOwners: [APPLICATION_CAP],
  },
  {
    id: 'UE-INST-PILOT-COMMERCIAL-AGREEMENT-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Who may approve the commercial terms of a pilot, what acceptance by the applicant organization must exist before a contract, an invoice or a subscription is created for it, and what may the system record as signed or issued?',
    sourceState: 'One platform-tier administrator approves a typed member count and amount, a second administrator is needed only to differ from the one who bound the organization, and the commercial transition then inserts a contract, sets it active with a signature time, issues an invoice and activates a subscription without any acceptance by the organization. No adopted decision names the approving office or the acceptance step.',
    softwareOwners: [APPLICATION_CAP],
  },
  {
    id: 'UE-INST-PILOT-REFERENCE-AND-CASE-STUDY-PUBLICATION',
    status: 'OUTSTANDING',
    question: 'Whose attestation and consent are required before a pilot testimonial, case study, time-saved figure or benchmark record is generated, stored or shown outside the pilot organization, and what basis may its figures rest on?',
    sourceState: 'The reference profile builds a testimonial, hours saved, a case study and a benchmark record from response keys, a literal default quotation and score-derived figures and stores them as versioned snapshots; no consent or attestation step exists and no adopted decision names the approver or the basis.',
    softwareOwners: [APPLICATION_CAP],
  },
  {
    id: 'UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS',
    status: 'OUTSTANDING',
    question: 'Who may read per-user pilot usage telemetry, champion lists, friction lists and conversion signals for an organization, may the platform read them across organizations, and what events may the signals rest on given that clients assert them?',
    sourceState: 'The telemetry routes let an administrator name any organization id and return per-user activity, the events are written by any member with caller-asserted types and metadata, and the champion and conversion thresholds are computed from them. No adopted decision names the readers, the cross-organization mandate or the evidential basis of a signal.',
    softwareOwners: [PROGRAM_CAP],
  },
  {
    id: 'UE-INST-PILOT-DEMO-RUNTIME-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Who may seed demo data, purge it and bootstrap or reset a pilot organization, in which runtimes, and may fictional records live in the same tables as the real records of a pilot organization?',
    sourceState: 'An officer can seed fictional grievances and employers into their own organization and a platform-tier administrator can reset the organization at a fixture slug, in any runtime whose NZILA_MODE is pilot or demo, which includes the pilot deployment; the seeded rows carry no marker and are counted with real records. No adopted decision names the authority, the runtimes or the separation.',
    softwareOwners: [PROGRAM_CAP],
  },
]

/* ------------------------------------------------------------------------------------------------------------ */
/* risk screens                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

export const RISK_SCREENS = {
  'pilot/events/route.ts|POST': {
    RLS_ASSUMED_FROM_DB_CLIENT: {
      reason: 'The single insert runs through the shared db import in pilot-tracking, but the user and organization it stores are the session user and the session organization from withRoleAuth, and a body that names a different user or organization is refused with 403 before the insert, so the write cannot be placed in another organization whatever policy the connection role carries; the read routes over the same table are carried by a separate defect.',
      evidence: [{ ref: `${API}pilot/events/route.ts`, quote: 'return NextResponse.json({ error: "Events can only be recorded for the authenticated user and organization" }, { status: 403 });' }],
    },
  },
  'pilot/apply/[id]/package-export/route.ts|GET': {
    SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: {
      reason: 'The bundle reproduces only fields the applicant typed on the public form (organization name, contact name and e-mail address, member count, challenges and goals), computed scores and template text, and it is returned only after the steward floor and the ownership check, so no member, health, financial or organizing-support record is reproduced and the caller is limited to the organization the application is bound to or claimed by.',
      evidence: [{ ref: `${API}pilot/apply/[id]/package-export/route.ts`, quote: '`- Contact: ${application.contactName} <${application.contactEmail}>`,' }],
    },
  },
}

/* ------------------------------------------------------------------------------------------------------------ */
/* shared text                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const base = (a) => ({ service: `${API}${a.route} (${a.method})` })

const PLATFORM_AUTHN = 'Authenticated session: withApiAuth requires authentication on this non-public path (the public allowlist matches the exact path /api/pilot/apply only), and the handler resolves the user with getCurrentUser and answers 401 when none exists.'
const PLATFORM_AUTHZ = 'The handler calls hasMinRole(system_admin) before any database access and answers 403 otherwise; the role is resolved by the canonical role resolution (a PLATFORM_ADMIN_USER_IDS identity in the legacy mode, the organization membership role title, or the canonical context), and any title whose ROLE_HIERARCHY level is 200 or more passes, which includes platform staff titles such as support_agent (218). A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.'
const PLATFORM_TENANT = 'The application id comes from the path and the row is read and locked by id under withSystemContext, which bypasses tenant policies by design for the platform tier; the only organization named is the body organizationId (verify and rebind) or the already bound verified organization (terms and transition).'
const OWNED_AUTHN = 'Authenticated session: withApiAuth requires authentication on this non-public path and the handler requires the steward floor with hasMinRole before reading the application.'
const OWNED_AUTHZ = 'The handler calls hasMinRole(steward) and then enforcePilotOwnership: the effective owner is the verified organization or, before verification, the organization id the applicant typed (responses.organizationId); a caller passes when the actor level is at or above 200 (platform tier) or the actor organization equals that owner. A role title and an organization-id comparison are not a kernel decision, so kernelAuthorization stays false.'
const OWNED_TENANT = 'The application is loaded by id under withSystemContext (the table has no organization predicate the route can filter by) and then compared with the caller by enforcePilotOwnership; the owner is verifiedOrganizationId when set and otherwise the applicant-typed responses.organizationId, so before verification the boundary is an unauthenticated claim.'

const platformGate = (a) => [
  ...guardEv(a, 'withApiAuth'),
  a.h('authentication', /await getCurrentUser\(\);$/),
  a.h('authorization', /hasMinRole\('system_admin'\)/),
  a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
  a.svc('authorization', OWNERSHIP, 'export const PILOT_PLATFORM_ACCESS_MIN_LEVEL: number = ROLE_HIERARCHY.system_admin;'),
  a.svc('defect', AUTH_GUARD, 'support_agent: 218,                // Support Agent - Customer support'),
]

const ownedReadGate = (a, extra = []) => [
  ...guardEv(a, 'withApiAuth'),
  a.h('authorization', "const canAccess = await hasMinRole('steward');"),
  a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
  a.h('tenantScope', 'const denied = await enforcePilotOwnership(application);'),
  a.imp('tenantScope', 'enforcePilotOwnership', 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));'),
  a.svc('tenantScope', OWNERSHIP, 'return getPilotVerifiedOrganizationId(application) ?? getPilotClaimedOrganizationId(application);', 'getPilotEffectiveOrganizationId'),
  a.svc('tenantScope', OWNERSHIP, 'if (actorLevel >= PILOT_PLATFORM_ACCESS_MIN_LEVEL) {', 'authorizePilotAccess'),
  a.h('mutation', 'const [application] = await withSystemContext((_tx) =>'),
  a.svc('defect', OWNERSHIP, 'const raw = responses.organizationId;', 'getPilotClaimedOrganizationId'),
  ...extra,
]

const lockedWriteGate = (a, extra = []) => [
  ...guardEv(a, 'withApiAuth'),
  a.h('authorization', "withLockedPilotMutation"),
  a.imp('authorization', 'withLockedPilotMutation', 'if (!(await hasMinRole(minRole))) {'),
  a.svc('tenantScope', PILOT_MUTATION, 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));', 'withLockedPilotMutation'),
  a.svc('tenantScope', PILOT_MUTATION, 'const organizationId = application.verifiedOrganizationId;', 'withLockedPilotMutation'),
  a.svc('tenantScope', OWNERSHIP, 'return getPilotVerifiedOrganizationId(application) ?? getPilotClaimedOrganizationId(application);', 'getPilotEffectiveOrganizationId'),
  a.svc('mutation', PILOT_MUTATION, '.update(pilotApplications)', 'withLockedPilotMutation'),
  a.svc('audit', PILOT_MUTATION, '.update(pilotApplications)', 'withLockedPilotMutation'),
  a.svc('defect', OWNERSHIP, 'const raw = responses.organizationId;', 'getPilotClaimedOrganizationId'),
  ...extra,
]

const NO_AUDIT_CORR = {
  field: 'audit',
  manifest: 'audit AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE',
  actual: 'The write goes through withLockedPilotMutation, which locks the application and merges the response keys with one update and writes no audit row, and the route writes none, so no audit record exists for the write.',
}

const GET_CORR = { field: 'mutating', manifest: 'read-only GET', actual: 'A GET reads the application and computes the output; it writes nothing.' }

/* ------------------------------------------------------------------------------------------------------------ */
/* apply (public intake) and the generic list / item routes                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const applyPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous prospective union submitting a pilot application',
  authn: 'None: the exact path /api/pilot/apply is on the public route allowlist so no session is read; the handler checks a per-address limit and a zod body schema and nothing identifies the submitter.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. checkRateLimit(ip, RATE_LIMITS_PER_IP.PILOT_APPLY) allows 5 submissions an hour per client-supplied forwarded address and fails closed when Redis is unavailable; the body schema bounds the named fields. Nothing created here grants access to tenant data.',
  tenant: 'None: the insert writes a pilot_applications row with no verified organization (the form has no organization before the account exists); the only organization signal stored is the applicant-typed responses.organizationId, which later decides same-organization access until an administrator binds the application.',
  owner: 'A pilot_applications row created for the submitter; the submitter has no later access path, and the claimed organization stewards and platform-tier actors can read it.',
  sens: 'Applicant contact name, e-mail address and phone number, organization name and type, member count, jurisdictions, sectors, current system, challenges, goals, a self-assessed readiness score and a free-form responses object',
  priv: 'Personal contact data of a prospective customer is stored and sent to HubSpot, the e-mail address and organization name are written to the application log, and the submitter response carries only the application id.',
  mut: 'NONE',
  auditDetail: 'The route inserts the pilot_applications row and writes no audit record; the only trace is the logger line pilot_application:created with the id, organization name and e-mail address.',
  reqAudit: 'Record the submission with the consent given for the contact and a proof of the address before the contact is shared, attributing it to the intake source, once the institution decides what an application and its contact may be used for.',
  does: 'Applies the per-address limit, validates the body, inserts a pilot_applications row through the bare db import with the typed fields, the readiness score from the assessment and the sanitized responses object, logs the creation, awaits a HubSpot contact upsert and deal creation with the typed contact, and returns 201 with the application id; a failure returns 500.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Prove control of the contact address and record consent before any external sharing, key the limit on a platform-verified address and add a challenge, bound the free-form response object, stop treating a typed organization id as an ownership signal, and decide the purpose and retention of an application.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: [
    a.h('authentication', 'const rl = await checkRateLimit(ip, RATE_LIMITS_PER_IP.PILOT_APPLY);'),
    a.svc('authentication', PUBLIC_ROUTES, "'/api/pilot/apply', // Public pilot-program lead-intake form (POST only; GET requires system_admin, checked in the route handler itself)"),
    a.h('authorization', 'if (!rl.allowed) {'),
    a.h('tenantScope', 'responses: sanitizeResponsesForPublicCreate(responses),'),
    a.svc('tenantScope', RESPONSES, "if (key === 'organizationId') continue;", 'sanitizeResponsesForPublicCreate'),
    a.h('mutation', '.insert(pilotApplications)'),
    a.h('audit', "logger.info('pilot_application:created', {"),
    a.h('behavior', 'return NextResponse.json({ ok: true, id: row.id }, { status: 201 });'),
    a.h('privacy', 'const contactId = await upsertContact({'),
    a.svc('privacy', CRM, 'const apiKey = process.env.HUBSPOT_API_KEY', 'getClient'),
    a.h('defect', "const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()"),
    a.h('defect', 'readinessScore: assessment?.score?.toString() ?? null,'),
    a.h('defect', 'const [row] = await db'),
  ],
  inf: [
    { claim: 'defect', statement: 'pilot_applications carries a direct organization policy on verified_organization_id with an insert check that the column equals the tenant setting; a row inserted here has no verified organization, so the insert can succeed only on a connection that the policy does not constrain, and the route cannot show which role its bare db import uses.' },
    { claim: 'defect', statement: 'The route comment states the endpoint is public by design; the public allowlist matches the exact path only, so the per-application item routes are not public.' },
  ],
  def: [DEF_RATE_KEY, DEF_HUBSPOT, DEF_RESPONSES_UNBOUNDED, DEF_CLAIM_OWNER, DEF_SIGNALS],
  corr: [
    { field: 'guard', manifest: 'control GENERIC_CRUD_ROLE_FLOOR', actual: 'The POST is a hand-written public handler with no authentication and no role floor; only the GET uses the generic CRUD factory.' },
    { field: 'audit', manifest: 'audit AUDIT_DECLARED_ATOMIC:CRUD_ATOMIC', actual: 'The insert goes through the bare db import and the handler writes no audit row; the factory audit applies only to the item PATCH.' },
  ],
})

const applyGet = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator listing every pilot application',
  authn: 'Authenticated session: the exact path is on the public allowlist so the wrapper is not applied, the handler resolves the role with hasMinRole and the factory handler then requires authentication again with withApi.',
  authz: 'The handler calls hasMinRole(system_admin) before opening the system connection and answers 403 otherwise; the factory handler repeats the system_admin floor. Any title at or above level 200 passes, which includes platform staff titles such as support_agent (218). A role title is not a kernel decision, so kernelAuthorization stays false.',
  tenant: 'No organization predicate: the table has no organization column and the list is built with orgScoped false under withSystemContext, so every application of every applicant is in scope by design for the platform tier.',
  owner: 'pilot_applications rows submitted by anonymous applicants, listed with every column including the full responses object, contact details and the verification and commercial terms fields.',
  sens: 'Applicant contact name, e-mail address and phone number, organization name, member count, challenges, goals, the responses object (commercial history, intelligence notes, scores and artifact versions), the bound organization id and the approved commercial terms',
  priv: 'Prospective-customer personal data and commercial negotiation history of every applicant is returned in pages of up to 100 to any caller at the system_admin level.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written. The generic list writes no audit row for the read.',
  reqAudit: 'Audit platform-tier reads of applicant contact data and commercial history once a platform-staff mandate names who may read them.',
  does: 'Checks the system_admin floor, elevates to the system connection and runs the generic CRUD list over pilot_applications ordered and paginated (limit capped at 100), returning every column of each row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Replace the role title with a platform-staff mandate, return only the review fields, and audit reads of applicant contact data.',
  dec: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    a.h('authentication', "if (!(await hasMinRole('system_admin'))) {"),
    a.imp('authentication', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('authorization', "if (!(await hasMinRole('system_admin'))) {"),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', 'return withSystemContext((_tx) => listPilotApplications(request, context));'),
    a.svc('tenantScope', CRUD_FACTORY, "const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));", 'crudRoutes'),
    a.h('mutation', 'return withSystemContext((_tx) => listPilotApplications(request, context));'),
    a.svc('behavior', CRUD_FACTORY, 'const baseQuery = db.select().from(table);', 'crudRoutes'),
    a.svc('privacy', CRUD_GOVERNANCE, "'notifications', 'organizer_tasks', 'organizing_campaigns', 'pay_equity_exercises', 'pilot_applications', 'ppe_equipment',"),
    a.svc('defect', AUTH_GUARD, 'support_agent: 218,                // Support Agent - Customer support'),
  ],
  def: [DEF_PLATFORM_TIER],
  corr: [GET_CORR],
})

const idGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading one pilot application',
  authn: 'Authenticated session: withPilotOwnership requires the steward floor with hasMinRole, and the factory handler requires authentication again with withApi.',
  authz: 'withPilotOwnership calls hasMinRole(steward), loads the application by id under withSystemContext, answers 404 when it is missing and then authorizes: a caller at or above level 200 passes cross-organization and runs under withSystemContext, any other caller passes only when its organization equals the effective owner (the verified organization, or before verification the applicant-typed responses.organizationId). A role title and an id comparison are not a kernel decision, so kernelAuthorization stays false.',
  tenant: OWNED_TENANT,
  owner: 'One pilot_applications row (every column, including the contact details, the bound organization and the responses object).',
  sens: 'Applicant contact name, e-mail address and phone number, organization name, member count, challenges, goals, the bound organization id, approved commercial terms and the responses object',
  priv: 'A steward of the claimed organization, which the anonymous applicant chose, receives the applicant contact details and the whole responses object, including platform-written commercial history after binding.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and the generic item read writes no audit row.',
  reqAudit: 'Audit reads of applicant contact data by a platform-tier caller and by a claimed-organization steward once the claim rule and the platform mandate are decided.',
  does: 'Checks the steward floor, loads the application, authorizes by ownership and then runs the generic CRUD item read, which returns the row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Replace the applicant-typed claim with a verified owner before any organization-level access, and audit platform-tier reads.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    a.h('authentication', "withPilotOwnership(handlers.GET, { minRole: 'steward' })"),
    a.imp('authentication', 'withPilotOwnership', 'if (!(await hasMinRole(minRole))) {'),
    a.h('authorization', "withPilotOwnership(handlers.GET, { minRole: 'steward' })"),
    a.imp('authorization', 'withPilotOwnership', 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));'),
    a.svc('tenantScope', OWNERSHIP, 'return getPilotVerifiedOrganizationId(application) ?? getPilotClaimedOrganizationId(application);', 'getPilotEffectiveOrganizationId'),
    a.svc('tenantScope', OWNERSHIP, 'if (actorLevel >= PILOT_PLATFORM_ACCESS_MIN_LEVEL) {', 'authorizePilotAccess'),
    a.h('mutation', "withPilotOwnership(handlers.GET, { minRole: 'steward' })"),
    a.local('behavior', 'handlers', "readRole: 'steward',"),
    a.svc('privacy', CRUD_FACTORY, 'const baseQuery = db.select().from(table);', 'crudRoutes'),
    a.svc('defect', OWNERSHIP, 'const raw = responses.organizationId;', 'getPilotClaimedOrganizationId'),
  ],
  def: [DEF_CLAIM_OWNER, DEF_PLATFORM_TIER],
  corr: [GET_CORR],
})

const idPatch = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, amending one pilot application',
  authn: 'Authenticated session: withPilotOwnership requires the steward floor with hasMinRole, and the factory handler requires authentication again with withApi.',
  authz: 'withPilotOwnership applies the steward floor and the ownership decision as for the read, and the factory re-runs authorizePilotAccess on the row it locks (lockedAuthCheck) before it writes. Status, verification and commercial terms fields are in blockedPatchFields; other columns are writable by any caller that passes. A role title and an id comparison are not a kernel decision, so kernelAuthorization stays false.',
  tenant: OWNED_TENANT,
  owner: 'One pilot_applications row; the PATCH merges non-reserved keys into responses and sets other non-blocked columns (organization and contact fields, member count, readiness score and the free-text fields).',
  sens: 'Applicant contact name, e-mail address and phone number, organization name, member count, readiness score, challenges, goals and the non-reserved response keys',
  priv: 'A steward of the claimed organization can rewrite the contact fields, the readiness score that drives the generated scores and the response keys that carry the reference testimonial.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The factory locks the row with FOR UPDATE and writes the update and persistAtomicAudit (crud.pilot_applications.update, naming the fields and no values) in one tenant transaction opened for the caller organization.',
  reqAudit: 'Keep the in-transaction audit row and record the application as the resource with the bound organization once the claim rule is decided.',
  does: 'Checks the steward floor and ownership, strips blocked fields and reserved response keys, locks the row, re-authorizes against the locked row, merges the response fragment and writes the update with its audit row, returning the updated row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Add readiness score, member count and the identity fields to the blocked list or to a platform-only edit, replace the applicant-typed claim with a verified owner, and stop the testimonial keys from being writable by the claimed organization.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION', 'UE-INST-PILOT-REFERENCE-AND-CASE-STUDY-PUBLICATION'],
  ev: [
    a.h('authentication', "withPilotOwnership(handlers.PATCH, { minRole: 'steward' })"),
    a.imp('authentication', 'withPilotOwnership', 'if (!(await hasMinRole(minRole))) {'),
    a.h('authorization', "withPilotOwnership(handlers.PATCH, { minRole: 'steward' })"),
    a.imp('authorization', 'withPilotOwnership', 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));'),
    a.local('authorization', 'handlers', 'lockedAuthCheck: async (existing) => {'),
    a.svc('tenantScope', OWNERSHIP, 'return getPilotVerifiedOrganizationId(application) ?? getPilotClaimedOrganizationId(application);', 'getPilotEffectiveOrganizationId'),
    a.svc('tenantScope', OWNERSHIP, 'if (actorLevel >= PILOT_PLATFORM_ACCESS_MIN_LEVEL) {', 'authorizePilotAccess'),
    a.h('mutation', "withPilotOwnership(handlers.PATCH, { minRole: 'steward' })"),
    a.local('mutation', 'handlers', "'verifiedOrganizationId',"),
    a.svc('audit', CRUD_FACTORY, 'await persistAtomicAudit(tx, {', 'crudRoutes'),
    a.svc('behavior', RESPONSES, 'export function stripReservedResponsesKeysForPatch(', undefined),
    a.local('defect', 'handlers', "'commercialTermsApprovedAt',"),
    a.svc('defect', RESPONSES, "'subscriptionPlanId',"),
    a.svc('defect', OWNERSHIP, 'const raw = responses.organizationId;', 'getPilotClaimedOrganizationId'),
  ],
  def: [DEF_CLAIM_OWNER, DEF_SIGNALS, DEF_REFERENCE],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* platform-tier binding, terms and transition                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const verifyPost = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator binding a pilot application to an organization',
  authn: PLATFORM_AUTHN,
  authz: PLATFORM_AUTHZ,
  tenant: `${PLATFORM_TENANT} bindPilotOrganization checks that an organizations row with the body id exists and binds only an application whose verified organization is null (a different existing binding answers 409).`,
  owner: 'The verified_organization_id, verified_by and verified_at columns of one pilot_applications row, and the audit row written under the target organization.',
  sens: 'The binding between an applicant and an organization, the administrator identity, and the application id',
  priv: 'The binding decides which organization stewards own the application and its generated commercial material; it is stored with the administrator identity and written into the target organization audit log.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'bindPilotOrganization locks the application with FOR UPDATE inside withSystemContext and writes the update and persistAtomicAudit (pilot.application.verify_organization) on the same transaction, so a failed audit rolls the binding back.',
  reqAudit: 'Keep the in-transaction audit row and record the evidence relied on and the reason for the binding.',
  does: 'Checks the system_admin floor, validates the organization id as a GUID, locks the application, binds it to an existing organization (idempotent for the same organization, 409 for a different one), stamps the administrator and time and writes the audit row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Require and record the proof that the applicant belongs to the organization and a reason, authorize the binding by a platform-staff mandate, and write the audit under the platform actor as well as the organization.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...platformGate(a),
    a.h('tenantScope', 'organizationId: parsed.data.organizationId,'),
    a.svc('tenantScope', OWNERSHIP, '.where(and(eq(pilotApplications.id, pilotId), isNull(pilotApplications.verifiedOrganizationId)))', 'bindPilotOrganization'),
    a.h('mutation', 'const result = await bindPilotOrganization({'),
    a.svc('mutation', OWNERSHIP, 'verifiedOrganizationId: organizationId,', 'bindPilotOrganization'),
    a.svc('audit', OWNERSHIP, 'await persistAtomicAudit(tx, {', 'bindPilotOrganization'),
    a.svc('behavior', OWNERSHIP, '.for(\'update\');', 'bindPilotOrganization'),
    a.svc('defect', OWNERSHIP, '.select({ id: organizations.id })', 'bindPilotOrganization'),
    a.svc('defect', OWNERSHIP, "action: 'pilot.application.verify_organization',", 'bindPilotOrganization'),
  ],
  def: [DEF_PLATFORM_TIER, DEF_VERIFY],
  corr: [],
})

const rebindPost = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator correcting the organization an application is bound to',
  authn: PLATFORM_AUTHN,
  authz: `${PLATFORM_AUTHZ} A rebind additionally requires a reason of at least 10 characters and an administrator other than the one who made the binding (403 otherwise).`,
  tenant: `${PLATFORM_TENANT} rebindPilotOrganization checks that the target organization exists, that the application is already bound, that no contract, invoice or subscription exists for it, and clears the approved commercial terms.`,
  owner: 'The verified organization columns of one pilot_applications row, the cleared commercial terms columns, and two audit rows (one under the new and one under the previous organization).',
  sens: 'The binding between an applicant and two organizations, the reason text, the administrator identity and the cleared commercial terms',
  priv: 'The correction moves ownership of the application and its commercial material from one organization to another and writes the reason and both organization ids into the audit log of each.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'rebindPilotOrganization locks the application with FOR UPDATE inside withSystemContext and writes the update with two persistAtomicAudit rows (pilot.application.rebind_organization and pilot.application.organization_unbound) on the same transaction; a failed audit rolls the rebind back.',
  reqAudit: 'Keep both in-transaction audit rows and bound the reason text.',
  does: 'Checks the system_admin floor, validates the organization id and a reason, locks the application, refuses when unbound, when the same administrator made the binding or when financial artifacts exist, then rebinds, clears the approved terms and writes both audit rows.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Authorize the correction by a platform-staff mandate, record the evidence for the correction, bound the reason, and decide the workflow for a correction after financial artifacts exist.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...platformGate(a),
    a.h('tenantScope', 'organizationId: parsed.data.organizationId,'),
    a.svc('tenantScope', OWNERSHIP, '.where(and(eq(pilotApplications.id, pilotId), eq(pilotApplications.verifiedOrganizationId, previousOrganizationId)))', 'rebindPilotOrganization'),
    a.h('mutation', 'const result = await rebindPilotOrganization({'),
    a.svc('mutation', OWNERSHIP, 'verifiedMemberCount: null,', 'rebindPilotOrganization'),
    a.svc('audit', OWNERSHIP, 'await persistAtomicAudit(tx, {', 'rebindPilotOrganization'),
    a.svc('behavior', OWNERSHIP, 'if (pilot.verifiedBy && pilot.verifiedBy === verifiedBy) {', 'rebindPilotOrganization'),
    a.svc('behavior', OWNERSHIP, 'const hasFinancialArtifacts = await pilotHasFinancialArtifacts(pilotId);', 'rebindPilotOrganization'),
    a.svc('defect', OWNERSHIP, "action: 'pilot.application.organization_unbound',", 'rebindPilotOrganization'),
    a.h('defect', 'reason: parsed.data.reason,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The body schema requires reason to be a trimmed string of at least 10 characters with no maximum, and the reason is written to the audit details of both organizations and to a logger warning.' },
  ],
  def: [DEF_PLATFORM_TIER, DEF_UNBOUNDED_TEXT],
  corr: [],
})

const approveTermsPost = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator approving the commercial terms of a verified pilot application',
  authn: PLATFORM_AUTHN,
  authz: `${PLATFORM_AUTHZ} The approver must also differ from the administrator who bound the organization (403 otherwise).`,
  tenant: `${PLATFORM_TENANT} approveCommercialTerms requires a bound organization and refuses once any contract, invoice or subscription exists for the application.`,
  owner: 'The verified_member_count, verified_pilot_amount, verified_subscription_plan_id, commercial_terms_approved_by and commercial_terms_approved_at columns of one pilot_applications row, and one audit row under the bound organization.',
  sens: 'The member count, pilot amount and subscription plan chosen for an organization and the approving administrator identity',
  priv: 'The values later become the contract value, invoice total and subscription of the bound organization and are written into that organization audit log.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'approveCommercialTerms locks the application with FOR UPDATE inside withSystemContext and writes the update and persistAtomicAudit (pilot.commercial_terms.approve) on the same transaction.',
  reqAudit: 'Keep the in-transaction audit row and record the source of the member count and the amount.',
  does: 'Checks the system_admin floor, validates a positive integer member count, an optional plan id and an optional amount, resolves the amount (typed, or the lower bound of a price band for the member count), requires a bound organization and a different administrator than the binder, refuses after financial artifacts exist, writes the terms and the audit row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Record the source of the member count and the amount, require the applicant organization to accept the terms before they can drive a financial artifact, and authorize the approval by a stated mandate.',
  dec: ['UE-INST-PILOT-COMMERCIAL-AGREEMENT-AUTHORITY', 'UE-INST-PLATFORM-CONTRACT-AUTHORITY', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...platformGate(a),
    a.h('tenantScope', 'const pilotAmount = parsed.data.pilotAmount != null ? String(parsed.data.pilotAmount) : null;'),
    a.svc('tenantScope', TERMS, '.where(and(eq(pilotApplications.id, pilotId), eq(pilotApplications.verifiedOrganizationId, organizationId)));', 'approveCommercialTerms'),
    a.h('mutation', 'const result = await approveCommercialTerms({'),
    a.svc('mutation', TERMS, 'verifiedPilotAmount: resolvedAmount,', 'approveCommercialTerms'),
    a.svc('audit', TERMS, 'await persistAtomicAudit(tx, {', 'approveCommercialTerms'),
    a.svc('behavior', TERMS, 'if (pilot.verifiedBy && pilot.verifiedBy === approvedBy) {', 'approveCommercialTerms'),
    a.svc('defect', TERMS, 'resolvedAmount = parsePriceBandLowerBound(getRecommendedEconomicsTier(memberCount).targetPriceRange);', 'approveCommercialTerms'),
  ],
  def: [DEF_PLATFORM_TIER, DEF_APPROVE_TERMS],
  corr: [],
})

const transitionPost = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator moving a pilot application through the commercial states',
  authn: PLATFORM_AUTHN,
  authz: `${PLATFORM_AUTHZ} The handler then requires authorizePilotAccess to answer platform and refuses a same-organization caller (403), so the claimed organization cannot run billing transitions.`,
  tenant: 'The application is read and locked by id under withSystemContext inside one transaction; the organization for every contract, invoice and subscription is the verified organization column read after the lock, and the billing account is looked up for that organization.',
  owner: 'The status, reviewed and approved times and the whole responses object of one pilot_applications row, plus commercial_contracts, platform_invoices, platform_invoice_line_items and org_subscriptions rows of the verified organization.',
  sens: 'The commercial state history with reason text, qualification scores, artifact versions, contract, invoice and subscription identifiers, the approved pilot amount and the verified organization id',
  priv: 'The transition creates financial records for an organization (a contract term, an issued invoice, an active subscription) and writes the reason text and the identifiers into the application and the audit details.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The contract, invoice, line item, subscription and application writes and persistAtomicAudit (pilot.commercial_transition, naming the states, reason, contract, invoice and subscription ids and the terms fingerprint) run on the same transaction inside withSystemContext, so the audit commits only with the effects.',
  reqAudit: 'Keep the in-transaction audit row; also state in it whether each financial effect was written or only staged.',
  does: 'Checks the system_admin floor and platform-tier access, parses the target state, locks the bound application, enforces adjacent transitions unless allowSkip is true, requires approved terms for contract_sent, invoice_issued and subscription_active, inserts or updates the contract, invoice and subscription for the bound organization when a billing account exists (otherwise appends a staged note), recomputes the scores, appends the history, sets the commercial state and pilot status and writes the audit row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Require an acceptance by the applicant organization before a contract is signed, an invoice issued or a subscription activated, refuse a transition whose financial effect cannot be written instead of recording it as staged, validate and bound the body, and authorize the transition by a stated mandate.',
  dec: ['UE-INST-PILOT-COMMERCIAL-AGREEMENT-AUTHORITY', 'UE-INST-PLATFORM-CONTRACT-AUTHORITY', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...platformGate(a),
    a.h('tenantScope', 'const verifiedOrganizationId = getPilotVerifiedOrganizationId(application);'),
    a.h('tenantScope', '.where(eq(billingAccounts.organizationId, organizationId));'),
    a.h('mutation', '.insert(commercialContracts)'),
    a.h('mutation', '.insert(platformInvoices)'),
    a.h('mutation', '.insert(orgSubscriptions)'),
    a.h('audit', 'await persistAtomicAudit(tx as unknown as RLSTx, {'),
    a.h('behavior', 'if (decision.reason !== \'platform\') {'),
    a.h('behavior', 'if (!body.allowSkip && !isCommercialTransitionAllowed(fromState, targetState)) {'),
    a.h('defect', "status: 'active',"),
    a.h('defect', 'signedAt: now,'),
    a.h('defect', "monetization.notes.push('No billing account found; monetization side effects were staged only.');"),
    a.h('defect', "monetization.notes.push('No draft contract found to sign; staged only.');"),
    a.h('defect', "status: 'issued',"),
    a.h('defect', 'const body = (await request.json().catch(() => ({}))) as TransitionPayload;'),
    a.h('defect', "source: body.source ?? 'admin-ui',"),
    a.svc('defect', WAVE1, 'if (state === \'approved\' || state === \'contract_sent\' || state === \'contract_signed\' || state === \'invoice_issued\') {', 'inferPilotStatusFromCommercialState'),
    a.svc('defect', WAVE1, 'const readiness = input.readinessScore ?? 55;', 'calculateCommercialSignals'),
  ],
  def: [DEF_TRANSITION, DEF_PLATFORM_TIER, DEF_SIGNALS, DEF_UNBOUNDED_TEXT],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* generated outputs                                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

const proposalGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading the generated proposal package',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: OWNED_TENANT,
  owner: 'No row is written. The package is computed from one pilot_applications row (typed intake fields, readiness score, commercial state and response scores).',
  sens: 'Applicant organization name, contact name and e-mail address, member count, challenges and goals, qualification scores, economics tier with a price range, and the proposal, statement of work, success metrics and pilot plan texts',
  priv: 'The generated documents reproduce the applicant typed contact and organization context and state scores and a price range derived from the applicant self-assessment.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed for the computed package.',
  reqAudit: 'No audit record is needed for a read of a generated package inside the authorized set; audit platform-tier reads of applicant data.',
  does: 'Checks the steward floor, loads the application under withSystemContext, authorizes by ownership, normalizes the commercial state and returns the proposal package built by buildProposalPackage, including qualification scores, signals, economics tier and the four generated documents.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'State the basis of each score, mark scores derived from a self-assessment as such, and replace the applicant-typed claim with a verified owner.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: ownedReadGate(a, [
    a.h('behavior', 'const proposal = buildProposalPackage('),
    a.h('privacy', 'data: proposal,'),
    a.svc('defect', WAVE1, 'const readiness = input.readinessScore ?? 55;', 'calculateCommercialSignals'),
  ]),
  def: [DEF_CLAIM_OWNER, DEF_SIGNALS],
  corr: [GET_CORR],
})

const packageExportGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, exporting the pilot package bundle',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: OWNED_TENANT,
  owner: 'No row is written. The bundle is computed from one pilot_applications row and returned as markdown text with a file name.',
  sens: 'Applicant organization name and type, contact name and e-mail address, member count, jurisdictions, sectors, current system, challenges, goals, opportunity score and tier, and the proposal, statement of work, success metrics and pilot plan texts',
  priv: 'The bundle reproduces the typed contact details and the intake answers of the applicant in a document intended to be handed on, with no classification or sharing step.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written, and the export of the bundle is not audited.',
  reqAudit: 'Audit each package export with the exporter and the application, since the bundle carries applicant contact data and is meant to leave the system.',
  does: 'Checks the steward floor, loads the application under withSystemContext, authorizes by ownership, builds the proposal package, assembles the intake summary and a markdown bundle and returns them with a file name derived from the organization name.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Audit the export, classify the bundle before it is shared, and replace the applicant-typed claim with a verified owner.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: ownedReadGate(a, [
    a.h('behavior', 'const bundleMarkdown = ['),
    a.h('privacy', '`- Contact: ${application.contactName} <${application.contactEmail}>`,'),
    a.h('privacy', "fileName: `pilot-package-${toSlug(application.organizationName || 'pilot')}.md`,"),
    a.svc('defect', WAVE1, 'const readiness = input.readinessScore ?? 55;', 'calculateCommercialSignals'),
  ]),
  def: [DEF_CLAIM_OWNER, DEF_SIGNALS],
  corr: [GET_CORR],
})

const timelineGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading the commercialization timeline',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: OWNED_TENANT,
  owner: 'No row is written. The timeline is assembled from the commercial transition history, artifact versions, reference versions and intelligence timeline stored in one pilot_applications row.',
  sens: 'Commercial state moves with reason text, artifact and reference snapshot summaries, intelligence events (lessons, objections, requested features, blockers and stakeholder sentiment), the organization name and the application id',
  priv: 'The platform-written negotiation history and the free-text intelligence notes are returned to a steward of the claimed organization.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed.',
  reqAudit: 'No audit record is needed for a read inside the authorized set; audit platform-tier reads of applicant data.',
  does: 'Checks the steward floor, loads the application under withSystemContext, authorizes by ownership and merges the stored transition history, artifact versions, reference versions and intelligence timeline into one list sorted by time.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [9, 13],
  future: 'Replace the applicant-typed claim with a verified owner and decide which platform-written history an organization steward may read.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: ownedReadGate(a, [
    a.h('behavior', 'events.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));'),
    a.h('privacy', 'data: transition,'),
  ]),
  def: [DEF_CLAIM_OWNER],
  corr: [GET_CORR],
})

const artifactsGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading generated artifacts and stored versions',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: OWNED_TENANT,
  owner: 'No row is written. The artifacts are computed from one pilot_applications row and returned with the stored artifact versions and the diff of the last two.',
  sens: 'Qualification scores, economics tier, the generated proposal, statement of work, success metrics and pilot plan artifacts, and the stored version records',
  priv: 'The artifacts restate the applicant organization and contact context and the scores derived from the applicant self-assessment.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed.',
  reqAudit: 'No audit record is needed for a read inside the authorized set; audit platform-tier reads of applicant data.',
  does: 'Checks the steward floor, loads the application under withSystemContext, authorizes by ownership, builds the proposal package and returns the artifacts with the stored versions and the latest diff.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'State the basis of each score and replace the applicant-typed claim with a verified owner.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: ownedReadGate(a, [
    a.h('behavior', 'const latestDiff = latestVersion && previousVersion'),
    a.h('privacy', 'artifacts: proposal.artifacts,'),
    a.svc('defect', WAVE1, 'const readiness = input.readinessScore ?? 55;', 'calculateCommercialSignals'),
  ]),
  def: [DEF_CLAIM_OWNER, DEF_SIGNALS],
  corr: [GET_CORR],
})

const artifactsPost = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, persisting an artifact version',
  authn: OWNED_AUTHN.replace('before reading the application', 'inside withLockedPilotMutation'),
  authz: 'withLockedPilotMutation calls hasMinRole(steward), locks the application with FOR UPDATE and re-authorizes ownership against the locked row (platform tier, or the effective owner organization); the write merges only the artifact version keys and is bound to the verified organization read under the lock. A role title and an id comparison are not a kernel decision, so kernelAuthorization stays false.',
  tenant: OWNED_TENANT,
  owner: 'The pilotArtifactVersions, latestPilotArtifactVersionId, latestPilotArtifactChecksum and latestPilotArtifactUpdatedAt keys of the responses column of one pilot_applications row.',
  sens: 'The generated artifact snapshot (scores, proposal documents), the caller-typed source, milestone and notes strings, and the version checksum',
  priv: 'The snapshot restates applicant contact and organization context and the caller text is stored with it.',
  mut: 'NONE',
  auditDetail: 'The handler locks the application and merges the artifact keys with one update inside withSystemContext and writes no audit row; no logger line records the write either.',
  reqAudit: 'Write an atomic audit row for each persisted artifact version naming the actor, the application and the version id.',
  does: 'Reads an unvalidated body, locks and re-authorizes the application, builds the proposal package and a version record with a checksum, returns persisted false when an identical checksum exists, and otherwise appends the version and merges the four artifact keys.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Validate and bound the body, audit each persisted version, and replace the applicant-typed claim with a verified owner.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: lockedWriteGate(a, [
    a.h('behavior', 'const snapshot = buildPilotArtifactVersionRecord({'),
    a.h('defect', 'const payload = (await request.json().catch(() => ({}))) as PersistArtifactsPayload;'),
    a.h('defect', "source: payload.source ?? 'manual',"),
    a.svc('defect', WAVE1, 'const readiness = input.readinessScore ?? 55;', 'calculateCommercialSignals'),
  ]),
  def: [DEF_CLAIM_OWNER, DEF_NO_AUDIT_WRITES, DEF_UNBOUNDED_TEXT, DEF_SIGNALS],
  corr: [NO_AUDIT_CORR],
})

const intelligenceGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading pilot intelligence notes',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: OWNED_TENANT,
  owner: 'No row is written. The notes are read from the pilotIntelligence key of the responses column of one pilot_applications row.',
  sens: 'Lessons learned, objections raised, requested features, deployment blockers and stakeholder sentiment notes with stakeholder names',
  priv: 'Free-text notes about stakeholders and objections recorded by platform staff or the claimed organization are returned to any caller that passes the ownership check.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed.',
  reqAudit: 'No audit record is needed for a read inside the authorized set; audit platform-tier reads.',
  does: 'Checks the steward floor, loads the application under withSystemContext, authorizes by ownership and returns the intelligence arrays and their counts.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [9, 13],
  future: 'Replace the applicant-typed claim with a verified owner and decide who may read internal notes about a prospect.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: ownedReadGate(a, [
    a.h('behavior', 'const lessonsLearned = toStringArray(intelligence.lessonsLearned);'),
    a.h('privacy', 'stakeholderSentiment,'),
  ]),
  def: [DEF_CLAIM_OWNER],
  corr: [GET_CORR],
})

const intelligencePost = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, recording a pilot intelligence note',
  authn: OWNED_AUTHN.replace('before reading the application', 'inside withLockedPilotMutation'),
  authz: 'withLockedPilotMutation calls hasMinRole(steward), locks the application with FOR UPDATE and re-authorizes ownership against the locked row; the write merges only the pilotIntelligence key and is bound to the verified organization read under the lock. A role title and an id comparison are not a kernel decision, so kernelAuthorization stays false.',
  tenant: OWNED_TENANT,
  owner: 'The pilotIntelligence key of the responses column of one pilot_applications row.',
  sens: 'Caller-typed lessons learned, objections, requested features, deployment blockers, stakeholder names, sentiment and notes, and a caller-typed source',
  priv: 'Free-text notes about named stakeholders are stored in the application with the timestamp and the caller-typed source and no author.',
  mut: 'NONE',
  auditDetail: 'The handler locks the application and merges the pilotIntelligence key with one update inside withSystemContext and writes no audit row; the stored entry carries a time and a caller-typed source and no user id.',
  reqAudit: 'Write an atomic audit row naming the actor, the application and the type of each note, and store the author with the note.',
  does: 'Reads an unvalidated body, locks and re-authorizes the application, appends the trimmed lesson, objection, feature, blocker and stakeholder sentiment to the stored arrays and the interaction timeline, and merges the pilotIntelligence key.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Validate and bound the body, store the author, audit each note, and replace the applicant-typed claim with a verified owner.',
  dec: ['UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: lockedWriteGate(a, [
    a.h('behavior', 'lessonsLearned.push(payload.lessonLearned.trim());'),
    a.h('privacy', 'stakeholder: payload.stakeholderSentiment.stakeholder ?? \'unspecified\','),
    a.h('defect', 'const payload = (await request.json().catch(() => ({}))) as IntelligencePayload;'),
    a.h('defect', "source: payload.source ?? 'api',"),
  ]),
  def: [DEF_CLAIM_OWNER, DEF_NO_AUDIT_WRITES, DEF_UNBOUNDED_TEXT],
  corr: [NO_AUDIT_CORR],
})

const REFERENCE_FUTURE = 'Compute the profile only from measured pilot_metrics rows and attested testimonials, label every estimated figure, require the customer attestation and consent before a quotation, case study or benchmark is stored or shown, and replace the applicant-typed claim with a verified owner.'

const referenceGet = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, reading the generated reference profile',
  authn: OWNED_AUTHN,
  authz: OWNED_AUTHZ,
  tenant: `${OWNED_TENANT} The latest pilot_metrics row is read by pilot id under withSystemContext before the ownership decision and is not returned unless the decision passes.`,
  owner: 'No row is written. The profile, case study and benchmark dataset are computed from one pilot_applications row, its latest pilot_metrics row and the stored reference versions.',
  sens: 'Adoption, engagement and health figures, a testimonial quotation with author and role, an hours-saved estimate, renewal likelihood, a case study text naming the organization and a benchmark record with member count and scores',
  priv: 'A testimonial in the applicant contact name and the outcome figures are generated for a named organization and returned to any caller that passes the ownership check.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed for the computed profile.',
  reqAudit: 'No audit record is needed for a computed read inside the authorized set; audit platform-tier reads.',
  does: 'Checks the steward floor, loads the application and the latest metric row under withSystemContext, authorizes by ownership and returns the reference profile (with a default testimonial, a six-hour floor of time saved and metrics from the signals when no metric row exists), the case study, the benchmark dataset and the stored versions.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: REFERENCE_FUTURE,
  dec: ['UE-INST-PILOT-REFERENCE-AND-CASE-STUDY-PUBLICATION', 'UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: [
    ...guardEv(a, 'withApiAuth'),
    a.h('authorization', "const canAccess = await hasMinRole('steward');"),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', 'const denied = await enforcePilotOwnership(payload.application);'),
    a.imp('tenantScope', 'enforcePilotOwnership', 'const decision = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));'),
    a.svc('tenantScope', OWNERSHIP, 'return getPilotVerifiedOrganizationId(application) ?? getPilotClaimedOrganizationId(application);', 'getPilotEffectiveOrganizationId'),
    a.local('tenantScope', 'buildReferencePayload', '.where(and(eq(pilotApplications.id, id)));'),
    a.h('mutation', 'const payload = await buildReferencePayload(id);'),
    a.local('behavior', 'buildReferencePayload', 'return { application, ...computeReferenceProfileData(application, metric) };'),
    a.local('privacy', 'buildReferencePayload', '.where(eq(pilotMetrics.pilotId, app.id))'),
    a.local('defect', 'buildReferencePayload', 'return { application, ...computeReferenceProfileData(application, metric) };'),
    a.svc('defect', WAVE1, 'const championScore = Math.max(0, Math.min(100, Math.round(input.championScore ?? readiness * 0.75)));', 'calculateCommercialSignals'),
  ],
  def: [DEF_REFERENCE, DEF_CLAIM_OWNER, DEF_SIGNALS],
  corr: [GET_CORR],
})

const referencePost = (a) => mk({
  ...base(a),
  persona: 'Steward of the organization an application claims, or a platform-tier actor, persisting the generated reference profile as a version',
  authn: OWNED_AUTHN.replace('before reading the application', 'inside withLockedPilotMutation'),
  authz: 'withLockedPilotMutation calls hasMinRole(steward), locks the application with FOR UPDATE and re-authorizes ownership against the locked row; the write merges only the reference version keys and is bound to the verified organization read under the lock. A role title and an id comparison are not a kernel decision, so kernelAuthorization stays false.',
  tenant: `${OWNED_TENANT} The latest pilot_metrics row is read by pilot id under withSystemContext before the lock and is used only inside the locked callback after the ownership decision passes.`,
  owner: 'The pilotReferenceVersions, latestPilotReferenceVersionId, latestPilotReferenceChecksum and latestPilotReferenceUpdatedAt keys of the responses column of one pilot_applications row.',
  sens: 'The stored reference snapshot (testimonial quotation with author and role, hours saved, outcome figures, case study, benchmark record), the caller-typed source, milestone and notes, and the checksum',
  priv: 'A testimonial in the applicant contact name and invented outcome figures are stored as a versioned case study of a named organization with the caller text.',
  mut: 'NONE',
  auditDetail: 'The handler locks the application and merges the reference version keys with one update inside withSystemContext and writes no audit row; the stored snapshot carries a time and a caller-typed source and no user id.',
  reqAudit: 'Write an atomic audit row for each stored reference snapshot naming the actor, the application and the version, and record the attestation behind any quotation.',
  does: 'Reads an unvalidated body, loads the latest metric row, locks and re-authorizes the application, computes the reference profile, case study and benchmark dataset, builds a version record with a checksum, returns persisted false for an identical checksum and otherwise appends the version and merges the four reference keys.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: REFERENCE_FUTURE,
  dec: ['UE-INST-PILOT-REFERENCE-AND-CASE-STUDY-PUBLICATION', 'UE-INST-PILOT-APPLICANT-ORGANIZATION-VERIFICATION'],
  ev: lockedWriteGate(a, [
    a.h('behavior', 'const computed = computeReferenceProfileData(application, metric);'),
    a.h('behavior', 'const snapshot = buildPilotReferenceVersionRecord({'),
    a.h('privacy', 'caseStudy: computed.caseStudy,'),
    a.h('defect', 'const requestPayload = (await request.json().catch(() => ({}))) as PersistReferencePayload;'),
    a.h('defect', "source: requestPayload.source ?? 'manual',"),
    a.local('defect', 'computeReferenceProfileData', 'estimatedHoursPerWeek: Math.max(6, Math.round(adoptionRate * 0.18)),'),
    a.local('defect', 'computeReferenceProfileData', '`${application.organizationName} established a repeatable pilot operating cadence with measurable adoption growth.`,'),
  ]),
  def: [DEF_REFERENCE, DEF_CLAIM_OWNER, DEF_NO_AUDIT_WRITES, DEF_UNBOUNDED_TEXT, DEF_SIGNALS],
  corr: [NO_AUDIT_CORR],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* usage telemetry                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const TELEMETRY_AUTHN = 'Authenticated session resolved by withRoleAuth, which wraps withApiAuth (a tenant transaction is opened for the session organization only in the canonical bootstrap mode) and then resolves the user with getCurrentUser.'
const TELEMETRY_AUTHZ = 'withRoleAuth with an admin floor: hasRole(admin) on the resolved organization role title passes an administrator of any organization (and any higher or platform title); the wrapper also emits a separate governance audit event after the handler. The organization to read is the organizationId query parameter and is never compared with the session organization. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.'
const TELEMETRY_TENANT = 'The session organization is resolved by the wrapper and ignored by the handler; the organization is taken from the query string and passed to a service that filters pilot_events by that id through the bare db import. The only boundary left is the pilot_events direct-organization policy, which constrains the query only when the request runs under a tenant transaction (the canonical bootstrap mode).'

const telemetryGate = (a, routeLine, orgLine) => [
  ...guardEv(a, 'withRoleAuth'),
  a.h('authorization', routeLine),
  a.h('tenantScope', orgLine),
  a.sch('tenantScope', RLS_ROUND58, "PERFORM ue_create_direct_org_rls_policy('pilot_events', 'organization_id', FALSE);"),
  a.svc('tenantScope', WITH_API, 'return withRLSContext({ organizationId: resolvedOrganizationId }, runHandler);', undefined),
]

const championsGet = (a) => mk({
  ...base(a),
  persona: 'Administrator reading potential champion users of a named organization',
  authn: TELEMETRY_AUTHN,
  authz: TELEMETRY_AUTHZ,
  tenant: TELEMETRY_TENANT,
  owner: 'No row is written. The response is aggregated from pilot_events rows of the organization named in the query.',
  sens: 'User ids with total events, cases created, updates added, active days and a score, for users over the champion thresholds',
  priv: 'Per-user behavioural telemetry of the named organization is returned to an administrator of any organization, subject only to the row-level policy.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row; the deprecated wrapper emits a separate governance audit event with the path only, after the handler, which is not an attributable read audit of the organization read.',
  reqAudit: 'Audit each read with the session organization and the organization read, once the institution decides who may read per-user pilot telemetry.',
  does: 'Requires the organizationId query parameter and returns detectChampions for it: users with at least 3 case_created, 5 update_added and 5 distinct active days events, with a score of 3 per case, 2 per update and 1 per day, ordered by score.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session, refuse a different id, state the basis of the champion criteria and audit the read.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...telemetryGate(a, "export const GET = withRoleAuth('admin', async (req) => {", 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
    a.h('mutation', 'const champions = await detectChampions(orgId);'),
    a.svc('behavior', SIGNALS, 'WHERE organization_id = ${organizationId}', 'detectChampions'),
    a.svc('privacy', SIGNALS, 'userId: String(r.user_id),', 'detectChampions'),
    a.svc('defect', SIGNALS, 'import { db } from "@/db";', undefined),
    a.svc('defect', SIGNALS, "COUNT(*) FILTER (WHERE event_type = 'case_created') >= 3", 'detectChampions'),
  ],
  def: [DEF_TELEMETRY_XT, DEF_EVENTS_ASSERTED],
  corr: [GET_CORR],
})

const frictionGet = (a) => mk({
  ...base(a),
  persona: 'Administrator reading the friction report of a named organization',
  authn: TELEMETRY_AUTHN,
  authz: TELEMETRY_AUTHZ,
  tenant: TELEMETRY_TENANT,
  owner: 'No row is written. The response is aggregated from pilot_events rows of the organization named in the query.',
  sens: 'User ids with the date of last login, last case or last activity and days since, for users who logged in without a case, created a case without an update, or went inactive; counts only when summary is true',
  priv: 'Per-user behavioural telemetry of the named organization is returned to an administrator of any organization, subject only to the row-level policy.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row; the deprecated wrapper emits a separate governance audit event with the path only, after the handler.',
  reqAudit: 'Audit each read with the session organization and the organization read, once the institution decides who may read per-user pilot telemetry.',
  does: 'Requires the organizationId query parameter and returns either the counts of the three friction lists (summary true) or the full lists of users with last-seen dates from raw SQL over pilot_events.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session, refuse a different id, return counts by default and audit the read.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...telemetryGate(a, "export const GET = withRoleAuth('admin', async (req) => {", 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
    a.h('mutation', 'const report = await getFrictionReport(orgId);'),
    a.svc('behavior', FRICTION, "WHERE organization_id = ${orgId} AND event_type = 'user_login'", 'detectLoginNoCase'),
    a.svc('privacy', FRICTION, 'lastSeen: String(r.last_seen),', 'detectLoginNoCase'),
    a.svc('defect', FRICTION, 'import { db } from "@/db";', undefined),
  ],
  def: [DEF_TELEMETRY_XT, DEF_EVENTS_ASSERTED],
  corr: [GET_CORR],
})

const metricsGet = (a) => mk({
  ...base(a),
  persona: 'Administrator reading engagement metrics and a daily active user trend of a named organization',
  authn: TELEMETRY_AUTHN,
  authz: TELEMETRY_AUTHZ,
  tenant: TELEMETRY_TENANT,
  owner: 'No row is written. The response is aggregated from pilot_events rows of the organization named in the query.',
  sens: 'Average minutes to first case and first update, cases per user, updates per case, daily active users, total users, cases and updates, and a 30-day daily active user trend',
  priv: 'Organization-level usage aggregates of the named organization are returned to an administrator of any organization, subject only to the row-level policy.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row; the deprecated wrapper emits a separate governance audit event with the path only, after the handler.',
  reqAudit: 'Audit each read with the session organization and the organization read, once the institution decides who may read pilot usage metrics.',
  does: 'Requires the organizationId query parameter, computes the pilot engagement metrics from pilot_events with raw SQL and, when trend is true, adds a 30-day daily active user series.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session, refuse a different id, state that the metrics rest on client-asserted events, and audit the read.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...telemetryGate(a, "export const GET = withRoleAuth('admin', async (req) => {", 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
    a.h('mutation', 'const metrics = await getPilotMetrics(orgId);'),
    a.svc('behavior', METRICS, 'WHERE organization_id = ${orgId}', 'computeTotals'),
    a.svc('privacy', METRICS, 'totalUsers: (row?.total_users as number) ?? 0,', 'computeTotals'),
    a.svc('defect', METRICS, 'import { db } from "@/db";', undefined),
    a.svc('defect', METRICS, "WHERE organization_id = ${orgId} AND event_type = 'user_login'", 'computeTimeToFirstCase'),
  ],
  def: [DEF_TELEMETRY_XT, DEF_EVENTS_ASSERTED],
  corr: [GET_CORR],
})

const readinessGet = (a) => mk({
  ...base(a),
  persona: 'Administrator reading the conversion assessment of a named organization',
  authn: TELEMETRY_AUTHN,
  authz: TELEMETRY_AUTHZ,
  tenant: TELEMETRY_TENANT,
  owner: 'No row is written. The response is aggregated from pilot_events rows of the organization named in the query.',
  sens: 'The organization id, four boolean signals, a combined conversion flag, active users and days in the last 14 days, and total cases and updates',
  priv: 'Organization-level usage counts and a conversion flag for the named organization are returned to an administrator of any organization, subject only to the row-level policy.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row; the deprecated wrapper emits a separate governance audit event with the path only, after the handler.',
  reqAudit: 'Audit each read with the session organization and the organization read, once the institution decides who may read the conversion assessment.',
  does: 'Requires the organizationId query parameter and returns assessConversionReadiness: counts over pilot_events and a flag that is true when there are 3 active users in 14 days, 10 cases, 5 updates and activity on 5 of the last 14 days.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive the organization from the session, refuse a different id, state the basis of the thresholds and that they rest on client-asserted events, and audit the read.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...telemetryGate(a, "export const GET = withRoleAuth('admin', async (req) => {", 'const orgId = req.nextUrl.searchParams.get("organizationId");'),
    a.h('mutation', 'const readiness = await assessConversionReadiness(orgId);'),
    a.svc('behavior', SIGNALS, 'isReady: Object.values(signals).every(Boolean),', 'assessConversionReadiness'),
    a.svc('privacy', SIGNALS, 'activeUsers14d,', 'assessConversionReadiness'),
    a.svc('defect', SIGNALS, 'import { db } from "@/db";', undefined),
    a.svc('defect', SIGNALS, 'multipleActiveUsers: activeUsers14d >= 3,', 'assessConversionReadiness'),
  ],
  def: [DEF_TELEMETRY_XT, DEF_EVENTS_ASSERTED],
  corr: [GET_CORR],
})

const eventsPost = (a) => mk({
  ...base(a),
  persona: 'Member recording a pilot usage event for themselves in their own organization',
  authn: TELEMETRY_AUTHN,
  authz: 'withRoleAuth with a member floor: any member record of the session organization passes. The body user id and organization id, when present, must equal the session values or the handler answers 403; the event type must be one of 25 listed values. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The user and organization written are the session values from the wrapper context, never the body values; the insert goes through the bare db import with the organization id stated in the row, so under the pilot_events policy it is admitted only on a connection whose tenant setting matches or that the policy does not constrain.',
  owner: 'pilot_events rows of the session organization: the actor user id, the caller-typed session id, the event type and the caller-typed metadata object, and up to one automatic first_* event.',
  sens: 'The acting user id, a caller-typed session id, the event type and an unbounded metadata object (including a caller-typed case id)',
  priv: 'The row records what the member says they did; the metadata is stored without a size or key limit and is readable by administrators through the telemetry routes.',
  mut: 'NONE',
  auditDetail: 'The handler inserts the pilot_events row (and a first_* row when applicable) through trackPilotEvent with a bare insert and writes no audit row; the coverage manifest records an attribution-exempt declaration for this write.',
  reqAudit: 'Usage events are not individually audited; if the signals derived from them are used for a conversion decision, record the basis and verify the action the event claims.',
  does: 'Reads the body, refuses a user or organization that differs from the session, validates the event type against a list of 25, delegates case_created and update_added with a caseId to trackers that add a first_* event for the first occurrence, and otherwise inserts the event with the caller-typed metadata, returning ok.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Produce usage events from the actions themselves on the server, verify the case id against the organization, bound the metadata and the event types a client may assert, and state the basis of every signal derived from the events.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "export const POST = withRoleAuth('member', async (req, context: BaseAuthContext) => {"),
    a.h('authorization', '(claimedOrganizationId !== undefined && claimedOrganizationId !== organizationId)'),
    a.h('tenantScope', 'const organizationId = context.organizationId;'),
    a.svc('tenantScope', TRACKING, 'organizationId: input.organizationId,', 'trackPilotEvent'),
    a.h('mutation', 'await trackPilotEvent({ eventType, userId, organizationId, sessionId, metadata });'),
    a.svc('mutation', TRACKING, 'await db.insert(pilotEvents).values({', 'trackPilotEvent'),
    a.svc('audit', TRACKING, 'await db.insert(pilotEvents).values({', 'trackPilotEvent'),
    a.h('behavior', 'if (!VALID_EVENT_TYPES.includes(eventType)) {'),
    a.h('privacy', 'const { eventType, userId: claimedUserId, organizationId: claimedOrganizationId, sessionId, metadata } = body;'),
    a.h('defect', 'await trackCaseCreated(userId, organizationId, sessionId, metadata.caseId);'),
    a.svc('defect', TRACKING, 'metadata: input.metadata ?? null,', 'trackPilotEvent'),
  ],
  def: [DEF_EVENTS_ASSERTED],
  corr: [],
})

const feedbackPost = (a) => mk({
  ...base(a),
  persona: 'Member submitting ease-of-use feedback in their own organization',
  authn: TELEMETRY_AUTHN,
  authz: 'withRoleAuth with a member floor: any member record of the session organization passes; the rating, category and trigger are validated against fixed values. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The user and organization written are the session values from the wrapper context; the feedback row, two pilot events and the audit row are written inside withRLSContext for that organization.',
  owner: 'One pilot_feedback row of the session organization (user id, rating, category, comment, trigger), two pilot_events rows and one audit row.',
  sens: 'The member user id, the rating, category, trigger and a free-text comment',
  priv: 'The feedback is stored with the member user id and is returned with it to administrators of the organization; the comment is unvalidated free text.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The pilot_feedback insert, the two pilot_events inserts and persistAtomicAudit (pilot.feedback.submit) run on the same transaction inside withRLSContext for the session organization.',
  reqAudit: 'Keep the in-transaction audit row.',
  does: 'Validates an integer rating from 1 to 5, an optional category and a trigger, inserts the feedback row, a feedback_submitted event and a feature_used event, and writes the audit row in one tenant transaction, returning ok.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [9, 13],
  future: 'Bound and type the comment and decide whether a member feedback is attributable to the member.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "export const POST = withRoleAuth('member', async (req, context: BaseAuthContext) => {"),
    a.h('tenantScope', 'await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.insert(pilotFeedback)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('behavior', "const validTriggers = [\"first_case\", \"milestone_usage\"];"),
    a.h('privacy', 'comment: comment ?? null,'),
    a.h('defect', 'const { easeRating, category, comment, trigger } = body;'),
    a.sch('defect', PILOT_FEEDBACK, 'comment: text("comment"),', { resolvesExport: 'pilotFeedback' }),
  ],
  def: [DEF_FEEDBACK_COMMENT],
  corr: [],
})

const feedbackGet = (a) => mk({
  ...base(a),
  persona: 'Administrator reading pilot feedback of their own organization',
  authn: TELEMETRY_AUTHN,
  authz: 'withRoleAuth with an admin floor: hasRole(admin) passes an administrator of the session organization (and any higher or platform title); the organization read is the session organization. A role title is not a kernel decision, so kernelAuthorization stays false.',
  tenant: 'The organization read is the session organization from the wrapper context, applied as an explicit predicate on both queries, which also run through withRLSContext.',
  owner: 'No row is written. The response is a summary over pilot_feedback rows of the session organization and the ten most recent rows.',
  sens: 'Counts and the average rating by category, and the ten most recent rows with user id, rating, category, comment and trigger',
  priv: 'The recent rows carry the member user id and the raw comment to any administrator of the organization.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row; the deprecated wrapper emits a separate governance audit event with the path only, after the handler.',
  reqAudit: 'No row-level audit is required for an own-organization administrator read; decide whether feedback is attributable.',
  does: 'Computes the response count, average ease rating and category counts and selects the ten most recent feedback rows of the session organization, returning both.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [9, 13],
  future: 'Return only the fields an administrator needs and decide whether member feedback is attributable.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', "export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {"),
    a.h('tenantScope', 'const orgId = context.organizationId;'),
    a.h('tenantScope', '.where(eq(pilotFeedback.organizationId, orgId))'),
    a.h('mutation', '.select()'),
    a.h('behavior', 'WHERE organization_id = ${orgId}'),
    a.h('privacy', 'recent,'),
    a.h('defect', '.select()'),
  ],
  def: [DEF_FEEDBACK_COMMENT],
  corr: [GET_CORR],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* enrollment metrics and onboarding checklist                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const ORG_AUTHN = 'Authenticated session resolved by withOrganizationAuth (requireUser, then the canonical organization context of the session).'

const currentGet = (a) => mk({
  ...base(a),
  persona: 'Officer of an enrolled organization reading its pilot metrics',
  authn: ORG_AUTHN,
  authz: 'withOrganizationAuth resolves the session organization and the handler requires hasMinRole(officer) (403 otherwise). A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization from withOrganizationAuth and is applied as an explicit eq(organizationId) predicate on the enrollment and milestone reads and as an interpolated organization id in the member and grievance statements; the reads run under withSystemContext, so the row policies do not apply.',
  owner: 'No row is written. The response is built from the organization pilot enrollment, milestones, organization_members and grievances rows.',
  sens: 'Enrollment date, organizer adoption and member engagement rates, cases managed, average time to resolution, health score and milestones of the session organization',
  priv: 'Organization-level aggregates of the caller own organization; no member identity is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed for own-organization aggregates.',
  reqAudit: 'No audit record is needed for an own-organization aggregate read.',
  does: 'Checks the officer floor, reads the active enrollment and milestones of the session organization, computes adoption and engagement from organization_members update times and cases managed and average resolution hours from grievances of the last 30 days, falls back to stored enrollment values when a count is zero, and returns the metrics or null when there is no active enrollment.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Run the reads in the tenant context, define adoption, engagement and resolution time from recorded activity and resolved cases, and mark any stored fallback.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', '.where(eq(pilotEnrollments.organizationId, organizationId))'),
    a.h('mutation', 'return withSystemContext(async () => {'),
    a.h('behavior', 'const metrics: PilotMetrics = {'),
    a.h('privacy', 'milestones,'),
    a.h('defect', "AND created_at > NOW() - INTERVAL '30 days'"),
    a.h('defect', 'EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600'),
    a.h('defect', ': enrollment.organizerAdoptionRate;'),
    a.h('defect', "AND updated_at > NOW() - INTERVAL '30 days')"),
  ],
  def: [DEF_PILOT_METRICS, DEF_CURRENT_SYSTEM, DEF_DEMO_DATA],
  corr: [GET_CORR],
})

const onboardingGet = (a) => mk({
  ...base(a),
  persona: 'Officer of an organization reading its pilot onboarding checklist and demo dataset state',
  authn: ORG_AUTHN,
  authz: 'withOrganizationAuth resolves the session organization and the handler requires hasMinRole(officer) (403 otherwise). A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization from withOrganizationAuth and is applied as an explicit eq(organizationId) predicate on both reads, which run on the bare db import.',
  owner: 'No row is written. The response is read from the organization pilot_checklist_items and pilot_demo_seeds rows against a fixed list of seven item ids.',
  sens: 'The completion state of seven checklist steps, a completion count, and the demo dataset counts and active flag',
  priv: 'Organization-level checklist state of the caller own organization; no personal data is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row is needed.',
  reqAudit: 'No audit record is needed for an own-organization checklist read.',
  does: 'Checks the officer floor, reads the checklist rows and the demo seed row of the session organization, reports each of seven fixed item ids as completed or not (false when no row), the completion count and flag, and the demo dataset counts when a seed is active.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive each step from the record it names, and read only the item ids that every writer of the table uses.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', '.where(eq(pilotChecklistItems.organizationId, organizationId));'),
    a.sch('tenantScope', RLS_ROUND58, "PERFORM ue_create_direct_org_rls_policy('pilot_checklist_items', 'organization_id', FALSE);"),
    a.h('mutation', 'const rows = await db'),
    a.h('behavior', 'items[itemId] = rowMap.get(itemId) ?? false;'),
    a.h('privacy', 'isComplete: completedCount === totalCount,'),
    a.h('defect', 'items[itemId] = rowMap.get(itemId) ?? false;'),
  ],
  def: [DEF_BOOTSTRAP_REPORT],
  corr: [GET_CORR],
})

const onboardingPatch = (a) => mk({
  ...base(a),
  persona: 'Officer of an organization marking a pilot onboarding checklist step done or reopened',
  authn: ORG_AUTHN,
  authz: 'withOrganizationAuth resolves the session organization and the handler requires hasMinRole(officer) (403 otherwise); the item id must be one of seven fixed ids. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization from withOrganizationAuth; the upsert and the reads run inside withRLSContext for that organization and write that organization id.',
  owner: 'One pilot_checklist_items row of the session organization per step (completed flag, completer and time) and the audit rows written with it.',
  sens: 'The completion state of a checklist step with the completing user id and time',
  priv: 'The completing user id and time are stored with the step; the step state is organization-level.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The checklist upsert and persistAtomicAudit (pilot.checklist_item_completed or pilot.checklist_item_reopened, and pilot.checklist_completed when all seven are done) run on the same transaction inside withRLSContext for the session organization.',
  reqAudit: 'Keep the in-transaction audit rows and derive each step from the record it names.',
  does: 'Checks the officer floor, validates an item id and a boolean, upserts the checklist row with the completer and time, recomputes the completion count over the seven fixed ids, writes the audit row (and the completion audit row when all are done) and returns the state.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Derive each checklist step from the record it names, or record the evidence for a manual attestation and who may attest it.',
  dec: ['UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('tenantScope', 'const state = await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.onConflictDoUpdate({'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('behavior', 'const isComplete = completedCount === totalCount;'),
    a.h('privacy', 'completedBy: completed ? userId : null,'),
    a.h('defect', 'completed: z.boolean(),'.replace('completed: z.boolean(),', 'if (!CHECKLIST_ITEM_IDS.includes(itemId as (typeof CHECKLIST_ITEM_IDS)[number])) {')),
    a.h('defect', 'completedAt: completed ? changedAt : null,'),
  ],
  def: [DEF_CHECKLIST_ASSERTED],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* demo data and bootstrap                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

const demoDataPost = (a) => mk({
  ...base(a),
  persona: 'Officer seeding the fictional demo dataset into their own organization',
  authn: ORG_AUTHN,
  authz: 'withOrganizationAuth resolves the session organization; the handler requires a pilot or demo runtime (NZILA_MODE) and hasMinRole(officer). A role title and a runtime flag are not a kernel decision, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization and every seeded row is written with that organization id inside withRLSContext for it.',
  owner: 'Four employers and grievances rows of the session organization with fixed demo numbers and addresses, and one pilot_demo_seeds row recording the seed.',
  sens: 'Fictional grievances with named grievants and descriptions, employer names of real federal departments with e-mail addresses on real government domains, and the seeding user id',
  priv: 'The rows are fictional but sit in the same tables as real records, with no row marker, and name real departments with e-mail addresses on real domains.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The employer and grievance inserts, the pilot_demo_seeds write and persistAtomicAudit (pilot.demo_data_seeded) run on the same transaction inside withRLSContext for the session organization.',
  reqAudit: 'Keep the in-transaction audit row and mark seeded rows so they cannot be mistaken for real records.',
  does: 'Refuses unless NZILA_MODE is pilot or demo and the caller is an officer, inserts the demo employers and grievances for the session organization when no active seed row exists (or reopens a purged one), records the seed and writes the audit row, returning the dataset summary; a second seed answers conflict.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Keep demo data out of the tables of a real pilot organization or mark every row it creates, decide which runtime and which office may seed it, and exclude it from every metric.',
  dec: ['UE-INST-PILOT-DEMO-RUNTIME-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('authorization', 'const { runtimeMode, failure } = requireDemoRuntimeMode();'),
    a.svc('authorization', DEMO_RUNTIME, "const DEMO_MUTATION_MODES = ['pilot', 'demo'] as const", undefined),
    a.h('tenantScope', 'seeded = await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', 'await tx.insert(grievances).values(demoGrievances);'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('behavior', 'const demoEmployers = generateDemoEmployers(organizationId);'),
    a.svc('privacy', DEMO_DATA, "{ id: uuidv4(), organizationId, name: 'Treasury Board Secretariat', employerType: 'federal' as const, email: 'lr-demo@tbs-sct.gc.ca' },", 'generateDemoEmployers'),
    a.svc('defect', DEMO_DATA, "grievanceNumber: 'GRV-DEMO-001',", 'generateDemoGrievances'),
    a.svc('defect', DEMO_DATA, "employerName: 'Canada Revenue Agency', grievantName: 'Marc-Antoine Deschamps',", 'generateDemoGrievances'),
  ],
  def: [DEF_DEMO_DATA],
  corr: [],
})

const demoDataDelete = (a) => mk({
  ...base(a),
  persona: 'Officer purging the demo dataset from their own organization',
  authn: ORG_AUTHN,
  authz: 'withOrganizationAuth resolves the session organization; the handler requires a pilot or demo runtime (NZILA_MODE) and hasMinRole(officer). A role title and a runtime flag are not a kernel decision, so kernelAuthorization stays false.',
  tenant: 'The organization is the session organization and the deletes are filtered by that organization id inside withRLSContext for it, plus a number or address prefix.',
  owner: 'The pilot_demo_seeds row of the session organization (closed) and every grievance whose number starts with GRV-DEMO- and every employer whose e-mail starts with lr-demo@ in that organization, whether or not the seed created them.',
  sens: 'Grievance and employer rows matched by prefix, and the purging user id',
  priv: 'The delete is by pattern and removes any matching row of the organization, including a row typed by a user with a matching number or address.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The seed row update, the grievance and employer deletes and persistAtomicAudit (pilot.demo_data_purged) run on the same transaction inside withRLSContext for the session organization.',
  reqAudit: 'Keep the in-transaction audit row and delete only the rows the seed recorded.',
  does: 'Refuses unless NZILA_MODE is pilot or demo and the caller is an officer, closes the active seed row (conflict when none), deletes the organization grievances numbered GRV-DEMO-% and employers with e-mail lr-demo@%, and writes the audit row.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Delete only rows identified by a recorded marker from the seed, and decide which runtime and office may purge.',
  dec: ['UE-INST-PILOT-DEMO-RUNTIME-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withOrganizationAuth'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('authorization', 'const { runtimeMode, failure } = requireDemoRuntimeMode();'),
    a.h('tenantScope', 'await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('mutation', '.delete(grievances)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('behavior', '.set({ purgedAt: new Date(), updatedAt: new Date() })'),
    a.h('privacy', 'like(grievances.grievanceNumber, "GRV-DEMO-%"),'),
    a.h('defect', 'like(employers.email, "lr-demo@%"),'),
  ],
  def: [DEF_DEMO_DATA],
  corr: [],
})

const bootstrapPost = (a) => mk({
  ...base(a),
  persona: 'Platform-tier administrator bootstrapping or resetting the CUPE pilot organization from a fixture',
  authn: 'Authenticated session resolved by withApi (a session is required and the handler answers 401 when no user id exists).',
  authz: 'withApi with minRole system_admin (any role title at or above level 200, which includes platform staff titles such as support_agent), a write rate limit, and a runtime gate: assertPilotDemoMutationRuntime refuses unless NZILA_MODE is pilot or demo. A role title is not a kernel decision and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'The target organization is resolved from the slug in a fixture file read relative to the process working directory, never from the request; every write runs under withSystemContext with that organization id, and the reset deletes by organization id alone.',
  owner: 'The organization at the fixture slug (created when absent), its organization_members, grievances and pilot_checklist_items rows, two pilot_events rows and one audit row.',
  sens: 'Fixture member names, e-mail addresses and roles (including admin and president) and fixture grievance titles and descriptions with grievant names, and, on reset, every real grievance and member row of the organization',
  priv: 'The reset hard-deletes the organization grievances, members and checklist rows, and the seeding writes fixture people with elevated organization roles under fixed fixture user ids.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The deletes, inserts and persistAtomicAudit (pilot.bootstrap.cupe, naming the reset flag, runtime mode, attempted member and case counts and the fixture worksite count) run on one system transaction.',
  reqAudit: 'Keep the in-transaction audit row and record the count of rows deleted and actually inserted.',
  does: 'Refuses outside a pilot or demo runtime, reads the fixture file, finds the organization by slug, optionally deletes its grievances, members and checklist rows, creates the organization when absent, inserts fixture members and grievances ignoring conflicts, inserts five checklist rows and two events, writes the audit row and returns counts, literal onboarding figures and a demo script.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Refuse to reset an organization that holds records the bootstrap did not create, take a confirmation and a dry run, report counts of rows actually written, seed only the checklist ids the checklist route reads, and decide which runtime and office may bootstrap.',
  dec: ['UE-INST-PILOT-DEMO-RUNTIME-AUTHORITY', 'UE-INST-PLATFORM-STAFF-MANDATE'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'system_admin' },"),
    a.h('authorization', 'runtimeMode = assertPilotDemoMutationRuntime();'),
    a.svc('authorization', DEMO_RUNTIME, "const DEMO_MUTATION_MODES = ['pilot', 'demo'] as const", undefined),
    a.h('tenantScope', '.where(eq(organizations.slug, slug))'),
    a.h('mutation', 'await tx.delete(grievances).where(eq(grievances.organizationId, orgId));'),
    a.h('mutation', 'await tx.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('behavior', '.onConflictDoNothing();'),
    a.h('privacy', 'role: m.role,'),
    a.h('defect', 'await tx.delete(pilotChecklistItems).where(eq(pilotChecklistItems.organizationId, orgId));'),
    a.h('defect', 'membersInserted += 1;'),
    a.h('defect', 'worksites: fixture.worksites.length,'),
    a.h('defect', 'completed: 3,'),
    a.h('defect', "const done = itemId === 'org_profile_configured' || itemId === 'team_invited' || itemId === 'first_case_created';"),
  ],
  inf: [
    { claim: 'defect', statement: `The fixture is resolved as resolve(process.cwd(), '${BOOTSTRAP_FIXTURE}') and the file exists at the repository root only; no apps/union-eyes/fixtures directory exists, so the route reads the fixture only when the process working directory is the repository root and otherwise fails with a read error.` },
    { claim: 'defect', statement: 'The fixture members carry fixed ids such as cupe-admin-001 as user ids; whether the identity provider can issue such an id is not shown by the route.' },
  ],
  def: [DEF_BOOTSTRAP_RESET, DEF_BOOTSTRAP_REPORT],
  corr: [],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* platform overview                                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

const overviewGet = (a) => mk({
  ...base(a),
  persona: 'Platform administrator or officer of the platform organization reading every enrolled pilot organization',
  authn: 'Authenticated session resolved by requireUser inside the handler (no wrapper is applied).',
  authz: 'The handler requires hasMinRole(officer) and then isPlatformAdminUser or, in the legacy mode only, that the caller organization is DEFAULT_ORGANIZATION_ID, so an officer role title in the platform organization passes. A role title and an organization id are not a kernel decision, so kernelAuthorization stays false.',
  tenant: 'No organization predicate: the read joins every actively enrolled organization under withSystemContext and runs three queries for each enrollment, with the organization id taken from each enrollment row.',
  owner: 'No row is written. The response lists the active pilot_enrollments rows with organization names and slugs, milestones, member counts and grievance counts of every enrolled organization.',
  sens: 'Organization id, name and slug, enrollment date, adoption and engagement rates, cases managed, average resolution time, health score and milestones of every active pilot organization',
  priv: 'Cross-organization adoption, case and health figures of every pilot organization are returned to an officer of the platform organization.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: nothing is written and no audit row records the cross-organization read.',
  reqAudit: 'Audit the cross-organization overview read with the reader once a platform-staff mandate names who may read it.',
  does: 'Checks the officer floor and the platform organization or platform administrator condition, reads every active enrollment joined to its organization under the system context, and for each computes adoption, engagement, case figures and milestones, returning the list.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Authorize the overview by a platform-staff mandate, paginate it, audit the read and mark proxy figures.',
  dec: ['UE-INST-PLATFORM-STAFF-MANDATE', 'UE-INST-PILOT-USAGE-SIGNAL-READERS-AND-BASIS'],
  ev: [
    a.h('authentication', 'const user = await requireUser();'),
    a.imp('authentication', 'requireUser', 'const { userId } = await auth();'),
    a.h('authorization', 'const canAccess = await hasMinRole("officer");'),
    a.imp('authorization', 'hasMinRole', 'if (currentStateContextEnabled()) return hasRole(minRole);'),
    a.h('authorization', 'if (!platformAdmin && !platformOrganization) {'),
    a.h('tenantScope', '.where(eq(pilotEnrollments.status, "active"));'),
    a.h('mutation', 'return await withSystemContext(async () => {'),
    a.h('behavior', 'const orgMetrics = await Promise.all('),
    a.h('privacy', 'organizationSlug: orgSlug,'),
    a.h('defect', 'const platformOrganization = !currentStateContextEnabled() &&'),
    a.h('defect', 'EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600'),
  ],
  def: [DEF_OVERVIEW, DEF_PILOT_METRICS, DEF_PLATFORM_TIER],
  corr: [
    { field: 'guard', manifest: 'control SESSION_ONLY', actual: 'The handler requires the officer role title and a platform administrator identity or membership of the platform organization, not only a session.' },
  ],
})

const BUILDERS = {
  'pilot/apply/route.ts|GET': applyGet,
  'pilot/apply/route.ts|POST': applyPost,
  'pilot/apply/[id]/route.ts|GET': idGet,
  'pilot/apply/[id]/route.ts|PATCH': idPatch,
  'pilot/apply/[id]/verify-organization/route.ts|POST': verifyPost,
  'pilot/apply/[id]/rebind-organization/route.ts|POST': rebindPost,
  'pilot/apply/[id]/approve-commercial-terms/route.ts|POST': approveTermsPost,
  'pilot/apply/[id]/commercial-transition/route.ts|POST': transitionPost,
  'pilot/apply/[id]/proposal/route.ts|GET': proposalGet,
  'pilot/apply/[id]/package-export/route.ts|GET': packageExportGet,
  'pilot/apply/[id]/commercialization-timeline/route.ts|GET': timelineGet,
  'pilot/apply/[id]/artifacts/route.ts|GET': artifactsGet,
  'pilot/apply/[id]/artifacts/route.ts|POST': artifactsPost,
  'pilot/apply/[id]/intelligence/route.ts|GET': intelligenceGet,
  'pilot/apply/[id]/intelligence/route.ts|POST': intelligencePost,
  'pilot/apply/[id]/reference-profile/route.ts|GET': referenceGet,
  'pilot/apply/[id]/reference-profile/route.ts|POST': referencePost,
  'pilot/champions/route.ts|GET': championsGet,
  'pilot/friction/route.ts|GET': frictionGet,
  'pilot/metrics/route.ts|GET': metricsGet,
  'pilot/readiness/route.ts|GET': readinessGet,
  'pilot/events/route.ts|POST': eventsPost,
  'pilot/feedback/route.ts|POST': feedbackPost,
  'pilot/feedback/route.ts|GET': feedbackGet,
  'pilot/current/route.ts|GET': currentGet,
  'pilot/onboarding/route.ts|GET': onboardingGet,
  'pilot/onboarding/route.ts|PATCH': onboardingPatch,
  'pilot/demo-data/route.ts|POST': demoDataPost,
  'pilot/demo-data/route.ts|DELETE': demoDataDelete,
  'pilot/bootstrap/cupe/route.ts|POST': bootstrapPost,
  'pilot/overview/route.ts|GET': overviewGet,
}

function build(a) {
  const builder = BUILDERS[`${a.route}|${a.method}`]
  if (!builder) throw new Error(`no Gate 0B.10 pilot facts for ${a.route}|${a.method}`)
  return builder(a)
}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}
