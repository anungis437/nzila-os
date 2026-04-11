/**
 * Contract Test — @nzila/ingestion-core Package Invariants
 *
 * Validates that the ingestion pipeline package maintains its architectural
 * contracts:
 *
 *   ING-CORE-01: Package structure and exports
 *   ING-CORE-02: Runner is pure (no I/O imports)
 *   ING-CORE-03: Event bridge exists and follows platform-events pattern
 *   ING-CORE-04: Tests exist with meaningful coverage
 *   ING-CORE-05: Pipeline produces correlation IDs
 *
 * @invariant ING-CORE-01 through ING-CORE-05
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const PKG = join(ROOT, 'packages', 'ingestion-core')

describe('ING-CORE-01 — Package structure', () => {
  it('package.json exists with correct name', () => {
    const path = join(PKG, 'package.json')
    expect(existsSync(path)).toBe(true)
    const pkg = JSON.parse(readFileSync(path, 'utf-8'))
    expect(pkg.name).toBe('@nzila/ingestion-core')
    expect(pkg.type).toBe('module')
  })

  it('barrel export exists at src/index.ts', () => {
    const path = join(PKG, 'src', 'index.ts')
    expect(existsSync(path)).toBe(true)
  })

  it('exports runner, audited, registry, builders, and events modules', () => {
    const barrel = readFileSync(join(PKG, 'src', 'index.ts'), 'utf-8')
    expect(barrel).toContain('runPipeline')
    expect(barrel).toContain('executePipeline')
    expect(barrel).toContain('registerPipeline')
    expect(barrel).toContain('pipeline')
    expect(barrel).toContain('pipelineEventsFromResult')
  })
})

describe('ING-CORE-02 — Runner purity', () => {
  it('runner.ts has no database or fetch imports', () => {
    const content = readFileSync(join(PKG, 'src', 'runner.ts'), 'utf-8')
    expect(content).not.toContain("import.*from.*'drizzle")
    expect(content).not.toContain("import.*from.*'pg'")
    expect(content).not.toContain("import.*from.*'postgres'")
    expect(content).not.toMatch(/\bfetch\s*\(/)
  })

  it('runner.ts only imports from ./types', () => {
    const content = readFileSync(join(PKG, 'src', 'runner.ts'), 'utf-8')
    const imports = content.match(/from\s+['"]([^'"]+)['"]/g) ?? []
    for (const imp of imports) {
      expect(imp).toMatch(/from\s+['"]\.\/types['"]/)
    }
  })
})

describe('ING-CORE-03 — Event bridge follows platform-events pattern', () => {
  it('events.ts exists', () => {
    expect(existsSync(join(PKG, 'src', 'events.ts'))).toBe(true)
  })

  it('events.ts references createPlatformEvent from @nzila/platform-events', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('@nzila/platform-events')
    expect(content).toContain('createPlatformEvent')
  })

  it('events.ts emits ingestion.pipeline.started and completed event types', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('ingestion.pipeline.started')
    expect(content).toContain('ingestion.pipeline.completed')
  })

  it('events.ts threads correlationId and orgId', () => {
    const content = readFileSync(join(PKG, 'src', 'events.ts'), 'utf-8')
    expect(content).toContain('correlationId')
    expect(content).toContain('orgId')
    expect(content).toContain('actorId')
  })
})

describe('ING-CORE-04 — Tests exist', () => {
  it('runner.test.ts exists with pipeline assertions', () => {
    const path = join(PKG, 'src', '__tests__', 'runner.test.ts')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('runPipeline')
    expect(content).toContain('expect')
  })

  it('tests cover all outcomes', () => {
    const content = readFileSync(
      join(PKG, 'src', '__tests__', 'runner.test.ts'),
      'utf-8',
    )
    expect(content).toContain('completed')
    expect(content).toContain('failed')
    expect(content).toContain('partial')
    expect(content).toContain('skipped')
  })
})

describe('ING-CORE-05 — Pipeline produces correlation IDs', () => {
  it('runner.ts generates correlationId via crypto.randomUUID', () => {
    const content = readFileSync(join(PKG, 'src', 'runner.ts'), 'utf-8')
    expect(content).toContain('crypto.randomUUID()')
  })

  it('PipelineContext type includes correlationId', () => {
    const content = readFileSync(join(PKG, 'src', 'types.ts'), 'utf-8')
    expect(content).toContain('correlationId')
  })

  it('IngestionRecord type includes correlationId, orgId, actorId', () => {
    const content = readFileSync(join(PKG, 'src', 'types.ts'), 'utf-8')
    // Check the IngestionRecord section
    const recordSection = content.slice(
      content.indexOf('interface IngestionRecord'),
    )
    expect(recordSection).toContain('correlationId')
    expect(recordSection).toContain('orgId')
    expect(recordSection).toContain('actorId')
  })
})
