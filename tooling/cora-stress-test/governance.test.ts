import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import {
  evaluatePortfolio,
  evaluateThresholds,
  registrationHash,
  validateRegistry,
  type Registry,
  type TestRecord,
} from './governance.js'

const fixture = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'docs',
  'categories',
  'products-and-market',
  'agri',
  'CORA_STRESS_TEST_REGISTRY.json',
)
const pending = (): Registry => validateRegistry(JSON.parse(readFileSync(fixture, 'utf8')))

function lock(record: TestRecord): TestRecord {
  record.metricDefinitions = [{ id: 'delta', unit: 'minutes' }]
  record.passCriteria = [{ metric: 'delta', operator: 'GTE', value: 10 }]
  record.redirectCriteria = [{ metric: 'delta', operator: 'GTE', value: 3 }]
  record.killCriteria = [{ metric: 'delta', operator: 'LT', value: 0 }]
  record.owner = 'SYNTHETIC_OWNER_NOT_ASSIGNED'
  record.plannedDecisionDate = '2026-10-20T00:00:00Z'
  record.approval = { reference: 'SYNTHETIC_APPROVAL_NOT_REAL', at: '2026-10-14T00:00:00Z' }
  record.lockedAt = '2026-10-15T00:00:00Z'
  record.lockedHash = registrationHash(record)
  return record
}

function observed(record: TestRecord, value = 10): TestRecord {
  lock(record)
  record.observations = {
    at: '2026-10-16T00:00:00Z',
    evidenceRefs: ['SYNTHETIC_OBSERVATION_NOT_HUMAN'],
    values: [{ metric: 'delta', value, unit: 'minutes' }],
  }
  return record
}

function complete(): Registry {
  const registry = pending()
  Object.values(registry.organicSourceRights).forEach((right) => {
    right.state = 'ESTABLISHED_ALLOWED'
    right.scope = 'Synthetic control only; no live rights grant'
    right.evidenceRefs = ['SYNTHETIC_RIGHTS_ONLY']
    right.requiredForTest = true
  })
  for (const route of registry.routes) {
    if (route.id === 'ROUTE_B') {
      route.handoff = 'SYNTHETIC_DIFFERENT_SETTING_NOT_CFA_SELECTION'
      route.selectionEvidence = ['SYNTHETIC_CONTROL_ONLY']
    }
    route.indicators = {
      recipientDelta: true,
      producerNetValuePositive: true,
      problemJustifiesIntervention: true,
      directSourceBaselineSufficient: false,
      policyRequired: false,
      evidenceRefs: ['SYNTHETIC_INDICATORS_ONLY'],
    }
    route.phase4 = { baselineRef: 'synthetic-p4-baseline', resultRef: 'synthetic-p4-result' }
    route.phase5 = { baselineRef: 'synthetic-p5-baseline', resultRef: 'synthetic-p5-result' }
    route.phases.forEach((phase) => {
      phase.disposition = 'PASS'
    })
  }
  for (const record of registry.tests) {
    observed(record)
    assert(record.lockedHash)
    record.decision = {
      date: '2026-10-17T00:00:00Z',
      result: 'PASS',
      numericResult: 'PASS',
      memoRef: 'SYNTHETIC_MEMO_ONLY',
      evidenceRefs: ['SYNTHETIC_DECISION_ONLY'],
      owner: 'SYNTHETIC_DECISION_OWNER',
      lockedHash: record.lockedHash,
      conditionsClosed: true,
    }
  }
  return validateRegistry(registry)
}

test('canonical registry remains twelve pending phases with inherited gates and no B', () => {
  const registry = pending()
  assert.equal(registry.tests.length, 12)
  assert(registry.tests.every((t) => !t.owner && !t.passCriteria && !t.observations && !t.decision))
  assert.equal(registry.routes[1]?.handoff, 'PENDING_CFA_SELECTION')
  assert.equal(
    registry.inheritedGates.CORA_ORGANIC_FIRST_LIVE_SOURCE,
    'BLOCKED_RIGHTS_CONFIRMATION',
  )
  const result = evaluatePortfolio(registry)
  assert.equal(result.status, 'BLOCKED_EVIDENCE')
  assert.equal(result.disposition, null)
})

for (const [value, expected] of [
  [10, 'PASS'],
  [9.99, 'REDIRECT_POLICY'],
  [3, 'REDIRECT_POLICY'],
  [2.99, 'REDESIGN'],
  [-1, 'FAIL'],
] as const) {
  test(`pre-registered numeric boundary ${value} yields ${expected}`, () => {
    assert.equal(evaluateThresholds(observed(pending().tests[0]!, value)), expected)
  })
}

test('kill overrides even a matching pass', () => {
  const record = observed(pending().tests[0]!, 10)
  record.killCriteria = [{ metric: 'delta', operator: 'GTE', value: 10 }]
  record.lockedHash = registrationHash(record)
  assert.equal(evaluateThresholds(record), 'FAIL')
})

test('all pass and redirect conditions must match, with no averaging', () => {
  const record = observed(pending().tests[0]!, 10)
  record.passCriteria?.push({ metric: 'delta', operator: 'GT', value: 10 })
  record.redirectCriteria?.push({ metric: 'delta', operator: 'EQ', value: 10 })
  record.lockedHash = registrationHash(record)
  assert.equal(evaluateThresholds(record), 'REDIRECT_POLICY')
  record.redirectCriteria?.push({ metric: 'delta', operator: 'LTE', value: 9 })
  record.lockedHash = registrationHash(record)
  assert.equal(evaluateThresholds(record), 'REDESIGN')
})

test('threshold edits after lock are rejected', () => {
  const registry = complete()
  registry.tests[0]!.passCriteria![0]!.value = 9
  assert.throws(() => validateRegistry(registry), /changed registration/)
})

for (const [label, mutate] of [
  [
    'missing metric',
    (t: TestRecord) => {
      t.observations!.values = []
    },
  ],
  [
    'duplicate metric',
    (t: TestRecord) => {
      t.observations!.values.push({ metric: 'delta', value: 10, unit: 'minutes' })
    },
  ],
  [
    'wrong unit',
    (t: TestRecord) => {
      t.observations!.values[0]!.unit = 'seconds'
    },
  ],
  [
    'nonfinite value',
    (t: TestRecord) => {
      t.observations!.values[0]!.value = Infinity
    },
  ],
  [
    'observation before lock',
    (t: TestRecord) => {
      t.observations!.at = '2026-10-14T00:00:00Z'
    },
  ],
  [
    'undated observation',
    (t: TestRecord) => {
      t.observations!.at = '2026-10-16'
    },
  ],
  [
    'invalid calendar date',
    (t: TestRecord) => {
      t.observations!.at = '2026-02-30T00:00:00Z'
    },
  ],
  [
    'missing observation evidence',
    (t: TestRecord) => {
      t.observations!.evidenceRefs = []
    },
  ],
  [
    'empty pass criteria',
    (t: TestRecord) => {
      t.passCriteria = []
      t.lockedHash = registrationHash(t)
    },
  ],
] as const) {
  test(`${label} cannot yield a numeric pass`, () => {
    const record = observed(pending().tests[0]!)
    mutate(record)
    assert.throws(() => evaluateThresholds(record))
  })
}

for (const [label, mutate] of [
  [
    'duplicate route',
    (r: Registry) => {
      r.routes[1]!.id = 'ROUTE_A'
    },
  ],
  [
    'duplicate phase',
    (r: Registry) => {
      r.routes[0]!.phases[5]!.phase = 4
    },
  ],
  [
    'duplicate phase test',
    (r: Registry) => {
      r.tests[5]!.phase = 4
    },
  ],
  [
    'source rights bypass',
    (r: Registry) => {
      r.inheritedGates.CORA_ORGANIC_FIRST_LIVE_SOURCE = 'PASS'
    },
  ],
  [
    'production bypass',
    (r: Registry) => {
      r.inheritedGates.PRODUCTION_ACTIVATION = 'PASS'
    },
  ],
  [
    'pending B selection claim',
    (r: Registry) => {
      r.routes[1]!.selectionEvidence = ['invented']
    },
  ],
  [
    'pending B executed',
    (r: Registry) => {
      observed(r.tests[6]!)
    },
  ],
  [
    'pending B baseline claim',
    (r: Registry) => {
      r.routes[1]!.phase4.baselineRef = 'invented'
    },
  ],
  [
    'decision without lock',
    (r: Registry) => {
      r.tests[0]!.decision = complete().tests[0]!.decision
    },
  ],
] as const) {
  test(`reject ${label}`, () => {
    const registry = pending()
    mutate(registry)
    assert.throws(() => validateRegistry(registry))
  })
}

test('both materially successful routes land application without clearing inherited gates', () => {
  const registry = complete()
  assert.equal(evaluatePortfolio(registry).disposition, 'APPLICATION_CONFIRMED')
  assert.equal(registry.executionPermission, 'NONE_GRANTED')
  assert.equal(registry.inheritedGates.PRODUCTION_ACTIVATION, 'BLOCKED_STRESS_TEST')
})

for (const surviving of ['ROUTE_A', 'ROUTE_B'] as const) {
  test(`one material route names ${surviving}; other cannot be hidden`, () => {
    const registry = complete()
    registry.routes.find((r) => r.id !== surviving)!.indicators.recipientDelta = false
    const result = evaluatePortfolio(registry)
    assert.equal(result.disposition, 'NARROWER_PRODUCT')
    assert.deepEqual(result.survivingRoutes, [surviving])
    assert.equal(result.reasons.length, 2)
  })
}

test('policy dependency takes precedence over application/narrower product', () => {
  const registry = complete()
  registry.routes[1]!.indicators.policyRequired = true
  registry.routes[1]!.phases[0]!.disposition = 'REDIRECT_POLICY'
  registry.tests[6]!.decision!.result = 'REDIRECT_POLICY'
  assert.equal(evaluatePortfolio(registry).disposition, 'INFRASTRUCTURE_PLUS_POLICY')
})

test('policy redirect cannot be hidden as no policy dependency', () => {
  const registry = complete()
  registry.routes[1]!.phases[0]!.disposition = 'REDIRECT_POLICY'
  registry.tests[6]!.decision!.result = 'REDIRECT_POLICY'
  assert.throws(() => validateRegistry(registry), /contradicts policy dependency/)
})

test('no recipient delta with justified producer problem lands policy-only', () => {
  const registry = complete()
  registry.routes.forEach((r) => {
    r.indicators.recipientDelta = false
  })
  assert.equal(evaluatePortfolio(registry).disposition, 'POLICY_STANDARDS_ONLY')
})

test('no producer justification is NO_GO even with institutional efficiency', () => {
  const registry = complete()
  registry.routes.forEach((r) => {
    r.indicators.producerNetValuePositive = false
  })
  assert.equal(evaluatePortfolio(registry).disposition, 'NO_GO')
})

test('direct-source sufficiency falsifies material Organic software success', () => {
  const registry = complete()
  registry.routes[0]!.indicators.directSourceBaselineSufficient = true
  const result = evaluatePortfolio(registry)
  assert.equal(result.disposition, 'NARROWER_PRODUCT')
  assert.deepEqual(result.survivingRoutes, ['ROUTE_B'])
})

test('complete negative outcomes fall through to NO_GO', () => {
  const registry = complete()
  registry.routes.forEach((r) => {
    r.indicators.directSourceBaselineSufficient = true
  })
  assert.equal(evaluatePortfolio(registry).disposition, 'NO_GO')
})

for (const [label, mutate] of [
  [
    'unknown indicator',
    (r: Registry) => {
      r.routes[1]!.indicators.producerNetValuePositive = null
    },
  ],
  [
    'no indicator evidence',
    (r: Registry) => {
      r.routes[1]!.indicators.evidenceRefs = []
    },
  ],
  [
    'missing readiness baseline',
    (r: Registry) => {
      r.routes[1]!.phase5.baselineRef = null
    },
  ],
  [
    'unclosed conditions',
    (r: Registry) => {
      r.tests[0]!.decision!.conditionsClosed = false
    },
  ],
  [
    'redesign phase',
    (r: Registry) => {
      r.routes[1]!.phases[0]!.disposition = 'REDESIGN'
      r.tests[6]!.decision!.result = 'REDESIGN'
    },
  ],
] as const) {
  test(`${label} blocks final classification, not default NO_GO`, () => {
    const registry = complete()
    mutate(registry)
    const result = evaluatePortfolio(registry)
    assert.equal(result.disposition, null)
    assert.equal(result.status, 'BLOCKED_EVIDENCE')
  })
}

test('human PASS cannot override failed numeric criteria', () => {
  const registry = complete()
  registry.tests[0]!.observations!.values[0]!.value = -1
  registry.tests[0]!.decision!.numericResult = 'FAIL'
  assert.throws(() => validateRegistry(registry), /cannot override/)
})

test('version change without prospective approval history is rejected', () => {
  const registry = complete()
  const record = registry.tests[0]!
  record.version = 2
  record.lockedHash = registrationHash(record)
  record.decision!.lockedHash = record.lockedHash
  assert.throws(() => validateRegistry(registry), /missing amendment history/)
})

test('Organic Phase 0 cannot pass merely because publication is allowed', () => {
  const registry = complete()
  registry.organicSourceRights = pending().organicSourceRights
  assert.throws(() => validateRegistry(registry), /unresolved\/prohibited rights/)
})

test('Organic source-right fields remain independent and required rights fail closed', () => {
  const registry = complete()
  registry.organicSourceRights.RETENTION_RIGHTS!.state = 'ESTABLISHED_PROHIBITED'
  assert.throws(() => validateRegistry(registry), /unresolved\/prohibited rights/)
  registry.organicSourceRights.RETENTION_RIGHTS!.state = 'NOT_ESTABLISHED'
  assert.throws(() => validateRegistry(registry), /unresolved\/prohibited rights/)
})

test('approved prospective amendment binds old/new hash and new evidence', () => {
  const registry = complete()
  const record = registry.tests[0]!
  const beforeHash = record.lockedHash!
  record.version = 2
  record.passCriteria![0]!.value = 11
  record.observations!.values[0]!.value = 11
  record.lockedHash = registrationHash(record)
  record.thresholdChanges = [
    {
      fromVersion: 1,
      toVersion: 2,
      beforeHash,
      afterHash: record.lockedHash,
      approvedAt: '2026-10-14T12:00:00Z',
      approvalRef: 'SYNTHETIC_AMENDMENT',
      rationale: 'Synthetic prospective control, not actual research',
      prospectiveEvidenceScope: 'Synthetic new observation cohort only',
    },
  ]
  record.decision!.lockedHash = record.lockedHash
  assert.equal(validateRegistry(registry).tests[0]!.version, 2)
  record.thresholdChanges[0]!.approvedAt = '2026-10-16T00:00:00Z'
  assert.throws(() => validateRegistry(registry), /late amendment/)
})
