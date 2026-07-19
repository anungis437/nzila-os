/**
 * Contract Test — Gate Authority + CI Behavior (Phase 5)
 *
 * Proves the gate-authority taxonomy is honest and enforceable:
 *   - advisory failure does NOT fail CI;
 *   - blocking failure DOES fail CI;
 *   - deprecated gates are excluded from canonical execution;
 *   - every registered gate has a valid classification;
 *   - final:go is visible but advisory (target production-blocking).
 *
 * @invariant INV-GATE-AUTHORITY
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  loadRegistry,
  validateRegistry,
  runAuthority,
  enforcementFor,
  runSelfTest,
  VALID_CLASSIFICATIONS,
  DEFAULT_ENFORCEMENT,
  type AuthorityRegistry,
  type GateEntry,
} from '../governance/gate-authority'

const ROOT = join(__dirname, '..', '..')
const REGISTRY_PATH = join(ROOT, 'governance', 'gates', 'gate-authority-registry.json')

function realRegistry(): AuthorityRegistry {
  return loadRegistry(REGISTRY_PATH)
}

/** Executor that fails only the gate ids in `failIds`. */
function failing(failIds: string[]) {
  const set = new Set(failIds)
  const executed: string[] = []
  const exec = (g: GateEntry) => {
    executed.push(g.id)
    return set.has(g.id) ? { ok: false, detail: 'synthetic failure' } : { ok: true }
  }
  return { exec, executed }
}

describe('INV-GATE-AUTHORITY — registry integrity', () => {
  it('the real registry passes integrity validation', () => {
    const { ok, errors } = validateRegistry(realRegistry())
    expect(errors).toEqual([])
    expect(ok).toBe(true)
  })

  it('every registered gate has a valid classification', () => {
    for (const g of realRegistry().gates) {
      expect(VALID_CLASSIFICATIONS, `${g.id} classification`).toContain(g.classification)
    }
  })

  it('registry summary counts match the actual gate classifications', () => {
    const reg = realRegistry()
    const counts: Record<string, number> = {}
    for (const g of reg.gates) counts[g.classification] = (counts[g.classification] ?? 0) + 1
    const declared = (reg.summary as { byClassification: Record<string, number> }).byClassification
    for (const c of VALID_CLASSIFICATIONS) {
      expect(declared[c] ?? 0, `summary count for ${c}`).toBe(counts[c] ?? 0)
    }
  })

  it('rejects a gate with a missing/invalid classification', () => {
    const reg = realRegistry()
    const broken: AuthorityRegistry = {
      ...reg,
      gates: [...reg.gates, { id: 'bogus', classification: 'super-blocking' as never, scope: 's', owner: 'o', command: 'x' }],
    }
    const { ok, errors } = validateRegistry(broken)
    expect(ok).toBe(false)
    expect(errors.some((e) => e.includes('bogus'))).toBe(true)
  })
})

describe('INV-GATE-AUTHORITY — enforcement mapping', () => {
  it('maps every classification to an enforcement mode', () => {
    expect(enforcementFor('pr-blocking')).toBe('blocking')
    expect(enforcementFor('release-blocking')).toBe('blocking')
    expect(enforcementFor('pilot-blocking')).toBe('blocking')
    expect(enforcementFor('production-blocking')).toBe('blocking')
    expect(enforcementFor('advisory')).toBe('report-only')
    expect(enforcementFor('experimental')).toBe('report-only')
    expect(enforcementFor('deprecated')).toBe('excluded')
  })

  it('default enforcement table covers all valid classifications', () => {
    for (const c of VALID_CLASSIFICATIONS) {
      expect(DEFAULT_ENFORCEMENT[c]).toBeDefined()
    }
  })
})

describe('INV-GATE-AUTHORITY — CI behavior semantics', () => {
  it('a BLOCKING gate failure DOES fail CI (exitCode 1)', async () => {
    const reg = realRegistry()
    const blockingGate = reg.gates.find((g) => enforcementFor(g.classification, reg) === 'blocking')!
    const { exec } = failing([blockingGate.id])
    const result = await runAuthority(reg, exec)
    expect(result.exitCode).toBe(1)
    expect(result.blockingFailures).toBeGreaterThanOrEqual(1)
  })

  it('an ADVISORY gate failure does NOT fail CI (exitCode 0)', async () => {
    const reg = realRegistry()
    const advisoryGate = reg.gates.find((g) => g.classification === 'advisory')!
    const { exec } = failing([advisoryGate.id])
    const result = await runAuthority(reg, exec)
    expect(result.exitCode).toBe(0)
    expect(result.advisoryFailures).toBeGreaterThanOrEqual(1)
  })

  it('an EXPERIMENTAL gate failure does NOT fail CI (exitCode 0)', async () => {
    const reg = realRegistry()
    const expGate = reg.gates.find((g) => g.classification === 'experimental')!
    const { exec } = failing([expGate.id])
    const result = await runAuthority(reg, exec)
    expect(result.exitCode).toBe(0)
  })

  it('DEPRECATED gates are excluded from canonical execution (never run)', async () => {
    const reg = realRegistry()
    const deprecated = reg.gates.filter((g) => g.classification === 'deprecated').map((g) => g.id)
    expect(deprecated.length).toBeGreaterThan(0)
    const { exec, executed } = failing([])
    const result = await runAuthority(reg, exec)
    for (const id of deprecated) {
      expect(executed, `deprecated gate ${id} must not execute`).not.toContain(id)
    }
    expect(result.skipped).toBe(deprecated.length)
  })

  it('the built-in self-test proves advisory!=fail / blocking=fail / deprecated excluded', async () => {
    const { ok, failures } = await runSelfTest()
    expect(failures).toEqual([])
    expect(ok).toBe(true)
  })
})

describe('INV-GATE-AUTHORITY — specific gate handling', () => {
  it('final:go is registered, advisory, and targets production-blocking (visible, not blocking)', () => {
    const reg = realRegistry()
    const finalGo = reg.gates.find((g) => g.id === 'validate-final-go')
    expect(finalGo, 'final:go must be in the registry').toBeDefined()
    expect(finalGo!.classification).toBe('advisory')
    expect(finalGo!.targetClassification).toBe('production-blocking')
    expect(finalGo!.promotionCondition).toMatch(/certification artifacts/i)
    expect(enforcementFor(finalGo!.classification, reg)).toBe('report-only')
  })

  it('live-readiness is advisory with production-blocking target (evidence absent)', () => {
    const reg = realRegistry()
    const lr = reg.gates.find((g) => g.id === 'validate-live-readiness')!
    expect(lr.classification).toBe('advisory')
    expect(lr.targetClassification).toBe('production-blocking')
  })

  it('the path-repaired UE validators are NOT over-promoted to blocking', () => {
    const reg = realRegistry()
    for (const id of ['validate-runtime-authority', 'validate-runtime-convergence', 'validate-ue-infrastructure', 'validate-navigation-monetization']) {
      const g = reg.gates.find((x) => x.id === id)!
      expect(enforcementFor(g.classification, reg), `${id} must remain report-only`).toBe('report-only')
    }
  })

  it('still-failing UE validators are flagged repair-required (honest red, not green)', () => {
    const reg = realRegistry()
    for (const id of ['validate-ue-infrastructure', 'validate-navigation-monetization']) {
      const g = reg.gates.find((x) => x.id === id)!
      expect(g.repairRequired, `${id} must be repair-required`).toBe(true)
    }
  })

  it('no gate has achieved production-blocking classification yet', () => {
    const reg = realRegistry()
    const achieved = reg.gates.filter((g) => g.classification === 'production-blocking')
    expect(achieved).toEqual([])
  })
})

describe('INV-GATE-AUTHORITY — registry file shape', () => {
  it('declares the v2 schema and the seven taxonomy categories', () => {
    const raw = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
    expect(raw.$schema).toBe('gate-authority-registry/v2')
    expect(Object.keys(raw.taxonomy.categories).sort()).toEqual([...VALID_CLASSIFICATIONS].sort())
  })
})
