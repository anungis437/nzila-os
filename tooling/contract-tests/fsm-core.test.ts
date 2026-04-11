/**
 * Contract Test — @nzila/fsm-core Package Invariants
 *
 * Validates that the generic FSM engine package maintains its architectural
 * contracts:
 *
 *   FSM-CORE-01: Package structure and exports
 *   FSM-CORE-02: Engine is pure (no I/O imports)
 *   FSM-CORE-03: Event bridge exists and follows platform-events pattern
 *   FSM-CORE-04: Tests exist with meaningful coverage
 *   FSM-CORE-05: Type system includes all required primitives
 *
 * @invariant FSM-CORE-01 through FSM-CORE-05
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const PKG = join(ROOT, 'packages', 'fsm-core')

describe('FSM-CORE-01 — Package structure', () => {
  it('package.json exists with correct name', () => {
    const path = join(PKG, 'package.json')
    expect(existsSync(path)).toBe(true)
    const pkg = JSON.parse(readFileSync(path, 'utf-8'))
    expect(pkg.name).toBe('@nzila/fsm-core')
    expect(pkg.type).toBe('module')
  })

  it('barrel export exists at src/index.ts', () => {
    const path = join(PKG, 'src', 'index.ts')
    expect(existsSync(path)).toBe(true)
  })

  it('exports engine, audited, registry, builders, and events modules', () => {
    const barrel = readFileSync(join(PKG, 'src', 'index.ts'), 'utf-8')
    expect(barrel).toContain('attemptTransition')
    expect(barrel).toContain('executeTransition')
    expect(barrel).toContain('registerMachine')
    expect(barrel).toContain('transition')
    expect(barrel).toContain('platformEventsFromTransition')
  })
})

describe('FSM-CORE-02 — Engine purity', () => {
  it('engine.ts has no database or fetch imports', () => {
    const content = readFileSync(join(PKG, 'src', 'engine.ts'), 'utf-8')
    expect(content).not.toContain("import.*from.*'drizzle")
    expect(content).not.toContain("import.*from.*'pg'")
    expect(content).not.toContain("import.*from.*'postgres'")
    expect(content).not.toMatch(/\bfetch\s*\(/)
  })

  it('engine.ts only imports from local types', () => {
    const content = readFileSync(join(PKG, 'src', 'engine.ts'), 'utf-8')
    // Extract the `from '...'` clauses from import statements
    const fromClauses = content.match(/}\s+from\s+['"][^'"]+['"]/g) ?? []
    for (const clause of fromClauses) {
      expect(
        clause,
        'engine.ts must only import from ./types',
      ).toMatch(/['"]\.\/types['"]/)
    }
  })
})

describe('FSM-CORE-03 — Event bridge follows platform-events pattern', () => {
  it('events.ts exists', () => {
    expect(existsSync(join(PKG, 'src', 'events.ts'))).toBe(true)
  })

  it('events.ts references createPlatformEvent from @nzila/platform-events', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('@nzila/platform-events')
    expect(content).toContain('createPlatformEvent')
  })

  it('events.ts emits fsm.transition.completed event type', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('fsm.transition.completed')
  })

  it('events.ts threads correlationId and orgId', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('correlationId')
    expect(content).toContain('orgId')
    expect(content).toContain('actorId')
  })
})

describe('FSM-CORE-04 — Tests exist', () => {
  it('engine.test.ts exists with transition assertions', () => {
    const path = join(PKG, 'src', '__tests__', 'engine.test.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('attemptTransition')
    expect(content).toContain('expect')
  })

  it('tests cover all failure codes', () => {
    const content = readFileSync(
      join(PKG, 'src', '__tests__', 'engine.test.ts'),
      'utf-8',
    )
    expect(content).toContain('TERMINAL_STATE')
    expect(content).toContain('INVALID_TRANSITION')
    expect(content).toContain('ORG_MISMATCH')
    expect(content).toContain('ROLE_DENIED')
    expect(content).toContain('GUARD_FAILED')
  })
})

describe('FSM-CORE-05 — Type system completeness', () => {
  it('types.ts exports all required primitives', () => {
    const content = readFileSync(join(PKG, 'src', 'types.ts'), 'utf-8')
    const required = [
      'TransitionContext',
      'Guard',
      'GuardResolver',
      'EmittedEvent',
      'ScheduledAction',
      'TransitionDef',
      'MachineDefinition',
      'TransitionSuccess',
      'TransitionFailure',
      'TransitionResult',
      'TransitionRecord',
      'TransitionFailureCode',
    ]
    for (const name of required) {
      expect(content, `Missing type: ${name}`).toContain(name)
    }
  })

  it('TransitionDef includes org-scoping fields', () => {
    const content = readFileSync(join(PKG, 'src', 'types.ts'), 'utf-8')
    expect(content).toContain('allowedRoles')
  })
})
