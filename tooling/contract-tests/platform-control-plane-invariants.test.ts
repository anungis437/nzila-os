/**
 * Contract Tests — Integration Control Plane Invariants
 *
 * Structural and behavioral invariants for @nzila/platform-integrations-control-plane.
 * Enforces: package structure, no console.*, no any, Zod schemas,
 * "org" nomenclature, webhook verification, DLQ management.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PKG_DIR = join(ROOT, 'packages/platform-integrations-control-plane')

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

describe('PLAT-CP-01: Package structure', () => {
  it('should have required scaffolding files', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/index.ts'))).toBe(true)
  })

  it('should have required source modules', () => {
    expect(existsSync(join(PKG_DIR, 'src/types.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/registry.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/webhook-verify.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/dlq.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/rate-limiter.ts'))).toBe(true)
  })

  it('should declare correct package name', () => {
    const pkg = JSON.parse(readContent(join(PKG_DIR, 'package.json')))
    expect(pkg.name).toBe('@nzila/platform-integrations-control-plane')
    expect(pkg.type).toBe('module')
  })
})

// ── No console.* ────────────────────────────────────────────────────────────

describe('PLAT-CP-02: No console.* in source', () => {
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

describe('PLAT-CP-03: No any type', () => {
  it('should not use any type assertions in source files', () => {
    const violations: string[] = []
    for (const file of getSourceFiles()) {
      const content = readContent(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
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

describe('PLAT-CP-04: org nomenclature', () => {
  it('should use "org" and never "tenant" in source files', () => {
    const violations: string[] = []
    for (const file of getSourceFiles()) {
      const content = readContent(file)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (/\btenant(Id|_id|Name|_name)?\b/i.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
          const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
          violations.push(`${rel}:${String(i + 1)} — ${line.trim()}`)
        }
      }
    }
    expect(violations, `Found 'tenant' nomenclature:\n${violations.join('\n')}`).toHaveLength(0)
  })
})

// ── Zod Schemas ─────────────────────────────────────────────────────────────

describe('PLAT-CP-05: Zod validation', () => {
  it('should have Zod schemas in types.ts', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('z.object')
    expect(types).toContain('from \'zod\'')
  })
})

// ── Security Controls ───────────────────────────────────────────────────────

describe('PLAT-CP-06: Security controls', () => {
  it('should use HMAC-SHA256 for webhook verification', () => {
    const verify = readContent(join(PKG_DIR, 'src/webhook-verify.ts'))
    expect(verify).toContain('sha256')
    expect(verify.toLowerCase()).toContain('hmac')
  })

  it('should use timing-safe comparison', () => {
    const verify = readContent(join(PKG_DIR, 'src/webhook-verify.ts'))
    expect(verify).toContain('timingSafeEqual')
  })

  it('should have replay protection', () => {
    const verify = readContent(join(PKG_DIR, 'src/webhook-verify.ts'))
    expect(verify).toContain('replay')
  })
})

// ── Port Pattern ────────────────────────────────────────────────────────────

describe('PLAT-CP-07: Port pattern', () => {
  it('should define ports interfaces', () => {
    const registry = readContent(join(PKG_DIR, 'src/registry.ts'))
    expect(registry).toContain('interface')
    expect(registry).toContain('Ports')
  })

  it('should use constructor injection in registry', () => {
    const registry = readContent(join(PKG_DIR, 'src/registry.ts'))
    expect(registry).toContain('constructor')
    expect(registry).toContain('ports')
  })
})
