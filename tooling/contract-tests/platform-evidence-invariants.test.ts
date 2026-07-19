/**
 * Contract Tests — Platform Evidence Pack Invariants
 *
 * Structural and behavioral invariants for @nzila/platform-evidence-pack.
 * Enforces: package structure, no console.*, no any, Zod schemas,
 * "org" nomenclature, cryptographic sealing, retention policies.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PKG_DIR = join(ROOT, 'packages/platform-evidence-pack')

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

describe('PLAT-EVD-01: Package structure', () => {
  it('should have required scaffolding files', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/index.ts'))).toBe(true)
  })

  it('should have required source modules', () => {
    expect(existsSync(join(PKG_DIR, 'src/types.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/orchestrator.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/exporter.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/verifier.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/retention.ts'))).toBe(true)
  })

  it('should declare correct package name', () => {
    const pkg = JSON.parse(readContent(join(PKG_DIR, 'package.json')))
    expect(pkg.name).toBe('@nzila/platform-evidence-pack')
    expect(pkg.type).toBe('module')
  })
})

// ── No console.* ────────────────────────────────────────────────────────────

describe('PLAT-EVD-02: No console.* in source', () => {
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

describe('PLAT-EVD-03: No any type', () => {
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

describe('PLAT-EVD-04: org nomenclature', () => {
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

describe('PLAT-EVD-05: Zod validation', () => {
  it('should have Zod schemas for evidence artifacts and packs', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('evidenceArtifactSchema')
    expect(types).toContain('evidencePackIndexSchema')
    expect(types).toContain('z.object')
  })
})

// ── Cryptographic Integrity ─────────────────────────────────────────────────

describe('PLAT-EVD-06: Cryptographic integrity', () => {
  it('should use SHA-256 for pack digest', () => {
    const orchestrator = readContent(join(PKG_DIR, 'src/orchestrator.ts'))
    expect(orchestrator).toContain('sha256')
  })

  it('should compute Merkle root over artifacts', () => {
    const orchestrator = readContent(join(PKG_DIR, 'src/orchestrator.ts'))
    expect(orchestrator).toContain('merkle')
  })

  it('should support hash verification in verifier', () => {
    const verifier = readContent(join(PKG_DIR, 'src/verifier.ts'))
    expect(verifier).toContain('sha256')
    expect(verifier).toContain('digest')
  })
})

// ── Retention ───────────────────────────────────────────────────────────────

describe('PLAT-EVD-07: Retention policies', () => {
  it('should define retention classes', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('RetentionClass')
    expect(types).toContain('standard')
    expect(types).toContain('regulatory')
  })

  it('should have retention policy enforcement', () => {
    const retention = readContent(join(PKG_DIR, 'src/retention.ts'))
    expect(retention).toContain('RetentionManager')
    expect(retention).toContain('evaluatePack')
  })
})

// ── Port Pattern ────────────────────────────────────────────────────────────

describe('PLAT-EVD-08: Port pattern', () => {
  it('should define ports interfaces', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('OrchestratorPorts')
    expect(types).toContain('ExporterPorts')
    expect(types).toContain('VerifierPorts')
    expect(types).toContain('RetentionPorts')
  })
})
