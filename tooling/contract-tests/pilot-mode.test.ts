/**
 * Contract Tests — @nzila/pilot-mode
 *
 * Static architectural invariants. These tests read source files
 * to enforce structural properties of the package.
 *
 * @invariant PILOT-01 Package structure
 * @invariant PILOT-02 Engine purity
 * @invariant PILOT-03 Event bridge
 * @invariant PILOT-04 Tests exist
 * @invariant PILOT-05 Targeting hierarchy
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PKG = resolve(__dirname, '../../packages/pilot-mode')
const src = (f: string) => resolve(PKG, 'src', f)
const read = (f: string) => readFileSync(f, 'utf-8')

// ── PILOT-01: Package Structure ────────────────────────────────────────────

describe('PILOT-01 — Package structure', () => {
  it('has a valid package.json with correct name', () => {
    const pkg = JSON.parse(read(resolve(PKG, 'package.json')))
    expect(pkg.name).toBe('@nzila/pilot-mode')
    expect(pkg.type).toBe('module')
    expect(pkg.private).toBe(true)
  })

  it('has a barrel export', () => {
    expect(existsSync(src('index.ts'))).toBe(true)
    const barrel = read(src('index.ts'))
    expect(barrel).toContain("from './types'")
    expect(barrel).toContain("from './engine'")
    expect(barrel).toContain("from './audited'")
    expect(barrel).toContain("from './registry'")
    expect(barrel).toContain("from './builders'")
    expect(barrel).toContain("from './events'")
  })

  it('has all expected source modules', () => {
    const modules = ['types.ts', 'engine.ts', 'audited.ts', 'registry.ts', 'builders.ts', 'events.ts']
    for (const m of modules) {
      expect(existsSync(src(m)), `${m} should exist`).toBe(true)
    }
  })
})

// ── PILOT-02: Engine Purity ────────────────────────────────────────────────

describe('PILOT-02 — Engine purity (no I/O)', () => {
  it('engine.ts has no database or fetch imports', () => {
    const engine = read(src('engine.ts'))
    expect(engine).not.toMatch(/import.*from\s+['"](@nzila\/db|drizzle-orm|pg|postgres|node:http|node:https)['"]/)
    expect(engine).not.toMatch(/\bfetch\s*\(/)
  })

  it('engine.ts only imports from ./types', () => {
    const engine = read(src('engine.ts'))
    const importMatches = [...engine.matchAll(/}\s+from\s+['"]([^'"]+)['"]/g)]
    const sources = importMatches.map((m) => m[1])
    for (const s of sources) {
      expect(s).toBe('./types')
    }
  })

  it('types.ts has no runtime imports', () => {
    const types = read(src('types.ts'))
    const runtimeImports = [...types.matchAll(/^import\s+(?!type\s)/gm)]
    expect(runtimeImports).toHaveLength(0)
  })
})

// ── PILOT-03: Event Bridge ─────────────────────────────────────────────────

describe('PILOT-03 — Event bridge', () => {
  it('events.ts exists', () => {
    expect(existsSync(src('events.ts'))).toBe(true)
  })

  it('references @nzila/platform-events', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('@nzila/platform-events')
    expect(events).toContain('createPlatformEvent')
  })

  it('emits pilot.flag.evaluated event', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('pilot.flag.evaluated')
  })

  it('emits pilot.cohort.enrolled event', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('pilot.cohort.enrolled')
  })

  it('emits pilot.flag.changed event', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('pilot.flag.changed')
  })

  it('threads metadata (orgId, actorId, correlationId)', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('orgId')
    expect(events).toContain('actorId')
    expect(events).toContain('correlationId')
  })
})

// ── PILOT-04: Tests Exist ──────────────────────────────────────────────────

describe('PILOT-04 — Tests exist', () => {
  it('has engine tests', () => {
    const testPath = resolve(PKG, 'src/__tests__/engine.test.ts')
    expect(existsSync(testPath)).toBe(true)
    const tests = read(testPath)
    expect(tests).toContain('evaluatePilotFlag')
    expect(tests).toContain('evaluateAllFlags')
    expect(tests).toContain('hashBucket')
    expect(tests).toContain('validatePilotFlag')
  })

  it('tests cover all evaluation reasons', () => {
    const tests = read(resolve(PKG, 'src/__tests__/engine.test.ts'))
    const reasons = [
      'flag_disabled',
      'flag_expired',
      'org_targeted',
      'user_targeted',
      'cohort_targeted',
      'percentage_included',
      'no_match',
    ]
    for (const reason of reasons) {
      expect(tests, `Test should cover reason: ${reason}`).toContain(reason)
    }
  })

  it('tests verify percentage distribution', () => {
    const tests = read(resolve(PKG, 'src/__tests__/engine.test.ts'))
    expect(tests).toContain('rollout distribution')
  })
})

// ── PILOT-05: Targeting Hierarchy ──────────────────────────────────────────

describe('PILOT-05 — Targeting hierarchy', () => {
  it('PilotFlagDef supports org targeting', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('orgIds')
  })

  it('PilotFlagDef supports user targeting', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('userIds')
  })

  it('PilotFlagDef supports cohort targeting', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('cohortId')
  })

  it('PilotFlagDef supports percentage rollout', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('percentage')
  })

  it('engine uses deterministic hashing', () => {
    const engine = read(src('engine.ts'))
    expect(engine).toContain('hashBucket')
    expect(engine).toContain('djb2')
  })

  it('PilotContext requires orgId and userId', () => {
    const types = read(src('types.ts'))
    expect(types).toMatch(/interface PilotContext/)
    expect(types).toContain('orgId')
    expect(types).toContain('userId')
  })

  it('supports rollout strategies', () => {
    const types = read(src('types.ts'))
    expect(types).toContain("'instant'")
    expect(types).toContain("'gradual'")
    expect(types).toContain("'canary'")
  })

  it('supports flag expiry', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('expiresAt')
  })
})
