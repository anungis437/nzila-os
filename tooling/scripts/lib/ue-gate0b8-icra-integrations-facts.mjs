/**
 * Gate 0B.8 facts: the pseudonymous ICRA assessment product (start, answer, submit, results, profile, report,
 * checkout, claim, review, e-mail link, telemetry), the tenant integration control plane (framework routes and the
 * api-keys CRUD), and the Shopify rewards webhook. Every evidence item is produced by `opAuthoring` from the exact
 * handler, the helper or service it calls, or the resolved schema, and is proved again by the validator. This tranche
 * records the source; it repairs nothing and approves nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv, NOT_ATOMIC } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const ICRA_CAP = 'UE-OMIT-ICRA-PUBLIC-ASSESSMENT'
const REWARDS_CAP = 'UE-OMIT-REWARDS-REDEMPTION-FULFILMENT'
const PROVIDER_CAP = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const GATE = 14

const ICRA_SCHEMA = `${APP}db/schema/icra-schema.ts`
const CAPABILITY_LIB = `${APP}lib/icra/assessment-capability.ts`
const OBSERVABILITY = `${APP}lib/icra/observability.ts`
const GUARD = `${APP}lib/public-intake/guard.ts`
const RATE_LIMIT = `${APP}lib/rate-limit.ts`
const TURNSTILE = `${APP}lib/icra/turnstile.ts`
const CRUD_GOVERNANCE_FILE = `${APP}lib/api/crud-governance.ts`
const CONTROL_PLANE = `${APP}lib/integrations/control-plane.ts`
const SYNC_ENGINE = `${APP}lib/integrations/sync-engine.ts`
const FACTORY = `${APP}lib/integrations/factory.ts`
const WEBHOOK_SERVICE = `${APP}lib/services/rewards/webhook-service.ts`
const REDEMPTION_SERVICE = `${APP}lib/services/rewards/redemption-service.ts`
const REWARDS_SCHEMA = `${APP}db/schema/domains/infrastructure/rewards.ts`
const INTEGRATIONS_SCHEMA = `${APP}db/schema/domains/infrastructure/integrations.ts`
const WORKERS_AUTHORITY = `${APP}db/rls-storage-authority/integrations-workers.ts`

export const ROUTES = new Set([
  'icra/[assessmentId]/answer/route.ts',
  'icra/[assessmentId]/capability/exchange/route.ts',
  'icra/[assessmentId]/claim/route.ts',
  'icra/[assessmentId]/profile/route.ts',
  'icra/[assessmentId]/submit/route.ts',
  'icra/checkout/route.ts',
  'icra/email-results/route.ts',
  'icra/report/[assessmentId]/review/route.ts',
  'icra/report/[assessmentId]/route.ts',
  'icra/results/[id]/route.ts',
  'icra/start/route.ts',
  'icra/submit/route.ts',
  'icra/telemetry/route.ts',
  'integrations/api-keys/route.ts',
  'integrations/framework/[id]/activate/route.ts',
  'integrations/framework/[id]/sync/route.ts',
  'integrations/framework/route.ts',
  'integrations/shopify/webhooks/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  ICRA_ASSESSMENT_INTAKE: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_PSEUDONYMOUS_ASSESSMENT_INTAKE',
    actor: 'Anonymous respondent starting, answering, resuming and submitting an institutional continuity risk assessment without a Union Eyes account, holding only the assessment capability',
    routes: ['icra/start/route.ts', 'icra/[assessmentId]/answer/route.ts', 'icra/[assessmentId]/submit/route.ts', 'icra/submit/route.ts'],
    evidence: [
      ev(ICRA_SCHEMA, 'export const icraAssessments = pgTable('),
      ev(ICRA_SCHEMA, "status: varchar('status', { length: 16 }).notNull().default('in_progress'),"),
      ev(ICRA_SCHEMA, "consent: jsonb('consent'),"),
      ev(`${API}icra/start/route.ts`, "logger.info('icra.assessment.started', {"),
    ],
  },
  ICRA_RESULT_ACCESS: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_PSEUDONYMOUS_RESULT_ACCESS',
    actor: 'Anonymous respondent holding the assessment capability, reading the stored continuity profile or converting a capability received by e-mail into the browser cookie',
    routes: ['icra/[assessmentId]/capability/exchange/route.ts', 'icra/[assessmentId]/profile/route.ts', 'icra/results/[id]/route.ts'],
    evidence: [
      ev(CAPABILITY_LIB, 'export const CAPABILITY_TOKEN_TTL_DAYS = 30;'),
      ev(CAPABILITY_LIB, 'export function checkCapability('),
      ev(ICRA_SCHEMA, 'export const icraMaturityProfiles = pgTable('),
    ],
  },
  ICRA_REPORT_COMMERCE: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_PAID_REPORT_TIER_AND_PDF',
    actor: 'Anonymous respondent buying a report tier through Stripe and downloading the executive PDF for an assessment whose capability they hold',
    routes: ['icra/checkout/route.ts', 'icra/report/[assessmentId]/route.ts'],
    evidence: [
      ev(`${API}icra/checkout/route.ts`, 'const BRIEF_AMOUNT_CENTS = 120000; // $1,200 CAD (canonical)'),
      ev(`${API}icra/report/[assessmentId]/route.ts`, 'const PDF_ELIGIBLE_TIERS = new Set(['),
      ev(`${APP}components/icra/ICRAReportGate.tsx`, "fetch('/api/icra/checkout', {"),
    ],
  },
  ICRA_REPORT_REVIEW: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_REPORT_NARRATIVE_REVIEW_DECISION',
    actor: 'Operator holding the shared cron secret recording an approval or rejection of the report narrative slot for one assessment',
    routes: ['icra/report/[assessmentId]/review/route.ts'],
    evidence: [
      ev(`${API}icra/report/[assessmentId]/review/route.ts`, ' * Governance review mutation for the deterministic report AI slot.'),
      ev(`${API}icra/report/[assessmentId]/review/route.ts`, ' * Requires the cron secret and writes an explicit approval/rejection decision'),
    ],
  },
  ICRA_CLAIM: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_PAID_ASSESSMENT_CLAIM_INTO_ORGANIZATION',
    actor: 'Signed-in user holding a single-use claim token, binding a paid pseudonymous assessment to the organization of their session',
    routes: ['icra/[assessmentId]/claim/route.ts'],
    evidence: [
      ev(`${API}icra/[assessmentId]/claim/route.ts`, 'Bind a pseudonymous, paid ICRA assessment to a Nzila identity.'),
      ev(ICRA_SCHEMA, "claimToken: varchar('claim_token', { length: 128 }),"),
    ],
  },
  ICRA_EMAIL_RESULTS_LINK: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_RESULTS_LINK_BY_EMAIL',
    actor: 'Anonymous respondent holding the assessment capability asking for the results link to be e-mailed to an address they type',
    routes: ['icra/email-results/route.ts'],
    evidence: [
      ev(`${API}icra/email-results/route.ts`, ' * SECURITY: this is SAVE_MY_CURRENT_RESULTS_ACCESS_LINK, not'),
      ev(`${API}icra/email-results/route.ts`, " * parameter. A prior version of this route rotated the capability on every"),
    ],
  },
  ICRA_FLOW_TELEMETRY: {
    capabilityId: ICRA_CAP,
    domain: 'ICRA_FLOW_ABANDONMENT_TELEMETRY',
    actor: 'Anonymous browser of the assessment flow sending section and abandonment events',
    routes: ['icra/telemetry/route.ts'],
    evidence: [
      ev(`${API}icra/telemetry/route.ts`, ' * Client-side abandonment + flow instrumentation sink. Accepts a tightly'),
      ev(OBSERVABILITY, ' * Events are stored in icra_events (not part of icra-schema.ts — append'),
    ],
  },
  ICRA_INTEGRATIONS_FRAMEWORK: {
    capabilityId: PROVIDER_CAP,
    domain: 'TENANT_INTEGRATION_CONTROL_PLANE',
    actor: 'Steward of an organization configuring, activating and running a synchronization of an approved external provider integration',
    routes: ['integrations/framework/route.ts', 'integrations/framework/[id]/activate/route.ts', 'integrations/framework/[id]/sync/route.ts'],
    evidence: [
      ev(CONTROL_PLANE, ' * This is the production authority root for the existing adapter framework.'),
      ev(INTEGRATIONS_SCHEMA, "credentials: jsonb('credentials').notNull(), // Encrypted"),
    ],
  },
  ICRA_INTEGRATIONS_API_KEYS: {
    capabilityId: PROVIDER_CAP,
    domain: 'INTEGRATION_API_KEY_RECORDS',
    actor: 'Administrator attempting to list or add integration API key records through the generic factory, which refuses both',
    routes: ['integrations/api-keys/route.ts'],
    evidence: [
      ev(INTEGRATIONS_SCHEMA, 'export const integrationApiKeys = pgTable('),
      ev(INTEGRATIONS_SCHEMA, "keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA-256 hash"),
      ev(WORKERS_AUTHORITY, 'app/api/integrations/api-keys/route.ts is crudRoutes()-backed (orgScoped:true, server-derived organizationId).'),
    ],
  },
  ICRA_SHOPIFY_WEBHOOK: {
    capabilityId: REWARDS_CAP,
    domain: 'SHOPIFY_REWARDS_REDEMPTION_WEBHOOK',
    actor: 'Shopify, as an external provider posting order, fulfilment and refund events for member reward redemptions, and any caller of the public health response',
    routes: ['integrations/shopify/webhooks/route.ts'],
    evidence: [
      ev(`${API}integrations/shopify/webhooks/route.ts`, ' * Handles all Shopify webhooks for the Recognition & Rewards system.'),
      ev(REWARDS_SCHEMA, 'export const webhookReceipts = pgTable('),
      ev(REWARDS_SCHEMA, "payloadJson: jsonb('payload_json').notNull(),"),
    ],
  },
}

const D = (id, ownerCapabilityId, gate, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate, severity, title, ...extra })

const DEF_PDF_GATE = 'DEF-0B8-ICRA-PAID-PDF-REPORT-GATE-REQUIRES-STATUS-COMPLETED-NO-WRITER'
const DEF_CHECKOUT_NOT_SUBMITTED = 'DEF-0B8-ICRA-CHECKOUT-SELLS-A-TIER-WITHOUT-REQUIRING-A-SUBMITTED-ASSESSMENT'
const DEF_LIMITS = 'DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS'
const DEF_NO_BOT = 'DEF-0B8-ICRA-PUBLIC-WRITES-HAVE-NO-BOT-CHALLENGE-AND-TURNSTILE-IS-OPTIONAL'
const DEF_NO_LIMIT = 'DEF-0B8-ICRA-READ-ROUTES-HAVE-NO-LIMITER'
const DEF_ONE_SHOT = 'DEF-0B8-ICRA-ONE-SHOT-SUBMIT-STORES-CLIENT-SUPPLIED-CONSENT-AND-UNBOUNDED-BODY'
const DEF_CONSENT = 'DEF-0B8-ICRA-STEPWISE-FLOW-NEVER-REQUIRES-CONSENT'
const DEF_PARTIAL = 'DEF-0B8-ICRA-STEPWISE-SUBMIT-SCORES-ANY-NON-EMPTY-ANSWER-SET'
const DEF_EMAIL = 'DEF-0B8-ICRA-EMAIL-RESULTS-SENDS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS'
const DEF_SINK = 'DEF-0B8-ICRA-EVENT-SINK-WRITES-A-TABLE-NO-SCHEMA-DEFINES-AND-SWALLOWS-FAILURE'
const DEF_CLAIM_ISSUER = 'DEF-0B8-ICRA-CLAIM-TOKEN-HAS-NO-ICRA-ISSUER-SO-CLAIM-CANNOT-SUCCEED'
const DEF_CLAIM_AUTHORITY = 'DEF-0B8-ICRA-CLAIM-BINDS-TO-ANY-SIGNED-IN-USER-ORGANIZATION-AND-KEEPS-CAPABILITY'
const DEF_REVIEW_AUTH = 'DEF-0B8-ICRA-REVIEW-DECISION-BY-SHARED-CRON-SECRET-WITH-BODY-CLAIMED-REVIEWER-ROLE'
const DEF_REVIEW_AUDIT = 'DEF-0B8-ICRA-REVIEW-AUDIT-ONLY-WHEN-A-CLAIMED-ORGANIZATION-EXISTS'
const DEF_MALFORMED = 'DEF-0B8-ICRA-MALFORMED-IDS-AND-ANSWER-VALUES-SURFACE-AS-SERVER-ERRORS'
const DEF_CHECKOUT_CONFIG = 'DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED'
const DEF_CREDENTIALS = 'DEF-0B8-ICRA-INTEGRATION-CREDENTIALS-NEVER-STORED-OR-RESOLVED-YET-REPORTED-STORED'
const DEF_DRY_RUN = 'DEF-0B8-ICRA-SYNC-DRY-RUN-IS-ACCEPTED-AND-AUDITED-BUT-NEVER-READ'
const DEF_SYNC_LOCAL = 'DEF-0B8-ICRA-SYNC-CONCURRENCY-GUARD-AND-INSTANCE-CACHE-ARE-PROCESS-LOCAL'
const DEF_CONFIG_RESET = 'DEF-0B8-ICRA-CONFIGURE-UPDATE-RESETS-OMITTED-ENABLED-SETTINGS-AND-WEBHOOK-URL'
const DEF_API_KEYS = 'DEF-0B8-ICRA-API-KEYS-ROUTES-REFUSE-EVERY-REQUEST-WHILE-THE-AUTHORITY-REGISTER-CALLS-THEM-LIVE'
const DEF_SHOPIFY_CODE = 'DEF-0B8-ICRA-SHOPIFY-DISCOUNT-CODE-NEVER-MATCHES-THE-WEBHOOK-EXTRACTOR'
const DEF_SHOPIFY_ACK = 'DEF-0B8-ICRA-SHOPIFY-WEBHOOK-ACKNOWLEDGES-FAILURES-WITH-200-AND-RECORDS-IGNORED-AS-PROCESSED'
const DEF_SHOPIFY_REFUND = 'DEF-0B8-ICRA-SHOPIFY-ANY-REFUND-EVENT-RETURNS-ALL-CREDITS'
const DEF_SHOPIFY_PII = 'DEF-0B8-ICRA-SHOPIFY-WEBHOOK-STORES-FULL-PAYLOAD-AND-CUSTOMER-DATA-IN-A-GLOBAL-TABLE'
const DEF_SHOPIFY_RLS = 'DEF-0B8-ICRA-SHOPIFY-WEBHOOK-QUERIES-TENANT-RLS-TABLES-WITH-NO-ORGANIZATION-CONTEXT'
const DEF_SHOPIFY_TRUST = 'DEF-0B8-ICRA-SHOPIFY-SHOP-DOMAIN-NEVER-CHECKED-ONE-GLOBAL-SECRET-AND-HEADER-KEYED-LIMIT'

export const DEFECTS = [
  D(DEF_PDF_GATE, ICRA_CAP, GATE, 'HIGH',
    'The ICRA report route that serves the executive PDF refuses every request with 422 Assessment not yet completed unless icra_assessments.status equals completed, and no code in the application or its SQL migrations ever writes completed (the start route writes in_progress, the stepwise and one-shot submit routes write submitted, and review, claim and the Stripe fulfilment write no status), while the checkout route sells the briefing and diagnostic tiers whose copy promises a boardroom-ready PDF and the Stripe fulfilment only raises reportTierId, so a buyer who pays $1,200 or $6,500 CAD can never download the PDF the purchase advertises and the route answers 422 for every paid assessment.',
    {
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any anonymous visitor who holds an assessment capability can reach the checkout route, pay through Stripe for the briefing or diagnostic tier, and then receive 422 from the PDF route for that assessment, because the status it requires is never written by any route.',
        potentialImpact: {
          classes: ['FINANCIAL_INTEGRITY', 'FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A buyer is charged for a deliverable the product describes as an executive PDF export with all chapters, and the paid state the results page shows as unlocked does not include that file, so the sale is made on a promise the route cannot keep and the buyer has no code path to the file.',
        },
        activationState: 'REACHABLE_UNAUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/icra/report/[assessmentId]/route.ts', quote: "if (assessment.status !== 'completed') {" },
          { ref: 'apps/union-eyes/components/icra/ICRAReportGate.tsx', quote: "fetch('/api/icra/checkout', {" },
          { ref: 'apps/union-eyes/components/icra/ICRAReportGate.tsx', quote: 'Boardroom-ready PDF · 18–24 pages' },
        ],
        existingContainment: 'NONE',
        blockingCondition: 'The briefing or diagnostic tier is offered for sale (the checkout route is reachable and the gate component renders the purchase button) while no path writes the completed status the PDF route requires.',
        justification: 'The checkout route and the gate that calls it are reachable without any account, the charge is real money, and the PDF route that fulfils the advertised export refuses on a status no code writes, so the harm follows from the routes as written and nothing in the source limits who pays; the tier unlock on the results page does not substitute for the file the copy names.',
      },
    }),
  D(DEF_CHECKOUT_NOT_SUBMITTED, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA checkout route selects reportTierId and the capability columns of the assessment and never reads status, so a buyer holding the capability of an assessment that is still in_progress, with no answers and no stored profile, is given a Stripe session for the $1,200 or $6,500 CAD tier, and the Stripe fulfilment then raises reportTierId on an assessment that has no profile payload to patch.'),
  D(DEF_LIMITS, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA answer, capability exchange, results, one-shot submit, e-mail results and telemetry routes limit requests with lib/rate-limit.ts, an in-memory Map per server process whose default key is the first x-forwarded-for value plus a user-agent hash and whose per-route keys read the same x-forwarded-for header, so the allowance multiplies with the number of instances, resets on restart and, unless an edge overwrites the header (which no route verifies), is chosen by the caller by sending a different header value or user agent; the one-shot submit allowance of 3 per hour and the e-mail allowance of 5 per hour are therefore not enforced limits on a determined caller.'),
  D(DEF_NO_BOT, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA start, one-shot submit and checkout routes create rows and Stripe sessions for anonymous callers with no bot challenge: start and checkout read no challenge token, and the one-shot submit calls verifyTurnstileToken, which returns success with notConfigured true whenever TURNSTILE_SECRET_KEY is unset, so the only controls are the per-address limits (20 and 10 per hour for the durable guard, keyed on cf-connecting-ip, x-real-ip or x-forwarded-for request headers), and each start call inserts an icra_organizations row and an icra_assessments row.'),
  D(DEF_NO_LIMIT, ICRA_CAP, GATE, 'LOW',
    'The ICRA resume GET on /api/icra/start, the profile GET and the PDF report GET apply no rate limit or guardPublicIntake bucket, so an anonymous caller can issue unbounded capability probes and database lookups against any assessment id and, for the report, unbounded PDF renders for an assessment whose capability and tier it holds.'),
  D(DEF_ONE_SHOT, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA one-shot submit validates only that the three acknowledgement booleans are true and then stores the whole client consent object in icra_assessments.consent, including a client-supplied acceptedAt and doctrineVersion and any extra keys, where the stepwise start route stamps both server-side; it also stores locale without validation (a column of 16 characters), reads the body with req.json() under no size cap, and keeps any number of orgContext keys whose names are not checked, so the stored consent record is not evidence of what the server presented or when.'),
  D(DEF_CONSENT, ICRA_CAP, GATE, 'MEDIUM',
    'The stepwise ICRA flow never requires consent: the start route accepts a missing or partial consent object and stores consent null, the answer route stores answers and free-text notes with no consent check, and the stepwise submit route scores and stores the profile without ever testing the consent column, so assessments, sensitive free-text notes and a scored profile are collected and kept for respondents who never acknowledged the anti-surveillance, data-handling and explainability statements that the one-shot route requires.'),
  D(DEF_PARTIAL, ICRA_CAP, GATE, 'MEDIUM',
    'The stepwise ICRA submit route refuses only when no answer row exists (answerRows.length === 0) and otherwise computes and stores a maturity band, composite and continuity profile from however few answers were recorded and sets status submitted, where the one-shot route rejects any answer set that does not cover every routed question, so a profile built from one answer is stored and returned as the organization continuity profile and can be bought and reported on.'),
  D(DEF_EMAIL, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA e-mail results route accepts any syntactically valid address in the body, with no proof the sender controls it, and sends a branded message from the platform that embeds the caller 30-day bearer capability in the link fragment; any capability holder (and a capability is issued free by the start route) can therefore make the platform send mail to arbitrary third parties, limited only by the per-process in-memory allowance of 5 per hour keyed on a forwarded header, and the event handed to the sink carries an unsalted SHA-256 prefix of the typed address.'),
  D(DEF_SINK, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA event sink inserts into an icra_events table that no schema file or migration in the repository defines (its own header says to add the table to the migration), inside a try that swallows every error, so on a database without the table the telemetry, submission and e-mail events are silently dropped while the telemetry route still answers 204; where the table exists, the stored ip_hash is an unsalted SHA-256 of the forwarded address truncated to 32 characters, reversible by enumerating addresses, and the metadata column takes caller-chosen keys and values (telemetry) or the raw error string (submission_error).'),
  D(DEF_CLAIM_ISSUER, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA claim route matches icra_assessments.claim_token, but no code sets that column for an ICRA assessment: the only producer of a claim token is the workbook branch of the Stripe webhook, which writes the workbooks table, and the ICRA fulfilment branch writes reportTierId and the profile payload only (the claim route header says issuance is wired separately), so every claim answers 404 and a paid assessment can never be bound to an organization.'),
  D(DEF_CLAIM_AUTHORITY, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA claim route binds a paid assessment to the organization returned by getOrganizationIdForUser (an active membership in any role) for any signed-in user who presents the claim token, with no role or office test and no check that the caller organization is the purchaser, and it clears the claim token but leaves capabilityTokenHash and capabilityTokenExpiresAt unchanged, so the pseudonymous holder keeps full read and write access to an assessment that now belongs to an organization and the audit row names the organization of whoever presented the token.'),
  D(DEF_REVIEW_AUTH, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA report review route authorizes an approval or rejection of the report narrative with the shared platform cron secret alone and takes reviewerRole from the request body (governance_reviewer, exec_sponsor, or facilitator for any other value), so the recorded reviewer role is an unverified claim by whoever holds a secret that is not tied to any person, and the audit actor, when one is written, is the constant system:icra-report-review.'),
  D(DEF_REVIEW_AUDIT, ICRA_CAP, GATE, 'MEDIUM',
    'The ICRA report review route writes its audit record only when the assessment has a claimedOrgId, a column set only by the claim route whose claim token no code issues, so in practice every review decision is committed with no audit record, the decision (reviewer role, status, summary and time) living only inside the assessment organizationContext JSON that the same route rewrites.'),
  D(DEF_MALFORMED, ICRA_CAP, GATE, 'LOW',
    'The ICRA start resume GET, the profile GET, the capability exchange and the e-mail results routes pass the path, query or body assessment id to a uuid column comparison without validating its shape (the unhandled database error escapes as a 500 where the result and report routes validate with a UUID pattern first), and the answer route calls buildAnswer inside its try, so an out-of-range or non-numeric answer value, or a note sent in public-sector mode, is reported as 500 Failed to record answer and a server error log instead of a 400.'),
  D(DEF_CHECKOUT_CONFIG, ICRA_CAP, GATE, 'LOW',
    'The ICRA checkout route builds the Stripe success and cancel URLs from NEXT_PUBLIC_APP_URL with a fallback of http://localhost:3000, and charges either the STRIPE_PRICE_ICRA_BRIEF or STRIPE_PRICE_ICRA_DIAGNOSTIC price id when set or the literal 120000 and 650000 cent amounts otherwise, while the displayed prices in the gate component are separate literals, so an unset URL sends a paying buyer back to localhost and a Stripe price that differs from the literals charges an amount the page does not show.'),
  D(DEF_CREDENTIALS, PROVIDER_CAP, GATE, 'MEDIUM',
    'The integration framework stores credentials as the JSON object credentialRef (a caller-chosen string, or the literal managed) and never resolves it: provider-policy states credentialRef is a placeholder never resolved to a vault-backed secret, the base adapter initialize requires config.credentials.apiKey (or clientId and clientSecret for OAuth providers) which that object never contains, and toPublicConfig returns credentialsStored true as a literal for every row, so an activated integration reports stored credentials that no sync can use and a steward is told the integration is ready to synchronize when every sync attempt fails at adapter initialization.'),
  D(DEF_DRY_RUN, PROVIDER_CAP, GATE, 'MEDIUM',
    'The integration sync route accepts dryRun in the body, passes it into SyncOptions and records dryRun in the audited details, but neither the sync engine nor any adapter reads it, so a steward who sets dryRun true expecting a rehearsal is recorded in the audit trail as having requested a dry run for an operation that is executed as a normal synchronization.'),
  D(DEF_SYNC_LOCAL, PROVIDER_CAP, GATE, 'LOW',
    'The sync engine prevents concurrent runs with a process-local Set keyed organization, provider and type, and the integration factory caches adapter instances in a process-local Map keyed organization and provider that the sync route never evicts, so two instances can run the same synchronization at once and a reconfigured integration can keep serving the adapter built from the earlier configuration until the process restarts.'),
  D(DEF_CONFIG_RESET, PROVIDER_CAP, GATE, 'LOW',
    'The integration configure route on an existing provider row writes enabled input.enabled ?? false, settings input.settings ?? {} and webhookUrl input.webhookUrl ?? null into the update, so a steward who changes only the credential reference silently disables the integration and clears its settings and webhook URL, and a configure call with enabled true switches the integration on without the concurrency predicate that the activate route applies.'),
  D(DEF_API_KEYS, PROVIDER_CAP, GATE, 'MEDIUM',
    'The /api/integrations/api-keys route is a generic crudRoutes configuration over integration_api_keys, which the CRUD governance table lists as DENIED, so every GET and POST answers 403 before any query, while the storage authority register still describes the route as the crudRoutes-backed live path with a server-derived organization, and the subordinate authority register states that nothing authenticates from key_hash, so the register text and the route disagree and no route can create, list or verify an integration API key.'),
  D(DEF_SHOPIFY_CODE, REWARDS_CAP, GATE, 'HIGH',
    'The Shopify redemption flow cannot complete: createDiscountCode names the discount UE followed by the first 12 hex characters of the redemption id with the dashes removed and uppercased, while the webhook extractor extractRedemptionIdFromDiscount requires UE followed by a full dashed 36-character UUID, so every orders/paid event is answered ignored with no_redemption_discount, a redemption never reaches ordered, providerOrderId is never set, and the fulfilled and refunded events, which look the redemption up by provider order id, never match; the member credits were already deducted by initiateRedemption before the Shopify call.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'The discount-code step runs only when the SHOPIFY_ENABLED environment variable equals true, so a member redeeming credits today is not sent a Shopify checkout; if the variable is set, the member credits are deducted, a Shopify discount of the shortened format is created, and the paid, fulfilled and refund webhooks for that order are all ignored by the receiver.',
        potentialImpact: {
          classes: ['FINANCIAL_INTEGRITY', 'DATA_QUALITY'],
          description: 'Members would lose reward credits for orders that the platform never marks ordered, fulfilled or refunded, and a Shopify refund would not return the credits, so the credit ledger and the redemption statuses diverge from what the shop sold.',
        },
        activationState: 'NOT_ACTIVATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/actions/rewards-actions.ts', quote: "if (process.env.SHOPIFY_ENABLED === 'true') {" },
          { ref: 'apps/union-eyes/lib/config/env-validation.ts', quote: "SHOPIFY_ENABLED: z.string().transform(val => val === 'true').prefault('false').optional()," },
        ],
        existingContainment: {
          summary: 'The flag defaults to false in the environment schema and the discount creation and checkout session step runs only when it equals true; with it unset, the redemption is initiated without a Shopify discount and the webhook receives no matching events.',
          evidence: [
            { ref: 'apps/union-eyes/lib/config/env-validation.ts', quote: "SHOPIFY_ENABLED: z.string().transform(val => val === 'true').prefault('false').optional()," },
            { ref: 'apps/union-eyes/actions/rewards-actions.ts', quote: "if (process.env.SHOPIFY_ENABLED === 'true') {" },
          ],
        },
        blockingCondition: 'SHOPIFY_ENABLED is set to true in any deployment, or an organization is offered Shopify-backed reward redemptions, while the discount code format created by createDiscountCode cannot be matched by the webhook extractor.',
        justification: 'The harm needs the flag to be true, and the source shows it defaults to false, so no member is affected today; the defect is a certain failure of the paid, fulfilled and refund path the moment the flag is set, with credits already deducted, so release with the flag on is blocked until the two formats agree.',
      },
    }),
  D(DEF_SHOPIFY_ACK, REWARDS_CAP, GATE, 'MEDIUM',
    'The Shopify webhook receiver answers 200 with received true and error Internal processing error for every thrown failure (so Shopify, which retries only on non-2xx, never redelivers a paid, fulfilled or refund event that failed), and processWebhookIdempotent records the receipt after the handler for ignored results too, so an event ignored because the redemption was not yet found (an orders/fulfilled that arrives before orders/paid is processed) is stored as processed and a redelivery of the same webhook id is skipped as already_processed; the receipt check, the handler and the receipt insert run in separate transactions.'),
  D(DEF_SHOPIFY_REFUND, REWARDS_CAP, GATE, 'MEDIUM',
    'The Shopify refunds/create handler computes the refunded amount from the refund line items but processRedemptionRefund ignores it: it sets the redemption to refunded and returns the whole creditsSpent through an applyLedgerEntry refund, so a partial refund of any size returns every credit of the redemption, the refund amount is kept only in the stored payload, and a later refund event for the same order is treated as already refunded.'),
  D(DEF_SHOPIFY_PII, REWARDS_CAP, GATE, 'MEDIUM',
    'The Shopify webhook receiver stores the full request payload in webhook_receipts.payload_json, a table with no organization column that records every event of every organization, and the orders/paid handler writes the Shopify customer id, e-mail address, first and last name and the line items into reward_redemptions.provider_payload_json and logs the discount codes, so personal data of the purchaser is retained in global and per-redemption JSON with no retention rule or field minimization.'),
  D(DEF_SHOPIFY_RLS, REWARDS_CAP, GATE, 'MEDIUM',
    'The Shopify webhook handlers read and update reward_redemptions and the credit ledger through the plain db import with no withRLSContext or withSystemContext around the handler (the system context in webhook-service covers only the receipt check and insert), while reward_redemptions carries a fail-closed organization policy for the union_eyes_runtime role and the union_eyes_system privileges on it are revoked, so with no app.current_org_id set the lookups can match no row and every transition throws or is ignored as redemption_not_found even if the discount code format matched.'),
  D(DEF_SHOPIFY_TRUST, REWARDS_CAP, GATE, 'LOW',
    'The Shopify webhook receiver verifies the HMAC with one global SHOPIFY_WEBHOOK_SECRET for every organization and parses the X-Shopify-Shop-Domain header but never reads it (the route destructures only topic, webhookId and hmac), so the shop that sent an event is not checked against any organization; the pre-signature rate limit is keyed on the whole x-forwarded-for header string, so a caller who varies that header receives a fresh allowance for each unsigned request.'),
]

export const CAPABILITIES = [
  {
    id: ICRA_CAP,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-006', 'UE-CONV-K-005'],
    obligationKey: 'icra-pseudonymous-assessment-product',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Anonymous respondent holding an assessment capability, a signed-in user holding a claim token, and the operator who records a narrative review decision, for the institutional continuity risk assessment product',
    businessOutcome: 'A respondent can complete, resume and read an institutional continuity assessment without an account, only the holder of the assessment capability can read or change it, consent is recorded by the server before data is collected, a purchased report tier delivers what its copy promises, an organization that buys an assessment can bind it to its own tenant under a named office, and every public write is bounded by controls that do not depend on a forged header.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/icra (start, answer, submit, results, profile, report, report review, checkout, claim, email-results, telemetry, capability exchange)',
    service: `${APP}lib/icra/assessment-capability.ts`,
    sourceFiles: [
      `${APP}lib/icra/assessment-capability.ts`,
      `${APP}lib/icra/claim-tokens.ts`,
      `${APP}lib/icra/observability.ts`,
      `${APP}lib/public-intake/guard.ts`,
      `${APP}db/schema/icra-schema.ts`,
      `${APP}app/api/icra/start/route.ts`,
      `${APP}app/api/icra/report/[assessmentId]/route.ts`,
      `${APP}app/api/icra/checkout/route.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}lib/icra/assessment-capability.ts` }],
    auditEvidence: 'The assessment routes write no audit record: start, answer and submit log with logger only. The claim route writes an atomic audit row with the organization of the signed-in user, and the review route writes one only for an assessment that has a claimed organization.',
    privacyClassification: 'Pseudonymous organization context (display name, sector, jurisdiction, workforce band, governance model, federation affiliation), answers with optional free-text notes, a stored continuity profile, a consent record, a hashed bearer capability, and for a paid assessment a Stripe purchase and an optional claim binding to a tenant organization.',
    gap: 'No existing capability names the pseudonymous ICRA product. UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING owns tenant subscription billing for signed-in organizations, UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns analytics reports read through a tenant session, UE-OMIT-AI-ADVISORY-GOVERNANCE owns routes whose purpose is a model call, and UE-OMIT-ROUTE-EXPOSURE-HARDENING owns the exposure of routes, not a product. These routes are not tenant routes: icra_assessments has no Union Eyes organization column, is classified SYSTEM_ONLY, is read and written through withSystemContext, and is authorized by a bearer capability, a Stripe purchase and a claim token, which none of those capabilities governs.',
  },
  {
    id: REWARDS_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'rewards-redemption-provider-fulfilment',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Member redeeming recognition credits for a provider reward, the organization that holds the credit ledger, and the external shop that reports order, fulfilment and refund events',
    businessOutcome: 'A redemption moves from initiated to ordered, fulfilled or refunded only on a verified event from the shop the organization chose, credits are deducted and returned exactly once and in the amount the shop refunded, failures are retried rather than acknowledged, and the purchaser data the shop sends is limited to what the organization needs.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/integrations/shopify/webhooks',
    service: `${APP}lib/services/rewards/redemption-service.ts`,
    sourceFiles: [
      `${APP}app/api/integrations/shopify/webhooks/route.ts`,
      `${APP}lib/services/rewards/webhook-service.ts`,
      `${APP}lib/services/rewards/redemption-service.ts`,
      `${APP}lib/services/rewards/shopify-service.ts`,
      `${APP}db/schema/domains/infrastructure/rewards.ts`,
    ],
    proof: [{ type: 'path', ref: `${APP}lib/services/rewards/redemption-service.ts` }],
    auditEvidence: 'The redemption transitions (ordered, fulfilled, refund) commit an audit row in the same transaction through auditRewards; the webhook receipt is a separate write and the receipt insert is not part of that transaction.',
    privacyClassification: 'Shopify order identifiers, purchaser customer id, e-mail address and names, line items, tracking details and refund amounts, retained in the webhook receipt payload and the redemption provider payload, alongside the member credit balance movements.',
    gap: 'No existing capability names reward redemptions or the Shopify provider. UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS owns the tenant integration control plane (provider configuration, activation and synchronization of approved adapters), and the Shopify webhook is not part of it: the route is a public provider webhook authenticated by a global signature secret, it writes the rewards credit ledger and webhook_receipts rather than integration_configs, and it is driven by the rewards actions, not by an integration configured through the framework routes.',
  },
]

export const DECISIONS = [
  {
    id: 'UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE',
    status: 'OUTSTANDING',
    question: 'How long may a pseudonymous ICRA assessment, its free-text notes, its consent record and its organization context be kept, who may erase them, and must a respondent be able to withdraw an assessment that they started?',
    sourceState: 'The ICRA routes create assessments, answers with free-text notes and organization context rows and offer no delete or withdraw route; the capability expires after 30 days but the rows do not, and a source comment states the notes are not PII-safe by construction. No adopted decision names a retention period or an erasure office.',
    softwareOwners: [ICRA_CAP],
  },
  {
    id: 'UE-INST-ICRA-REPORT-REVIEW-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which office may approve or reject the narrative slot of an ICRA report before it is shown or sent, and how is that decision attributed to a person?',
    sourceState: 'The review route accepts the shared cron secret and a reviewer role named in the request body; it names no person or office and the audit record, when written, names a constant system actor. No adopted decision names the reviewing office.',
    softwareOwners: [ICRA_CAP],
  },
  {
    id: 'UE-INST-ICRA-PAID-ASSESSMENT-CLAIM-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which office of an organization may claim a purchased ICRA assessment into the tenant, must that office be the purchaser, and what does each paid report tier deliver once claimed?',
    sourceState: 'The claim route binds the assessment to the organization of any signed-in user who presents a claim token and checks no role; no code issues an ICRA claim token, and the tier copy promises an executive PDF that the report route does not release. No adopted decision names the claiming office or the tier deliverable.',
    softwareOwners: [ICRA_CAP],
  },
  {
    id: 'UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which office of an organization may configure, activate and run an external provider integration, and who holds and rotates the credential material that the integration uses?',
    sourceState: 'The framework routes allow any steward to configure, activate and synchronize an approved provider; credentials are a placeholder reference that nothing resolves, and the api-keys route is refused by governance. No adopted decision names the office or the credential custody.',
    softwareOwners: [PROVIDER_CAP],
  },
  {
    id: 'UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY',
    status: 'OUTSTANDING',
    question: 'Which shop and which office decide that a reward redemption was ordered, fulfilled or refunded, and may a refund return the full credit amount or only the amount the shop refunded?',
    sourceState: 'The webhook receiver trusts one global Shopify signing secret for every organization, applies any refund event as a full credit return and never reads the shop domain. No adopted decision names the shop, the organization binding or the refund rule.',
    softwareOwners: [REWARDS_CAP],
  },
]

/* ------------------------------------------------------------------------------------------------------------ */
/* shared evidence for the pseudonymous capability model                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

const base = (a) => ({ service: `${API}${a.route} (${a.method})` })

const CAP_AUTHN = 'No session and no account: the caller presents the assessment capability, an HttpOnly cookie icra_cap_<assessmentId> or an Authorization: Bearer header, and the route checks its SHA-256 hash and expiry against icra_assessments. The assessment id alone is not accepted.'
const CAP_AUTHZ = 'The only decision is possession of the capability: checkCapability compares the hash of the presented token with the stored capabilityTokenHash in constant time and refuses an expired (30-day) or missing token (404, 410 or 401). There is no role, office or tenant test and no authorizeAction call, so kernelAuthorization stays false.'
const CAP_TENANT = 'No Union Eyes tenant: icra_assessments has no tenant organization column (organization_id points at the pseudonymous icra_organizations table) and every query runs through withSystemContext (the union_eyes_system role), so no row-level policy narrows it; the row is selected by the assessment id of the request and the capability check is the only boundary.'
const CAP_FUTURE = 'Keep the capability as the only boundary for the pseudonymous flow, bound the public routes with a limiter that does not depend on a request header and a bot challenge, record consent on the server before any data is collected, and decide with the institution how long assessments are kept and who may erase them.'

function capRead(a, { id = 'assessmentId', extract = true } = {}) {
  return [
    ...(extract ? [a.imp('authentication', 'extractCapabilityToken', "const authHeader = request.headers.get('authorization');")] : []),
    a.imp('authentication', 'checkCapability', 'if (!row.capabilityTokenHash) return'),
    a.imp('authorization', 'checkCapability', 'if (isCapabilityExpired(row.capabilityTokenExpiresAt))'),
    a.imp('authorization', 'checkCapability', 'if (!crypto.timingSafeEqual(presentedHash, storedHash))'),
    a.imp('authorization', 'capabilityDenialStatus', 'return 404;'),
    a.h('tenantScope', `.where(eq(icraAssessments.id, ${id}))`),
    a.tbl('tenantScope', 'icraAssessments', /id: uuid\('id'\)\.primaryKey\(\)\.defaultRandom\(\),/, { absentColumns: ['tenantId', 'tenant_id'] }),
  ]
}

const NO_AUDIT = 'The route writes no audit record; the only trace is a logger line.'

/* ------------------------------------------------------------------------------------------------------------ */
/* icra/start                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const startGet = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent resuming a pseudonymous assessment with the capability cookie or bearer header',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CAP_AUTHZ,
  tenant: CAP_TENANT,
  owner: 'icra_assessments row selected by the assessmentId query parameter; the response is a constructed resume DTO and never the raw row.',
  sens: 'Assessment status, locale, the declared organization context (name, sector, jurisdiction, workforce band, governance model, federation affiliation, free-text challenge), question bank and doctrine versions, report tier and timestamps',
  priv: 'A holder of the capability receives the organization context the respondent typed, including the organization name and federation affiliation; the capability hash, claim and payment columns are excluded from the DTO.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of a pseudonymous assessment by its capability holder need no audit record; the resume is not attributable to a person.',
  does: 'Reads the assessment by the id in the query, verifies the presented capability and returns a resume DTO with the status, locale, organization context, versions, tier and timestamps; a missing id is 400, a missing or invalid capability 401, an expired one 410 and an unknown id 404.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    ...capRead(a, { id: 'id' }),
    a.h('mutation', '.select({'),
    a.h('behavior', 'const check = checkCapability(presented, row)'),
    a.h('privacy', 'organizationContext: row!.organizationContext,'),
    a.h('defect', "const id = url.searchParams.get('assessmentId')"),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler imports no rate limiter or guardPublicIntake and carries no try block around the query: the id from the query string is compared to a uuid column without a shape check, so a malformed id raises a database error that the route does not catch.' },
  ],
  def: [DEF_NO_LIMIT, DEF_MALFORMED],
})

const startPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous visitor beginning an institutional continuity risk assessment',
  authn: 'None: no session and no capability exists before the call; guardPublicIntake bounds the caller by a request-header address, not an identity, and the route issues the capability in the response and the cookie.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. guardPublicIntake applies the write bucket (20 per hour per header-derived address, refusing when the limiter is unavailable in production) and a 16 KiB body cap; no bot challenge is read. Nothing created here grants access to tenant data.',
  tenant: 'None: the route reads no tenant data. It inserts a pseudonymous icra_organizations row from the free-text organization context the visitor typed and an icra_assessments row through withSystemContext, neither of which is a Union Eyes tenant.',
  owner: 'icra_organizations and icra_assessments rows created for the visitor; the visitor owns the row only through the capability returned once in the body and the cookie.',
  sens: 'Organization display name, sector, jurisdiction, workforce band, governance model and federation affiliation typed by the visitor, locale, consent acknowledgements',
  priv: 'The organization context is stored twice (as an icra_organizations row and in the assessment organizationContext) and the capability is returned in the JSON body and as a cookie; the consent acknowledgement is stored only when all three booleans are true, otherwise the consent column is null.',
  mut: 'NONE',
  auditDetail: 'The route inserts an icra_organizations row (when a name, sector or jurisdiction is given) and an icra_assessments row in one system transaction and writes no audit record; the only trace is the logger line icra.assessment.started.',
  reqAudit: 'A pseudonymous start has no actor to attribute; record the consent decision server-side with the time and doctrine version before any answer is stored, and count starts per address bucket for abuse review.',
  does: 'Applies the public intake guard, validates the body with zod, inserts the pseudonymous organization and the assessment in a system transaction with a server-generated capability hash and 30-day expiry, stamps consent only when all three acknowledgements are true, logs the start and returns 201 with the assessment id and the capability token and sets the capability cookie.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: CAP_FUTURE,
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    a.h('authentication', "const intake = await guardPublicIntake(request, { bucket: 'write' })"),
    a.imp('authentication', 'guardPublicIntake', 'const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)'),
    a.h('authorization', 'if (!intake.ok) return intake.response'),
    a.svc('authorization', GUARD, "write: { limit: 20, window: 3600, identifier: 'public-intake-write' },"),
    a.h('tenantScope', '.insert(icraOrganizations)'),
    a.tbl('tenantScope', 'icraAssessments', /organizationId: uuid\('organization_id'\)\.references\(\(\) => icraOrganizations\.id/, { absentColumns: ['tenantId', 'tenant_id'] }),
    a.h('mutation', '.insert(icraAssessments)'),
    a.h('audit', "logger.info('icra.assessment.started', {"),
    a.h('behavior', '{ assessmentId: assessment.id, capabilityToken },'),
    a.h('privacy', 'federationAffiliation: ctx.federationAffiliation,'),
    a.h('defect', 'consent: consentComplete'),
    a.h('defect', 'organizationContext: ctx ?? null,'),
    a.tbl('defect', 'icraAssessments', /consent: jsonb\('consent'\),/),
    a.svc('defect', GUARD, "const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')", 'clientAddress'),
  ],
  inf: [
    { claim: 'defect', statement: 'The start schema marks consent optional and the handler inserts the assessment whether or not consentComplete is true (the column is then null), and no later stepwise route reads the consent column.' },
    { claim: 'defect', statement: 'The route reads no challenge token and imports no Turnstile verifier; the only controls are the guardPublicIntake bucket and the body cap.' },
  ],
  def: [DEF_CONSENT, DEF_NO_BOT],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* icra/[assessmentId]                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const answerPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent recording or replacing the answer to one assessment question',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} The assessment must also still be in_progress (409 otherwise).`,
  tenant: CAP_TENANT,
  owner: 'icra_assessment_answers rows of the assessment named in the path; each answer is deleted and re-inserted for the question.',
  sens: 'The respondent answer to a continuity question, its normalized score, and an optional free-text note of up to 2000 characters that the scorer documents as not PII-safe by construction',
  priv: 'The capability holder writes answers and free-text notes about the organization; the response echoes the stored answer including the note, and the note is kept with the answer row.',
  mut: 'NONE',
  auditDetail: 'The route deletes the previous answer for the question and inserts the new one in one system transaction and writes no audit record; the only trace is a logger.debug line.',
  reqAudit: NO_AUDIT,
  does: 'Applies an in-memory limit of 240 per hour per assessment and forwarded address, validates the body, checks the question id against the question bank, verifies the capability and the in_progress status, builds the scored answer with buildAnswer and replaces the stored answer for that question, returning ok true and the answer.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    ...capRead(a),
    a.h('authorization', "if (assessment.status !== 'in_progress') {"),
    a.h('mutation', '.delete(icraAssessmentAnswers)'),
    a.h('mutation', 'await tx.insert(icraAssessmentAnswers).values({'),
    a.h('audit', "logger.debug('icra.answer.recorded', {"),
    a.h('behavior', 'const answer = buildAnswer(question, payload.rawValue, payload.note)'),
    a.h('privacy', 'note: answer.note,'),
    a.h('defect', "const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'"),
    a.imp('defect', 'rateLimit', 'rateLimitStore.set(key, entry);'),
    a.svc('defect', RATE_LIMIT, "const forwarded = request.headers.get('x-forwarded-for');", 'defaultKeyGenerator'),
    a.h('defect', 'const answer = buildAnswer(question, payload.rawValue, payload.note)'),
  ],
  inf: [
    { claim: 'defect', statement: 'buildAnswer is called inside the withSystemContext callback that sits in the try block, and normalizeQuestionScore throws for a value outside the scale, so an invalid answer value reaches the catch and is answered 500 Failed to record answer.' },
    { claim: 'defect', statement: 'The handler never tests the consent column: answers and free-text notes are stored for an assessment whose consent is null.' },
  ],
  def: [DEF_LIMITS, DEF_CONSENT, DEF_MALFORMED],
})

const stepwiseSubmit = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent finishing a stepwise assessment and receiving the computed continuity profile',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} guardPublicIntake runs first with the capability bucket (60 per 10 minutes per header-derived address) to slow guessing.`,
  tenant: CAP_TENANT,
  owner: 'icra_maturity_profiles, icra_continuity_scores, icra_governance_flags and icra_followup_recommendations rows derived from the stored answers of the assessment named in the path.',
  sens: 'The computed maturity band, composite score, dimension scores, governance observations and recommendations derived from the respondent answers',
  priv: 'The capability holder receives the stored profile; a repeat submit after the status has left in_progress returns the stored profile and never rebuilds it.',
  mut: 'NONE',
  auditDetail: 'The route deletes and rebuilds the profile, score, flag and recommendation rows and sets status submitted in one system transaction and writes no audit record; the only trace is the logger line icra.assessment.submitted.',
  reqAudit: NO_AUDIT,
  does: 'Verifies the capability, returns the stored profile when the assessment already left in_progress, otherwise reads every answer row (refusing only when none exists), computes the profile, replaces the derived rows, sets the status to submitted with the submit time and returns the profile.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    ...capRead(a),
    a.h('authentication', "const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false })"),
    a.svc('authorization', GUARD, "capability: { limit: 60, window: 600, identifier: 'public-intake-capability' },"),
    a.h('mutation', 'await tx.insert(icraMaturityProfiles).values({'),
    a.h('mutation', ".set({ status: 'submitted', submittedAt: new Date() })"),
    a.h('audit', "logger.info('icra.assessment.submitted', {"),
    a.h('behavior', 'const profile = computeProfile({ assessmentId, answers })'),
    a.h('defect', 'if (answerRows.length === 0) {'),
    a.h('defect', "if (assessment.status !== 'in_progress') {"),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler never compares the answered question ids with the routed set that the one-shot route enforces, and never tests the consent column; the only completeness test is that at least one answer row exists.' },
  ],
  def: [DEF_PARTIAL, DEF_CONSENT],
})

const exchangePost = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent opening an e-mailed results link and converting the fragment capability into the browser cookie',
  authn: 'No session: the capability is presented in the JSON body (min 16 characters) and verified against the stored hash and expiry for the assessment in the path.',
  cat: 'EXTERNAL_TRUST',
  authz: CAP_AUTHZ,
  tenant: CAP_TENANT,
  owner: 'The icra_assessments row named in the path is read for its capability hash and expiry; nothing is stored.',
  sens: 'The bearer capability itself, which the caller supplies and which the route sets back as the HttpOnly cookie',
  priv: 'The route returns ok true and sets the cookie icra_cap_<assessmentId> with the value the caller sent; it does not rotate or reveal any other secret.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The handler only verifies the presented capability against the stored hash and sets an HttpOnly cookie on the response; it inserts, updates and deletes no row.',
  auditDetail: 'No row is written and no audit record is written; the cookie is a response header.',
  reqAudit: 'No audit record is needed for a cookie conversion of a capability the caller already holds.',
  does: 'Applies an in-memory limit of 20 per hour per forwarded address and assessment, validates the body, reads the capability hash and expiry of the assessment, verifies the presented capability and, when valid, answers ok true with the capability set as the HttpOnly cookie for 30 days.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  ev: [
    ...capRead(a, { extract: false }),
    a.h('mutation', 'setCapabilityCookie(response, assessmentId, capability);'),
    a.h('audit', 'setCapabilityCookie(response, assessmentId, capability);'),
    a.h('behavior', "const response = NextResponse.json({ ok: true });"),
    a.imp('behavior', 'setCapabilityCookie', 'httpOnly: true,'),
    a.h('defect', "const forwarded = req.headers.get('x-forwarded-for');"),
    a.imp('defect', 'rateLimit', 'rateLimitStore.set(key, entry);'),
    a.svc('defect', RATE_LIMIT, "const forwarded = request.headers.get('x-forwarded-for');", 'defaultKeyGenerator'),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler has no try block and does not validate that the path id is a UUID, so a malformed id surfaces the database error as a 500.' },
  ],
  def: [DEF_LIMITS, DEF_MALFORMED],
  corr: [{ field: 'mutating', manifest: 'mutating true, audit AUDIT_EXEMPT_DECLARED', actual: 'The POST verifies a capability and sets a response cookie; it writes no row.' }],
})

const profileGet = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent reading the stored continuity profile of their assessment',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: CAP_AUTHZ,
  tenant: CAP_TENANT,
  owner: 'The icra_maturity_profiles row of the assessment named in the path.',
  sens: 'The continuity profile payload: maturity band, composite, dimension scores, observations and recommendations',
  priv: 'The capability holder receives the whole stored profile payload; the oldest profile row is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads by the pseudonymous holder are not attributable and need no audit record.',
  does: 'Verifies the capability for the assessment in the path and returns the profile payload of the first profile row ordered by generation time, 404 when none exists.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  ev: [
    ...capRead(a),
    a.h('tenantScope', '.where(eq(icraMaturityProfiles.assessmentId, assessmentId))'),
    a.h('mutation', '.from(icraMaturityProfiles)'),
    a.h('behavior', 'return NextResponse.json({ profile: rows[0].profilePayload });'),
    a.h('defect', '.orderBy(icraMaturityProfiles.generatedAt)'),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler has no rate limiter, no UUID shape check and no try block, so every anonymous probe costs a database query and a malformed id surfaces the database error.' },
  ],
  def: [DEF_NO_LIMIT, DEF_MALFORMED],
})

const resultsGet = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent reading the continuity profile on the results page',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} The header comment calls access pseudonymous via an unguessable UUID, which the code no longer relies on: the capability check decides.`,
  tenant: CAP_TENANT,
  owner: 'The icra_maturity_profiles row of the assessment whose id is in the path (validated as a UUID).',
  sens: 'The continuity profile payload: maturity band, composite, dimension scores, observations and recommendations',
  priv: 'The capability holder receives the stored profile payload; the failure branch logs the id and the error message.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads by the pseudonymous holder are not attributable and need no audit record.',
  does: 'Validates the id as a UUID, applies an in-memory limit of 20 per minute, verifies the capability and returns the stored profile payload as JSON, 404 when no profile exists.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: CAP_FUTURE,
  ev: [
    ...capRead(a, { id: 'id' }),
    a.h('authentication', 'const presented = extractCapabilityToken(req, id);'),
    a.h('tenantScope', '.where(eq(icraMaturityProfiles.assessmentId, id))'),
    a.h('mutation', '.from(icraMaturityProfiles)'),
    a.h('behavior', 'return NextResponse.json(profile, { status: 200 });'),
    a.h('defect', 'const rl = rateLimit(req, { maxRequests: 20, windowSeconds: 60 });'),
    a.imp('defect', 'rateLimit', 'rateLimitStore.set(key, entry);'),
    a.svc('defect', RATE_LIMIT, "const forwarded = request.headers.get('x-forwarded-for');", 'defaultKeyGenerator'),
  ],
  inf: [
    { claim: 'defect', statement: 'The limiter key is the default key of lib/rate-limit.ts (forwarded address plus user-agent hash) held in a per-process Map.' },
  ],
  def: [DEF_LIMITS],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* icra/submit (one shot), checkout, report, email, telemetry                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

const oneShotSubmit = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent submitting a complete assessment, organization context and consent in one request',
  authn: 'None: no session and no capability exists before the call; the route issues the capability in the response and the cookie. The caller is bounded by an in-memory limit and an optional Turnstile check.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. rateLimit allows 3 per hour per forwarded address and user agent in a per-process Map, verifyTurnstileToken passes when TURNSTILE_SECRET_KEY is unset, and validateBody requires the three acknowledgement booleans to be true and a non-empty answers array. Nothing created here grants access to tenant data.',
  tenant: 'None: the route reads no tenant data and inserts an icra_assessments row and its derived rows through withSystemContext.',
  owner: 'The icra_assessments row and its answer, profile, score, flag and recommendation rows created for the visitor; the visitor owns them through the capability returned once.',
  sens: 'The consent object, locale, the typed organization context (select values and a free-text primary challenge), every canonical answer and the derived profile',
  priv: 'The consent object is stored as the client sent it; answers are rebuilt from the question bank and the free-text note is not read from the body; the capability is returned in the JSON body and the cookie, and the event sink receives the hashed address.',
  mut: 'NONE',
  auditDetail: 'The route inserts the assessment and the derived rows in one system transaction and writes no audit record; the traces are the logger line icra.assessment.submitted and a fire-and-forget event to the icra_events sink.',
  reqAudit: 'Record the consent decision on the server with the time and doctrine version and keep one durable event for the submission.',
  does: 'Limits by address, validates the consent and answers, runs the Turnstile check, normalizes the organization context, rebuilds every answer from the governed question bank and rejects an incomplete or duplicated set, inserts the assessment (status submitted) and its answers, profile, scores, flags and recommendations and returns 201 with the assessment id and the capability.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: CAP_FUTURE,
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    a.h('authentication', 'const rl = rateLimit(req, { maxRequests: 3, windowSeconds: 60 * 60 })'),
    a.h('authentication', 'const turnstile = await verifyTurnstileToken(turnstileToken ?? null, ip)'),
    a.local('authorization', 'validateBody', 'c.acknowledgedAntiSurveillance !== true ||'),
    a.svc('authorization', TURNSTILE, 'return { success: true, notConfigured: true };', 'verifyTurnstileToken'),
    a.h('tenantScope', '.insert(icraAssessments)'),
    a.tbl('tenantScope', 'icraAssessments', /id: uuid\('id'\)\.primaryKey\(\)\.defaultRandom\(\),/, { absentColumns: ['tenantId', 'tenant_id'] }),
    a.h('mutation', 'await Promise.all(inserts)'),
    a.h('audit', "logger.info('icra.assessment.submitted', {"),
    a.h('behavior', 'const { profile } = scoreAssessment(assessmentId, canonicalAnswers, normalizedOrgContext)'),
    a.local('behavior', 'canonicalizeAnswers', 'canonical.push(buildAnswer(question, candidate.rawValue))'),
    a.h('privacy', 'consent,'),
    a.h('defect', "const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null"),
    a.h('defect', "locale = 'en-CA'"),
    a.h('defect', 'body = await req.json()'),
    a.h('defect', "metadata: { error: String(err) },"),
    a.svc('defect', OBSERVABILITY, 'INSERT INTO icra_events (', 'buildInsertSql'),
    a.tbl('defect', 'icraAssessments', /consent: jsonb\('consent'\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The consent value inserted is the destructured request field with no server stamp, so acceptedAt, doctrineVersion and any other key arrive from the client, while the stepwise start route writes acceptedAt and doctrineVersion on the server.' },
    { claim: 'defect', statement: 'The orgContext loop trims and caps each string value but accepts any number of keys with any names, and the request body is read with req.json() without the size cap that guardPublicIntake applies to the start and checkout routes.' },
  ],
  def: [DEF_ONE_SHOT, DEF_LIMITS, DEF_NO_BOT, DEF_SINK],
})

const checkoutPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent buying the briefing or diagnostic report tier for their assessment',
  authn: 'No session: the caller presents the assessment capability, which is verified against the assessment named in the body; guardPublicIntake applies the checkout bucket (10 per hour per header-derived address) and the 16 KiB body cap first.',
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} Payment is not itself an authorization: the route only creates the Stripe session, and the tier is raised later by the Stripe webhook.`,
  tenant: CAP_TENANT,
  owner: 'The icra_assessments row named in the body is read for its tier and capability; no row is written here, and the Stripe session carries the assessment id, tier id and product in its metadata.',
  sens: 'Assessment id and tier choice sent to Stripe, the current report tier, and the buyer e-mail Stripe collects on its own page',
  priv: 'The assessment id, tier and product are sent to Stripe as session metadata; no organization context or answers are sent, and the response is the hosted checkout URL.',
  mut: 'NONE',
  auditDetail: 'The route writes no database row and no audit record; it creates a Stripe checkout session (an external write) and logs the session id with logger.info.',
  reqAudit: 'Keep the Stripe session as the payment record and record the checkout request with the assessment id and tier in the application audit trail.',
  does: 'Applies the public intake guard, validates the body, verifies the capability for the assessment, refuses with 409 when the tier is already at or above the requested one, builds the line items from a Stripe price id or the literal amounts and creates a hosted Stripe checkout session whose success and cancel URLs point at the results page, returning its URL.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Require a submitted assessment before a session is created, fail closed when the application URL is unset, take the amount from one source shared with the displayed price, bind the session to the capability holder, and make the paid tier deliver the PDF its copy names.',
  dec: ['UE-INST-ICRA-PAID-ASSESSMENT-CLAIM-AUTHORITY'],
  ev: [
    a.h('authentication', "const intake = await guardPublicIntake(request, { bucket: 'checkout' });"),
    a.imp('authentication', 'extractCapabilityToken', "const authHeader = request.headers.get('authorization');"),
    a.imp('authorization', 'checkCapability', 'if (!crypto.timingSafeEqual(presentedHash, storedHash))'),
    a.imp('authorization', 'checkCapability', 'if (isCapabilityExpired(row.capabilityTokenExpiresAt))'),
    a.svc('authorization', GUARD, "checkout: { limit: 10, window: 3600, identifier: 'public-intake-checkout' },"),
    a.h('tenantScope', '.where(eq(icraAssessments.id, assessmentId))'),
    a.tbl('tenantScope', 'icraAssessments', /id: uuid\('id'\)\.primaryKey\(\)\.defaultRandom\(\),/, { absentColumns: ['tenantId', 'tenant_id'] }),
    a.h('mutation', 'const session = await stripe.checkout.sessions.create(checkoutParams);'),
    a.h('audit', "logger.info('[icra-checkout] Checkout session created', {"),
    a.h('behavior', 'return NextResponse.json({ url: session.url });'),
    a.h('privacy', 'icra_assessment_id: assessmentId,'),
    a.h('defect', 'reportTierId: icraAssessments.reportTierId,'),
    a.h('defect', "process.env.NEXT_PUBLIC_APP_URL?.replace(/\\/$/, '') ?? 'http://localhost:3000';"),
    a.local('defect', 'buildLineItems', 'unit_amount: BRIEF_AMOUNT_CENTS,'),
    a.local('defect', 'buildLineItems', 'return [{ price: priceIdBrief, quantity: 1 }];'),
    a.sch('defect', ICRA_SCHEMA, "reportTierId: varchar('report_tier_id', { length: 64 }).notNull().default('continuity_reflection'),", { symbol: 'icraAssessments' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The assessment select lists reportTierId and the two capability columns only, so status is never read and a tier can be bought for an assessment that has no submitted profile; the Stripe fulfilment that follows payment only raises reportTierId and patches a profile payload when one exists.' },
    { claim: 'defect', statement: 'The PDF route that a paid tier is meant to unlock requires status completed, which no code writes (see the report route), so the checkout offers the purchase without the file being obtainable.' },
  ],
  def: [DEF_PDF_GATE, DEF_CHECKOUT_NOT_SUBMITTED, DEF_NO_BOT, DEF_CHECKOUT_CONFIG],
})

const reportGet = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent holding the capability of a paid assessment asking for the executive PDF',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} After the capability, the route requires status completed and a paid report tier (executive_continuity_brief or institutional_continuity_diagnostic).`,
  tenant: CAP_TENANT,
  owner: 'The icra_assessments row and the first icra_maturity_profiles row of the assessment named in the path (validated as a UUID).',
  sens: 'The rendered executive PDF built from the organization context and the continuity profile',
  priv: 'The capability holder of a paid assessment would receive the PDF with the typed organization context; the response is private, no-store and noindex.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler renders a PDF in memory, writes no row and no audit record.',
  reqAudit: 'A download by the pseudonymous holder is not attributable; record paid-report downloads once an organization claims the assessment.',
  does: 'Validates the id, verifies the capability, refuses with 422 unless status equals completed (a value no route writes), refuses with 403 unless the tier is a paid one, reads the first profile and renders and returns the PDF.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: 'Decide what completed means and write it from the submit routes, or gate the PDF on submitted, and keep the tier check; rate limit the render.',
  dec: ['UE-INST-ICRA-PAID-ASSESSMENT-CLAIM-AUTHORITY'],
  ev: [
    ...capRead(a),
    a.h('authorization', 'if (!PDF_ELIGIBLE_TIERS.has(assessment.reportTierId)) {'),
    a.h('tenantScope', '.where(eq(icraMaturityProfiles.assessmentId, assessmentId))'),
    a.h('mutation', 'const pdfBuffer = await generateExecutiveContinuityPdf(reportData);'),
    a.h('behavior', "'Content-Type': 'application/pdf',"),
    a.h('privacy', "'Cache-Control': 'private, no-store',"),
    a.h('defect', "if (assessment.status !== 'completed') {"),
    a.h('defect', "return NextResponse.json({ error: 'Assessment not yet completed' }, { status: 422 });"),
    a.tbl('defect', 'icraAssessments', /status: varchar\('status', \{ length: 16 \}\)\.notNull\(\)\.default\('in_progress'\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'Status values written in the application are in_progress (start), submitted (stepwise and one-shot submit) and no other; the review, claim and Stripe fulfilment code paths write no status, and no SQL migration sets completed, so the 422 branch is taken for every assessment.' },
    { claim: 'defect', statement: 'The handler carries no rate limiter and no guardPublicIntake bucket, and the render runs only after the capability, status and tier checks.' },
  ],
  def: [DEF_PDF_GATE, DEF_NO_LIMIT],
})

const emailResultsPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous respondent asking the platform to e-mail the results link to an address they type',
  authn: CAP_AUTHN,
  cat: 'EXTERNAL_TRUST',
  authz: `${CAP_AUTHZ} The recipient address is not verified: any syntactically valid address is accepted.`,
  tenant: CAP_TENANT,
  owner: 'The icra_assessments row named in the body is read for its capability; nothing is stored, and the recipient address is not kept.',
  sens: 'The recipient e-mail address and the results URL carrying the 30-day bearer capability in its fragment',
  priv: 'The capability is sent in clear e-mail to the typed address through the e-mail provider; the event sink keeps an unsalted SHA-256 prefix of the address, the assessment id and the address hash.',
  mut: 'NONE',
  auditDetail: 'The route writes no database row and no audit record; it sends an e-mail through the provider (an external write) and fires a results_emailed event to the icra_events sink.',
  reqAudit: 'Keep a durable record of each send (assessment, time, delivery outcome) without the address, and verify the recipient before the capability is mailed.',
  does: 'Limits to 5 per hour by forwarded address, validates the address, verifies the capability for the assessment id in the body, builds the results URL with the capability in the fragment and sends the e-mail, returning ok true or 502 or 500 when delivery fails.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Send only to an address the respondent verified, rate limit with a durable limiter that does not trust a request header, and keep the recipient hash salted or drop it.',
  dec: ['UE-INST-ICRA-PSEUDONYMOUS-DATA-LIFECYCLE'],
  ev: [
    ...capRead(a),
    a.h('authentication', 'const presented = extractCapabilityToken(req, assessmentId)'),
    a.h('mutation', 'const result = await sendEmail({'),
    a.h('audit', "kind: 'results_emailed',"),
    a.h('behavior', 'const resultsUrl = `${baseUrl}/${locale}/continuity-assessment/results/${assessmentId}#cap=${encodeURIComponent(presented as string)}`'),
    a.h('privacy', "const emailHash = createHash('sha256').update(email).digest('hex').slice(0, 32)"),
    a.h('defect', "const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null"),
    a.h('defect', 'if (!isValidEmail(email)) {'),
    a.h('defect', 'const rl = rateLimit(req, { maxRequests: 5, windowSeconds: 60 * 60 })'),
    a.svc('defect', OBSERVABILITY, 'INSERT INTO icra_events (', 'buildInsertSql'),
  ],
  inf: [
    { claim: 'defect', statement: 'The only recipient test is isValidEmail on the typed string; no code path proves the sender controls the address, and the start route issues a capability to any caller, so any caller can obtain a capability and then send the platform branded e-mail to third parties at the in-memory allowance.' },
    { claim: 'defect', statement: 'The assessment lookup runs outside a try block, so a malformed assessment id in the body surfaces the database error as a 500.' },
  ],
  def: [DEF_EMAIL, DEF_LIMITS, DEF_SINK, DEF_MALFORMED],
})

const telemetryPost = (a) => mk({
  ...base(a),
  persona: 'Anonymous browser of the assessment flow sending a section or abandonment event',
  authn: 'None: no session and no capability; the route accepts events from any caller and bounds them by an in-memory limit.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check. rateLimit allows 60 per minute per forwarded address and user agent in a per-process Map; a kind allow list of ten event names and length caps on the section id and the metadata keys and values bound the payload. Nothing created here grants access to tenant data.',
  tenant: 'None: the route reads no tenant data and writes only an event row, through the sink, with a hashed address.',
  owner: 'icra_events rows, a table that no schema file defines; the event carries no assessment id from this route.',
  sens: 'Event kind, section id, up to eight caller-chosen metadata pairs of at most 64 characters, and the SHA-256 prefix of the forwarded address',
  priv: 'The sink stores the unsalted hashed address with caller-chosen metadata; the response is 204 on every path, including a rejected or rate-limited call.',
  mut: 'NONE',
  auditDetail: 'The route writes an event through fireAndForgetEvent, a raw insert into icra_events inside a try that swallows every error; there is no audit record and no confirmation that the event was stored.',
  reqAudit: 'Define the events table in the schema and migrations, return a failure when the sink is unavailable or document that loss is accepted, and salt the address hash.',
  does: 'Limits by address, parses the body, accepts only an allow-listed kind, bounds the section id and metadata and hands the event to the sink, answering 204 for every outcome.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Create the icra_events table through a migration, key the limiter on a trusted address, salt the address hash and report sink failure to operators.',
  ev: [
    a.h('authentication', 'const rl = rateLimit(req, { maxRequests: 60, windowSeconds: 60 })'),
    a.h('authorization', 'if (!kind || !ALLOWED_KINDS.has(kind)) {'),
    a.h('tenantScope', 'ipHash: hashIp(ip),'),
    a.h('mutation', 'fireAndForgetEvent({'),
    a.h('audit', 'fireAndForgetEvent({'),
    a.h('behavior', 'return new NextResponse(null, { status: 204 })'),
    a.h('privacy', 'metadata,'),
    a.h('defect', "const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null"),
    a.h('defect', 'if (entries.length >= MAX_METADATA_KEYS) break'),
    a.svc('defect', OBSERVABILITY, 'INSERT INTO icra_events (', 'buildInsertSql'),
    a.svc('defect', OBSERVABILITY, '// Silent — observability failures must never affect user flows', 'trackIcraEvent'),
    a.svc('defect', OBSERVABILITY, "return createHash('sha256').update(ip).digest('hex').slice(0, 32);", 'hashIp'),
  ],
  inf: [
    { claim: 'defect', statement: 'A repository search finds the name icra_events only in lib/icra/observability.ts, so no schema or migration defines the table that the insert targets.' },
  ],
  def: [DEF_SINK, DEF_LIMITS],
  corr: [{ field: 'mutating', manifest: 'mutating true, audit EXEMPT', actual: 'The POST hands an event to a raw insert into icra_events; it writes an event row where the sink table exists.' }],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* claim and review                                                                                               */
/* ------------------------------------------------------------------------------------------------------------ */

const claimPost = (a) => mk({
  ...base(a),
  persona: 'Signed-in user presenting a claim token to bind a paid pseudonymous assessment to the organization of their session',
  authn: `${SESSION} (auth() from the Entra server helper; 401 when no user id).`,
  cat: 'SESSION_ONLY',
  authz: 'A session is the only authority test: any signed-in user who is an active member, in any role, of the organization that getOrganizationIdForUser resolves, and who holds the single-use claim token for the assessment, can claim it. No role, office or purchaser check and no authorizeAction call, so kernelAuthorization stays false.',
  tenant: 'The organization comes from the session user through getOrganizationIdForUser, never from the body; the update is selected by assessment id, claim token, unclaimed state and expiry through withSystemContext and writes the user and organization onto the assessment.',
  owner: 'The icra_assessments row named in the path; claimedByUserId, claimedOrgId and claimedAt are written from the session, and the claim token is cleared.',
  sens: 'The binding of a pseudonymous assessment, its organization context and profile to a user id and an organization',
  priv: 'After the claim the assessment is tied to a named user and tenant organization; the capability hash and expiry are not changed, so the earlier pseudonymous holder keeps access.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The conditional update and persistAtomicAudit (icra.assessment.claim with the organization and user) run on the same transaction handle inside withSystemContext, so the claim cannot commit without the audit row; the failure branches write nothing.',
  reqAudit: 'Keep the in-transaction audit row and add the purchaser, the claiming role and the capability revocation to it once the claiming office is named.',
  does: 'Requires a session, validates the claim token, resolves the organization of the user, applies one conditional update that matches the id, token, unclaimed state and expiry, writes the audit row in the same transaction and returns ok with the organization; a miss is classified as 404, 409 or 410.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Name the office that may claim a purchased assessment, check it against the purchaser, revoke the pseudonymous capability when the claim succeeds, and issue the ICRA claim token from the purchase.',
  dec: ['UE-INST-ICRA-PAID-ASSESSMENT-CLAIM-AUTHORITY'],
  ev: [
    a.h('authentication', 'const { userId } = await auth();'),
    a.h('authorization', 'if (!userId) {'),
    a.h('authorization', 'const orgId = await getOrganizationIdForUser(userId).catch(() => null);'),
    a.imp('authorization', 'getOrganizationIdForUser', "eq(organizationMembers.status, 'active'),"),
    a.h('tenantScope', 'claimedOrgId: orgId,'),
    a.h('tenantScope', 'eq(icraAssessments.claimToken, claimToken),'),
    a.h('mutation', '.update(icraAssessments)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', 'return NextResponse.json({ ok: true, assessmentId, organizationId: orgId });'),
    a.h('privacy', 'claimedByUserId: userId,'),
    a.h('defect', 'eq(icraAssessments.claimToken, claimToken),'),
    a.h('defect', 'claimToken: null,'),
    a.tbl('defect', 'icraAssessments', /claimToken: varchar\('claim_token', \{ length: 128 \}\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The update clears claimToken and claimTokenExpiresAt and writes the claimed columns only; it does not touch capabilityTokenHash or capabilityTokenExpiresAt, so the pseudonymous capability stays valid after the claim.' },
    { claim: 'defect', statement: 'A repository search finds one producer of a claim token (generateClaimToken in the Stripe webhook), inside the workbook branch that updates the workbooks table; the ICRA branch updates reportTierId and the profile payload only, so no ICRA row ever has claim_token set and the match on claimToken cannot succeed.' },
  ],
  def: [DEF_CLAIM_ISSUER, DEF_CLAIM_AUTHORITY],
})

const reviewPost = (a) => mk({
  ...base(a),
  persona: 'Operator holding the shared cron secret recording an approve or reject decision on the report narrative slot',
  authn: 'No session: the caller sends the shared platform secret (CRON_SECRET_KEY or CRON_SECRET) in x-cron-secret or as a bearer value; the secret is not tied to a person.',
  cat: 'EXTERNAL_TRUST',
  authz: 'authorize compares the presented value with the environment secret in constant time and refuses when none is configured. The decision (approve or reject), the summary and the reviewerRole (governance_reviewer, exec_sponsor or facilitator for anything else) come from the request body and are not verified against any person or office; no authorizeAction call, so kernelAuthorization stays false.',
  tenant: 'None: the assessment is selected by the UUID in the path through withSystemContext and the secret holder can review any assessment; the organization is the claimed organization when one exists.',
  owner: 'The organizationContext JSON of the icra_assessments row named in the path, which carries the report AI slot and its review workflow.',
  sens: 'The reviewer role, decision, free-text summary and time written into the assessment organization context, which later renders into the report',
  priv: 'The decision and summary are stored in the same JSON that holds the respondent organization context; the response returns only the action and review status.',
  mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
  auditDetail: 'The decision is written to organizationContext and, only when the assessment has a claimedOrgId, persistAtomicAudit writes icra.report.review on the same transaction handle; for an assessment with no claimed organization the decision commits with no audit record, and the audit actor is the constant system:icra-report-review.',
  reqAudit: 'Write an audit record for every review decision, attribute it to the reviewing person, and keep the decision in a table with its own history instead of overwriting a JSON slot.',
  does: 'Validates the id, authorizes with the shared secret, parses the action and summary, loads the assessment and its profile, resolves or builds the report AI slot, applies the review decision, rewrites organizationContext and, for a claimed assessment, writes the audit row, returning the action and review status.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Name the reviewing office, authenticate the reviewer as a person, take the role from the authority and not the body, and audit every decision in the same transaction.',
  dec: ['UE-INST-ICRA-REPORT-REVIEW-AUTHORITY'],
  ev: [
    a.h('authentication', 'if (!authorize(request)) {'),
    a.local('authentication', 'authorize', "const expected = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';"),
    a.local('authorization', 'authorize', 'return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);'),
    a.local('authorization', 'normalizeReviewerRole', "return role === 'governance_reviewer' || role === 'exec_sponsor' ? role : 'facilitator';"),
    a.h('tenantScope', '.where(eq(icraAssessments.id, assessmentId))'),
    a.h('mutation', '.set({ organizationContext: updatedOrganizationContext })'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.imp('audit', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
    a.h('behavior', 'const updated = applyAdaptiveReportReviewDecision(slot, {'),
    a.h('privacy', 'summary,'),
    a.h('defect', 'if (assessment.claimedOrgId) {'),
    a.h('defect', "userId: 'system:icra-report-review',"),
    a.h('defect', 'reviewerRole: normalizeReviewerRole(parsed.reviewerRole),'),
  ],
  inf: [
    { claim: 'defect', statement: 'claimedOrgId is written only by the claim route, whose claim token no code issues for an ICRA assessment, so the audit branch is not taken for any assessment reachable today.' },
  ],
  def: [DEF_REVIEW_AUTH, DEF_REVIEW_AUDIT, DEF_CLAIM_ISSUER],
  corr: [{ field: 'audit', manifest: 'AUDIT_DECLARED_ATOMIC:ATOMIC', actual: 'The audit row is atomic with the update only when the assessment has a claimedOrgId; otherwise the decision commits with no audit record.' }],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* integrations framework                                                                                         */
/* ------------------------------------------------------------------------------------------------------------ */

const FRAMEWORK_AUTHZ = 'withApi requires a session and the steward role floor (a role comparison, not an authorizeAction decision, so kernelAuthorization stays false). The control plane then admits only providers in the approved policy map. Which office may run external integrations is an outstanding institutional decision.'
const FRAMEWORK_TENANT = 'The organization comes from the authenticated membership that withApi resolves (orgScoping caller-org), never from the body; the control plane runs inside withRLSContext for that organization and every query repeats an explicit organization predicate.'
const FRAMEWORK_FUTURE = 'Resolve credentialRef to a vault-backed secret or refuse activation until one exists, report credential state from the secret store, name the office that may run integrations, and make the dry-run flag real or reject it.'

const frameworkGet = (a) => mk({
  ...base(a),
  persona: 'Steward of an organization listing the integration configurations of the organization',
  authn: `${SESSION} (withApi, auth required).`,
  authz: FRAMEWORK_AUTHZ,
  tenant: FRAMEWORK_TENANT,
  owner: 'integration_configs rows of the session organization.',
  sens: 'Provider, type, enabled state, webhook URL, the settings object (echoed verbatim), last sync time and a credentialsStored flag',
  priv: 'The steward receives each configuration with its settings and webhook URL; credential material is never returned, and the credentialsStored flag is a literal true.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of integration configuration by a steward need no audit record unless settings can carry personal data.',
  does: 'Lists the integration_configs rows of the session organization through the control plane and returns each as a public configuration with credentialsStored true.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: FRAMEWORK_FUTURE,
  dec: ['UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', "orgScoping: 'caller-org',"),
    a.h('tenantScope', 'integrations: await listIntegrationConfigsForOrg(organizationId!),'),
    a.imp('tenantScope', 'listIntegrationConfigsForOrg', '.where(eq(integrationConfigs.organizationId, organizationId));'),
    a.h('mutation', 'integrations: await listIntegrationConfigsForOrg(organizationId!),'),
    a.imp('behavior', 'listIntegrationConfigsForOrg', 'return rows.map(toPublicConfig);'),
    a.svc('defect', CONTROL_PLANE, 'credentialsStored: true,', 'toPublicConfig'),
  ],
  inf: [
    { claim: 'defect', statement: 'toPublicConfig builds credentialsStored from the literal true for every row, whatever the credentials column holds (a credentialRef object).' },
  ],
  def: [DEF_CREDENTIALS],
  corr: [],
})

const frameworkPost = (a) => mk({
  ...base(a),
  persona: 'Steward of an organization configuring an approved external provider integration',
  authn: `${SESSION} (withApi, auth required).`,
  authz: FRAMEWORK_AUTHZ,
  tenant: FRAMEWORK_TENANT,
  owner: 'The integration_configs row for the provider of the session organization, created or updated; credentials hold only the credentialRef object.',
  sens: 'Provider, type, enabled flag, an allow-listed settings object, a webhook URL and a credential reference string',
  priv: 'The settings keys are limited to a per-provider non-secret allow list and the response returns the stored configuration; no credential material is accepted or returned, only a reference string.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The row write and persistAtomicAudit (integration.configure.create or update, with provider, type, enabled input, settings key names and whether the reference changed) run on the same RLS transaction handle, so the configuration cannot commit without the audit row; settings values and the reference are not written to it.',
  reqAudit: 'Keep the in-transaction audit row and record the resulting enabled state and webhook URL rather than the input.',
  does: 'Validates the body, requires the provider to be in the approved policy and registered for the type, rejects settings keys outside the allow list, then creates or updates the integration_configs row for the provider and organization with credentials {credentialRef}, settings, webhookUrl and enabled (defaulting to false), audits it in the transaction and returns 201 with the public configuration.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: FRAMEWORK_FUTURE,
  dec: ['UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', "orgScoping: 'caller-org',"),
    a.h('tenantScope', 'integration: await configureIntegrationForOrg(organizationId!, body, userId!),'),
    a.imp('tenantScope', 'configureIntegrationForOrg', 'eq(integrationConfigs.organizationId, organizationId),'),
    a.imp('authorization', 'configureIntegrationForOrg', 'assertKnownProvider(input.provider);'),
    a.h('mutation', 'integration: await configureIntegrationForOrg(organizationId!, body, userId!),'),
    a.imp('mutation', 'configureIntegrationForOrg', '.set({'),
    a.imp('audit', 'configureIntegrationForOrg', 'await persistAtomicAudit(tx, {'),
    a.svc('audit', `${APP}lib/audit/atomic-audit.ts`, 'await tx.insert(auditLogs).values({', 'persistAtomicAudit'),
    a.h('behavior', 'successStatus: 201,'),
    a.imp('privacy', 'configureIntegrationForOrg', 'settingsKeys: Object.keys(input.settings ?? {}),'),
    a.imp('defect', 'configureIntegrationForOrg', "credentials: { credentialRef: input.credentialRef ?? 'managed' },"),
    a.imp('defect', 'configureIntegrationForOrg', 'enabled: input.enabled ?? false,'),
    a.imp('defect', 'configureIntegrationForOrg', 'settings: input.settings ?? {},'),
    a.imp('defect', 'configureIntegrationForOrg', 'webhookUrl: input.webhookUrl ?? null,'),
    a.svc('defect', CONTROL_PLANE, 'credentialsStored: true,', 'toPublicConfig'),
    a.svc('defect', `${APP}lib/integrations/provider-policy.ts`, '* in this codebase yet (`credentialRef` is a placeholder, never'),
  ],
  inf: [
    { claim: 'defect', statement: 'The update branch spreads values (which carry enabled, settings and webhookUrl defaults) into set(), so fields the caller omitted are overwritten with false, an empty object and null; only credentials keeps the existing value when no reference is sent.' },
  ],
  def: [DEF_CREDENTIALS, DEF_CONFIG_RESET],
})

const activatePost = (a) => mk({
  ...base(a),
  persona: 'Steward of an organization switching a configured provider integration on or off',
  authn: `${SESSION} (withApi, auth required).`,
  authz: FRAMEWORK_AUTHZ,
  tenant: FRAMEWORK_TENANT,
  owner: 'The integration_configs row named in the path, constrained by id and the session organization.',
  sens: 'The enabled state of an integration and its public configuration',
  priv: 'The response returns the public configuration, including settings and webhook URL and the literal credentialsStored true.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The compare-and-set update and persistAtomicAudit (integration.activate or deactivate with the provider and previous state) run on the same RLS transaction handle; a concurrent change yields 409 and no audit row.',
  reqAudit: 'Keep the in-transaction audit row.',
  does: 'Loads the configuration by id and session organization, requires an approved provider, updates enabled with a predicate on the state it read so a concurrent change is refused, audits the change in the transaction and returns the public configuration.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: FRAMEWORK_FUTURE,
  dec: ['UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', "orgScoping: 'caller-org',"),
    a.h('tenantScope', 'integration: await setIntegrationActivationForOrg(organizationId!, params.id, body.enabled, userId!),'),
    a.imp('tenantScope', 'setIntegrationActivationForOrg', 'eq(integrationConfigs.organizationId, organizationId),'),
    a.imp('authorization', 'setIntegrationActivationForOrg', 'assertKnownProvider(config.provider as IntegrationProvider);'),
    a.h('mutation', 'integration: await setIntegrationActivationForOrg(organizationId!, params.id, body.enabled, userId!),'),
    a.imp('mutation', 'setIntegrationActivationForOrg', '.set({ enabled, updatedAt: new Date() })'),
    a.imp('audit', 'setIntegrationActivationForOrg', 'await persistAtomicAudit(tx, {'),
    a.svc('audit', `${APP}lib/audit/atomic-audit.ts`, 'await tx.insert(auditLogs).values({', 'persistAtomicAudit'),
    a.h('behavior', 'async ({ body, organizationId, userId, params }) => {'),
    a.imp('privacy', 'setIntegrationActivationForOrg', 'return toPublicConfig(updated);'),
    a.svc('defect', CONTROL_PLANE, 'credentialsStored: true,', 'toPublicConfig'),
    a.imp('defect', 'setIntegrationActivationForOrg', 'const config = await loadIntegrationById(organizationId, integrationId, tx);'),
  ],
  inf: [
    { claim: 'defect', statement: 'Activation checks the provider policy and the organization match but not that a usable credential exists, so an integration whose credentials hold only the reference placeholder can be switched on and is then reported with credentialsStored true.' },
  ],
  def: [DEF_CREDENTIALS],
})

const syncPost = (a) => mk({
  ...base(a),
  persona: 'Steward of an organization starting a synchronization with an enabled provider integration',
  authn: `${SESSION} (withApi, auth required).`,
  authz: FRAMEWORK_AUTHZ,
  tenant: FRAMEWORK_TENANT,
  owner: 'The integration_configs row named in the path, constrained by id and session organization, and the integration_sync_log and provider data the adapter writes for that organization.',
  sens: 'The synchronization request (type, entities, dry-run flag, limit), the provider data the adapter imports for the organization and the sync result counts',
  priv: 'The response returns the sync result counts and errors; the audit details carry the provider, sync type, entity names, dry-run flag and limit.',
  mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  auditDetail: 'performAuditedOperation records an intent row (requested) before the sync and an outcome row (completed or failed) after it; the external effect and the audit rows are not one transaction, and a refused intent maps to 409.',
  reqAudit: 'Keep the intent and outcome pair and add the record counts to the outcome.',
  does: 'Loads the configuration by id and organization, requires it to be enabled and the provider approved, restricts entities to the approved list, and runs the sync engine for the organization and provider inside an audited operation; the dryRun field is passed along but nothing reads it.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: FRAMEWORK_FUTURE,
  dec: ['UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY'],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('tenantScope', "orgScoping: 'caller-org',"),
    a.h('tenantScope', 'result: await initiateTenantIntegrationSync(organizationId!, userId!, {'),
    a.imp('tenantScope', 'initiateTenantIntegrationSync', 'loadIntegrationById(organizationId, request.integrationId, tx),'),
    a.imp('authorization', 'initiateTenantIntegrationSync', 'assertKnownProvider(provider);'),
    a.h('mutation', 'result: await initiateTenantIntegrationSync(organizationId!, userId!, {'),
    a.imp('mutation', 'initiateTenantIntegrationSync', 'SyncEngine.getInstance().executeSync(organizationId, provider, options),'),
    a.imp('audit', 'initiateTenantIntegrationSync', 'return performAuditedOperation('),
    a.h('behavior', 'const refused = operationAuditResponse(error);'),
    a.h('privacy', 'entities: body.entities,'),
    a.h('defect', 'dryRun: body.dryRun,'),
    a.imp('defect', 'initiateTenantIntegrationSync', 'dryRun: request.dryRun,'),
    a.svc('defect', SYNC_ENGINE, 'private runningJobs: Set<string> = new Set();'),
    a.svc('defect', FACTORY, 'private instances: Map<string, IIntegration> = new Map();'),
    a.svc('defect', CONTROL_PLANE, 'credentialsStored: true,', 'toPublicConfig'),
  ],
  inf: [
    { claim: 'defect', statement: 'A repository search finds dryRun only in lib/integrations/types.ts and control-plane.ts: it is placed in SyncOptions and in the audit details and is never read by the sync engine or by an adapter.' },
    { claim: 'defect', statement: 'The factory builds the adapter from integration_configs.credentials, which the control plane writes only as {credentialRef}, and the adapter initialize calls validateConfig, which requires apiKey (or clientId and clientSecret), so each sync that reaches the adapter fails at initialization.' },
  ],
  def: [DEF_CREDENTIALS, DEF_DRY_RUN, DEF_SYNC_LOCAL],
  corr: [NOT_ATOMIC],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* integrations api-keys (generic CRUD over a DENIED table)                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const apiKeysProfile = {
  persona: 'Administrator attempting to list or add integration API key records through the generic factory, which refuses both',
  owner: 'integration_api_keys rows (name, key hash, scopes and expiry), which no route or worker creates or verifies; the organization column is nullable.',
  sens: 'API key names, key prefixes, SHA-256 key hashes, scopes and expiry of machine credentials',
  priv: (method) => (method === 'GET'
    ? 'Nothing is returned: the governance class of integration_api_keys is DENIED, so the read is refused with 403 before the query.'
    : 'Nothing is stored: the write is refused with 403 before any row or audit record is written.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Answers 403 to every caller at the ${floor} role floor: assertCrudRead refuses the DENIED table before any query.`
    : `Answers 403 to every caller at the ${floor} role floor: assertCrudWrite refuses the DENIED table before the insert.`),
  future: 'Decide with the institution whether integration API keys exist, serve them from a dedicated route that shows a secret once and stores only a hash with an in-transaction audit row and a verifier that authenticates from it, or retire the route and correct the storage authority register.',
  gate: GATE,
  deps: [1, 13],
  status: () => 'LATENT_NOT_OPERATIONAL',
  def: () => [DEF_API_KEYS],
  extraEv: (a) => [
    a.sch('defect', CRUD_GOVERNANCE_FILE, "'documents', 'integration_api_keys', 'oauth_providers',"),
    a.tbl('privacy', 'integrationApiKeys', /keyHash: varchar\('key_hash', \{ length: 64 \}\)\.notNull\(\)/),
    a.tbl('defect', 'integrationApiKeys', /organizationId: uuid\('organization_id'\)/),
    a.sch('defect', WORKERS_AUTHORITY, 'app/api/integrations/api-keys/route.ts is crudRoutes()-backed (orgScoped:true, server-derived organizationId).'),
  ],
  reqRead: 'No audit record is needed for a refused read; a dedicated, authority-checked route must audit the reads and creation of credential records.',
  dec: ['UE-INST-INTEGRATION-CONTROL-PLANE-AUTHORITY'],
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Shopify webhook                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

const SHOPIFY_FUTURE = 'Make the discount code and the extractor use one format (and key the redemption by an unambiguous reference), return a non-2xx status for failures so Shopify retries, record a receipt only for events that changed state, refund the amount the shop refunded, bind each shop to an organization and check the shop domain, and keep only the purchaser fields the organization needs.'

const shopifyGet = (a) => mk({
  ...base(a),
  persona: 'Shopify, or any caller, checking that the webhook endpoint is reachable',
  authn: 'None: the route is on the public webhook allowlist and reads no header or session.',
  cat: 'NONE_PUBLIC',
  authz: 'No authentication and no role check; the handler ignores its request argument and returns a static document, so there is nothing to authorize.',
  tenant: 'None: the response is built from literals and reads no tenant data.',
  owner: 'No stored rows; the document is a literal of the handler.',
  sens: 'The endpoint name and the three supported webhook topics, which are public configuration',
  priv: 'No member or organization data is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'No audit record is needed for a static health response.',
  does: 'Returns status ok, the endpoint name shopify-webhooks and the list of supported topics (orders/paid, orders/fulfilled, refunds/create) to any caller.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: SHOPIFY_FUTURE,
  dec: ['UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY'],
  ev: [
    a.h('authentication', 'export async function GET(_request: NextRequest) {'),
    a.h('authorization', 'return standardSuccessResponse({'),
    a.h('tenantScope', "endpoint: 'shopify-webhooks',"),
    a.h('mutation', "status: 'ok',"),
    a.h('behavior', "'refunds/create'"),
  ],
  inf: [
    { claim: 'behavior', statement: 'The handler names its parameter _request and never reads it; the response is the same for every caller and no database or provider call is made.' },
  ],
  def: [],
  corr: [],
})

const shopifyPost = (a) => mk({
  ...base(a),
  persona: 'Shopify delivering an orders/paid, orders/fulfilled or refunds/create event for a member reward redemption',
  authn: 'No session: the provider signs the raw body with HMAC-SHA256 using the shop secret, and the route verifies it in constant time against the single global SHOPIFY_WEBHOOK_SECRET (500 when it is unset, 400 for a bad signature or missing headers).',
  cat: 'EXTERNAL_TRUST',
  authz: 'The only decision is possession of the global webhook secret: any caller who can sign with it is trusted for every organization. The X-Shopify-Shop-Domain header is parsed and never compared with any organization or shop record, and no authorizeAction call is made, so kernelAuthorization stays false.',
  tenant: 'None from the caller: the redemption is found by the id inside a discount code (or by the provider order id) with no organization predicate, and the organization is then taken from the redemption row; the webhook receipt table has no organization column.',
  owner: 'reward_redemptions rows (status, provider order id and payload), the member credit ledger and webhook_receipts rows.',
  sens: 'The full webhook payload, the purchaser customer id, e-mail address and names, line items, tracking details and refund amounts, and the member credit balance movements',
  priv: 'The whole payload is stored in webhook_receipts and the customer fields and line items in the redemption provider payload; the discount codes are logged.',
  mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
  auditDetail: 'Each redemption transition (ordered, fulfilled, refund) updates the row with a status predicate and writes its audit row through auditRewards on the same transaction handle, so that part is atomic; the receipt check, the handler and the receipt insert are separate transactions, and a handler failure is acknowledged with 200.',
  reqAudit: 'Keep the in-transaction audit rows, record the receipt in the same transaction as the state change, and audit refused or ignored events with their reason.',
  does: 'Rate limits by the forwarded address header, verifies the HMAC, parses the payload and, for an event not yet recorded, routes it by topic: orders/paid marks the redemption ordered from the discount code, orders/fulfilled marks it fulfilled by order id and refunds/create returns the full credits by order id; any thrown failure is answered 200 with an error body.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: SHOPIFY_FUTURE,
  dec: ['UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY'],
  ev: [
    a.h('authentication', 'const isValid = verifyShopifySignature('),
    a.svc('authentication', WEBHOOK_SERVICE, 'return crypto.timingSafeEqual(', 'verifyShopifySignature'),
    a.h('authorization', "const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;"),
    a.h('authorization', 'if (!isValid) {'),
    a.svc('authorization', WEBHOOK_SERVICE, 'const shopDomain = getHeader(\'x-shopify-shop-domain\');', 'parseShopifyHeaders'),
    a.local('tenantScope', 'handleOrderPaid', 'const redemption = await getRedemptionByIdInternal(redemptionId);'),
    a.svc('tenantScope', REDEMPTION_SERVICE, 'where: eq(rewardRedemptions.id, redemptionId),', 'getRedemptionByIdInternal'),
    a.h('mutation', 'const result = await processWebhookIdempotent('),
    a.local('mutation', 'handleOrderPaid', 'await markRedemptionOrdered('),
    a.svc('mutation', REDEMPTION_SERVICE, "status: 'ordered',", 'markRedemptionOrdered'),
    a.svc('audit', `${APP}lib/services/rewards/audit.ts`, 'return persistAtomicAudit(tx as RLSTx, entry);', 'auditRewards'),
    a.svc('audit', REDEMPTION_SERVICE, "action: 'rewards.redemption.ordered',", 'markRedemptionOrdered'),
    a.svc('audit', REDEMPTION_SERVICE, "action: 'rewards.redemption.refund',", 'processRedemptionRefund'),
    a.h('behavior', "return NextResponse.json({ received: true, error: 'Internal processing error' }, { status: 200 });"),
    a.local('behavior', 'handleOrderPaid', "return { status: 'ignored', reason: 'no_redemption_discount' };"),
    a.local('privacy', 'handleOrderPaid', 'email: (payload.customer as Record<string, unknown> | undefined)?.email,'),
    a.local('privacy', 'handleOrderPaid', "logger.info('[Webhook] orders/paid', { orderId, orderNumber, discountCodes });"),
    a.svc('privacy', WEBHOOK_SERVICE, 'payloadJson: payload,', 'processWebhookIdempotent'),
    a.h('defect', "const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';"),
    a.h('defect', 'const { topic, webhookId, hmac } = headers || {};'),
    a.local('defect', 'handleRefundCreated', 'refund_amount: totalRefund,'),
    a.svc('defect', REDEMPTION_SERVICE, 'amountCredits: redemption.creditsSpent,', 'processRedemptionRefund'),
    a.svc('defect', REDEMPTION_SERVICE, "import { db } from '@/db';"),
    a.sch('defect', `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`, "PERFORM ue_create_direct_org_rls_policy('reward_redemptions', 'org_id', FALSE);"),
    a.sch('defect', `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`, 'policy — a session with no org context sees zero rows, full stop.'),
    a.svc('defect', WEBHOOK_SERVICE, 'const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;', 'extractRedemptionIdFromDiscount'),
    a.svc('defect', WEBHOOK_SERVICE, 'const alreadyProcessed = await isWebhookProcessed(provider, webhookId);', 'processWebhookIdempotent'),
    a.svc('defect', WEBHOOK_SERVICE, 'await recordWebhookProcessed({', 'processWebhookIdempotent'),
    a.sch('defect', REWARDS_SCHEMA, "payloadJson: jsonb('payload_json').notNull(),", { symbol: 'webhookReceipts', absentColumns: ['organizationId', 'orgId'] }),
  ],
  inf: [
    { claim: 'defect', statement: 'createDiscountCode in lib/services/rewards/shopify-service.ts, which the route does not import, builds the code as UE plus redemptionId with dashes removed, cut to 12 characters and upper-cased, while extractRedemptionIdFromDiscount demands UE plus a dashed 36-character UUID, so the two formats cannot agree and handleOrderPaid returns ignored for every order; markRedemptionOrdered is therefore never reached, providerOrderId is never set, and the order-id lookups in the fulfilled and refund handlers find nothing.' },
    { claim: 'defect', statement: 'Inside the webhook handlers the redemption and ledger queries use the plain db proxy, which resolves to the ordinary pooled connection when neither a system nor a tenant context is active; the round-58 migration gives reward_redemptions the fail-closed direct organization policy of ue_create_direct_org_rls_policy (a session with no org context sees zero rows), so the unscoped lookup by id or by order id returns nothing on that connection.' },
    { claim: 'defect', statement: 'The only caller of createDiscountCode is the redemption action in actions/rewards-actions.ts, which runs it only when SHOPIFY_ENABLED equals true and deducts the credits before the Shopify call.' },
  ],
  def: [DEF_SHOPIFY_CODE, DEF_SHOPIFY_ACK, DEF_SHOPIFY_REFUND, DEF_SHOPIFY_PII, DEF_SHOPIFY_RLS, DEF_SHOPIFY_TRUST],
  corr: [{ field: 'audit', manifest: 'AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE', actual: 'The redemption transitions audit atomically in their own transactions, but the webhook receipt and idempotency check are separate transactions and a failing handler is acknowledged with 200.' }],
})

const FACTS = {
  'icra/start/route.ts|GET': startGet,
  'icra/start/route.ts|POST': startPost,
  'icra/[assessmentId]/answer/route.ts|POST': answerPost,
  'icra/[assessmentId]/submit/route.ts|POST': stepwiseSubmit,
  'icra/[assessmentId]/capability/exchange/route.ts|POST': exchangePost,
  'icra/[assessmentId]/profile/route.ts|GET': profileGet,
  'icra/results/[id]/route.ts|GET': resultsGet,
  'icra/submit/route.ts|POST': oneShotSubmit,
  'icra/checkout/route.ts|POST': checkoutPost,
  'icra/report/[assessmentId]/route.ts|GET': reportGet,
  'icra/email-results/route.ts|POST': emailResultsPost,
  'icra/telemetry/route.ts|POST': telemetryPost,
  'icra/[assessmentId]/claim/route.ts|POST': claimPost,
  'icra/report/[assessmentId]/review/route.ts|POST': reviewPost,
  'integrations/framework/route.ts|GET': frameworkGet,
  'integrations/framework/route.ts|POST': frameworkPost,
  'integrations/framework/[id]/activate/route.ts|POST': activatePost,
  'integrations/framework/[id]/sync/route.ts|POST': syncPost,
  'integrations/shopify/webhooks/route.ts|GET': shopifyGet,
  'integrations/shopify/webhooks/route.ts|POST': shopifyPost,
}

export function facts(a, readText) {
  if (a.route === 'integrations/api-keys/route.ts') return crudRecord(a, readText, apiKeysProfile)
  const build = FACTS[`${a.route}|${a.method}`]
  if (!build) throw new Error(`no Gate 0B.8 icra-integrations facts for ${a.route}|${a.method}`)
  return build(a)
}
