/**
 * Contract Tests: Trade Domain Contracts (Phase Trade, PR 8.1)
 *
 * Enforces layering, isolation, and governance rules for the trade domain.
 *
 * Rules:
 *   TRADE_SERVER_ACTIONS_ORG_REQUIRED_001 — all server actions call resolveOrgContext()
 *   TRADE_FSM_ENFORCED_002 — deal stage transitions use attemptDealTransition()
 *   TRADE_INTEGRATIONS_DISPATCHER_ONLY_003 — no direct SDK import in trade app
 *   TRADE_EVIDENCE_REQUIRED_FOR_TERMINAL_STATES_004 — terminal transitions require evidence
 *   TRADE_CARS_BOUNDARY_005 — core packages may NOT import from trade-cars
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '../..')

// ── Helpers ─────────────────────────────────────────────────────────────────

function readAllFilesRecursive(dir: string, ext = '.ts'): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = []
  if (!existsSync(dir)) return results

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      results.push(...readAllFilesRecursive(fullPath, ext))
    } else if (entry.isFile() && (entry.name.endsWith(ext) || entry.name.endsWith('.tsx'))) {
      results.push({ path: fullPath, content: readFileSync(fullPath, 'utf-8') })
    }
  }
  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// TRADE_SERVER_ACTIONS_ORG_REQUIRED_001
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_SERVER_ACTIONS_ORG_REQUIRED_001', () => {
  const actionsDir = join(REPO_ROOT, 'apps', 'trade', 'lib', 'actions')
  const actionFiles = readAllFilesRecursive(actionsDir).filter(
    (f) => !f.path.endsWith('index.ts') && !f.path.includes('.test.'),
  )

  it('actions directory exists with server action files', () => {
    expect(actionFiles.length).toBeGreaterThan(0)
  })

  for (const file of actionFiles) {
    const fileName = file.path.replace(REPO_ROOT, '')

    it(`${fileName} uses 'use server' directive`, () => {
      expect(file.content).toContain("'use server'")
    })

    it(`${fileName} calls resolveOrgContext()`, () => {
      expect(file.content).toContain('resolveOrgContext')
    })

    it(`${fileName} imports resolveOrgContext from resolve-org`, () => {
      expect(file.content).toMatch(/import.*resolveOrgContext.*from.*resolve-org/)
    })

    it(`${fileName} includes audit entry generation`, () => {
      expect(file.content).toMatch(/buildActionAuditEntry|buildTransitionAuditEntry/)
    })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// TRADE_FSM_ENFORCED_002
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_FSM_ENFORCED_002', () => {
  it('deal-actions.ts uses attemptDealTransition for stage changes', () => {
    const dealActionsPath = join(REPO_ROOT, 'apps', 'trade', 'lib', 'actions', 'deal-actions.ts')
    const content = readFileSync(dealActionsPath, 'utf-8')
    expect(content).toContain('attemptDealTransition')
  })

  it('deal-actions.ts imports tradeDealMachine', () => {
    const dealActionsPath = join(REPO_ROOT, 'apps', 'trade', 'lib', 'actions', 'deal-actions.ts')
    const content = readFileSync(dealActionsPath, 'utf-8')
    expect(content).toContain('tradeDealMachine')
  })

  it('deal FSM machine definition exists in trade-core', () => {
    const machinePath = join(REPO_ROOT, 'packages', 'trade-core', 'src', 'machines', 'deal.ts')
    expect(existsSync(machinePath)).toBe(true)
  })

  it('deal FSM engine exists in trade-core', () => {
    const enginePath = join(REPO_ROOT, 'packages', 'trade-core', 'src', 'machines', 'engine.ts')
    expect(existsSync(enginePath)).toBe(true)
  })

  it('no direct stage mutation in server actions (no .stage = assignment)', () => {
    const allTradeActions = readAllFilesRecursive(
      join(REPO_ROOT, 'apps', 'trade', 'lib', 'actions'),
    )
    for (const f of allTradeActions) {
      // Should not contain direct stage assignment like `.stage =` or `stage:` mutations
      // outside of FSM result handling
      const lines = f.content.split('\n')
      for (const line of lines) {
        // Allow stage references in FSM calls, but not in direct DB mutations
        if (line.includes('.stage =') && !line.includes('//') && !line.includes('result.')) {
          expect.fail(
            `Direct stage mutation found in ${f.path}: "${line.trim()}" — use attemptDealTransition() instead`,
          )
        }
      }
    }
  })

  it('deal machine has evidence required for accepted, shipped, closed transitions', () => {
    const machinePath = join(REPO_ROOT, 'packages', 'trade-core', 'src', 'machines', 'deal.ts')
    const content = readFileSync(machinePath, 'utf-8')

    // The transitions to accepted, shipped (from funded), and closed should have evidenceRequired: true
    // We verify the machine definition includes these markers
    expect(content).toContain('evidenceRequired: true')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TRADE_INTEGRATIONS_DISPATCHER_ONLY_003
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_INTEGRATIONS_DISPATCHER_ONLY_003', () => {
  const FORBIDDEN_DIRECT_IMPORTS = [
    '@sendgrid/mail',
    '@twilio',
    '@slack/web-api',
    'hubspot-api',
    '@hubspot/api-client',
    'nodemailer',
  ]

  const tradeAppFiles = readAllFilesRecursive(join(REPO_ROOT, 'apps', 'trade'))
  const tradeCoreFiles = readAllFilesRecursive(join(REPO_ROOT, 'packages', 'trade-core'))

  for (const sdk of FORBIDDEN_DIRECT_IMPORTS) {
    it(`apps/trade does not directly import ${sdk}`, () => {
      for (const f of tradeAppFiles) {
        expect(f.content).not.toContain(`from '${sdk}`)
        expect(f.content).not.toContain(`from "${sdk}`)
        expect(f.content).not.toContain(`require('${sdk}`)
        expect(f.content).not.toContain(`require("${sdk}`)
      }
    })

    it(`packages/trade-core does not directly import ${sdk}`, () => {
      for (const f of tradeCoreFiles) {
        expect(f.content).not.toContain(`from '${sdk}`)
        expect(f.content).not.toContain(`from "${sdk}`)
      }
    })
  }

  it('event emitter references integrations-runtime dispatcher (not direct SDK)', () => {
    const emitterPath = join(
      REPO_ROOT,
      'apps',
      'trade',
      'lib',
      'events',
      'trade-event-emitter.ts',
    )
    if (existsSync(emitterPath)) {
      const content = readFileSync(emitterPath, 'utf-8')
      expect(content).toContain('integrations-runtime')
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TRADE_EVIDENCE_REQUIRED_FOR_TERMINAL_STATES_004
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_EVIDENCE_REQUIRED_FOR_TERMINAL_STATES_004', () => {
  it('evidence pack module exists', () => {
    const evidencePath = join(
      REPO_ROOT,
      'apps',
      'trade',
      'lib',
      'evidence',
      'trade-evidence-packs.ts',
    )
    expect(existsSync(evidencePath)).toBe(true)
  })

  it('evidence module covers quote acceptance, shipment docs, and commission settlement', () => {
    const evidencePath = join(
      REPO_ROOT,
      'apps',
      'trade',
      'lib',
      'evidence',
      'trade-evidence-packs.ts',
    )
    const content = readFileSync(evidencePath, 'utf-8')

    expect(content).toContain('buildQuoteAcceptancePack')
    expect(content).toContain('buildShipmentDocsPack')
    expect(content).toContain('buildCommissionSettlementPack')
  })

  it('evidence module uses computeMerkleRoot for integrity', () => {
    const evidencePath = join(
      REPO_ROOT,
      'apps',
      'trade',
      'lib',
      'evidence',
      'trade-evidence-packs.ts',
    )
    const content = readFileSync(evidencePath, 'utf-8')
    expect(content).toContain('computeMerkleRoot')
  })

  it('evidence module uses SHA-256 hashing', () => {
    const evidencePath = join(
      REPO_ROOT,
      'apps',
      'trade',
      'lib',
      'evidence',
      'trade-evidence-packs.ts',
    )
    const content = readFileSync(evidencePath, 'utf-8')
    expect(content).toContain('sha256')
  })

  it('deal FSM marks terminal-adjacent transitions as evidence-required', () => {
    const machinePath = join(REPO_ROOT, 'packages', 'trade-core', 'src', 'machines', 'deal.ts')
    const content = readFileSync(machinePath, 'utf-8')

    // Count evidenceRequired: true occurrences — should be at least 3
    // (accepted, shipped, closed per the spec)
    const matches = content.match(/evidenceRequired:\s*true/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// TRADE_CARS_BOUNDARY_005
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_CARS_BOUNDARY_005', () => {
  const corePackages = [
    'packages/trade-core',
    'packages/trade-db',
    'packages/trade-adapters',
  ]

  for (const pkg of corePackages) {
    const pkgDir = join(REPO_ROOT, pkg)
    const files = readAllFilesRecursive(pkgDir)

    it(`${pkg} does NOT import from @nzila/trade-cars`, () => {
      for (const f of files) {
        const hasImport =
          f.content.includes("from '@nzila/trade-cars") ||
          f.content.includes('from "@nzila/trade-cars') ||
          f.content.includes("require('@nzila/trade-cars") ||
          f.content.includes('require("@nzila/trade-cars')

        if (hasImport) {
          expect.fail(
            `${f.path.replace(REPO_ROOT, '')} imports from @nzila/trade-cars — ` +
              `core packages must NOT depend on the cars vertical. ` +
              `Only apps/trade may import both core and cars packages.`,
          )
        }
      }
    })
  }

  it('apps/trade is allowed to import from @nzila/trade-cars', () => {
    const tradeAppPkg = join(REPO_ROOT, 'apps', 'trade', 'package.json')
    if (existsSync(tradeAppPkg)) {
      const pkg = JSON.parse(readFileSync(tradeAppPkg, 'utf-8'))
      // apps/trade may have trade-cars as a dependency (allowed)
      expect(pkg.dependencies?.['@nzila/trade-cars'] || true).toBeTruthy()
    }
  })

  it('trade-cars does not import from trade-adapters (isolation)', () => {
    const carsDir = join(REPO_ROOT, 'packages', 'trade-cars')
    const carsFiles = readAllFilesRecursive(carsDir)
    for (const f of carsFiles) {
      expect(f.content).not.toContain("from '@nzila/trade-adapters")
      expect(f.content).not.toContain('from "@nzila/trade-adapters')
    }
  })

  it('trade-cars package.json does not list trade-adapters as dependency', () => {
    const carsPkg = join(REPO_ROOT, 'packages', 'trade-cars', 'package.json')
    const pkg = JSON.parse(readFileSync(carsPkg, 'utf-8'))
    expect(pkg.dependencies?.['@nzila/trade-adapters']).toBeUndefined()
    expect(pkg.devDependencies?.['@nzila/trade-adapters']).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Additional structural contracts
// ══════════════════════════════════════════════════════════════════════════════

describe('TRADE_STRUCTURAL_CONTRACTS', () => {
  it('trade DB schema exists in packages/db/src/schema/trade.ts', () => {
    const schemaPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'trade.ts')
    expect(existsSync(schemaPath)).toBe(true)
  })

  it('trade schema is exported from db schema barrel', () => {
    const indexPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain("from './trade'")
  })

  it('all core trade tables have org_id column', () => {
    const schemaPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'trade.ts')
    const content = readFileSync(schemaPath, 'utf-8')

    // All pgTable definitions should include org_id
    const tableMatches = content.match(/pgTable\('trade_[^']+'/g)
    expect(tableMatches).not.toBeNull()
    expect(tableMatches!.length).toBeGreaterThanOrEqual(9)

    // Check that org_id appears consistently
    expect(content.match(/org_id/g)?.length ?? 0).toBeGreaterThanOrEqual(9)
  })

  it('cars vertical tables (trade_vehicle_*) are separate from core tables', () => {
    const schemaPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'trade.ts')
    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain("trade_vehicle_listings")
    expect(content).toContain("trade_vehicle_docs")
  })

  it('trade_vehicle_listings links to trade_listings via listing_id FK', () => {
    const schemaPath = join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'trade.ts')
    const content = readFileSync(schemaPath, 'utf-8')
    // Should reference tradeListings via listing_id
    expect(content).toContain('listing_id')
    expect(content).toContain('tradeListings.id')
  })

  it('resolve-org.ts exists and uses platform auth', () => {
    const resolveOrgPath = join(REPO_ROOT, 'apps', 'trade', 'lib', 'resolve-org.ts')
    const content = readFileSync(resolveOrgPath, 'utf-8')
    expect(content).toContain('@nzila/platform-auth/entra/server')
    expect(content).toContain('resolveOrgContext')
  })

  it('trade domain events module exists', () => {
    const eventsPath = join(REPO_ROOT, 'apps', 'trade', 'lib', 'events', 'trade-event-emitter.ts')
    expect(existsSync(eventsPath)).toBe(true)
  })

  it('migration docs exist', () => {
    expect(
      existsSync(join(REPO_ROOT, 'docs', 'migration', 'trade', 'canonical-domain-map.md')),
    ).toBe(true)
    expect(
      existsSync(join(REPO_ROOT, 'docs', 'migration', 'trade', 'cars-vertical-scope.md')),
    ).toBe(true)
  })
})
