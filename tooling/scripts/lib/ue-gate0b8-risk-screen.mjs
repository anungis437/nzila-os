/**
 * Gate 0B.8 risk-category screen. Eight recurring classes of route defect are screened on every operation of the
 * tranche. A trigger is computed from the source (the handler, the files the record cites) or from the recorded
 * mutation and audit characterization, never from the author's own say-so. A triggered category is satisfied only by a
 * defect that carries the category, or, for the categories where source can legitimately show the harm is absent, by a
 * recorded screen whose reason is backed by a quote that exists verbatim in the cited file (for row-level security, the
 * caller's own tenant transaction). A structural trigger (a GET that writes, an audit outside the data transaction) can
 * be satisfied only by a defect: it cannot be screened away.
 */
import { handlerRegion } from './ue-gate0b4-provenance.mjs'

export const RISK_CATEGORIES = [
  'SENSITIVE_SOURCE_IN_DERIVED_OUTPUT',
  'PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT',
  'ANALYTICS_CROSSES_BOUNDARY',
  'RLS_ASSUMED_FROM_DB_CLIENT',
  'AUDIT_OUTSIDE_DATA_TRANSACTION',
  'GET_WITH_SIDE_EFFECTS',
  'FABRICATED_INSTITUTIONAL_FINDING',
  'EXTERNAL_DISCLOSURE_WITHOUT_DECISION',
]

export const STRUCTURAL_CATEGORIES = ['AUDIT_OUTSIDE_DATA_TRANSACTION', 'GET_WITH_SIDE_EFFECTS']

const NON_ATOMIC_AUDITS = ['SEPARATE_AUDIT_EVENT_NOT_ATOMIC', 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', 'ATOMIC_AUDIT_LOCAL_PART_ONLY']
const CONTEXT_WRAPPERS = /withRLSContext|withSystemContext|withTenantContext|set_config|withApi\b/
const BARE_DB_IMPORT = /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@\/db['"]/
const OUTBOUND = /\bfetch\(\s*[`'"]?https?:|resend\.|sendEmail\(|sendgrid|nodemailer|stripe\.|openai|anthropic|chat\.completions|twilio|sendMail|sendBrandedEmail/i
const ANALYTICS_PATH = /stats|statistic|trend|dashboard|analytic|benchmark|aggregate|metric|insight/i
const FINDING_PATH = /compliance|jurisdiction-rules|deadline|findings|validate|attest|labour-standards|dashboard/i
const DERIVED_PATH = /export|report|summary|digest/i
const PUBLICATION_PATH = /publish|public|share|knowledge-base/i
const ORG_PREDICATE = /organization_?id|orgId|organizationId/i

/** Files whose text the screen reads: the route file and the implementation files the record cites, never a schema file. */
function implementationRefs(record) {
  return [...new Set((record.evidence ?? []).map((item) => item.ref))].filter((ref) => /\.(ts|tsx)$/.test(ref) && !/\/db\/schema\//.test(ref))
}

export function riskTriggers(record, { exists, readText }) {
  const triggers = new Map()
  const refs = implementationRefs(record).filter(exists)
  const texts = refs.map((ref) => [ref, readText(ref)])
  const routeRef = `apps/union-eyes/app/api/${record.route}`
  const routeText = exists(routeRef) ? readText(routeRef) : ''
  const handler = handlerRegion(routeText, record.method) ?? ''

  if (record.method === 'GET' && record.mutationAudit !== 'NOT_MUTATING') triggers.set('GET_WITH_SIDE_EFFECTS', `a GET handler recorded as ${record.mutationAudit}`)
  else if (record.method === 'GET' && /\.insert\(|\.update\(|\.delete\(|sql`\s*(UPDATE|INSERT|DELETE)/i.test(handler)) triggers.set('GET_WITH_SIDE_EFFECTS', 'the GET handler text contains a write')
  if (NON_ATOMIC_AUDITS.includes(record.mutationAudit)) triggers.set('AUDIT_OUTSIDE_DATA_TRANSACTION', `the audit is recorded as ${record.mutationAudit}`)
  for (const [ref, text] of texts) {
    if (BARE_DB_IMPORT.test(text) && !CONTEXT_WRAPPERS.test(text)) {
      triggers.set('RLS_ASSUMED_FROM_DB_CLIENT', `${ref} queries through the shared db import with no row-level-security or system context wrapper`)
      break
    }
  }
  for (const [ref, text] of texts) {
    if (OUTBOUND.test(text)) {
      triggers.set('EXTERNAL_DISCLOSURE_WITHOUT_DECISION', `${ref} calls an external service`)
      break
    }
  }
  if (ANALYTICS_PATH.test(record.route)) triggers.set('ANALYTICS_CROSSES_BOUNDARY', 'the route computes aggregates or a dashboard')
  if (FINDING_PATH.test(record.route)) triggers.set('FABRICATED_INSTITUTIONAL_FINDING', 'the route returns a compliance, deadline or rule finding')
  if (DERIVED_PATH.test(record.route)) triggers.set('SENSITIVE_SOURCE_IN_DERIVED_OUTPUT', 'the route produces a report or summary derived from source data')
  if (PUBLICATION_PATH.test(record.route)) triggers.set('PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT', 'the route serves published or shared content')
  return { triggers, texts }
}

export function riskCategoryProblems(record, defectsById, ctx) {
  const problems = []
  const { triggers, texts } = riskTriggers(record, ctx)
  const covered = new Set()
  for (const id of record.defects ?? []) {
    for (const category of defectsById.get(id)?.riskCategories ?? []) covered.add(category)
  }
  const screen = record.riskScreen ?? {}
  for (const [category, entry] of Object.entries(screen)) {
    if (!RISK_CATEGORIES.includes(category)) {
      problems.push(`operation ${record.id} screens an unknown risk category ${category}`)
      continue
    }
    if (STRUCTURAL_CATEGORIES.includes(category)) problems.push(`operation ${record.id} screens ${category} away; a structural trigger is satisfied only by a defect`)
    if (!triggers.has(category)) problems.push(`operation ${record.id} records a screen for ${category} that no source trigger raised`)
    if (typeof entry?.reason !== 'string' || entry.reason.length < 40) problems.push(`operation ${record.id} screen for ${category} states no reason`)
    const evidence = Array.isArray(entry?.evidence) ? entry.evidence : []
    if (evidence.length === 0) problems.push(`operation ${record.id} screen for ${category} cites no source evidence`)
    for (const item of evidence) {
      if (typeof item?.ref !== 'string' || !ctx.exists(item.ref)) problems.push(`operation ${record.id} screen for ${category} cites ${item?.ref}, which does not exist`)
      else if (typeof item.quote !== 'string' || !ctx.readText(item.ref).includes(item.quote)) problems.push(`operation ${record.id} screen for ${category} quotes a line that is not in ${item.ref}`)
    }
  }
  for (const [category, why] of triggers) {
    if (covered.has(category)) continue
    if (screen[category] && !STRUCTURAL_CATEGORIES.includes(category)) {
      if (category === 'ANALYTICS_CROSSES_BOUNDARY' && !texts.some(([, text]) => ORG_PREDICATE.test(text))) {
        problems.push(`operation ${record.id} screens ANALYTICS_CROSSES_BOUNDARY but no cited implementation file names an organization predicate`)
      }
      continue
    }
    problems.push(`operation ${record.id} raises ${category} (${why}) and has neither a defect that carries it nor a verified screen`)
  }
  return problems
}

export function riskDefectProblems(defect) {
  const problems = []
  if (defect.riskCategories === undefined) return problems
  if (!Array.isArray(defect.riskCategories) || defect.riskCategories.length === 0) problems.push(`defect ${defect.id} records an empty riskCategories list`)
  for (const category of defect.riskCategories ?? []) {
    if (!RISK_CATEGORIES.includes(category)) problems.push(`defect ${defect.id} names an unknown risk category ${category}`)
  }
  return problems
}

export function riskCoverage(defects) {
  return Object.fromEntries(RISK_CATEGORIES.map((category) => [category, defects.filter((defect) => (defect.riskCategories ?? []).includes(category)).length]))
}

const HS = 'DEF-0B8-HS-'
const ICRA = 'DEF-0B8-ICRA-'
const FED = 'DEF-0B8-FED-'
const JUR = 'DEF-0B8-JUR-'

export const DEFECT_RISK_CATEGORIES = {
  [`${HS}ANONYMOUS-REPORTER-STAMPED-IN-CREATED-BY`]: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'],
  [`${HS}INCIDENT-INJURY-WITNESS-AND-REPORTER-DATA-IN-UNTYPED-METADATA`]: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'],
  [`${HS}INCIDENT-CREATE-SILENTLY-NORMALISES-SEVERITY-TYPE-AND-DATE`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}DASHBOARD-ERROR-RETURNS-SUCCESS-WITH-CLEAN-METRICS`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}DASHBOARD-TRAINING-COMPLIANCE-IS-A-CONSTANT`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}DASHBOARD-METRICS-DERIVED-FROM-RECORD-CREATION-AND-DEFAULTS`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}TRAINING-FIGURES-READ-A-TABLE-NO-ROUTE-WRITES`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}UNMEASURED-VALUES-COERCED-TO-ZERO`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}RESOLUTION-TIME-NEEDS-DATES-NO-ROUTE-SETS`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${HS}STATS-ORGANIZATION-FILTER-FALLS-BACK-TO-ALWAYS-TRUE`]: ['ANALYTICS_CROSSES_BOUNDARY'],
  [`${HS}TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT`]: ['ANALYTICS_CROSSES_BOUNDARY'],
  [`${ICRA}EMAIL-RESULTS-SENDS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS`]: ['EXTERNAL_DISCLOSURE_WITHOUT_DECISION'],
  [`${ICRA}STEPWISE-SUBMIT-SCORES-ANY-NON-EMPTY-ANSWER-SET`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${ICRA}SHOPIFY-WEBHOOK-STORES-FULL-PAYLOAD-AND-CUSTOMER-DATA-IN-A-GLOBAL-TABLE`]: ['SENSITIVE_SOURCE_IN_DERIVED_OUTPUT'],
  [`${ICRA}SHOPIFY-WEBHOOK-QUERIES-TENANT-RLS-TABLES-WITH-NO-ORGANIZATION-CONTEXT`]: ['RLS_ASSUMED_FROM_DB_CLIENT'],
  [`${ICRA}REVIEW-AUDIT-ONLY-WHEN-A-CLAIMED-ORGANIZATION-EXISTS`]: ['AUDIT_OUTSIDE_DATA_TRANSACTION'],
  [`${FED}FEDERATION-SUBRESOURCE-PATHS-ARE-FEDERATION-ITEM-COPIES`]: ['FABRICATED_INSTITUTIONAL_FINDING', 'ANALYTICS_CROSSES_BOUNDARY'],
  [`${FED}BENCHMARK-ROUTE-IS-GENERIC-GRIEVANCE-CRUD-NOT-A-BENCHMARK`]: ['FABRICATED_INSTITUTIONAL_FINDING', 'ANALYTICS_CROSSES_BOUNDARY'],
  [`${FED}EXTERNAL-DECISION-AUDIT-SEPARATE-AND-BEST-EFFORT-IN-LEGACY-MODE`]: ['AUDIT_OUTSIDE_DATA_TRANSACTION', 'GET_WITH_SIDE_EFFECTS'],
  [`${ICRA}SYNC-OUTCOME-AUDIT-IS-WRITTEN-AFTER-THE-EFFECT-AND-ITS-FAILURE-IS-SWALLOWED`]: ['AUDIT_OUTSIDE_DATA_TRANSACTION'],
  [`${ICRA}SHOPIFY-WEBHOOK-ACKNOWLEDGES-FAILURES-WITH-200-AND-RECORDS-IGNORED-AS-PROCESSED`]: ['AUDIT_OUTSIDE_DATA_TRANSACTION'],
  [`${JUR}WCB-REPORTING-DEADLINE-SERVED-AS-ARBITRATION-DEADLINE`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}COMPLIANCE-CHECK-REPORTS-ZERO-FINDINGS-WHEN-NO-CHECK-APPLIES`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}STATUTORY-RULE-TABLES-ARE-UNVERSIONED-LITERALS-SERVED-WITH-STATUTE-CITATIONS`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}PROFILE-MINIMUM-WAGE-IS-A-PLACEHOLDER-ZERO`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}RULES-ROUTE-ACCEPTS-ANY-CODE-AND-ANSWERS-SUCCESS-WITH-NO-OR-WRONG-RULES`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}CLC-AND-DEADLINE-PATHS-ARE-BARGAINING-UNIT-CRUD-NO-VALIDATION`]: ['FABRICATED_INSTITUTIONAL_FINDING'],
  [`${JUR}KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS-ENTITLEMENT-AND-LEAVE-NO-READ-TRACE`]: ['PUBLICATION_BYPASSES_CLASSIFICATION_OR_CONSENT'],
  [`${JUR}KNOWLEDGE-BASE-ITEM-GET-INCREMENTS-VIEW-COUNT-IN-SYSTEM-CONTEXT-WITHOUT-ORG-PREDICATE`]: ['GET_WITH_SIDE_EFFECTS'],
  [`${JUR}GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK`]: ['GET_WITH_SIDE_EFFECTS', 'RLS_ASSUMED_FROM_DB_CLIENT'],
  [`${JUR}LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT`]: ['GET_WITH_SIDE_EFFECTS', 'RLS_ASSUMED_FROM_DB_CLIENT'],
  [`${JUR}LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500`]: ['RLS_ASSUMED_FROM_DB_CLIENT'],
}

const APP = 'apps/union-eyes/'
const API = `${APP}app/api/`
const rls = (route, quote) => ({
  RLS_ASSUMED_FROM_DB_CLIENT: {
    reason: 'The handler runs the service call inside withRLSContext and passes the transaction handle in, so the service default of the shared db handle is not the one used for this write; the organization context is set for the statement.',
    evidence: [{ ref: `${API}${route}`, quote }],
  },
})

/** Screens of triggered categories that no defect carries, keyed by operation id, each backed by a quote from the source. */
export const RISK_SCREENS = {
  'location/consent/route.ts|POST': rls('location/consent/route.ts', 'const consent = await withRLSContext({ organizationId }, async (tx) => {'),
  'location/consent/route.ts|DELETE': rls('location/consent/route.ts', 'await withRLSContext({ organizationId }, async (tx) => {'),
  'location/geofence/route.ts|POST': rls('location/geofence/route.ts', 'const geofence = await withRLSContext({ organizationId: trustedUnionLocalId }, async (tx) => {'),
  'icra/checkout/route.ts|POST': {
    EXTERNAL_DISCLOSURE_WITHOUT_DECISION: {
      reason: 'The only values sent to the external payment service are the assessment id, the tier id and a product label as session metadata plus the price lines; no answer, organization context or respondent field is sent, so no protected assessment content is disclosed.',
      evidence: [{ ref: `${API}icra/checkout/route.ts`, quote: 'icra_assessment_id: assessmentId,' }],
    },
  },
  'icra/report/[assessmentId]/route.ts|GET': {
    SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: {
      reason: 'The PDF is rendered only for a caller who presents the assessment bearer capability, and the response is private and not cached, so the derived report reaches the holder of the source assessment and not another party.',
      evidence: [{ ref: `${API}icra/report/[assessmentId]/route.ts`, quote: "'Cache-Control': 'private, no-store'," }],
    },
  },
  'icra/report/[assessmentId]/review/route.ts|POST': {
    SENSITIVE_SOURCE_IN_DERIVED_OUTPUT: {
      reason: 'The review summary is stored back into the assessment record and the response returns only the action and the review status, so no assessment content is copied into a response or a new record.',
      evidence: [{ ref: `${API}icra/report/[assessmentId]/review/route.ts`, quote: 'reviewStatus: updated.reviewWorkflow.status,' }],
    },
  },
}
