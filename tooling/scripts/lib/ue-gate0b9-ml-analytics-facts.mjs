/**
 * Route-ownership facts: the machine-learning and analytics routes. Sixteen route files (29 operations): the organization
 * member roster served under the name member/ai-feedback, the generic analytics-metric rows served as /api/metrics and
 * the movement-insights trends, the operational metrics read, the six generic ml_predictions row lists (monitoring
 * drift and usage, claim outcome, timeline, workload forecast, recommendations), the model monitoring metrics and alerts
 * routes, the churn-risk prediction, the SLA breach risk prediction and its feedback, and the natural-language query.
 * Every evidence item is produced by `opAuthoring` from the exact handler, the helper or service it reaches, or the
 * resolved schema, and is proved again by the validator. This tranche records the source; it repairs nothing and
 * approves nothing.
 */
import { applyCrossTenantExposure } from './ue-gate0b9-exposure.mjs'
import { mk } from './ue-gate0b4-record.mjs'
import { APP, API, CRUD_FACTORY, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const AI_CAP = 'UE-OMIT-AI-ADVISORY-GOVERNANCE'
const ANALYTICS_CAP = 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION'
const ALERT_CAP = 'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY'
const ENUM_CAP = 'UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION'
const K007 = 'UE-CAP-K-007'
const GATE = 14

const ML_SCHEMA = `${APP}db/schema/domains/ml/predictions.ts`
const PROFILES_SCHEMA = `${APP}db/schema/domains/member/profiles.ts`
const CLAIMS_SCHEMA = `${APP}db/schema/claims-schema.ts`
const ANALYTICS_SCHEMA = `${APP}db/schema/analytics.ts`
const ROUND58 = `${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`
const RLS_FOUNDATION = `${APP}db/migrations/0108_rls_tenant_isolation_foundation.sql`
const LEGACY_PREDICTIONS_SQL = `${APP}db/migrations/20260324_add_remaining_missing_tables.sql`
const PLATFORM_0019 = `${APP}db/migrations-platform/0019_declared_shape_tranche_2.sql`
const CHURN_MODEL = `${APP}lib/ml/models/churn-prediction-model.ts`
const AUDIT_LOGGER = `${APP}lib/audit-logger.ts`
const PILOT_TRACKING = `${APP}lib/services/pilot-tracking.ts`
const WITH_RLS = `${APP}lib/db/with-rls-context.ts`
const API_SECURITY = `${APP}lib/middleware/api-security.ts`

export const ROUTES = new Set([
  'member/ai-feedback/route.ts',
  'metrics/operational/route.ts',
  'metrics/route.ts',
  'ml/monitoring/alerts/route.ts',
  'ml/monitoring/drift/route.ts',
  'ml/monitoring/metrics/route.ts',
  'ml/monitoring/usage/route.ts',
  'ml/predictions/churn-risk/route.ts',
  'ml/predictions/claim-outcome/route.ts',
  'ml/predictions/sla-breach-risk/feedback/route.ts',
  'ml/predictions/sla-breach-risk/route.ts',
  'ml/predictions/timeline/route.ts',
  'ml/predictions/workload-forecast/route.ts',
  'ml/query/route.ts',
  'ml/recommendations/route.ts',
  'movement-insights/trends/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  ML_MEMBER_AI_FEEDBACK_FACADE: {
    capabilityId: K007,
    domain: 'MEMBER_ROSTER_SERVED_UNDER_AN_AI_FEEDBACK_NAME',
    actor: 'Member reading their own membership row, and steward or above reading the organization member roster, through a route whose name advertises member feedback on AI output',
    routes: ['member/ai-feedback/route.ts'],
    evidence: [
      ev(`${API}member/ai-feedback/route.ts`, ' * CRUD collection route for organizationMembers'),
      ev(`${APP}db/schema-organizations.ts`, "email: text('email').notNull(),"),
    ],
  },
  ML_ANALYTICS_METRICS_FACADES: {
    capabilityId: ANALYTICS_CAP,
    domain: 'STORED_ANALYTICS_METRIC_ROWS_SERVED_UNDER_METRICS_AND_TRENDS_NAMES',
    actor: 'Organization member reading stored analytics metric rows, and steward or above inserting a metric row, through the routes named metrics and movement-insights trends',
    routes: ['metrics/route.ts', 'movement-insights/trends/route.ts'],
    evidence: [
      ev(`${API}metrics/route.ts`, ' * CRUD collection route for analyticsMetrics'),
      ev(`${API}movement-insights/trends/route.ts`, ' * CRUD collection route for analyticsMetrics'),
      ev(ANALYTICS_SCHEMA, "export const analyticsMetrics = pgTable('analytics_metrics', {"),
      ev(`${APP}lib/observability/metrics.ts`, ' * Access metrics at: GET /api/metrics'),
      ev(`${APP}app/[locale]/dashboard/movement-insights/page.tsx`, ' * - Minimum 5 organizations per trend'),
    ],
  },
  ML_OPERATIONAL_METRICS: {
    capabilityId: ENUM_CAP,
    domain: 'PLATFORM_WIDE_OPERATIONAL_CLAIM_AND_QUEUE_COUNTS',
    actor: 'Any signed-in user, or the internal AI service presenting the shared service key, reading platform-wide claim, workflow, queue and SLA counts for observability dashboards',
    routes: ['metrics/operational/route.ts'],
    evidence: [
      ev(`${API}metrics/operational/route.ts`, ' * GET /api/metrics/operational'),
      ev(`${API}metrics/operational/route.ts`, ' * - request_count (proxy — relies on external APM; returns placeholder)'),
      ev(`${APP}scripts/perf-baseline.ts`, "{ name: 'metrics-operational', method: 'GET', path: '/api/metrics/operational', threshold_p95_ms: 1000 },"),
    ],
  },
  ML_PREDICTION_ROW_FACADES: {
    capabilityId: AI_CAP,
    domain: 'GENERIC_ML_PREDICTION_ROWS_SERVED_UNDER_SIX_MODEL_NAMES',
    actor: 'Organization member reading stored ml_predictions rows, and steward or above inserting a prediction row, through routes named drift, usage, claim outcome, timeline, workload forecast and recommendations',
    routes: [
      'ml/monitoring/drift/route.ts',
      'ml/monitoring/usage/route.ts',
      'ml/predictions/claim-outcome/route.ts',
      'ml/predictions/timeline/route.ts',
      'ml/predictions/workload-forecast/route.ts',
      'ml/recommendations/route.ts',
    ],
    evidence: [
      ev(`${API}ml/monitoring/drift/route.ts`, ' * CRUD collection route for mlPredictions'),
      ev(`${API}ml/recommendations/route.ts`, ' * CRUD collection route for mlPredictions'),
      ev(ML_SCHEMA, 'export const mlPredictions = pgTable("ml_predictions", {'),
    ],
  },
  ML_MONITORING_ALERTS: {
    capabilityId: ALERT_CAP,
    domain: 'MODEL_MONITORING_ALERT_INBOX_AND_ACKNOWLEDGEMENT',
    actor: 'Organization member listing model monitoring alerts, and steward acknowledging an alert, for the AI models the organization runs',
    routes: ['ml/monitoring/alerts/route.ts'],
    evidence: [
      ev(`${API}ml/monitoring/alerts/route.ts`, ' * Returns active ML monitoring alerts with severity levels'),
      ev(`${API}ml/monitoring/alerts/route.ts`, ' * - P1: Critical - Immediate action required (accuracy < 75%, PSI > 0.30)'),
    ],
  },
  ML_MONITORING_METRICS: {
    capabilityId: AI_CAP,
    domain: 'MODEL_PERFORMANCE_MONITORING_METRICS',
    actor: 'Organization member reading accuracy, precision, recall, confidence and status figures for the organization AI models',
    routes: ['ml/monitoring/metrics/route.ts'],
    evidence: [
      ev(`${API}ml/monitoring/metrics/route.ts`, ' * Returns real-time model performance metrics across all AI models:'),
      ev(ML_SCHEMA, 'export const modelMetadata = pgTable("model_metadata", {'),
    ],
  },
  ML_CHURN_RISK: {
    capabilityId: AI_CAP,
    domain: 'MEMBER_CHURN_RISK_PREDICTION',
    actor: 'Officer listing stored churn-risk predictions for the members of the organization, and generating a prediction for one named member',
    routes: ['ml/predictions/churn-risk/route.ts'],
    evidence: [
      ev(`${API}ml/predictions/churn-risk/route.ts`, ' * UC-07: Churn Risk Prediction API'),
      ev(CHURN_MODEL, "const MODEL_VERSION = 'v1.0.0';"),
    ],
  },
  ML_SLA_BREACH_RISK: {
    capabilityId: AI_CAP,
    domain: 'SLA_BREACH_RISK_SCORING_AND_FEEDBACK',
    actor: 'Steward submitting case features for an SLA breach risk score and recording the observed outcome, and member listing the stored scores and the feedback summary',
    routes: ['ml/predictions/sla-breach-risk/route.ts', 'ml/predictions/sla-breach-risk/feedback/route.ts'],
    evidence: [
      ev(`${API}ml/predictions/sla-breach-risk/route.ts`, "summary: 'Predict SLA breach risk with model/version and feature references',"),
      ev(`${API}ml/predictions/sla-breach-risk/feedback/route.ts`, "summary: 'Submit SLA prediction outcome feedback and update retrain signal',"),
      ev(ML_SCHEMA, 'export const modelMetadata = pgTable("model_metadata", {'),
    ],
  },
  ML_NATURAL_LANGUAGE_QUERY: {
    capabilityId: AI_CAP,
    domain: 'NATURAL_LANGUAGE_QUERY_OVER_EXTERNAL_AI_SERVICE',
    actor: 'Steward asking a natural-language question that the platform forwards to an external AI service and answers with the service result',
    routes: ['ml/query/route.ts'],
    evidence: [
      ev(`${API}ml/query/route.ts`, ' * Natural language query interface'),
      ev(`${API}ml/query/route.ts`, "// Natural-language questions are answered over the organization's claims, steward workload and settlement data, which a"),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate: GATE, severity, title, ...extra })

const DEF_OPS_ANY_CALLER = 'DEF-0B9-ML-OPERATIONAL-METRICS-COUNT-EVERY-ORGANIZATIONS-CLAIMS-FOR-ANY-SIGNED-IN-CALLER-OR-THE-SERVICE-KEY'
const DEF_OPS_PROXY = 'DEF-0B9-ML-OPERATIONAL-METRICS-ARE-PROXIES-NAMED-AS-REQUEST-AND-ERROR-RATES-AND-FAILED-READS-BECOME-ZERO'
const DEF_OPS_KEY = 'DEF-0B9-ML-OPERATIONAL-METRICS-SERVICE-KEY-COMPARED-WITH-EQUALITY-AND-ERROR-TEXT-RETURNED'
const DEF_CHURN_SYNTHETIC = 'DEF-0B9-ML-CHURN-SCORES-COME-FROM-A-RANDOMLY-INITIALISED-NETWORK-FITTED-ON-GENERATED-EXAMPLES-PRESENTED-AS-ML'
const DEF_CHURN_SHAPE = 'DEF-0B9-ML-CHURN-SQL-NAMES-COLUMNS-AND-STATUS-VALUES-THE-REPOSITORY-DOES-NOT-DEFINE'
const DEF_CHURN_PROFILING = 'DEF-0B9-ML-CHURN-PROFILES-NAMED-MEMBERS-FROM-THEIR-CASE-HISTORY-WITH-NO-CONSENT-OR-PURPOSE-DECISION'
const DEF_CHURN_AUDIT = 'DEF-0B9-ML-CHURN-INVOCATION-AUDIT-IS-A-SEPARATE-WRITE-BEFORE-VALIDATION-AND-ON-GET'
const DEF_CHURN_SCOPE = 'DEF-0B9-ML-CHURN-RESOLVES-A-SECOND-IDENTITY-READS-CLAIMS-WITHOUT-AN-ORGANIZATION-PREDICATE-AND-HAS-NO-FEATURE-GATE'
const DEF_SLA_HEURISTIC = 'DEF-0B9-ML-SLA-SCORE-IS-LITERAL-WEIGHTS-OVER-CALLER-VALUES-PRESENTED-AS-A-MODEL-WITH-CONSTANT-CONFIDENCE'
const DEF_SLA_CASE = 'DEF-0B9-ML-SLA-CASE-ID-IS-NEVER-VERIFIED-AND-NOT-STORED-WITH-THE-PREDICTION'
const DEF_SLA_VERSION = 'DEF-0B9-ML-SLA-MODEL-VERSION-IS-CALLER-NAMED-AND-CREATES-UNBOUNDED-MODEL-ROWS'
const DEF_SLA_FEEDBACK = 'DEF-0B9-ML-SLA-FEEDBACK-IS-REPEATABLE-CALLER-STATED-VERSION-UNBOUND-AND-A-LOST-UPDATE-READ-MODIFY-WRITE'
const DEF_SLA_SIGNAL = 'DEF-0B9-ML-SLA-RETRAIN-SIGNAL-AND-TRAINING-QUEUE-DESCRIBE-A-FORMULA-THAT-NEVER-READS-THEM'
const DEF_SLA_GRANT = 'DEF-0B9-ML-SLA-FEEDBACK-UPDATES-MODEL-METADATA-WHICH-THE-RUNTIME-ROLE-MAY-ONLY-SELECT-AND-INSERT'
const DEF_SLA_PILOT = 'DEF-0B9-ML-SLA-FEEDBACK-PILOT-EVENT-IS-AN-AWAITED-POST-COMMIT-WRITE-THROUGH-THE-BARE-DB'
const DEF_SLA_GET_GATE = 'DEF-0B9-ML-SLA-LIST-GET-SKIPS-THE-FEATURE-GATE-AND-SAFETY-CHECK-THE-POST-APPLIES'
const DEF_QUERY_DISCLOSURE = 'DEF-0B9-ML-QUERY-SENDS-FREE-TEXT-AND-ARBITRARY-CONTEXT-TO-AN-EXTERNAL-SERVICE-WITH-NO-DISCLOSURE-DECISION'
const DEF_QUERY_AUDIT = 'DEF-0B9-ML-QUERY-AUDIT-IS-A-LOG-LINE-AND-THE-SAFETY-CHECK-DECLARES-A-LOWER-ROLE-AND-DATA-CLASS'
const DEF_MON_METRICS_SQL = 'DEF-0B9-ML-MONITORING-METRICS-QUERY-ABSENT-COLUMNS-AND-JOIN-MODEL-METADATA-WITHOUT-AN-ORGANIZATION-PREDICATE'
const DEF_MON_METRICS_INVENTED = 'DEF-0B9-ML-MONITORING-METRICS-SUBSTITUTE-LITERAL-FIGURES-AND-REPORT-HEALTHY-WHEN-NOTHING-IS-MEASURED'
const DEF_PRED_FACADE = 'DEF-0B9-ML-PREDICTION-ROUTES-ARE-ONE-GENERIC-ROW-LIST-UNDER-SIX-MODEL-NAMES'
const DEF_PRED_FORGE = 'DEF-0B9-ML-STEWARD-CAN-STORE-ANY-PREDICTION-ROW-THAT-THE-SLA-LIST-ALERT-SWEEP-AND-INSIGHTS-READ'
const DEF_PRED_SHAPE = 'DEF-0B9-ML-DECLARED-PREDICTION-SHAPE-CONFLICTS-WITH-THE-SQL-THAT-CREATES-THE-TABLE'
const DEF_ALERT_SQL = 'DEF-0B9-ML-ALERTS-SQL-NAMES-ABSENT-COLUMNS-AND-AN-ABSENT-TABLE-AND-IS-NOT-VALID-SQL'
const DEF_ALERT_FINDING = 'DEF-0B9-ML-ALERTS-DRIFT-FINDING-IS-A-LITERAL-PSI-AND-ALERT-IDS-CHANGE-EVERY-SECOND'
const DEF_ALERT_ACK = 'DEF-0B9-ML-ALERT-ACKNOWLEDGE-GUID-NEVER-MATCHES-A-GENERATED-ID-AND-THE-ACKNOWLEDGEMENT-IS-KEYED-ON-THE-ID-ALONE'
const DEF_ALERT_JOIN = 'DEF-0B9-ML-ALERTS-ACKNOWLEDGEMENT-JOIN-HAS-NO-ORGANIZATION-PREDICATE-AND-READS-THROUGH-THE-BARE-DB'
const DEF_METRICS_NAME = 'DEF-0B9-ML-METRICS-ROUTE-SERVES-STORED-ANALYTICS-ROWS-WHERE-THE-PROMETHEUS-ENDPOINT-IS-DOCUMENTED'
const DEF_TRENDS_NAME = 'DEF-0B9-ML-MOVEMENT-TRENDS-ROUTE-IS-NOT-THE-CONSENT-GATED-AGGREGATE-THE-DASHBOARD-SERVES'

const CHURN_ROUTE = 'apps/union-eyes/app/api/ml/predictions/churn-risk/route.ts'

export const DEFECTS = [
  D(DEF_OPS_ANY_CALLER, ENUM_CAP, 'HIGH',
    'The operational metrics GET admits any signed-in user of any organization, or any caller that presents the AI service key, and then counts claims, claim status changes in the last 24 hours, claims not closed that were last updated more than five days ago, and claim-update messages containing error or failed across every organization: requireApiAuth is called with no options (so no organization and no role is required), none of the four database reads carries an organization predicate, and they run through the shared database client outside any organization context, on a connection whose role the migration that introduced the runtime roles records as rolbypassrls = true, so row-level security does not narrow them.',
    {
      riskCategories: ['ANALYTICS_CROSSES_BOUNDARY', 'RLS_ASSUMED_FROM_DB_CLIENT'],
      releaseDisposition: {
        disposition: 'RELEASE_BLOCKING',
        actualExposure: 'Any signed-in user of any organization, and any caller holding the AI service key, receives the platform-wide counts of claims, status changes, overdue claims and error-like claim updates from the route, with the figures of every organization added together and no organization narrowing.',
        potentialImpact: {
          classes: ['CROSS_TENANT_DISCLOSURE'],
          description: 'A member or steward of one organization learns the volume and workload of every other organization (how many claims exist, how many changed state in a day, how many are stale), which is cross-tenant disclosure of operational data that only a platform mandate could authorize, and no mandate is named in the source.',
        },
        activationState: 'REACHABLE_ANY_AUTHENTICATED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/metrics/operational/route.ts', quote: 'await requireApiAuth()' },
          { ref: 'apps/union-eyes/app/api/metrics/operational/route.ts', quote: 'db.select({ count: count() }).from(claims),' },
          { ref: 'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql', quote: 'rolbypassrls = true, so it ignores RLS entirely regardless of what' },
        ],
        existingContainment: 'NONE',
        justification: 'The route is reachable by any authenticated caller, the counts it returns are computed over every organization with no predicate, and the only database control that could narrow them is row-level security, which the recorded state of the connection role ignores; no role floor, entitlement or flag in the route limits who receives the figures, so the disclosure follows from the route as written.',
      },
    }),
  D(DEF_OPS_PROXY, ENUM_CAP, 'MEDIUM',
    'The operational metrics GET names the lifetime claim count of all organizations request_count (its own header says request_count is a proxy that returns a placeholder), derives error_rate from the number of claim updates whose message contains the text error or failed divided by the number of status changes in 24 hours, and runs its five reads under Promise.allSettled so that a rejected read is replaced by 0 (or an empty queue list) and the response is still 200 with window 24h, so an unreachable database or job queue reads as a healthy zero and the figures are not request counts or error rates.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_OPS_KEY, ENUM_CAP, 'MEDIUM',
    'The operational metrics GET compares the x-service-key header with AI_SERVICE_KEY using ===, which is not a constant-time comparison (lib/api/secret-compare.ts holds secretsEqual for this purpose and the route does not use it), accepts that one shared key as authority over the figures of every organization, and when the data queries throw returns 500 with detail set to String(err), so the text of a database or queue error reaches every caller that passed the check.'),

  D(DEF_CHURN_SYNTHETIC, AI_CAP, 'HIGH',
    'The churn-risk routes score a named member with a TensorFlow network that has no trained weights in the repository: loadChurnModel reads model.json from disk and, when it is absent (no code calls saveChurnModel), builds a new network and fits it for 50 epochs on 150 generated examples whose feature values are drawn with Math.random from hand-written ranges (the medium-risk labels are Math.random() > 0.5 ? 1 : 0), the normalisation constants are literals and confidence is Math.abs(churnProbability - 0.5) * 2; the POST stores the result with isPredictionFromML true and returns it as aiGenerated with source ml, so a risk level for a named person is presented as the output of a trained model when it is the output of a randomly initialised network fitted on invented data, and the interventions derived from it (priority outreach, a dedicated steward) attach to that person.',
    {
      riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'],
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'An officer of an organization can call the churn-risk routes; the POST names a member and computes a score through the randomly initialised network, stores it and returns it marked reviewRequired, and the GET lists stored scores with member names. The SQL names columns no schema file in the repository defines, so on a database built from the repository the statements are rejected before a score is stored or listed.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'PRIVACY_OR_CONSENT', 'SAME_TENANT_OVER_DISCLOSURE'],
          description: 'An officer is shown a numeric risk level and recommended interventions for a named member that are produced by noise-fitted arithmetic and labelled as machine learning, which can lead to outreach or steward assignment decisions about a person on the basis of a figure that carries no information about that person.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: CHURN_ROUTE, quote: "export const POST = withRoleAuth('officer', async (request, _context) => {" },
          { ref: 'apps/union-eyes/lib/ml/models/churn-prediction-model.ts', quote: 'await syntheticPreTrain(modelInstance);' },
        ],
        existingContainment: {
          summary: 'The response metadata marks the output aiGenerated and reviewRequired and the route is limited to the officer role floor, so a person is expected to review the score before acting; nothing in the route makes the review a condition of a stored score or of the interventions returned.',
          evidence: [
            { ref: CHURN_ROUTE, quote: 'reviewRequired: true,' },
          ],
        },
        blockingCondition: 'The churn-risk SQL runs against a database that holds the profile, claim and prediction columns it names (or is repaired to run) while the model directory holds no trained weights, so that scores for named members are produced and stored by the synthetic network.',
        justification: 'Harm requires the statements to execute, which the repository schema does not support, so release is blocked only once they can: from that moment every score for a named member comes from a network fitted on generated examples and is presented as a model output with a confidence figure, and the reviewRequired flag does not prevent the score from being stored or returned.',
      },
    }),
  D(DEF_CHURN_SHAPE, AI_CAP, 'MEDIUM',
    'The churn-risk SQL names columns and values that no schema file in the repository defines: the POST reads profiles.organization_id, full_name, union_tenure_years and member_age (profiles is the billing profile and has none of them) and claims.resolution_notes, counts claims with status withdrawn (a value the claim_status enum does not have) and inserts user_id, model_type, model_version, prediction_value, confidence_score, predicted_at, response_time_ms and features_used into ml_predictions, and the GET filters ml_predictions on model_type and predicted_at and joins profiles on user_id, while the declared ml_predictions shape, which the storage authority register calls canonical, has none of those columns, so on a database built from the repository these statements are rejected and the route answers 500 instead of a prediction; the intervention strings the POST stores and returns also carry garbled characters (UTF-8 emoji decoded as Latin-1 text).'),
  D(DEF_CHURN_PROFILING, AI_CAP, 'MEDIUM',
    'The churn-risk routes build a risk profile of a named member from that member case history (claim count, resolution rate, days since the last claim, a satisfaction figure the SQL itself labels simulated and infers from claim status and a resolution-notes text match, and a count of withdrawn claims), store the case-derived features in ml_predictions.features_used and return the member name, risk score, contributing factors such as inactive for N days or N negative feedback incidents, and tenure to any officer, with no record of what members are told, whether they consented, which office may act on a score or how long a score is kept.',
    { riskCategories: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'] }),
  D(DEF_CHURN_AUDIT, AI_CAP, 'MEDIUM',
    'The churn-risk invocation audit is a separate write outside the data transaction and ahead of the checks that decide whether the call is valid: auditAIInvocation writes an audit_logs row through auditLog and its own tenant context before the GET checks the organization and before the POST validates the body, so a rejected request leaves an AI invocation record with outcome success, the GET (a read method) writes a row on every call, and the POST prediction row and its persistAtomicAudit record commit in a second, unrelated transaction; the auditRefId returned in the response metadata names the first record, not the committed prediction.',
    { riskCategories: ['GET_WITH_SIDE_EFFECTS', 'AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_CHURN_SCOPE, AI_CAP, 'MEDIUM',
    'The churn-risk handlers are registered with withRoleAuth at the officer floor but ignore the context it supplies (the parameter is named _context) and resolve the user and organization a second time with getCurrentUser, the GET counts claims per member with a subquery (WHERE member_id = p.user_id) that carries no organization predicate and runs through the shared database client outside any organization context, the limit query parameter is parseInt of the raw string with no number check and no upper bound, and neither handler applies guardAiFeature although the sibling model routes apply one.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),

  D(DEF_SLA_HEURISTIC, AI_CAP, 'MEDIUM',
    'The SLA breach risk POST returns computeSlaBreachProbability, a sum of literal weights over four caller-supplied values (priority, hoursRemaining, transitionCount, hasPreviousBreaches; featureRefs is only required to be a list of strings of two characters or more), clamped to 0.01 to 0.99, together with a constant confidence 0.78, bounds of plus and minus 0.08 and a model object with type, version and trainedAt taken from a model_metadata row the route inserts with scoring heuristic_v1 when none exists, so arithmetic over unverified inputs is presented as a model prediction with a confidence and a training date, and a steward can obtain any score (including 0.80 and above, which the realtime alerting sweep counts as an imminent breach signal) by choosing the inputs.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_SLA_CASE, AI_CAP, 'MEDIUM',
    'The SLA breach risk POST accepts caseId as any GUID, never reads claims or grievances to check that it exists or belongs to the organization, and does not store it on the ml_predictions row (the table has no case column; the id appears only in the audit record details and the response), so a score is not attached to a case, the GET cannot list the predictions of a case, and the feedback route cannot check that a prediction belongs to the case it is later said to be about.'),
  D(DEF_SLA_VERSION, AI_CAP, 'MEDIUM',
    'The SLA breach risk POST and feedback POST take modelVersion from the caller (default sla-risk-v1, any non-empty string), look up model_metadata by organization, type sla_breach_risk and that string, and insert a new model_metadata row when none exists (the POST with the caller featureRefs as parameters, the feedback with empty parameters), so a steward creates unbounded model rows, the version recorded for a prediction is whatever was typed, and feedback can be recorded against a version the prediction was never made with.'),
  D(DEF_SLA_FEEDBACK, AI_CAP, 'MEDIUM',
    'The SLA feedback POST lets a steward submit feedback for the same prediction any number of times (nothing records that a prediction already has feedback), takes actualBreach and resolutionHours from the request body with no check against the case, and folds each submission into a running mean absolute error by reading the model_metadata parameters JSON and writing it back without a row lock or version check, so two concurrent submissions overwrite one another observation count and a steward can move the quality score and the retrain recommendation at will.'),
  D(DEF_SLA_SIGNAL, AI_CAP, 'MEDIUM',
    'The SLA feedback routes compute meanAbsoluteError, a qualityScore written to model_metadata.accuracy, retrainRecommended after 30 observations with an error above 0.25, a trainingDataQueue of the last 200 submissions (each with its free-text comment and submitting user id) and a retrainSignal, and the GET returns them as the model feedback summary, but no code reads trainingDataQueue or retrainSignal and the scoring function that produced the predictions is a fixed formula that never reads model parameters, so no retraining can follow from the signal and the accuracy figure describes a formula that stays as it is.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_SLA_GRANT, AI_CAP, 'MEDIUM',
    'The SLA feedback POST updates model_metadata inside withRLSContext, which when UE_CANONICAL_BOOTSTRAP_V2 is 1 runs the transaction as the union_eyes_runtime role, and the round-58 migration revokes every privilege from that role on model_metadata and grants SELECT and INSERT only (the storage authority register records the same required privileges), so under that configuration the UPDATE is refused with a permission error, the whole transaction including the audit record rolls back and the steward receives a server error for every feedback submission, although the route is the one the register lists as the feedback path.'),
  D(DEF_SLA_PILOT, AI_CAP, 'MEDIUM',
    'The SLA feedback POST calls trackPilotEvent after the transaction has committed and awaits it with no error handling: trackPilotEvent inserts into pilot_events through the shared database client imported from @/db outside any organization context (the route holds no tenant transaction at that point, and pilot_events carries a direct organization row-level policy), so when that insert fails the steward receives an error for feedback that was already committed and audited, and a retry records the observation a second time; the pilot_events activity record is therefore written in a separate transaction from the feedback and its atomic audit record, so the audit trail of the submission is split across two commits that can disagree.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT', 'AUDIT_OUTSIDE_DATA_TRANSACTION'] }),
  D(DEF_SLA_GET_GATE, AI_CAP, 'LOW',
    'The SLA breach risk GET lists the latest 25 stored sla_breach_risk prediction rows of the organization at the member floor with no guardAiFeature feature gate and no enforceAISafety call (the destructured handler argument is only organizationId), where the POST of the same file and both methods of the feedback route apply both, so an organization that has switched the AI feature off still serves its stored predictions to every member.'),

  D(DEF_QUERY_DISCLOSURE, AI_CAP, 'MEDIUM',
    'The ml/query POST forwards the free-text question of a steward (up to 500 characters), an arbitrary context value validated only as z.any(), the organization id and the shared AI_SERVICE_TOKEN bearer to the service at AI_SERVICE_URL, and merges the JSON the service returns (which its own contract says may include the generated sql and result data) into the response unfiltered, with no record of what the service may receive, no data-class or consent decision and no check of what comes back, while nothing in the repository implements the /api/query endpoint to show that it applies the organization id it is sent; the question and context can name members and cases.',
    { riskCategories: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'] }),
  D(DEF_QUERY_AUDIT, AI_CAP, 'MEDIUM',
    'The ml/query POST records its audit through logApiAuditEvent, which only writes a logger.info line (the question cut to 100 characters and the confidence), after the external call and not persisted, and it calls enforceAISafety with userRole member and dataClass internal although the route requires steward and answers over claims, steward workload and settlement data; enforceAISafety reads only the user id, organization id, requested entity organization and canMutate, so the declared role and data class are labels and not controls, and a question that is answered leaves no durable audit record.'),

  D(DEF_MON_METRICS_SQL, AI_CAP, 'MEDIUM',
    'The ml/monitoring/metrics GET queries ml_predictions for predicted_at, prediction_correct and assignment_accepted and model_metadata for model_name, precision, recall, f1_score, last_evaluated_at, baseline_accuracy and baseline_confidence, none of which the declared tables have, and joins model_metadata to the per-model figures on model_name with no organization predicate (the table is organization-scoped, and the query runs through the shared database client rather than a tenant transaction), so on a database built from the repository the route fails with a column error, and were the columns present the join would mix the model rows of every organization into one organization figures.',
    { riskCategories: ['ANALYTICS_CROSSES_BOUNDARY', 'RLS_ASSUMED_FROM_DB_CLIENT'] }),
  D(DEF_MON_METRICS_INVENTED, AI_CAP, 'MEDIUM',
    'The ml/monitoring/metrics GET substitutes literal figures for what was not measured and reports them as model health: precision, recall and f1 are COALESCEd to 0.80, the status CASE returns critical whenever accuracy is NULL and healthy only at 0.85 and above, and the mapping code turns a missing value into 0, a missing status into healthy, a missing trend into stable and a missing last_evaluated_at into the current time, so a model with no measurements is reported with 0.80 quality figures and a fresh timestamp.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_PRED_FACADE, AI_CAP, 'MEDIUM',
    'The drift, usage, claim-outcome, timeline, workload-forecast and recommendations routes are the same generic crudRoutes configuration over ml_predictions, so each lists every stored prediction row of the organization whatever its type (page of 50, at most 100) and inserts a caller-supplied row, while its name advertises drift monitoring, usage monitoring, an outcome prediction, a timeline forecast, a workload forecast or recommendations, and nothing is computed, filtered by type or monitored behind any of them.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_PRED_FORGE, AI_CAP, 'MEDIUM',
    'A steward can insert an ml_predictions row of any prediction type, value, bounds, confidence and horizon through the six generic prediction routes (the body is copied into the insert), and the same table is what the SLA breach risk list returns for type sla_breach_risk, what the SLA feedback route accepts a prediction id from, what the realtime alerting sweep counts under withSystemContext (sla_breach_risk rows from the last 60 minutes with predicted_value at or above 0.80, which raises an organization alert) and what the insights generator reads as the latest 20 predictions, so a caller-chosen row is stored with no provenance and is consumed as a model output.'),
  D(DEF_PRED_SHAPE, AI_CAP, 'MEDIUM',
    'The declared ml_predictions shape (prediction_type, prediction_date, predicted_value, bounds, confidence, horizon, granularity) conflicts with the SQL files that create the table: db/migrations/20260324_add_remaining_missing_tables.sql, db/migrations/20260507_fixup_create_break_glass_activations.sql and db/migrations/manual/067_advanced_analytics_q1_2025.sql each create it with model_name, model_version and target_date NOT NULL and no default, and migrations-platform/0019 only adds the declared columns (and sets NOT NULL on them only when the table is empty), so on a table created from those files the inserts of the SLA breach risk route and of the generic prediction routes, which supply none of the legacy columns, are refused by the database.'),

  D(DEF_ALERT_SQL, ALERT_CAP, 'MEDIUM',
    'The ml/monitoring/alerts routes name columns and a table that the repository does not define and the GET holds SQL that is not valid: it reads ml_predictions.model_type, predicted_at, prediction_correct and confidence_score (the declared table has prediction_type, prediction_date and confidence), joins a table ml_alert_acknowledgments that no schema file or migration creates, ends two SELECT lists with a trailing comma before FROM and orders by alert_timestamp, which no CTE selects, so the GET answers 500 and the POST, which inserts into ml_alert_acknowledgments, fails with a missing relation, on a database built from the repository.'),
  D(DEF_ALERT_FINDING, ALERT_CAP, 'MEDIUM',
    'The ml/monitoring/alerts GET emits a P1 finding with the literal text Data drift detected: Case Complexity PSI = 0.28 (threshold: 0.25) for Claim Outcome Prediction whenever the organization has created more than 100 claims in the last 7 days, whatever the data is (no population stability index is computed), and builds every alert id from the model type and TO_CHAR(NOW(), YYYYMMDDHH24MISS), so a drift figure is asserted from claim volume alone and the id of each alert changes every second, so an alert cannot be referred to twice.',
    { riskCategories: ['FABRICATED_INSTITUTIONAL_FINDING'] }),
  D(DEF_ALERT_ACK, ALERT_CAP, 'MEDIUM',
    'The ml/monitoring/alerts POST requires alertId to be z.guid, while every id the GET generates is text such as perf_<model>_<timestamp>, so no listed alert can be acknowledged; the insert is keyed ON CONFLICT (alert_id) alone, so an acknowledgement of one alert id by one organization blocks the same id for every other organization (the update applies only to the organization own row and a conflict is answered 409), and the POST accepts any GUID the caller types, acknowledging an alert that does not exist.'),
  D(DEF_ALERT_JOIN, ALERT_CAP, 'MEDIUM',
    'The ml/monitoring/alerts GET joins ml_alert_acknowledgments on alert_id with no organization predicate and runs the whole read through the shared database client rather than a tenant transaction (the POST uses withRLSContext), so an acknowledgement written by another organization for the same alert id would be shown as acknowledged, with the acknowledging user id and time, in this organization list.',
    { riskCategories: ['RLS_ASSUMED_FROM_DB_CLIENT'] }),

  D(DEF_METRICS_NAME, ANALYTICS_CAP, 'LOW',
    'The /api/metrics route is a generic crudRoutes configuration over analytics_metrics that lists the organization stored metric rows at the member floor and accepts a steward-supplied row, while lib/observability/metrics.ts documents the Prometheus (prom-client) metrics as available at GET /api/metrics and lib/public-routes.ts names /api/metrics as a role-scoped infrastructure route, so a scraper pointed at the documented path receives JSON rows of business metric records (including their metadata column) rather than metrics in the exposition format.'),
  D(DEF_TRENDS_NAME, ANALYTICS_CAP, 'MEDIUM',
    'The /api/movement-insights/trends route is a generic crudRoutes configuration over analytics_metrics (the organization own metric rows, readable at the member floor and insertable by a steward), while the movement insights dashboard page documents anonymized cross-union trends with a minimum of 5 organizations per trend, no individual organization identifiable and a consent status, reads movementTrends and dataAggregationConsent, and admits only the MOVEMENT_INSIGHTS_ROLES office list, so the API path serves none of the consent, minimum-population or office controls its name and its dashboard describe and returns organization rows under a movement-trends name.'),
]

export const DECISIONS = [
  {
    id: 'UE-INST-ML-MEMBER-RISK-SCORING',
    status: 'OUTSTANDING',
    question: 'May the union score individual members for churn risk from their case history, which office may read and act on a named member score, what must members be told, and how long may a score and its case-derived features be kept?',
    sourceState: 'The churn-risk routes compute and store a per-member risk score and the case-derived features behind it and return the member name to any officer; no source names a purpose, a notice to members, a consent record, a retention period or the office that may act on a score, and no adopted decision does.',
    softwareOwners: [AI_CAP],
  },
  {
    id: 'UE-INST-ML-EXTERNAL-QUERY-DISCLOSURE',
    status: 'OUTSTANDING',
    question: 'What organization, member and case information may be sent to the external AI query service, who may ask it questions, and how is the answer it returns recorded and reviewed before it is relied on?',
    sourceState: 'The natural-language query route sends a steward question, an unrestricted context value, the organization id and a shared bearer token to the service at AI_SERVICE_URL and returns whatever it answers; no source states a disclosure rule, a data class, a consent basis or a durable record of the questions, and no adopted decision does.',
    softwareOwners: [AI_CAP],
  },
]

/* ------------------------------------------------------------------------------------------------------------ */
/* risk screens                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

const FACTORY_ORG_SCREEN = {
  ANALYTICS_CROSSES_BOUNDARY: {
    reason: 'The generic factory adds the organization predicate taken from the authenticated session to the query of an orgScoped table and analytics_metrics carries an organization column, so the rows returned or written are those of the caller organization only; no parent, sibling or other organization is read.',
    evidence: [{ ref: CRUD_FACTORY, quote: 'conditions.push(eq(orgCol, organizationId));' }],
  },
}

export const RISK_SCREENS = {
  'ml/query/route.ts|POST': {
    RLS_ASSUMED_FROM_DB_CLIENT: {
      reason: 'The route reads and writes no database table: the only function it takes from the security middleware is logApiAuditEvent, which writes a logger line, so the shared database client imported elsewhere in that file is not used by this operation.',
      evidence: [{ ref: API_SECURITY, quote: "logger.info('API_SECURITY_AUDIT', {" }],
    },
  },
  'metrics/route.ts|GET': FACTORY_ORG_SCREEN,
  'metrics/route.ts|POST': FACTORY_ORG_SCREEN,
  'movement-insights/trends/route.ts|GET': FACTORY_ORG_SCREEN,
  'movement-insights/trends/route.ts|POST': FACTORY_ORG_SCREEN,
}

/* ------------------------------------------------------------------------------------------------------------ */
/* generic CRUD facades                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

const MEMBER_FEEDBACK_PROFILE = {
  persona: 'Member reading their own membership row, and steward or above reading the organization member roster, through a route named member ai-feedback',
  owner: 'organization_members rows of the organization, the compatibility membership projection; a member row names the user, the role and the personal contact details.',
  sens: 'Member name, e-mail, phone, role, status, department, hire date, membership number, seniority, exemption reason and metadata',
  priv: (method) => (method === 'GET'
    ? 'A steward or above reads the e-mail, phone, role, hire date and membership number of every member of the organization, and a member reads their own full row including the exemption reason, under a route name that advertises member feedback on AI output.'
    : 'The write is refused by the CRUD governance table, so no membership row or role can be created or changed through the route.'),
  does: (method, _model, floor) => ({
    GET: `Returns organization_members rows of the organization at a role floor of ${floor}, narrowed to the caller own row below steward; it is the member roster served under the name ai-feedback and records no feedback of any kind.`,
    POST: `Refuses to insert an organization_members row: the route declares writeRole ${floor} and the CRUD governance table classifies organization_members READ_ONLY, so the write is refused with 403; no feedback is stored.`,
  })[method],
  future: 'Retire the route or serve the member feedback on AI output that its name advertises through the AI feedback route that stores it, and move the member roster read to the membership authority readers.',
  gate: 13,
  deps: [14],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [],
  def: () => ['DEF-0B1-CRUD-FACADE-ORG-MEMBERS'],
  extraEv: (a) => [
    a.tbl('privacy', 'organizationMembers', /email: text\('email'\)\.notNull\(\),/),
    a.tbl('privacy', 'organizationMembers', /exemptionReason: text\('exemption_reason'\),/),
  ],
  inferences: () => [{ claim: 'defect', statement: 'The route file holds only the crudRoutes configuration; a search of apps/union-eyes finds no handler under member/ai-feedback that reads or stores feedback on AI output, which the application stores through the ai/feedback route.' }],
  reqRead: 'Audit reads of the member roster once the readers are named; it holds e-mail and phone numbers.',
}

const analyticsProfile = (advertised, nameDefect) => ({
  persona: `Organization member reading stored analytics metric rows, and steward or above inserting one, through a route named for ${advertised}`,
  owner: 'analytics_metrics rows of the organization: metric type, name, value, unit, period, comparison value, trend and a free metadata JSON column.',
  sens: 'Organization analytics metric rows, including a metadata JSON column that the application writer fills with the claim identifiers a metric was computed from',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization receives each stored metric row including its metadata column, which the metrics writer in the application fills with claim identifiers.'
    : 'A steward-supplied metric row, including its value, trend and metadata, is stored as supplied and then returned to every member as an organization metric.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Returns the stored analytics_metrics rows of the caller organization at a role floor of ${floor}, paged; the route name advertises ${advertised} and nothing is computed.`
    : `Inserts a caller-supplied analytics_metrics row for the organization and audits it at a role floor of ${floor}; the route name advertises ${advertised} and nothing is computed.`),
  future: 'Compute analytics from source tables behind a purpose-built handler authorized by a kernel decision, withhold identifiers the reader does not need, and close the generic write.',
  gate: GATE,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [],
  def: (method) => ['DEF-0B2-ANALYTICS-CRUD-FACADE', nameDefect, ...(method === 'GET' ? ['DEF-0B3-METRICS-CLAIM-IDS-IN-MEMBER-READ'] : [])],
  extraEv: (a) => [
    a.tbl('privacy', 'analyticsMetrics', /metadata: jsonb\('metadata'\),/),
    a.tbl('behavior', 'analyticsMetrics', /metricValue: numeric\('metric_value'\)\.notNull\(\),/),
  ],
  inferences: () => [{ claim: 'defect', statement: `The route file holds only the crudRoutes configuration over analyticsMetrics; no handler under it computes ${advertised}.` }],
  reqRead: 'Reads of stored metrics need no audit record; a computed analytic must record the data it was computed from.',
})

const ML_FACADE_ADVERTISED = {
  'ml/monitoring/drift/route.ts': 'model drift monitoring',
  'ml/monitoring/usage/route.ts': 'model usage monitoring',
  'ml/predictions/claim-outcome/route.ts': 'a claim outcome prediction',
  'ml/predictions/timeline/route.ts': 'a case timeline forecast',
  'ml/predictions/workload-forecast/route.ts': 'a steward workload forecast',
  'ml/recommendations/route.ts': 'recommendations',
}

const mlFacadeProfile = (advertised) => ({
  persona: `Organization member reading stored ml_predictions rows, and steward or above inserting one, through a route named for ${advertised}`,
  owner: 'ml_predictions rows of the organization: prediction type, date, predicted value, bounds, confidence, horizon and granularity.',
  sens: 'Stored prediction rows of every prediction type: type, date, value, bounds, confidence, horizon and granularity; the declared row holds no member or case identifier',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization receives every stored prediction row regardless of its type, including rows that other routes store for SLA breach risk and churn.'
    : 'A steward-supplied row, with a prediction type, value, bounds and confidence the caller chose, is stored with no provenance and is then read as a model output by the SLA list, the alerting sweep and the insights generator.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Lists the stored ml_predictions rows of the caller organization of every type at a role floor of ${floor}, paged; the route name advertises ${advertised} and nothing is filtered by type, monitored or computed.`
    : `Inserts a caller-supplied ml_predictions row for the organization and audits it atomically at a role floor of ${floor}; the route name advertises ${advertised} and nothing is predicted.`),
  future: 'Serve each advertised function through a purpose-built handler that computes it and records its provenance, and refuse caller-supplied prediction rows.',
  gate: GATE,
  deps: [13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  decisions: [],
  def: (method) => [DEF_PRED_FACADE, DEF_PRED_SHAPE, ...(method === 'POST' ? [DEF_PRED_FORGE] : [])],
  extraEv: (a) => [
    a.tbl('behavior', 'mlPredictions', /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/),
    a.tbl('defect', 'mlPredictions', /predictedValue: decimal\("predicted_value"\)\.notNull\(\),/),
    a.sch('defect', LEGACY_PREDICTIONS_SQL, 'model_name TEXT NOT NULL,'),
    a.sch('defect', LEGACY_PREDICTIONS_SQL, 'target_date TIMESTAMP NOT NULL,'),
    a.sch('defect', PLATFORM_0019, 'ADD COLUMN IF NOT EXISTS "prediction_date" timestamp,'),
  ],
  inferences: () => [
    { claim: 'defect', statement: `The route file holds only the crudRoutes configuration over mlPredictions; no handler under it computes or filters ${advertised}.` },
    { claim: 'defect', statement: 'The realtime alerting sweep (services/observability/realtime-alerting-service.ts) counts sla_breach_risk rows with predicted_value at or above 0.80 created in the last 60 minutes under withSystemContext, the insights generator (lib/ai/insights-generator.ts) reads the latest 20 ml_predictions rows of the organization, and the SLA breach risk list returns rows of type sla_breach_risk; none checks which route stored the row.' },
  ],
  reqRead: 'Reads of stored prediction rows need no audit record; a computed prediction must record the model and data it was computed from.',
})

/* ------------------------------------------------------------------------------------------------------------ */
/* metrics/operational                                                                                            */
/* ------------------------------------------------------------------------------------------------------------ */

const base = (a) => ({ service: `${API}${a.route} (${a.method})` })

const operationalGet = (a) => mk({
  ...base(a),
  persona: 'Any signed-in user of any organization, or the internal AI service presenting the shared service key, reading operational counts for observability dashboards',
  authn: 'Either the x-service-key header equal to the AI_SERVICE_KEY environment variable (compared with ===), or requireApiAuth() called with no options, which resolves a signed-in user and, with no orgScoped or roles option, requires neither an organization nor a role.',
  cat: 'SESSION_ONLY',
  authz: 'None beyond being signed in: the route passes no organization, role or entitlement option to requireApiAuth and no authorizeAction call is made, so kernelAuthorization stays false; the service key is one shared secret that is not tied to any organization.',
  tenant: 'None: the claims and claim_updates reads carry no organization predicate and run through the shared database client outside any organization context, so every organization is counted together.',
  owner: 'No stored resource of the caller: the response is counts computed over claims and claim_updates of every organization plus the job queue statistics.',
  sens: 'Platform-wide counts of claims, status changes in 24 hours, stale claims, error-like claim updates and job queue depth',
  priv: 'No personal data is returned, but the volume and workload of every organization is disclosed to any signed-in caller, and a failing database or queue error text is returned in the 500 body.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record, and the cross-organization read is not logged.',
  reqAudit: 'Record each platform-wide read with the mandate that authorized it once a platform-staff mandate is named; reads limited to the caller organization need no audit record.',
  does: 'Authenticates the caller by service key or session, then counts every claim, the claim status changes of the last 24 hours, claims not closed or resolved that were last updated more than 5 days ago and claim updates whose message contains error or failed, adds the job queue depth, replaces any failed read by 0 and returns the figures as request_count, error_rate, workflow_transition_rate, queue_depth and sla_violations.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [9, 13],
  future: 'Restrict the route to a named platform-operator mandate (or scope every count to the caller organization), compare the service key in constant time, return real request and error figures from the observability system, and answer a failed read as an error instead of zero.',
  dec: ['UE-INST-PLATFORM-STAFF-MANDATE'],
  cross: 'The claims and claim_updates counts are computed over every organization with no organization predicate and returned to any signed-in caller or holder of the service key; reachable cross-tenant data is not authorized by being reachable.',
  ev: [
    a.h('authentication', "const isServiceRequest = !!svcKey && req.headers.get('x-service-key') === svcKey"),
    a.h('authentication', 'await requireApiAuth()'),
    a.imp('authorization', 'requireApiAuth', 'if ((options.orgScoped || options.roles?.length) && !user.organizationId) {'),
    a.h('tenantScope', 'db.select({ count: count() }).from(claims),'),
    a.tbl('tenantScope', 'claims', /organizationId: uuid\("organization_id"\)\.notNull\(\)\.references\(\(\) => organizations\.id\),/),
    a.h('mutation', '.from(claimUpdates)'),
    a.h('behavior', 'request_count: totalClaims, // lifetime claim count as proxy'),
    a.h('defect', "totalClaimsResult.status === 'fulfilled' ? totalClaimsResult.value[0]?.count ?? 0 : 0"),
    a.h('defect', "{ error: 'Failed to compute metrics', detail: String(err) },"),
    a.sch('defect', RLS_FOUNDATION, 'rolbypassrls = true, so it ignores RLS entirely regardless of what'),
  ],
  inf: [
    { claim: 'defect', statement: 'lib/api/secret-compare.ts exports secretsEqual, a constant-time comparison of two secrets, and the route does not import it; the route imports db from @/db/db, the shared client, and calls no withRLSContext or withSystemContext, so the reads run on the ordinary pooled connection.' },
  ],
  def: [DEF_OPS_ANY_CALLER, DEF_OPS_PROXY, DEF_OPS_KEY],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* ml/monitoring/alerts and ml/monitoring/metrics                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

const ALERTS_FUTURE = 'Compute alerts from measured model performance with stable alert ids, define the acknowledgement table with an organization-scoped key, acknowledge by the id the list returns, and decide which office reads and acknowledges model alerts.'

const alertsGet = (a) => mk({
  ...base(a),
  persona: 'Organization member listing model monitoring alerts for the AI models the organization runs',
  authn: 'Entra session resolved by withRoleAuth, which loads the current user and the organization of that user.',
  cat: 'ROLE_FLOOR',
  authz: "withRoleAuth('member') role-title floor, a per-user rate limit, an organization presence check, the ML monitoring feature flag and enforceAISafety; none is a kernel decision about the alert data.",
  tenant: 'The three CTE reads carry WHERE organization_id equal to the session organization; the acknowledgement join carries none and the read goes through the shared database client, not a tenant transaction.',
  owner: 'Derived alert rows computed from ml_predictions and claims of the organization joined with ml_alert_acknowledgments, a table the repository does not define.',
  sens: 'Alert severity, model name, message and acknowledgement user id and time',
  priv: 'Every member receives the alerts and the id and time of the user who acknowledged each, at the member floor.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of alerts need no audit record; record who acknowledged an alert when the office that may read it is named.',
  does: 'Rate limits, checks the organization and feature gate, then runs one SQL statement that builds performance, confidence and drift alerts for the organization and left joins the acknowledgements, returning up to 50 alerts and a severity summary; the statement names columns and a table the repository does not define and is not valid SQL, so on a database built from the repository the read ends in the 500 branch.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: ALERTS_FUTURE,
  dec: ['UE-INST-OBSERVABILITY-ALERT-OWNER'],
  ev: [
    a.h('authorization', "withRoleAuth('member'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.ML_MONITORING, { userId, organizationId });'),
    a.h('tenantScope', 'WHERE organization_id = ${organizationScopeId}'),
    a.h('mutation', 'FROM ml_predictions'),
    a.h('behavior', "'Data drift detected: Case Complexity PSI = 0.28 (threshold: 0.25)' as message,"),
    a.h('behavior', 'HAVING COUNT(*) > 100 -- Only if we have sufficient data'),
    a.h('defect', 'LEFT JOIN ml_alert_acknowledgments ma ON ma.alert_id = all_alerts.alert_id'),
    a.h('defect', "'perf_' || model_type || '_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') as alert_id,"),
    a.h('defect', 'alert_timestamp,'),
    a.h('defect', 'END as model_name,'),
    a.sch('defect', ML_SCHEMA, /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/, { symbol: 'mlPredictions', absentColumns: ['model_type', 'predicted_at', 'prediction_correct', 'confidence_score'] }),
  ],
  inf: [
    { claim: 'defect', statement: 'A search of the repository for ml_alert_acknowledgments finds only this route, its tests and a documentation inventory; no schema file or migration creates the table. The two SELECT lists that end with END as model_name, directly before FROM, are a SQL syntax error, and the outer SELECT names alert_timestamp, which neither CTE selects.' },
    { claim: 'defect', statement: 'The route file imports db from @/db for the GET and withRLSContext for the POST only; the GET runs db.execute outside any tenant transaction.' },
  ],
  def: [DEF_ALERT_SQL, DEF_ALERT_FINDING, DEF_ALERT_JOIN],
})

const alertsPost = (a) => mk({
  ...base(a),
  persona: 'Steward acknowledging a model monitoring alert of the organization',
  authn: 'Entra session resolved by withRoleAuth, which loads the current user and the organization of that user.',
  cat: 'ROLE_FLOOR',
  authz: "withRoleAuth('steward') role-title floor plus an organization and user presence check; no feature gate or safety check is applied and the decision is not a kernel decision.",
  tenant: 'The insert and the conflict update run inside withRLSContext for the session organization, and the update applies only to the row held by the same organization; the conflict key is alert_id alone.',
  owner: 'ml_alert_acknowledgments rows (alert id, organization, acknowledged flag, acknowledging user and time), a table the repository does not define.',
  sens: 'The acknowledging user id and time against an alert id',
  priv: 'The acknowledgement names the acknowledging steward and is shown to every member in the alert list.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'persistAtomicAudit is given the transaction handle of withRLSContext and writes ml.alert.acknowledge in the same transaction as the acknowledgement, only when the statement returned a row; a statement that matches no row answers 409 and writes no audit record.',
  reqAudit: 'Keep the in-transaction audit record and add the previous acknowledgement state to it.',
  does: 'Validates the alert id as a GUID, inserts an acknowledgement for the organization or updates its own existing one, writes the audit record in the same transaction and answers success with the acknowledging user and time; a conflicting row held by another organization answers 409; the table is not defined in the repository, so on a database built from it the insert fails with a missing relation.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: ALERTS_FUTURE,
  dec: ['UE-INST-OBSERVABILITY-ALERT-OWNER'],
  ev: [
    a.h('authorization', "withRoleAuth('steward'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('tenantScope', 'const acknowledged = await withRLSContext({ organizationId: organizationScopeId }, async (tx) => {'),
    a.h('tenantScope', 'WHERE ml_alert_acknowledgments.organization_id = ${organizationScopeId}'),
    a.h('mutation', 'INSERT INTO ml_alert_acknowledgments ('),
    a.h('mutation', 'ON CONFLICT (alert_id)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'ml.alert.acknowledge',"),
    a.h('behavior', "return standardErrorResponse(ErrorCode.CONFLICT, 'This alert is already acknowledged elsewhere and cannot be changed');"),
    a.local('defect', 'mlMonitoringAlertsSchema', "alertId: z.guid('Invalid alertId'),"),
  ],
  inf: [
    { claim: 'defect', statement: 'The zod schema mlMonitoringAlertsSchema is declared at module scope with alertId z.guid; the alert ids the GET builds are the text perf_, conf_ or drift_complexity_ followed by a timestamp and are not GUIDs.' },
    { claim: 'defect', statement: 'A search of the repository for ml_alert_acknowledgments finds only this route, its tests and a documentation inventory; no schema file or migration creates the table.' },
  ],
  def: [DEF_ALERT_SQL, DEF_ALERT_ACK],
})

const monitoringMetricsGet = (a) => mk({
  ...base(a),
  persona: 'Organization member reading accuracy, precision, recall, confidence and status figures for the AI models the organization runs',
  authn: 'Entra session resolved by withRoleAuth, which loads the current user and the organization of that user.',
  cat: 'ROLE_FLOOR',
  authz: "withRoleAuth('member') role-title floor, a per-user rate limit, an organization presence check, the ML monitoring feature flag and enforceAISafety; none is a kernel decision about the model figures.",
  tenant: 'The ml_predictions subqueries carry WHERE organization_id equal to the session organization; the model_metadata join carries none and the read goes through the shared database client, not a tenant transaction.',
  owner: 'Derived per-model figures computed from ml_predictions of the organization joined to model_metadata on a model_name column the table does not have.',
  sens: 'Model accuracy, precision, recall, F1, 24-hour prediction count, average confidence, health status and trend per model',
  priv: 'No personal data; every member receives the model quality figures of the organization.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of model figures need no audit record.',
  does: 'Rate limits, checks the organization and feature gate and runs one SQL statement that counts the last 24 hours of predictions for four model types, derives accuracy, status and trend and joins model metadata, substituting 0.80 for missing precision, recall and F1; the statement names columns the declared tables do not have, so on a database built from the repository the read ends in the 500 branch.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: 'Compute model figures from measured outcomes recorded with provenance, report unmeasured values as unmeasured instead of a healthy default, scope every join by organization and read through a tenant transaction.',
  dec: [],
  ev: [
    a.h('authorization', "withRoleAuth('member'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.ML_MONITORING, { userId, organizationId });'),
    a.h('tenantScope', 'WHERE organization_id = ${organizationScopeId}'),
    a.h('mutation', 'FROM ml_predictions'),
    a.h('behavior', 'COALESCE(mm.precision, 0.80) as precision,'),
    a.h('defect', 'LEFT JOIN model_metadata mm ON mm.model_name = rp.model_name'),
    a.h('defect', "WHEN rp.accuracy >= 0.85 THEN 'healthy'"),
    a.h('defect', 'lastUpdated: row.last_evaluated_at || new Date().toISOString(),'),
    a.h('defect', "status: row.status || 'healthy',"),
    a.sch('defect', ML_SCHEMA, /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/, { symbol: 'mlPredictions', absentColumns: ['predicted_at', 'prediction_correct', 'assignment_accepted'] }),
    a.sch('defect', ML_SCHEMA, /modelType: varchar\("model_type", \{ length: 50 \}\)\.notNull\(\),/, { symbol: 'modelMetadata', absentColumns: ['model_name', 'precision', 'recall', 'f1_score', 'last_evaluated_at', 'baseline_accuracy', 'baseline_confidence'] }),
  ],
  inf: [
    { claim: 'defect', statement: 'The route imports db from @/db and calls db.execute with no withRLSContext or tenant transaction; the model_metadata join has no organization_id condition.' },
  ],
  def: [DEF_MON_METRICS_SQL, DEF_MON_METRICS_INVENTED],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* ml/predictions/churn-risk                                                                                      */
/* ------------------------------------------------------------------------------------------------------------ */

const CHURN_AUTHN = 'Entra session resolved by withRoleAuth, then the user and organization are resolved a second time with getCurrentUser inside the handler (the context argument is ignored).'
const CHURN_AUTHZ = "withRoleAuth('officer') role-title floor, a per-user rate limit and enforceAISafety (which checks only that a user id and an organization id exist); no feature gate is applied and no kernel decision is made."
const CHURN_FUTURE = 'Decide whether named-member churn scoring is permitted at all and by whom, replace the synthetic network with a trained and versioned model whose provenance is recorded, run the SQL against the real schema, read the user and organization from the wrapper context, and write the invocation audit in the data transaction after validation.'

const churnModelEv = (a) => [
  a.svc('defect', CHURN_MODEL, 'await syntheticPreTrain(modelInstance);', 'loadChurnModel'),
  a.svc('defect', CHURN_MODEL, 'syntheticLabels.push(Math.random() > 0.5 ? 1 : 0);', 'syntheticPreTrain'),
  a.svc('defect', CHURN_MODEL, 'const confidence = Math.abs(churnProbability - 0.5) * 2;', 'predictChurnRisk'),
]

const churnGet = (a) => mk({
  ...base(a),
  persona: 'Officer listing the stored churn-risk predictions of the members of the organization',
  authn: CHURN_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: CHURN_AUTHZ,
  tenant: 'The ml_predictions read carries p.organization_id equal to the second-resolved session organization; the profiles join and the per-member claims subquery carry no organization predicate and the read goes through the shared database client, not a tenant transaction.',
  owner: 'ml_predictions rows of type churn_risk (a features_used JSON written by the POST) joined to the billing profile row of each member and to the claims of that member.',
  sens: 'Member name, risk score and level, contributing factors, recommended interventions, days since last activity, union tenure and total case count per named member',
  priv: 'An officer receives a named list of members with a churn risk level and the case-derived factors behind it; the member is not told and no consent or purpose is recorded.',
  mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
  auditDetail: 'The GET writes an audit_logs row on every call through auditAIInvocation and auditLog, before the organization is checked and in its own transaction, and then logs a line with logger.info; the manifest read-only classification is wrong for a handler that writes.',
  reqAudit: 'Record named-member reads in the data transaction with the purpose and the reader once the office that may read churn scores is named.',
  does: 'Rate limits, writes an AI invocation audit row, reads the stored churn_risk rows of the last 7 days with the member profile name and a per-member claim count, filtered by an optional risk level and a caller limit, and returns the predictions with a summary and aiGenerated reviewRequired metadata; the SQL names columns the repository does not define, so on a database built from it the read ends in the 500 branch.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: CHURN_FUTURE,
  dec: ['UE-INST-ML-MEMBER-RISK-SCORING'],
  corr: [{ field: 'mutating', manifest: 'read-only GET, audit NOT_APPLICABLE:READ', actual: 'The GET writes an AI invocation audit row on every call before any check, so the read-only classification is wrong.' }],
  ev: [
    a.h('authorization', "withRoleAuth('officer'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('tenantScope', 'p.organization_id = ${organizationId}'),
    a.h('mutation', 'FROM ml_predictions p'),
    a.h('audit', 'const auditRefId = await auditAIInvocation({'),
    a.svc('mutation', AUDIT_LOGGER, 'return db.insert(auditLogs).values({', 'auditLog'),
    a.h('behavior', "p.model_type = 'churn_risk'"),
    a.h('privacy', 'prof.full_name as member_name,'),
    a.h('defect', 'WHERE member_id = p.user_id'),
    a.h('defect', "const limit = parseInt(searchParams.get('limit') || '50');"),
    a.sch('defect', ML_SCHEMA, /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/, { symbol: 'mlPredictions', absentColumns: ['user_id', 'model_type', 'predicted_at', 'features_used'] }),
    a.sch('defect', PROFILES_SCHEMA, /userId: text\("user_id"\)\.notNull\(\)\.unique\(\),/, { symbol: 'profilesTable', absentColumns: ['full_name', 'union_tenure_years', 'organization_id'] }),
    ...churnModelEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The route imports no guardAiFeature, while the sibling model routes (sla-breach-risk, ml/query, monitoring) call it; enforceAISafety in @nzila/policies reads only the user id, organization id, requested entity organization and canMutate, so the declared userRole officer and dataClass confidential are labels.' },
    { claim: 'defect', statement: 'No code calls saveChurnModel and the repository holds no saved model directory, so loadChurnModel always reaches the synthetic pre-training branch.' },
  ],
  def: [DEF_CHURN_SYNTHETIC, DEF_CHURN_SHAPE, DEF_CHURN_PROFILING, DEF_CHURN_AUDIT, DEF_CHURN_SCOPE],
})

const churnPost = (a) => mk({
  ...base(a),
  persona: 'Officer generating a churn-risk prediction for one named member of the organization',
  authn: CHURN_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: CHURN_AUTHZ,
  tenant: 'The member feature query carries p.organization_id equal to the second-resolved session organization and the insert runs inside withRLSContext for it; the memberId comes from the body and is checked only by that query.',
  owner: 'A new ml_predictions row of type churn_risk holding the case-derived features, the risk level and the interventions for the named member.',
  sens: 'Member name, tenure, age, claim history features (inactivity, resolution rate, simulated satisfaction, withdrawn count), risk score and level, factors and interventions',
  priv: 'The prediction and the case-derived features behind it are stored for a named member and returned to the officer; the member is not told and no consent or purpose is recorded.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The prediction insert and persistAtomicAudit (ml.churn_risk.predict) share one withRLSContext transaction; a separate AI invocation audit row is written earlier through auditAIInvocation, before the body is validated, outside that transaction.',
  reqAudit: 'Keep the in-transaction audit record, record the model version, its training provenance and the purpose, and write the invocation record only for a validated call.',
  does: 'Rate limits, writes an AI invocation audit row, validates the member id as a GUID, runs a feature query over profiles and claims for that member, scores it with the synthetic network, derives factors and interventions, stores the prediction and its audit record in one transaction and returns the named prediction marked aiGenerated reviewRequired; the SQL names columns the repository does not define, so on a database built from it the call ends in the 500 branch.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: CHURN_FUTURE,
  dec: ['UE-INST-ML-MEMBER-RISK-SCORING'],
  ev: [
    a.h('authorization', "withRoleAuth('officer'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('authentication', 'const user = await getCurrentUser();'),
    a.h('tenantScope', 'AND p.organization_id = ${organizationScopeId}'),
    a.h('tenantScope', 'await withRLSContext({ organizationId: organizationScopeId }, async (tx) => {'),
    a.h('mutation', 'INSERT INTO ml_predictions ('),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'ml.churn_risk.predict',"),
    a.h('behavior', 'const mlPrediction = await predictChurnRisk({'),
    a.h('privacy', '-- Satisfaction (simulated)'),
    a.h('defect', "COUNT(*) FILTER (WHERE c.status = 'withdrawn') as negative_feedback_count"),
    a.h('defect', 'isPredictionFromML: true'),
    a.h('defect', 'const auditRefId = await auditAIInvocation({'),
    a.h('defect', 'Priority outreach call within 48 hours'),
    a.sch('defect', ML_SCHEMA, /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/, { symbol: 'mlPredictions', absentColumns: ['user_id', 'model_type', 'prediction_value', 'confidence_score', 'predicted_at', 'response_time_ms', 'features_used'] }),
    a.sch('defect', PROFILES_SCHEMA, /userId: text\("user_id"\)\.notNull\(\)\.unique\(\),/, { symbol: 'profilesTable', absentColumns: ['full_name', 'union_tenure_years', 'member_age', 'organization_id'] }),
    a.sch('defect', CLAIMS_SCHEMA, /claimNumber: varchar\("claim_number", \{ length: 50 \}\),/, { symbol: 'claims', absentColumns: ['resolution_notes'] }),
    a.sch('defect', CLAIMS_SCHEMA, /"submitted",/, { symbol: 'claimStatusEnum', absentColumns: ['withdrawn'] }),
    ...churnModelEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The route imports no guardAiFeature, while the sibling model routes call it; enforceAISafety in @nzila/policies reads only the user id, organization id, requested entity organization and canMutate, so the declared userRole officer and dataClass confidential are labels.' },
    { claim: 'defect', statement: 'No code calls saveChurnModel and the repository holds no saved model directory, so loadChurnModel always reaches the synthetic pre-training branch.' },
  ],
  def: [DEF_CHURN_SYNTHETIC, DEF_CHURN_SHAPE, DEF_CHURN_PROFILING, DEF_CHURN_AUDIT, DEF_CHURN_SCOPE],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* ml/predictions/sla-breach-risk and feedback                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const SLA_AUTHN = 'Entra session resolved by withApi, with the grievance_case_suite entitlement and the AI rate limit.'
const SLA_FUTURE = 'Compute the score from case data the server reads rather than caller-supplied features, record the model version and provenance of every prediction against the case it is about, bind feedback to the version and the case, run each statement within the privileges the runtime role holds, and write the usage event in the data transaction.'

const slaPost = (a) => mk({
  ...base(a),
  persona: 'Steward submitting case features and receiving an SLA breach risk score',
  authn: SLA_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: "withApi minRole steward plus the grievance_case_suite entitlement, the GRIEVANCE_TRIAGE feature flag and enforceAISafety; these are role, billing and rollout gates, not a kernel decision about the case.",
  tenant: 'The model_metadata read and the prediction insert run inside withRLSContext for the session organization and the read carries an organization predicate; the case id in the body is not checked against any case or organization.',
  owner: 'A new ml_predictions row of type sla_breach_risk and, on first use of a version, a model_metadata row; the case id is not stored on either.',
  sens: 'A caller-chosen case id, the case features a steward typed, a score with bounds and a model object',
  priv: 'No member data is read; the response and the audit record carry the case id and features the caller supplied.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The model row (when first used), the prediction and persistAtomicAudit (ml.sla_breach.predict) share one withRLSContext transaction; the audit details carry the case id, the model version and the score.',
  reqAudit: 'Keep the in-transaction audit record and add the case it is about once the case is verified.',
  does: 'Checks the feature flag and safety gate, computes a probability from literal weights over the caller-supplied features, finds or inserts the model_metadata row for the caller-named version, inserts the prediction with constant confidence 0.78 and bounds of plus and minus 0.08, writes the audit record in the same transaction and returns the score, a model object and the confidence.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: SLA_FUTURE,
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'steward' },"),
    a.h('authorization', "entitlement: 'grievance_case_suite',"),
    a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {'),
    a.h('tenantScope', 'const { activeModel, prediction } = await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('tenantScope', 'eq(modelMetadata.organizationId, organizationId),'),
    a.h('mutation', '.insert(mlPredictions)'),
    a.h('mutation', '.insert(modelMetadata)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'ml.sla_breach.predict',"),
    a.h('behavior', 'const score = computeSlaBreachProbability(body.features);'),
    a.local('behavior', 'computeSlaBreachProbability', "const priorityWeight = input.priority === 'urgent' ? 0.25"),
    a.h('defect', "confidence: '0.78',"),
    a.h('defect', "scoring: 'heuristic_v1',"),
    a.h('defect', 'trainedAt: activeModel.trainedAt,'),
    a.h('defect', "const selectedVersion = body.modelVersion ?? 'sla-risk-v1';"),
    a.h('defect', 'caseId: body.caseId,'),
    a.tbl('defect', 'mlPredictions', /predictionType: varchar\("prediction_type", \{ length: 50 \}\)\.notNull\(\),/, { absentColumns: ['caseId', 'case_id', 'claim_id'] }),
    a.sch('defect', LEGACY_PREDICTIONS_SQL, 'model_name TEXT NOT NULL,'),
    a.sch('defect', LEGACY_PREDICTIONS_SQL, 'target_date TIMESTAMP NOT NULL,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The zod schema bodySchema (module scope) types caseId as z.guid() and featureRefs as a list of strings of at least two characters; the route reads no claims, grievances or cases table. The realtime alerting sweep (services/observability/realtime-alerting-service.ts) counts sla_breach_risk rows with predicted_value at or above 0.80 created in the last 60 minutes under withSystemContext.' },
  ],
  def: [DEF_SLA_HEURISTIC, DEF_SLA_CASE, DEF_SLA_VERSION, DEF_PRED_SHAPE, DEF_PRED_FORGE],
})

const slaGet = (a) => mk({
  ...base(a),
  persona: 'Organization member listing the latest stored SLA breach risk predictions',
  authn: SLA_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: 'withApi minRole member plus the grievance_case_suite entitlement; no feature flag and no safety check is applied to this method, and the decision is not a kernel decision.',
  tenant: 'The read carries an organization predicate for the session organization and type sla_breach_risk and runs through the shared database client rather than a tenant transaction.',
  owner: 'ml_predictions rows of type sla_breach_risk of the organization.',
  sens: 'Stored scores, bounds, confidence, horizon and granularity of SLA breach risk predictions',
  priv: 'Every member of the organization receives the stored predictions; the rows carry no case identifier.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of stored predictions need no audit record.',
  does: 'Returns the latest 25 sla_breach_risk prediction rows of the organization ordered by creation time, whoever stored them.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: 'Apply the feature gate and safety check the POST applies, and list predictions with the case and model provenance each was made with.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'member' },"),
    a.h('tenantScope', 'eq(mlPredictions.organizationId, organizationId),'),
    a.h('mutation', '.from(mlPredictions)'),
    a.h('behavior', '.limit(25);'),
    a.h('defect', 'async ({ organizationId }) => {'),
  ],
  inf: [
    { claim: 'defect', statement: 'The POST of this file and both methods of the feedback route call guardAiFeature and enforceAISafety; this GET calls neither, and the same table accepts caller-chosen rows of this type through the generic prediction routes.' },
  ],
  def: [DEF_SLA_GET_GATE, DEF_PRED_FORGE],
})

const feedbackPost = (a) => mk({
  ...base(a),
  persona: 'Steward recording the observed outcome of an SLA breach risk prediction',
  authn: SLA_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: 'withApi minRole steward plus the grievance_case_suite entitlement, the GRIEVANCE_TRIAGE feature flag and enforceAISafety; role, billing and rollout gates, not a kernel decision about the case.',
  tenant: 'The prediction read, the model_metadata read and insert and the update run inside withRLSContext for the session organization with organization predicates; the prediction must belong to the organization and to type sla_breach_risk, and the model version in the body is not bound to the prediction.',
  owner: 'The model_metadata row of the caller-named version (feedback statistics, a training queue of up to 200 entries and a retrain signal in its parameters JSON) and a pilot_events usage row.',
  sens: 'The steward typed outcome, resolution hours and free-text comment (up to 1000 characters), the submitting user id and the prediction values',
  priv: 'The free-text comment and the submitting user id are kept in the model parameters JSON and returned in no response, and the pilot event metadata carries the prediction id and error.',
  mut: 'ATOMIC_AUDIT_LOCAL_PART_ONLY',
  auditDetail: 'The model update and persistAtomicAudit (ml.sla_breach.feedback) share one withRLSContext transaction; the pilot_events usage insert runs afterwards through the shared client in a separate write that is awaited and not caught.',
  reqAudit: 'Keep the in-transaction audit record, bind the feedback to the prediction version and case, and write the usage event in the same transaction or tolerate its failure.',
  does: 'Checks the feature flag and safety gate, loads the prediction of the organization, finds or inserts the model_metadata row for the caller-named version, folds the observed outcome into a running error, quality score, retrain flag and training queue, updates the row, writes the audit record in the same transaction, then records a pilot event and returns the metrics; the model_metadata update is outside the privileges the runtime role holds when the canonical bootstrap flag is 1.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: SLA_FUTURE,
  dec: [],
  corr: [{ field: 'audit', manifest: 'AUDIT_DECLARED_ATOMIC:ATOMIC', actual: 'The model update and its audit record are atomic, but the pilot_events usage insert is a separate awaited write after the commit through the shared client.' }],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'steward' },"),
    a.h('authorization', "entitlement: 'grievance_case_suite',"),
    a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {'),
    a.h('tenantScope', 'const result = await withRLSContext({ organizationId }, async (tx) => {'),
    a.h('tenantScope', 'eq(mlPredictions.organizationId, organizationId),'),
    a.h('mutation', '.update(modelMetadata)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'ml.sla_breach.feedback',"),
    a.h('behavior', 'const retrainRecommended = observations >= 30 && meanAbsoluteError > 0.25;'),
    a.h('privacy', 'comment: body.comment,'),
    a.h('defect', 'await trackPilotEvent({'),
    a.h('defect', 'eq(modelMetadata.version, body.modelVersion),'),
    a.h('defect', 'const trainingDataQueue = [...previousQueue, feedbackEntry].slice(-200);'),
    a.h('defect', 'const currentParams = (activeModel.parameters ?? {}) as Record<string, unknown>;'),
    a.svc('defect', PILOT_TRACKING, 'await db.insert(pilotEvents).values({', 'trackPilotEvent'),
    a.sch('defect', ROUND58, "PERFORM ue_create_direct_org_rls_policy('pilot_events', 'organization_id', FALSE);"),
    a.sch('defect', ROUND58, /GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'model_metadata'/),
    a.svc('defect', WITH_RLS, 'await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)'),
    a.sch('defect', LEGACY_PREDICTIONS_SQL, 'model_name TEXT NOT NULL,'),
  ],
  inf: [
    { claim: 'defect', statement: 'A search of apps/union-eyes finds no reader of trainingDataQueue or retrainSignal outside this route and its tests, and the scoring function of the sibling route never reads model_metadata parameters. The storage authority register (db/rls-storage-authority/analytics-ai.ts) lists model_metadata with requiredRuntimePrivileges SELECT and INSERT and names this route as a supporting capability.' },
    { claim: 'defect', statement: 'Nothing in the handler records that a prediction already received feedback, and the parameters JSON is read and written back in the same transaction with no row lock or version column.' },
  ],
  def: [DEF_SLA_FEEDBACK, DEF_SLA_SIGNAL, DEF_SLA_VERSION, DEF_SLA_GRANT, DEF_SLA_PILOT, DEF_PRED_SHAPE],
})

const feedbackGet = (a) => mk({
  ...base(a),
  persona: 'Organization member reading the SLA prediction feedback summary and retrain signal',
  authn: SLA_AUTHN,
  cat: 'ROLE_FLOOR',
  authz: 'withApi minRole member plus the grievance_case_suite entitlement, the GRIEVANCE_TRIAGE feature flag and enforceAISafety; role, billing and rollout gates, not a kernel decision.',
  tenant: 'The read carries organization and type predicates and runs through the shared database client rather than a tenant transaction.',
  owner: 'The latest model_metadata row of type sla_breach_risk of the organization.',
  sens: 'Model version, accuracy, training time, feedback statistics, retrain signal and training queue size',
  priv: 'No member data is returned; the queue content (comments and user ids) stays in the stored row and only its size is returned.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Reads of the feedback summary need no audit record.',
  does: 'Checks the feature flag and safety gate and returns the latest sla_breach_risk model row of the organization (optionally by version) with its feedback statistics, retrain signal and training queue size.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: SLA_FUTURE,
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { minRole: 'member' },"),
    a.h('authorization', 'const blockedGet = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {'),
    a.h('tenantScope', 'eq(modelMetadata.organizationId, organizationId),'),
    a.h('mutation', '.from(modelMetadata)'),
    a.h('behavior', 'retrainSignal: (params.retrainSignal ?? null),'),
    a.h('defect', 'feedbackStats: (params.feedbackStats ?? null),'),
  ],
  inf: [
    { claim: 'defect', statement: 'A search of apps/union-eyes finds no reader of the retrain signal or the training queue other than this route and its tests.' },
  ],
  def: [DEF_SLA_SIGNAL],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* ml/query                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const queryPost = (a) => mk({
  ...base(a),
  persona: 'Steward asking a natural-language question that the platform forwards to an external AI service',
  authn: 'Entra session resolved by withRoleAuth, which loads the current user and the organization of that user.',
  cat: 'ROLE_FLOOR',
  authz: "withRoleAuth('steward') role-title floor, a per-user rate limit, an organization presence check, the ML query feature flag and enforceAISafety called with userRole member and dataClass internal; none is a kernel decision about the data the answer may draw on.",
  tenant: 'The organization id of the session is sent to the external service in a header and in the body; the service applies it, or not, outside this repository, and the route reads and writes no table itself.',
  owner: 'No stored resource: the question, context and organization id are sent to the service at AI_SERVICE_URL and its JSON answer is returned.',
  sens: 'A free-text question about claims, stewards, deadlines or settlements, an arbitrary context value, the organization id and the service bearer token (sent, not returned)',
  priv: 'The question and context may name members and cases and leave the platform for the AI service; the answer, including any sql or data fields the service returns, is spread into the response unfiltered.',
  mut: 'LOG_ONLY',
  auditDetail: 'logApiAuditEvent writes a logger.info line with the user id, the question cut to 100 characters and the confidence, after the external call; no row is written and no audit record is persisted.',
  reqAudit: 'Persist an audit record of each question and the service that answered it, in the data store, once the disclosure rule for the service is decided.',
  does: 'Rate limits, checks the organization and feature gate, posts the validated question and context to AI_SERVICE_URL/api/query with the shared bearer token and the organization id, throws on a failed response, adds up to three keyword-based follow-up suggestions and returns the service JSON with the suggestions.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [13],
  future: 'Decide what may be sent to the external service and by whom, send only the minimum, filter and record the answer, persist the audit record and verify that the service applies the organization it is given.',
  dec: ['UE-INST-ML-EXTERNAL-QUERY-DISCLOSURE'],
  corr: [{ field: 'audit', manifest: 'NOT_APPLICABLE:COMPUTE_ONLY', actual: 'The route calls an external AI service with the question and organization id and records only a logger line, so the compute-only audit classification understates the disclosure.' }],
  ev: [
    a.h('authorization', "withRoleAuth('steward'"),
    ...guardEv(a, 'withRoleAuth'),
    a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.ML_QUERY, { userId, organizationId });'),
    a.h('tenantScope', "'X-Organization-ID': organizationScopeId"),
    a.h('mutation', 'const response = await fetch(`${aiServiceUrl}/api/query`, {'),
    a.h('audit', 'logApiAuditEvent({'),
    a.svc('audit', API_SECURITY, "logger.info('API_SECURITY_AUDIT', {", 'logApiAuditEvent'),
    a.local('behavior', 'generateFollowUpSuggestions', "if (lowerQuestion.includes('claim')) {"),
    a.h('privacy', 'context: queryContext'),
    a.h('defect', "'Authorization': `Bearer ${process.env.AI_SERVICE_TOKEN}`,"),
    a.h('defect', "enforceAISafety({ origin: 'ml-query', action: 'POST', organizationId, userId, userRole: 'member', dataClass: 'internal' });"),
    a.h('defect', 'question: question.substring(0, 100),'),
    a.h('defect', '...result,'),
  ],
  inf: [
    { claim: 'defect', statement: 'The route reads the contract of the service from its own header comment (answer, data, sql, confidence, sources); a search of the repository finds no implementation of the /api/query endpoint of the service at AI_SERVICE_URL, so how it applies the organization id and what it returns for another organization is not shown by source.' },
    { claim: 'defect', statement: 'enforceAISafety in @nzila/policies reads only the user id, organization id, requested entity organization and canMutate, so the declared userRole member and dataClass internal are labels.' },
  ],
  def: [DEF_QUERY_DISCLOSURE, DEF_QUERY_AUDIT],
})

/* ------------------------------------------------------------------------------------------------------------ */
/* dispatch                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

const FACTS = {
  'metrics/operational/route.ts|GET': operationalGet,
  'ml/monitoring/alerts/route.ts|GET': alertsGet,
  'ml/monitoring/alerts/route.ts|POST': alertsPost,
  'ml/monitoring/metrics/route.ts|GET': monitoringMetricsGet,
  'ml/predictions/churn-risk/route.ts|GET': churnGet,
  'ml/predictions/churn-risk/route.ts|POST': churnPost,
  'ml/predictions/sla-breach-risk/route.ts|GET': slaGet,
  'ml/predictions/sla-breach-risk/route.ts|POST': slaPost,
  'ml/predictions/sla-breach-risk/feedback/route.ts|GET': feedbackGet,
  'ml/predictions/sla-breach-risk/feedback/route.ts|POST': feedbackPost,
  'ml/query/route.ts|POST': queryPost,
}

export function facts(a, readText) {
  const record = applyCrossTenantExposure(build(a, readText), DEFECTS)
  record.riskScreen = RISK_SCREENS[`${a.route}|${a.method}`] ?? {}
  return record
}

function build(a, readText) {
  if (a.route === 'member/ai-feedback/route.ts') return crudRecord(a, readText, MEMBER_FEEDBACK_PROFILE)
  if (a.route === 'metrics/route.ts') return crudRecord(a, readText, analyticsProfile('platform metrics', DEF_METRICS_NAME))
  if (a.route === 'movement-insights/trends/route.ts') return crudRecord(a, readText, analyticsProfile('cross-union movement trends', DEF_TRENDS_NAME))
  if (ML_FACADE_ADVERTISED[a.route]) return crudRecord(a, readText, mlFacadeProfile(ML_FACADE_ADVERTISED[a.route]))
  const build = FACTS[`${a.route}|${a.method}`]
  if (!build) throw new Error(`no ml-analytics facts for ${a.route}|${a.method}`)
  return build(a)
}
