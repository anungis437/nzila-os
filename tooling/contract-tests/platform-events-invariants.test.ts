/**
 * Contract Tests — Platform Events Invariants
 *
 * Structural and behavioral invariants for @nzila/platform-events.
 * Enforces: package structure, no console.*, no any, Zod schemas,
 * "org" nomenclature (never "tenant"), event envelope shape.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PKG_DIR = join(ROOT, 'packages/platform-events')

function readContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function getSourceFiles(): string[] {
  const srcDir = join(PKG_DIR, 'src')
  const files: string[] = []
  function walk(dir: string): void {
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(full)
    }
  }
  if (existsSync(srcDir)) walk(srcDir)
  return files
}

// ── Package Structure ───────────────────────────────────────────────────────

describe('PLAT-EVT-01: Package structure', () => {
  it('should have required scaffolding files', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/index.ts'))).toBe(true)
  })

  it('should have required source modules', () => {
    expect(existsSync(join(PKG_DIR, 'src/types.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/bus.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/schema.ts'))).toBe(true)
  })

  it('should declare correct package name', () => {
    const pkg = JSON.parse(readContent(join(PKG_DIR, 'package.json')))
    expect(pkg.name).toBe('@nzila/platform-events')
    expect(pkg.type).toBe('module')
  })
})

// ── No console.* ────────────────────────────────────────────────────────────

describe('PLAT-EVT-02: No console.* in source', () => {
  it('should not use console.log/warn/error in source files', () => {
    const violations: string[] = []
    for (const file of getSourceFiles()) {
      const content = readContent(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) {
          const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(`${rel}:${String(i + 1)} — ${line.trim()}`)
        }
      }
    }
    expect(violations, `Found console.* usage:\n${violations.join('\n')}`).toHaveLength(0)
  })
})

// ── No `any` ────────────────────────────────────────────────────────────────

describe('PLAT-EVT-03: No any type', () => {
  it('should not use any type assertions in source files', () => {
    const violations: string[] = []
    for (const file of getSourceFiles()) {
      const content = readContent(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        // Match `: unknown`, `as unknown`, `<unknown>`, but not inside comments or strings
        if (/(?<!\/\/.*)\b(:\s*any\b|as\s+any\b|<unknown>)/.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
          const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(`${rel}:${String(i + 1)} — ${line.trim()}`)
        }
      }
    }
    expect(violations, `Found 'any' usage:\n${violations.join('\n')}`).toHaveLength(0)
  })
})

// ── "org" not "tenant" ──────────────────────────────────────────────────────

describe('PLAT-EVT-04: org nomenclature', () => {
  it('should use "org" and never "tenant" in source files', () => {
    const violations: string[] = []
    for (const file of getSourceFiles()) {
      const content = readContent(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const trimmed = line.trimStart()
        if (/\btenant(Id|_id|Name|_name)?\b/i.test(line) && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
          const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(`${rel}:${String(i + 1)} — ${line.trim()}`)
        }
      }
    }
    expect(violations, `Found 'tenant' nomenclature:\n${violations.join('\n')}`).toHaveLength(0)
  })
})

// ── Zod Schemas ─────────────────────────────────────────────────────────────

describe('PLAT-EVT-05: Zod validation', () => {
  it('should have Zod schemas for event validation', () => {
    const schemaFile = readContent(join(PKG_DIR, 'src/schema.ts'))
    expect(schemaFile).toContain('z.object')
    expect(schemaFile).toContain('from \'zod\'')
  })
})

// ── Event Envelope Shape ────────────────────────────────────────────────────

describe('PLAT-EVT-06: Event envelope shape', () => {
  it('should define PlatformEvent type with required fields', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('PlatformEvent')
    expect(types).toContain('orgId')
    expect(types).toContain('correlationId')
    expect(types).toContain('traceId')
  })

  it('should export event categories', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('PLATFORM_EVENT_CATEGORIES')
  })
})
