/**
 * Contract Tests — @nzila/onboarding-core
 *
 * Static architectural invariants. These tests read source files
 * to enforce structural properties of the package.
 *
 * @invariant OB-CORE-01 Package structure
 * @invariant OB-CORE-02 Engine purity
 * @invariant OB-CORE-03 Event bridge
 * @invariant OB-CORE-04 Tests exist
 * @invariant OB-CORE-05 Type system completeness
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PKG = resolve(__dirname, '../../packages/onboarding-core')
const src = (f: string) => resolve(PKG, 'src', f)
const read = (f: string) => readFileSync(f, 'utf-8')

// ── OB-CORE-01: Package Structure ──────────────────────────────────────────

describe('OB-CORE-01 — Package structure', () => {
  it('has a valid package.json with correct name', () => {
    const pkg = JSON.parse(read(resolve(PKG, 'package.json')))
    expect(pkg.name).toBe('@nzila/onboarding-core')
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

// ── OB-CORE-02: Engine Purity ──────────────────────────────────────────────

describe('OB-CORE-02 — Engine purity (no I/O)', () => {
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
    // types.ts should only have type definitions, no runtime imports
    const runtimeImports = [...types.matchAll(/^import\s+(?!type\s)/gm)]
    expect(runtimeImports).toHaveLength(0)
  })
})

// ── OB-CORE-03: Event Bridge ───────────────────────────────────────────────

describe('OB-CORE-03 — Event bridge', () => {
  it('events.ts exists', () => {
    expect(existsSync(src('events.ts'))).toBe(true)
  })

  it('references @nzila/platform-events', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('@nzila/platform-events')
    expect(events).toContain('createPlatformEvent')
  })

  it('emits onboarding.step.completed event', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('onboarding.step.completed')
  })

  it('emits onboarding.flow.completed event', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('onboarding.flow.completed')
  })

  it('threads metadata (orgId, actorId, correlationId)', () => {
    const events = read(src('events.ts'))
    expect(events).toContain('orgId')
    expect(events).toContain('actorId')
    expect(events).toContain('correlationId')
    expect(events).toContain('causationId')
  })
})

// ── OB-CORE-04: Tests Exist ────────────────────────────────────────────────

describe('OB-CORE-04 — Tests exist', () => {
  it('has engine tests', () => {
    const testPath = resolve(PKG, 'src/__tests__/engine.test.ts')
    expect(existsSync(testPath)).toBe(true)
    const tests = read(testPath)
    expect(tests).toContain('completeStep')
    expect(tests).toContain('resetStep')
    expect(tests).toContain('evaluateProgress')
    expect(tests).toContain('validateFlow')
  })

  it('tests cover all failure codes', () => {
    const tests = read(resolve(PKG, 'src/__tests__/engine.test.ts'))
    const failureCodes = [
      'step_not_found',
      'already_completed',
      'dependencies_not_met',
      'validation_failed',
      'cannot_start',
    ]
    for (const code of failureCodes) {
      expect(tests, `Test should cover failure code: ${code}`).toContain(code)
    }
  })
})

// ── OB-CORE-05: Type System Completeness ────────────────────────────────────

describe('OB-CORE-05 — Type system completeness', () => {
  it('exports all required type names', () => {
    const barrel = read(src('index.ts'))
    const requiredTypes = [
      'OnboardingStepDef',
      'OnboardingFlowDef',
      'StepCompletion',
      'OnboardingProgress',
      'OnboardingStatus',
      'StepOutcome',
      'StepResult',
      'ProgressSummary',
      'OnboardingRecord',
    ]
    for (const t of requiredTypes) {
      expect(barrel, `Should export type: ${t}`).toContain(t)
    }
  })

  it('types include org-scoping fields', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('orgId')
    expect(types).toContain('actorId')
  })

  it('progress tracks flowId', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('flowId')
  })

  it('steps support dependencies', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('dependsOn')
  })

  it('steps support validation', () => {
    const types = read(src('types.ts'))
    expect(types).toContain('validate')
    expect(types).toContain('StepValidator')
  })
})
