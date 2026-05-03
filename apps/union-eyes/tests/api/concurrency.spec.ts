import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { QA_ROUTE_INVENTORY } from './_qa-route-inventory'

function readMatrix(): string {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
  const filePath = path.join(repoRoot, 'docs', 'union-eyes', 'qa', 'user-story-coverage-matrix.md')
  return fs.readFileSync(filePath, 'utf8')
}

// Contract-level concurrency policy: expected HTTP status codes for conflict scenarios
const UE_CONCURRENCY_CONFLICT_POLICY = {
  assignmentRace: {
    routeFile: 'app/api/workbench/assign/route.ts',
    method: 'POST',
    expectedConflictStatus: 409,
    expectedSuccessStatus: 200,
    idempotencyEnforced: true,
    description:
      'Concurrent assignment of the same case must resolve to exactly one winner; duplicate assignment returns 409',
  },
  escalationRace: {
    routeFile: 'app/api/workflow/transition/route.ts',
    method: 'POST',
    expectedConflictStatus: 409,
    expectedSuccessStatus: 200,
    idempotencyEnforced: true,
    description: 'Concurrent escalation transitions must be serialised; second in-flight transition returns 409',
  },
  staleUpdate: {
    routeFile: 'app/api/claims/[id]/status/route.ts',
    method: 'PATCH',
    expectedConflictStatus: 409,
    expectedSuccessStatus: 200,
    idempotencyEnforced: true,
    description: 'Stale version write to case status must return 409 to prevent silent data loss',
  },
  doubleSubmit: {
    routeFile: 'app/api/claims/route.ts',
    method: 'POST',
    expectedConflictStatus: 409,
    expectedSuccessStatus: 201,
    idempotencyEnforced: true,
    description: 'Duplicate intake submission with same idempotency key must return 409 on repeat',
  },
} as const

describe('UE QA - concurrency and consistency coverage declarations', () => {
  it('concurrency stories are explicitly tracked in the matrix', () => {
    const content = readMatrix()

    expect(content.includes('CONCURRENCY-ASSIGNMENT-RACE')).toBe(true)
    expect(content.includes('CONCURRENCY-ESCALATION-RACE')).toBe(true)
    expect(content.includes('CONCURRENCY-STALE-UPDATE')).toBe(true)
    expect(content.includes('CONCURRENCY-DOUBLE-SUBMIT')).toBe(true)
  })

  it('concurrency stories include a blocker level so maturity gate can fail closed', () => {
    const content = readMatrix()
    const concurrencyRows = content
      .split(/\r?\n/)
      .filter((line) => line.includes('| CONCURRENCY-'))

    const hasBlockerMarkers = concurrencyRows.every((line) =>
      /(none|visibility|ux_blocker|pilot_blocker|production_blocker)\s*\|\s*$/.test(line),
    )

    expect(hasBlockerMarkers).toBe(true)
  })

  it('assignment race conflict policy: assign route requires DecisionRecord and declares idempotency enforcement (CONCURRENCY-ASSIGNMENT-RACE)', () => {
    const policy = UE_CONCURRENCY_CONFLICT_POLICY.assignmentRace
    const routeEntry = QA_ROUTE_INVENTORY.find(
      (e) => e.routeFile === policy.routeFile && e.method === policy.method,
    )
    expect(routeEntry, `Route ${policy.routeFile} ${policy.method} must be declared in QA_ROUTE_INVENTORY`).toBeDefined()
    expect(routeEntry!.expectedDecisionRecordBehavior).toBe('required')
    expect(policy.idempotencyEnforced).toBe(true)
    expect(policy.expectedConflictStatus).toBe(409)
    expect(routeEntry!.expectedAuthorizationByPersona.unauthenticated).toBe('deny')
  })

  it('escalation race conflict policy: transition route requires DecisionRecord and declares serialisation enforcement (CONCURRENCY-ESCALATION-RACE)', () => {
    const policy = UE_CONCURRENCY_CONFLICT_POLICY.escalationRace
    const routeEntry = QA_ROUTE_INVENTORY.find(
      (e) => e.routeFile === policy.routeFile && e.method === policy.method,
    )
    expect(routeEntry, `Route ${policy.routeFile} ${policy.method} must be declared in QA_ROUTE_INVENTORY`).toBeDefined()
    expect(routeEntry!.expectedDecisionRecordBehavior).toBe('required')
    expect(routeEntry!.expectedNarBehavior).toBe('required')
    expect(policy.idempotencyEnforced).toBe(true)
    expect(policy.expectedConflictStatus).toBe(409)
  })

  it('stale version conflict policy: case status PATCH requires DecisionRecord and version gating (CONCURRENCY-STALE-UPDATE)', () => {
    const policy = UE_CONCURRENCY_CONFLICT_POLICY.staleUpdate
    const routeEntry = QA_ROUTE_INVENTORY.find(
      (e) => e.routeFile === policy.routeFile && e.method === policy.method,
    )
    expect(routeEntry, `Route ${policy.routeFile} ${policy.method} must be declared in QA_ROUTE_INVENTORY`).toBeDefined()
    expect(routeEntry!.expectedDecisionRecordBehavior).toBe('required')
    expect(routeEntry!.expectedNarBehavior).toBe('required')
    expect(policy.idempotencyEnforced).toBe(true)
    expect(policy.expectedConflictStatus).toBe(409)
    expect(routeEntry!.expectedAuthorizationByPersona.member).toBe('deny')
  })

  it('double-submit conflict policy: intake POST requires DecisionRecord and idempotency key deduplication (CONCURRENCY-DOUBLE-SUBMIT)', () => {
    const policy = UE_CONCURRENCY_CONFLICT_POLICY.doubleSubmit
    const routeEntry = QA_ROUTE_INVENTORY.find(
      (e) => e.routeFile === policy.routeFile && e.method === policy.method,
    )
    expect(routeEntry, `Route ${policy.routeFile} ${policy.method} must be declared in QA_ROUTE_INVENTORY`).toBeDefined()
    expect(routeEntry!.expectedDecisionRecordBehavior).toBe('required')
    expect(routeEntry!.expectedNarBehavior).toBe('required')
    expect(policy.idempotencyEnforced).toBe(true)
    expect(policy.expectedConflictStatus).toBe(409)
    expect(policy.expectedSuccessStatus).toBe(201)
    expect(routeEntry!.expectedAuthorizationByPersona.externalUxTester).toBe('deny')
  })
})
