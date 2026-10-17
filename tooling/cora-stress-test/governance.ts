import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Ajv, type Schema } from 'ajv'

type RouteId = 'ROUTE_A' | 'ROUTE_B'
type State =
  | 'PASS'
  | 'PASS_WITH_CONDITIONS'
  | 'REDIRECT_POLICY'
  | 'REDESIGN'
  | 'BLOCKED_EVIDENCE'
  | 'FAIL'
  | 'NOT_STARTED'
type NumericResult = 'PASS' | 'REDIRECT_POLICY' | 'FAIL' | 'REDESIGN'
type Criterion = {
  metric: string
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'
  value: number
}
export interface TestRecord {
  id: string
  route: RouteId
  phase: number
  version: number
  hypothesis: string
  metricDefinitions: { id: string; unit: string }[]
  passCriteria: Criterion[] | null
  redirectCriteria: Criterion[] | null
  killCriteria: Criterion[] | null
  evidenceRequired: string[]
  owner: string | null
  participantClass: string
  plannedDecisionDate: string | null
  approval: { reference: string; at: string } | null
  lockedAt: string | null
  lockedHash: string | null
  observations: {
    at: string
    evidenceRefs: string[]
    values: { metric: string; value: number; unit: string }[]
  } | null
  decision: {
    date: string
    result: State
    numericResult: NumericResult
    memoRef: string
    evidenceRefs: string[]
    owner: string
    lockedHash: string
    conditionsClosed: boolean
  } | null
  deviations: string[]
  thresholdChanges: {
    fromVersion: number
    toVersion: number
    beforeHash: string
    afterHash: string
    approvedAt: string
    approvalRef: string
    rationale: string
    prospectiveEvidenceScope: string
  }[]
}
export interface RouteRecord {
  id: RouteId
  handoff: string
  selectionEvidence: string[]
  phases: { phase: number; disposition: State }[]
  phase4: { baselineRef: string | null; resultRef: string | null }
  phase5: { baselineRef: string | null; resultRef: string | null }
  indicators: {
    recipientDelta: boolean | null
    producerNetValuePositive: boolean | null
    problemJustifiesIntervention: boolean | null
    directSourceBaselineSufficient: boolean | null
    policyRequired: boolean | null
    evidenceRefs: string[]
  }
}
export interface Registry {
  schemaVersion: '1.0'
  executionPermission: 'NONE_GRANTED'
  inheritedGates: Record<string, string>
  organicSourceRights: Record<
    string,
    {
      state:
        | 'ESTABLISHED_ALLOWED'
        | 'ESTABLISHED_PROHIBITED'
        | 'REQUIRES_CONFIRMATION'
        | 'NOT_ESTABLISHED'
        | 'NOT_APPLICABLE'
      scope: string
      evidenceRefs: string[]
      requiredForTest: boolean | null
    }
  >
  routes: RouteRecord[]
  tests: TestRecord[]
}
type Portfolio =
  | 'APPLICATION_CONFIRMED'
  | 'NARROWER_PRODUCT'
  | 'INFRASTRUCTURE_PLUS_POLICY'
  | 'POLICY_STANDARDS_ONLY'
  | 'NO_GO'

const root = path.resolve(import.meta.dirname, '..', '..')
const docs = path.join(root, 'docs', 'categories', 'products-and-market', 'agri')
const schema: Schema = JSON.parse(
  readFileSync(path.join(docs, 'CORA_STRESS_TEST_REGISTRY.schema.json'), 'utf8'),
)
const validateSchema = new Ajv({ allErrors: true, strict: false }).compile<Registry>(schema)

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function time(value: string): number {
  requireCondition(
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ),
    `Invalid ISO timestamp: ${value}`,
  )
  const result = Date.parse(value)
  requireCondition(Number.isFinite(result), `Invalid timestamp: ${value}`)
  const calendar = Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
  requireCondition(
    Number.isFinite(calendar) &&
      new Date(calendar).toISOString().slice(0, 10) === value.slice(0, 10),
    `Invalid calendar date: ${value}`,
  )
  return result
}

export function registrationHash(test: TestRecord): string {
  const contract = {
    id: test.id,
    route: test.route,
    phase: test.phase,
    version: test.version,
    hypothesis: test.hypothesis,
    metricDefinitions: test.metricDefinitions,
    passCriteria: test.passCriteria,
    redirectCriteria: test.redirectCriteria,
    killCriteria: test.killCriteria,
    evidenceRequired: test.evidenceRequired,
    owner: test.owner,
    participantClass: test.participantClass,
    plannedDecisionDate: test.plannedDecisionDate,
    approval: test.approval,
  }
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex')
}

export function evaluateThresholds(test: TestRecord): NumericResult | 'BLOCKED_EVIDENCE' {
  if (!test.lockedHash || !test.observations) return 'BLOCKED_EVIDENCE'
  requireCondition(test.lockedHash === registrationHash(test), `${test.id}: lock mismatch`)
  requireCondition(test.lockedAt && test.approval, `${test.id}: missing dated approval/lock`)
  requireCondition(
    test.owner &&
      test.plannedDecisionDate &&
      test.passCriteria &&
      test.redirectCriteria &&
      test.killCriteria,
    `${test.id}: incomplete preregistration`,
  )
  requireCondition(
    test.passCriteria.length &&
      test.redirectCriteria.length &&
      test.killCriteria.length &&
      test.observations.evidenceRefs.length &&
      test.evidenceRequired.length &&
      test.metricDefinitions.every((m) => m.unit !== 'TO_BE_PREREGISTERED'),
    `${test.id}: thresholds, evidence or metric units unresolved`,
  )
  requireCondition(
    time(test.approval.at) <= time(test.lockedAt) &&
      time(test.lockedAt) < time(test.observations.at),
    `${test.id}: registration must precede observations`,
  )
  const values = new Map(test.observations.values.map((value) => [value.metric, value]))
  requireCondition(
    values.size === test.observations.values.length,
    `${test.id}: duplicate observation`,
  )
  requireCondition(
    values.size === test.metricDefinitions.length,
    `${test.id}: missing/extra metrics`,
  )
  for (const metric of test.metricDefinitions) {
    const observed = values.get(metric.id)
    requireCondition(
      observed && observed.unit === metric.unit && Number.isFinite(observed.value),
      `${test.id}: missing/invalid metric or unit: ${metric.id}`,
    )
  }
  const matches = (criterion: Criterion): boolean => {
    requireCondition(Number.isFinite(criterion.value), `${test.id}: nonfinite threshold`)
    const observed = values.get(criterion.metric)
    requireCondition(observed, `${test.id}: unknown criterion metric`)
    switch (criterion.operator) {
      case 'GT':
        return observed.value > criterion.value
      case 'GTE':
        return observed.value >= criterion.value
      case 'LT':
        return observed.value < criterion.value
      case 'LTE':
        return observed.value <= criterion.value
      case 'EQ':
        return observed.value === criterion.value
    }
  }
  if (test.killCriteria.some(matches)) return 'FAIL'
  if (test.passCriteria.every(matches)) return 'PASS'
  if (test.redirectCriteria.every(matches)) return 'REDIRECT_POLICY'
  return 'REDESIGN'
}

export function validateRegistry(input: unknown): Registry {
  if (!validateSchema(input)) {
    throw new Error(`Registry schema: ${JSON.stringify(validateSchema.errors)}`)
  }
  requireCondition(new Set(input.routes.map((r) => r.id)).size === 2, 'Duplicate/missing route')
  requireCondition(new Set(input.tests.map((t) => t.id)).size === 12, 'Duplicate test ID')
  requireCondition(
    new Set(input.tests.map((t) => `${t.route}:${t.phase}`)).size === 12,
    'Duplicate/missing phase test',
  )
  for (const route of input.routes) {
    requireCondition(
      !route.phases.some((p) => p.disposition === 'REDIRECT_POLICY') ||
        route.indicators.policyRequired !== false,
      `${route.id}: policy redirect contradicts policy dependency indicator`,
    )
    requireCondition(
      new Set(route.phases.map((p) => p.phase)).size === 6,
      `${route.id}: duplicate/missing phase`,
    )
    if (route.id === 'ROUTE_A') {
      requireCondition(route.handoff === 'CANADA_ORGANIC_EVIDENCE', 'Handoff A must remain Organic')
      requireCondition(route.selectionEvidence.length > 0, 'A selection evidence missing')
      if (
        route.phases.some(
          (p) => p.phase === 0 && ['PASS', 'PASS_WITH_CONDITIONS'].includes(p.disposition),
        )
      ) {
        requireCondition(
          Object.values(input.organicSourceRights).every(
            (right) =>
              right.requiredForTest !== null &&
              right.evidenceRefs.length > 0 &&
              (right.requiredForTest
                ? right.state === 'ESTABLISHED_ALLOWED'
                : right.state === 'NOT_APPLICABLE' || right.state === 'ESTABLISHED_ALLOWED'),
          ),
          'Organic Phase 0 cannot pass with unresolved/prohibited rights or applicability',
        )
      }
    } else if (route.handoff === 'PENDING_CFA_SELECTION') {
      requireCondition(
        route.selectionEvidence.length === 0,
        'Pending B cannot claim selection evidence',
      )
      requireCondition(
        route.phases.every((p) => p.disposition === 'NOT_STARTED'),
        'Pending B cannot have phase results',
      )
      requireCondition(
        input.tests
          .filter((t) => t.route === route.id)
          .every((t) => !t.lockedHash && !t.observations && !t.decision),
        'Pending B cannot have executed/locked tests',
      )
      requireCondition(
        Object.entries(route.indicators).every(([key, value]) =>
          key === 'evidenceRefs' ? Array.isArray(value) && value.length === 0 : value === null,
        ) &&
          !route.phase4.baselineRef &&
          !route.phase4.resultRef &&
          !route.phase5.baselineRef &&
          !route.phase5.resultRef,
        'Pending B cannot claim baseline/results',
      )
    } else {
      requireCondition(
        route.handoff !== 'CANADA_ORGANIC_EVIDENCE' && route.selectionEvidence.length > 0,
        'B needs distinct setting and discovery selection evidence',
      )
    }
    for (const phase of route.phases) {
      const test = input.tests.find((t) => t.route === route.id && t.phase === phase.phase)
      requireCondition(test, 'Missing phase test')
      requireCondition(
        phase.disposition === (test.decision?.result ?? 'NOT_STARTED'),
        `${test.id}: scorecard/decision mismatch`,
      )
    }
  }
  for (const test of input.tests) {
    const metrics = new Set(test.metricDefinitions.map((m) => m.id))
    requireCondition(metrics.size === test.metricDefinitions.length, `${test.id}: duplicate metric`)
    for (const criteria of [test.passCriteria, test.redirectCriteria, test.killCriteria]) {
      for (const criterion of criteria ?? []) {
        requireCondition(metrics.has(criterion.metric), `${test.id}: unregistered metric`)
      }
    }
    if (test.lockedHash) {
      requireCondition(
        test.lockedHash === registrationHash(test),
        `${test.id}: changed registration`,
      )
      requireCondition(
        test.owner &&
          test.plannedDecisionDate &&
          test.approval &&
          test.lockedAt &&
          test.passCriteria &&
          test.redirectCriteria &&
          test.killCriteria,
        `${test.id}: incomplete locked registration`,
      )
      requireCondition(
        !test.metricDefinitions.some((m) => m.unit === 'TO_BE_PREREGISTERED'),
        `${test.id}: metric units unresolved`,
      )
      requireCondition(
        time(test.approval.at) <= time(test.lockedAt),
        `${test.id}: approval after lock`,
      )
      time(test.plannedDecisionDate)
    } else {
      requireCondition(
        !test.lockedAt && !test.observations && !test.decision,
        `${test.id}: observations/decision without lock`,
      )
    }
    if (test.version === 1)
      requireCondition(
        test.thresholdChanges.length === 0,
        `${test.id}: version 1 cannot have amendments`,
      )
    if (test.version > 1) {
      requireCondition(
        test.thresholdChanges.length === test.version - 1 && test.lockedAt && test.lockedHash,
        `${test.id}: missing amendment history`,
      )
      test.thresholdChanges.forEach((change, index) => {
        requireCondition(
          change.fromVersion === index + 1 && change.toVersion === index + 2,
          `${test.id}: nonsequential amendment`,
        )
        requireCondition(
          change.beforeHash !== change.afterHash,
          `${test.id}: unchanged amendment hash`,
        )
        if (index > 0)
          requireCondition(
            change.beforeHash === test.thresholdChanges[index - 1]?.afterHash,
            `${test.id}: broken amendment chain`,
          )
        requireCondition(
          test.lockedAt && time(change.approvedAt) <= time(test.lockedAt),
          `${test.id}: late amendment approval`,
        )
      })
      requireCondition(
        test.thresholdChanges.at(-1)?.afterHash === test.lockedHash,
        `${test.id}: amendment does not bind current registration`,
      )
    }
    if (test.observations) {
      const numeric = evaluateThresholds(test)
      if (test.decision) {
        requireCondition(
          test.decision.numericResult === numeric,
          `${test.id}: numeric decision mismatch`,
        )
        requireCondition(
          test.decision.lockedHash === test.lockedHash,
          `${test.id}: decision lock mismatch`,
        )
        requireCondition(
          time(test.decision.date) >= time(test.observations.at),
          `${test.id}: decision before observations`,
        )
        if (test.decision.result === 'PASS' || test.decision.result === 'PASS_WITH_CONDITIONS') {
          requireCondition(
            numeric === 'PASS',
            `${test.id}: human pass cannot override threshold failure`,
          )
        }
        requireCondition(
          test.decision.result !== 'NOT_STARTED',
          `${test.id}: observed decision cannot be NOT_STARTED`,
        )
      }
    }
  }
  return input
}

export function evaluatePortfolio(input: unknown): {
  status: 'EVALUATED' | 'BLOCKED_EVIDENCE'
  disposition: Portfolio | null
  survivingRoutes: RouteId[]
  reasons: string[]
} {
  const registry = validateRegistry(input)
  const reasons: string[] = []
  for (const route of registry.routes) {
    if (!route.selectionEvidence.length) reasons.push(`${route.id}: selection unresolved`)
    if (
      route.phases.some((p) =>
        ['NOT_STARTED', 'BLOCKED_EVIDENCE', 'REDESIGN'].includes(p.disposition),
      )
    )
      reasons.push(`${route.id}: phases incomplete`)
    if (
      Object.entries(route.indicators).some(
        ([key, value]) => key !== 'evidenceRefs' && value === null,
      ) ||
      !route.indicators.evidenceRefs.length
    )
      reasons.push(`${route.id}: indicators unevidenced`)
    if (
      !route.phase4.baselineRef ||
      !route.phase4.resultRef ||
      !route.phase5.baselineRef ||
      !route.phase5.resultRef
    )
      reasons.push(`${route.id}: Phase 4/5 baseline/results missing`)
    if (
      registry.tests.some(
        (t) => t.route === route.id && (!t.decision || !t.decision.conditionsClosed),
      )
    )
      reasons.push(`${route.id}: decisions/conditions open`)
  }
  if (reasons.length)
    return { status: 'BLOCKED_EVIDENCE', disposition: null, survivingRoutes: [], reasons }
  const producerViable = (r: RouteRecord) =>
    r.indicators.problemJustifiesIntervention && r.indicators.producerNetValuePositive
  const viable = (r: RouteRecord) =>
    producerViable(r) &&
    r.indicators.recipientDelta &&
    !r.indicators.directSourceBaselineSufficient &&
    r.phases.every((p) =>
      ['PASS', 'PASS_WITH_CONDITIONS', 'REDIRECT_POLICY'].includes(p.disposition),
    )
  const successful = registry.routes.filter(
    (r) =>
      viable(r) &&
      !r.indicators.policyRequired &&
      r.phases.every((p) => p.disposition !== 'REDIRECT_POLICY'),
  )
  const policyRoutes = registry.routes.filter((r) => viable(r) && r.indicators.policyRequired)
  let disposition: Portfolio
  let survivingRoutes: RouteId[] = []
  if (!registry.routes.some(producerViable)) disposition = 'NO_GO'
  else if (registry.routes.every((r) => !r.indicators.recipientDelta))
    disposition = 'POLICY_STANDARDS_ONLY'
  else if (policyRoutes.length) {
    disposition = 'INFRASTRUCTURE_PLUS_POLICY'
    survivingRoutes = registry.routes.filter(viable).map((r) => r.id)
  } else if (successful.length === 2) {
    disposition = 'APPLICATION_CONFIRMED'
    survivingRoutes = successful.map((r) => r.id)
  } else if (successful.length === 1) {
    disposition = 'NARROWER_PRODUCT'
    survivingRoutes = successful.map((r) => r.id)
  } else disposition = 'NO_GO'
  return {
    status: 'EVALUATED',
    disposition,
    survivingRoutes,
    reasons: registry.routes.map(
      (r) =>
        `${r.id}: materialSuccess=${successful.includes(r)}; policyDependent=${policyRoutes.includes(r)}; directSourceBaselineSufficient=${r.indicators.directSourceBaselineSufficient}; producerNetValuePositive=${r.indicators.producerNetValuePositive}`,
    ),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2] ?? path.join(docs, 'CORA_STRESS_TEST_REGISTRY.json')
    const registry = validateRegistry(JSON.parse(readFileSync(file, 'utf8')))
    process.stdout.write(
      `${JSON.stringify(
        {
          registry: 'VALID',
          executionPermission: registry.executionPermission,
          routes: registry.routes.map((r) => ({ id: r.id, handoff: r.handoff, phases: r.phases })),
          portfolio: evaluatePortfolio(registry),
          inheritedGates: registry.inheritedGates,
        },
        null,
        2,
      )}\n`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
