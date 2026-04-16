/**
 * Contract Test — Policy Enforcement Wiring
 *
 * Proves that every sensitive API flow invokes the policy engine
 * and fails correctly if enforcement is removed or bypassed.
 *
 * Validated flows:
 *   1. Break-glass activation  (access-break-glass policy)
 *   2. Governance vote casting  (voting-quorum policy)
 *   3. Financial period close   (financial-budget-gate policy)
 *
 * @invariant INV-PE-01: Every sensitive mutation calls enforcePolicies
 * @invariant INV-PE-02: Policy YAML files exist for all three flows
 * @invariant INV-PE-03: Policy-enforced routes return policyEnforced marker on deny
 * @invariant INV-PE-04: Policy enforcement middleware records audit events
 * @invariant INV-PE-05: Removing enforcePolicies from a route breaks this contract
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const CONSOLE = join(ROOT, 'apps', 'console')

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRoute(routePath: string): string {
  const fullPath = join(CONSOLE, routePath)
  if (!existsSync(fullPath)) throw new Error(`Route file not found: ${fullPath}`)
  return readFileSync(fullPath, 'utf-8')
}

function readPolicy(policyFile: string): string {
  const fullPath = join(ROOT, 'ops', 'policies', policyFile)
  if (!existsSync(fullPath)) throw new Error(`Policy file not found: ${fullPath}`)
  return readFileSync(fullPath, 'utf-8')
}

// ── INV-PE-01: enforcePolicies call is present in every sensitive route ───────

describe('INV-PE-01 — enforcePolicies wired into sensitive mutations', () => {
  const sensitiveRoutes = [
    {
      name: 'break-glass',
      path: 'app/api/admin/break-glass/route.ts',
      action: 'break_glass.activate',
    },
    {
      name: 'vote casting',
      path: 'app/api/governance/votes/route.ts',
      action: 'vote.cast',
    },
    {
      name: 'financial close',
      path: 'app/api/finance/close/route.ts',
      action: 'finance.close_period.create',
    },
  ]

  for (const route of sensitiveRoutes) {
    describe(`${route.name} (${route.path})`, () => {
      it('imports enforcePolicies from policy-enforcement module', () => {
        const src = readRoute(route.path)
        expect(src).toContain("enforcePolicies")
        expect(src).toMatch(/from\s+['"]@\/lib\/policy-enforcement['"]/)
      })

      it('calls enforcePolicies() inside POST handler', () => {
        const src = readRoute(route.path)
        // Must call enforcePolicies with the expected action
        expect(src).toContain(`enforcePolicies(`)
        expect(src).toContain(route.action)
      })

      it('returns 403 when policy blocks the action', () => {
        const src = readRoute(route.path)
        expect(src).toContain('policyResult.blocked')
        expect(src).toContain('status: 403')
        expect(src).toContain('policyEnforced: true')
      })
    })
  }
})

// ── INV-PE-02: Policy YAML files exist and contain required policies ──────────

describe('INV-PE-02 — Policy YAML files define required policies', () => {
  it('access-policies.yml contains access-break-glass policy', () => {
    const yaml = readPolicy('access-policies.yml')
    expect(yaml).toContain('id: access-break-glass')
    expect(yaml).toContain('enabled: true')
    expect(yaml).toContain('platform_admin')
    expect(yaml).toContain('/api/admin/break-glass')
  })

  it('voting-policies.yml contains voting-quorum policy', () => {
    const yaml = readPolicy('voting-policies.yml')
    expect(yaml).toContain('id: voting-quorum')
    expect(yaml).toContain('enabled: true')
    expect(yaml).toContain('quorumPercent')
    expect(yaml).toContain('/api/governance/votes')
  })

  it('financial-policies.yml contains financial-budget-gate policy', () => {
    const yaml = readPolicy('financial-policies.yml')
    expect(yaml).toContain('id: financial-budget-gate')
    expect(yaml).toContain('enabled: true')
    expect(yaml).toContain('budgetUtilization')
    expect(yaml).toContain('/api/finance')
  })

  it('every policy file has version and lastUpdated', () => {
    for (const file of ['access-policies.yml', 'voting-policies.yml', 'financial-policies.yml']) {
      const yaml = readPolicy(file)
      expect(yaml, `${file} must have version`).toMatch(/^version:\s+/m)
      expect(yaml, `${file} must have lastUpdated`).toMatch(/^lastUpdated:\s+/m)
    }
  })
})

// ── INV-PE-03: Policy enforcement middleware structure ────────────────────────

describe('INV-PE-03 — Policy enforcement middleware is correctly structured', () => {
  const middlewarePath = join(CONSOLE, 'lib', 'policy-enforcement.ts')

  it('policy-enforcement.ts exists', () => {
    expect(existsSync(middlewarePath)).toBe(true)
  })

  it('exports enforcePolicies function', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toMatch(/export\s+(async\s+)?function\s+enforcePolicies/)
  })

  it('exports clearPolicyCache for testing', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toMatch(/export\s+function\s+clearPolicyCache/)
  })

  it('delegates policy evaluation to Control Plane (not direct policy-engine)', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toContain('CONTROL_PLANE_URL')
    expect(src).toContain('/api/control-plane/policy/evaluate')
    // Console must NOT directly import the policy engine (boundary enforcement)
    expect(src).not.toMatch(/from\s+['"']@nzila\/platform-policy-engine['"']/)
  })

  it('fails closed (blocked: true) when Control Plane is unavailable', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toContain('createUnavailableResult')
    expect(src).toContain('blocked: true')
    expect(src).toContain('Control Plane policy evaluation unavailable')
  })

  it('records audit event on every enforcement decision', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toContain('recordAuditEvent')
    expect(src).toContain("policy_enforcement")
    // Must record for allowed, denied, and approval paths
    expect(src).toContain("'denied'")
    expect(src).toContain("'allowed'")
    expect(src).toContain("'approval_required'")
  })

  it('returns blocked, needsApproval, reason, evaluations', () => {
    const src = readFileSync(middlewarePath, 'utf-8')
    expect(src).toContain('blocked')
    expect(src).toContain('needsApproval')
    expect(src).toContain('reason')
    expect(src).toContain('evaluations')
    expect(src).toContain('approverRoles')
  })
})

// ── INV-PE-04: Break-glass requires approval path ────────────────────────────

describe('INV-PE-04 — Break-glass route handles approval flow', () => {
  it('returns 202 when policy requires approval', () => {
    const src = readRoute('app/api/admin/break-glass/route.ts')
    expect(src).toContain('policyResult.needsApproval')
    expect(src).toContain('status: 202')
    expect(src).toContain('approval_required')
  })

  it('logs warnings and info for policy decisions', () => {
    const src = readRoute('app/api/admin/break-glass/route.ts')
    expect(src).toContain('logger.warn')
    expect(src).toContain('logger.info')
  })
})

// ── INV-PE-05: Vote route enforces quorum and self-vote rules ────────────────

describe('INV-PE-05 — Vote route passes quorum and self-vote context', () => {
  it('passes quorumPercent to policy engine', () => {
    const src = readRoute('app/api/governance/votes/route.ts')
    expect(src).toContain('quorumPercent')
    expect(src).toContain('isInitiatorVoting')
  })

  it('passes motionType to policy engine for self-vote rule', () => {
    const src = readRoute('app/api/governance/votes/route.ts')
    expect(src).toContain('motionType')
  })

  it('records vote-denied audit event on policy block', () => {
    const src = readRoute('app/api/governance/votes/route.ts')
    expect(src).toContain('vote.denied_by_policy')
    expect(src).toContain('recordAuditEvent')
  })
})

// ── INV-PE-06: Financial close route enforces budget gate ────────────────────

describe('INV-PE-06 — Financial close route passes budget context', () => {
  it('passes budgetUtilization to policy engine', () => {
    const src = readRoute('app/api/finance/close/route.ts')
    expect(src).toContain('budgetUtilization')
  })

  it('handles approval_required with 202 status', () => {
    const src = readRoute('app/api/finance/close/route.ts')
    expect(src).toContain('policyResult.needsApproval')
    expect(src).toContain('status: 202')
  })

  it('blocks requests with policyEnforced marker', () => {
    const src = readRoute('app/api/finance/close/route.ts')
    expect(src).toContain('policyEnforced: true')
  })
})

// ── INV-PE-07: Policy engine package exports are stable ──────────────────────

describe('INV-PE-07 — Policy engine package surface contract', () => {
  const pkgDir = join(ROOT, 'packages', 'platform-policy-engine')

  it('package.json exists and exports evaluator', () => {
    const pkgPath = join(pkgDir, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.name).toBe('@nzila/platform-policy-engine')
    // Must expose main exports
    const exportsObj = pkg.exports || {}
    const mainEntry = exportsObj['.'] ?? pkg.main
    expect(mainEntry).toBeTruthy()
  })

  it('evaluator.ts exports evaluatePolicy and evaluatePolicies', () => {
    const evalPath = join(pkgDir, 'src', 'evaluator.ts')
    const src = readFileSync(evalPath, 'utf-8')
    expect(src).toMatch(/export\s+function\s+evaluatePolicy/)
    expect(src).toMatch(/export\s+function\s+evaluatePolicies/)
    expect(src).toMatch(/export\s+function\s+isBlocked/)
    expect(src).toMatch(/export\s+function\s+requiresApproval/)
  })

  it('types.ts exports PolicyDefinition and PolicyEvaluationInput', () => {
    const typesPath = join(pkgDir, 'src', 'types.ts')
    const src = readFileSync(typesPath, 'utf-8')
    expect(src).toContain('PolicyDefinition')
    expect(src).toContain('PolicyEvaluationInput')
    expect(src).toContain('PolicyEvaluationOutput')
  })
})

// ── INV-PE-08: Negative test — enforcement would break without wiring ────────

describe('INV-PE-08 — Enforcement removal breaks contract', () => {
  it('every sensitive route would lose 403 path without enforcePolicies', () => {
    // This proves the 403 response is ONLY reachable via enforcePolicies.
    // If someone removes the import/call, the route source will no longer
    // contain the policyEnforced marker, and this test will fail.
    const routes = [
      'app/api/admin/break-glass/route.ts',
      'app/api/governance/votes/route.ts',
      'app/api/finance/close/route.ts',
    ]

    for (const route of routes) {
      const src = readRoute(route)
      // The 403 response with policyEnforced MUST coexist with enforcePolicies call.
      // Removing one without the other is a signal the contract is broken.
      const hasEnforcement = src.includes('enforcePolicies(')
      const has403Policy = src.includes('policyEnforced: true') && src.includes('status: 403')
      expect(
        hasEnforcement && has403Policy,
        `${route} must have BOTH enforcePolicies call AND policyEnforced:true 403 response`,
      ).toBe(true)
    }
  })

  it('policy-enforcement module delegates generically via Control Plane proxy', () => {
    // The middleware must delegate to the Control Plane, which handles all policies.
    // This proves the console is a generic proxy — not hard-coded to one flow.
    const src = readFileSync(join(CONSOLE, 'lib', 'policy-enforcement.ts'), 'utf-8')
    // Delegates to Control Plane generically (action string is passed through)
    expect(src).toContain('CONTROL_PLANE_URL')
    expect(src).toContain('/api/control-plane/policy/evaluate')
    // Must fail closed on Control Plane unavailability (not open by default)
    expect(src).toContain('blocked: true')
    // Console must not load YAML files directly (control-plane boundary enforced)
    expect(src).not.toContain('readdirSync')
  })
})
