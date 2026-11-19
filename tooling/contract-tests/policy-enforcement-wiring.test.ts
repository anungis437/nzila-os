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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const CONSOLE = join(ROOT, 'apps', 'console')

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRoute(routePath: string): string {
  const fullPath = join(CONSOLE, routePath)
  if (!existsSync(fullPath)) throw new Error(`Route file not found: ${fullPath}`)
  return readFileSync(fullPath, 'utf-8')
}

function readConsole(relPath: string): string {
  const fullPath = join(CONSOLE, relPath)
  if (!existsSync(fullPath)) throw new Error(`Console file not found: ${fullPath}`)
  return readFileSync(fullPath, 'utf-8')
}

/** Source of one exported (async) function, from its declaration to the next top-level export. */
function exportedFunctionBody(src: string, name: string): string {
  const start = src.search(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`))
  if (start < 0) return ''
  const rest = src.slice(start + 1)
  const next = rest.search(/\nexport\s/)
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next)
}

/** Every .ts/.tsx source file under the console app and lib trees (tests excluded). */
function consoleSources(): Array<{ rel: string; src: string }> {
  const out: Array<{ rel: string; src: string }> = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue
        walk(full)
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push({ rel: relative(CONSOLE, full).replace(/\\/g, '/'), src: readFileSync(full, 'utf-8') })
      }
    }
  }
  walk(join(CONSOLE, 'app'))
  walk(join(CONSOLE, 'lib'))
  return out
}

function readPolicy(policyFile: string): string {
  const fullPath = join(ROOT, 'ops', 'policies', policyFile)
  if (!existsSync(fullPath)) throw new Error(`Policy file not found: ${fullPath}`)
  return readFileSync(fullPath, 'utf-8')
}

// ── INV-PE-01: enforcePolicies call is present in every sensitive route ───────

describe('INV-PE-01 — enforcePolicies wired into sensitive mutations', () => {
  // A route either enforces the policy itself, or delegates the whole mutation
  // to one service function that enforces it before writing. In the delegated
  // case the guarantee is asserted at the service AND the route must reach the
  // mutation only through that function.
  const sensitiveRoutes: Array<{
    name: string
    path: string
    action: string
    gate?: { module: string; file: string; fn: string }
  }> = [
    {
      name: 'break-glass',
      path: 'app/api/admin/break-glass/route.ts',
      action: 'break_glass.activate',
    },
    {
      name: 'financial close',
      path: 'app/api/finance/close/route.ts',
      action: 'finance.close_period.create',
      // Raw DB access moved out of the route (governance exceptions removed);
      // the policy gate moved with the mutation into the service.
      gate: {
        module: '@/lib/services/finance-close-service',
        file: 'lib/services/finance-close-service.ts',
        fn: 'createClosePeriod',
      },
    },
  ]

  for (const route of sensitiveRoutes) {
    const enforcementSource = () =>
      route.gate
        ? exportedFunctionBody(readConsole(route.gate.file), route.gate.fn)
        : readRoute(route.path)
    const enforcementModuleSource = () =>
      route.gate ? readConsole(route.gate.file) : readRoute(route.path)

    describe(`${route.name} (${route.path})`, () => {
      it('imports enforcePolicies from policy-enforcement module', () => {
        const src = enforcementModuleSource()
        expect(src).toContain("enforcePolicies")
        expect(src).toMatch(/from\s+['"]@\/lib\/policy-enforcement['"]/)
      })

      it('calls enforcePolicies() inside POST handler', () => {
        const src = enforcementSource()
        // Must call enforcePolicies with the expected action
        expect(src).toContain(`enforcePolicies(`)
        expect(src).toContain(route.action)
        if (route.gate) {
          // The route's POST reaches the mutation only through the gated service function.
          const routeSrc = readRoute(route.path)
          const post = exportedFunctionBody(routeSrc, 'POST')
          expect(routeSrc).toMatch(
            new RegExp(`import\\s*\\{[^}]*\\b${route.gate.fn}\\b[^}]*\\}\\s*from\\s*['"]${route.gate.module.replace(/[/@-]/g, '\\$&')}['"]`),
          )
          expect(post).toContain(`${route.gate.fn}(`)
          // …and the route itself carries no DB client that could bypass it.
          expect(routeSrc).not.toMatch(/from\s+['"]@nzila\/db(?:\/[^'"]*)?['"]/)
          expect(routeSrc).not.toMatch(/\.(?:insert|update|delete)\s*\(/)
        }
      })

      it('returns 403 when policy blocks the action', () => {
        const src = enforcementSource()
        expect(src).toContain('policyResult.blocked')
        expect(src).toMatch(/status:\s*403/)
        expect(src).toContain('policyEnforced: true')
        if (route.gate) {
          // The service's status reaches the client unchanged.
          expect(exportedFunctionBody(readRoute(route.path), 'POST')).toMatch(
            /NextResponse\.json\(\s*result\.body,\s*\{\s*status:\s*result\.status\s*\}\s*\)/,
          )
        }
      })
    })
  }

  it('financial close: the policy gate runs before the only close-period insert in the console', () => {
    const body = exportedFunctionBody(readConsole('lib/services/finance-close-service.ts'), 'createClosePeriod')
    const gate = body.indexOf('enforcePolicies(')
    const blocked = body.indexOf('policyResult.blocked')
    const approval = body.indexOf('policyResult.needsApproval')
    const insert = body.indexOf('.insert(closePeriods)')
    expect(gate).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(insert)
    expect(blocked).toBeLessThan(insert)
    expect(approval).toBeLessThan(insert)

    // No other console source inserts close periods, and only the finance close
    // route calls the gated creator — so every creation path is policy-enforced.
    const sources = consoleSources()
    const inserters = sources.filter((f) => /\.insert\(\s*closePeriods\s*\)/.test(f.src)).map((f) => f.rel)
    expect(inserters).toEqual(['lib/services/finance-close-service.ts'])
    const callers = sources
      .filter((f) => f.rel !== 'lib/services/finance-close-service.ts' && /\bcreateClosePeriod\s*\(/.test(f.src))
      .map((f) => f.rel)
    expect(callers).toEqual(['app/api/finance/close/route.ts'])
  })
})

// ── INV-PE-01b: vote casting is honestly unavailable ──────────────────────────
//
// Vote casting used to persist a vote behind enforcePolicies. That persistence
// was removed on purpose: the stored model binds no canonical voter, verified
// electorate or authoritative quorum, so "recording" a vote was theatre. The
// route now refuses every valid request with 501. There is no mutation left to
// gate — and if one is ever reintroduced, the policy gate must come back with it.

describe('INV-PE-01b — vote casting refuses (501) instead of recording an unverified vote', () => {
  const VOTE_ROUTE = 'app/api/governance/votes/route.ts'

  it('authenticates, validates, then answers 501 VERIFIED_VOTING_SOURCE_UNAVAILABLE', () => {
    const post = exportedFunctionBody(readRoute(VOTE_ROUTE), 'POST')
    expect(post).toContain('authenticateUser(')
    expect(post).toContain('safeParse(')
    expect(post).toContain('VERIFIED_VOTING_SOURCE_UNAVAILABLE')
    expect(post).toMatch(/status:\s*501/)
    expect(post).not.toMatch(/status:\s*20[01]\b/)
  })

  it('persists nothing: no DB client, no votes table, no insert', () => {
    const src = readRoute(VOTE_ROUTE)
    expect(src).not.toMatch(/from\s+['"]@nzila\/db(?:\/[^'"]*)?['"]/)
    expect(src).not.toMatch(/\bvotes\b\s*[,}]/)
    expect(src).not.toMatch(/\.(?:insert|update|delete)\s*\(/)
  })

  it('no other console source writes the votes table around the route', () => {
    const writers = consoleSources()
      .filter((f) => /\.(?:insert|update|delete)\(\s*votes\s*\)/.test(f.src))
      .map((f) => f.rel)
    expect(writers).toEqual([])
  })
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

  it('cannot persist a vote without the policy gate and its denial audit', () => {
    // Today the route persists nothing (INV-PE-01b), so there is no denial to
    // audit. Reintroducing persistence without enforcePolicies, the 403 path and
    // the vote.denied_by_policy audit event breaks this contract.
    const src = readRoute('app/api/governance/votes/route.ts')
    const persists =
      /from\s+['"]@nzila\/db(?:\/[^'"]*)?['"]/.test(src) || /\.(?:insert|update)\s*\(/.test(src)
    const gated =
      src.includes("enforcePolicies(") &&
      src.includes('vote.cast') &&
      src.includes('policyResult.blocked') &&
      src.includes('policyEnforced: true') &&
      src.includes('vote.denied_by_policy') &&
      src.includes('recordAuditEvent')
    expect(!persists || gated, 'vote persistence requires enforcePolicies + denial audit').toBe(true)
  })
})

// ── INV-PE-06: Financial close route enforces budget gate ────────────────────

describe('INV-PE-06 — Financial close route passes budget context', () => {
  // The gate moved from the route into finance-close-service.createClosePeriod
  // (the route's only path to the insert — see INV-PE-01).
  const gate = () =>
    exportedFunctionBody(readConsole('lib/services/finance-close-service.ts'), 'createClosePeriod')

  it('passes budgetUtilization to policy engine', () => {
    expect(gate()).toContain('budgetUtilization')
  })

  it('handles approval_required with 202 status', () => {
    const src = gate()
    expect(src).toContain('policyResult.needsApproval')
    expect(src).toMatch(/status:\s*202/)
    expect(src).toContain('approval_required')
  })

  it('blocks requests with policyEnforced marker', () => {
    expect(gate()).toContain('policyEnforced: true')
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
    // Each entry names where the enforcement lives: the route itself, or the
    // single service function the route delegates the mutation to.
    const routes: Array<{ route: string; enforcement: () => string }> = [
      {
        route: 'app/api/admin/break-glass/route.ts',
        enforcement: () => readRoute('app/api/admin/break-glass/route.ts'),
      },
      {
        route: 'app/api/finance/close/route.ts',
        enforcement: () =>
          exportedFunctionBody(readConsole('lib/services/finance-close-service.ts'), 'createClosePeriod'),
      },
    ]

    for (const { route, enforcement } of routes) {
      const src = enforcement()
      // The 403 response with policyEnforced MUST coexist with enforcePolicies call.
      // Removing one without the other is a signal the contract is broken.
      const hasEnforcement = src.includes('enforcePolicies(')
      const has403Policy = src.includes('policyEnforced: true') && /status:\s*403/.test(src)
      expect(
        hasEnforcement && has403Policy,
        `${route} must have BOTH enforcePolicies call AND policyEnforced:true 403 response`,
      ).toBe(true)
    }

    // Vote casting has no mutation to gate (INV-PE-01b): it must stay a 501
    // refusal for as long as it carries no enforcePolicies call.
    const vote = readRoute('app/api/governance/votes/route.ts')
    const voteGated = vote.includes('enforcePolicies(') && vote.includes('policyEnforced: true') && /status:\s*403/.test(vote)
    const voteRefuses = /status:\s*501/.test(vote) && !/\.(?:insert|update)\s*\(/.test(vote)
    expect(voteGated || voteRefuses, 'vote route must be policy-gated or refuse with 501').toBe(true)
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
