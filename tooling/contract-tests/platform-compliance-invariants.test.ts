/**
 * Contract Tests — Platform Compliance Snapshots Invariants
 *
 * Structural and behavioral invariants for @nzila/platform-compliance-snapshots.
 * Enforces: package structure, no console.*, no any, Zod schemas,
 * "org" nomenclature, SHA-256 hash chain, snapshot verification.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PKG_DIR = join(ROOT, 'packages/platform-compliance-snapshots')

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

describe('PLAT-CMP-01: Package structure', () => {
  it('should have required scaffolding files', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/index.ts'))).toBe(true)
  })

  it('should have required source modules', () => {
    expect(existsSync(join(PKG_DIR, 'src/types.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/collector.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/chain.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/generator.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/verifier.ts'))).toBe(true)
  })

  it('should declare correct package name', () => {
    const pkg = JSON.parse(readContent(join(PKG_DIR, 'package.json')))
    expect(pkg.name).toBe('@nzila/platform-compliance-snapshots')
    expect(pkg.type).toBe('module')
  })
})

// ── No console.* ────────────────────────────────────────────────────────────

describe('PLAT-CMP-02: No console.* in source', () => {
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

describe('PLAT-CMP-03: No any type', () => {
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

describe('PLAT-CMP-04: org nomenclature', () => {
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

describe('PLAT-CMP-05: Zod validation', () => {
  it('should have Zod schemas for snapshots and chain entries', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('complianceSnapshotSchema')
    expect(types).toContain('snapshotChainEntrySchema')
    expect(types).toContain('complianceControlSchema')
    expect(types).toContain('z.object')
  })
})

// ── Hash Chain ──────────────────────────────────────────────────────────────

describe('PLAT-CMP-06: Immutable hash chain', () => {
  it('should use SHA-256 for snapshot hashing', () => {
    const chain = readContent(join(PKG_DIR, 'src/chain.ts'))
    expect(chain).toContain('sha256')
    expect(chain).toContain('createHash')
  })

  it('should implement canonical JSON serialization', () => {
    const chain = readContent(join(PKG_DIR, 'src/chain.ts'))
    expect(chain).toContain('canonicalize')
    expect(chain).toContain('sort')
  })

  it('should link to previous hash for chain integrity', () => {
    const chain = readContent(join(PKG_DIR, 'src/chain.ts'))
    expect(chain).toContain('previousHash')
  })
})

// ── Snapshot Verification ───────────────────────────────────────────────────

describe('PLAT-CMP-07: Chain verification', () => {
  it('should support snapshot hash recomputation', () => {
    const verifier = readContent(join(PKG_DIR, 'src/verifier.ts'))
    expect(verifier).toContain('computeSnapshotHash')
    expect(verifier).toContain('recomputed')
  })

  it('should detect chain linkage breaks', () => {
    const verifier = readContent(join(PKG_DIR, 'src/verifier.ts'))
    expect(verifier).toContain('brokenAt')
    expect(verifier).toContain('previousHash')
  })
})

// ── Port Pattern ────────────────────────────────────────────────────────────

describe('PLAT-CMP-08: Port pattern', () => {
  it('should define ports interfaces', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('CollectorPorts')
    expect(types).toContain('ChainPorts')
    expect(types).toContain('GeneratorPorts')
    expect(types).toContain('VerifierPorts')
  })
})

// ── Control Families ────────────────────────────────────────────────────────

describe('PLAT-CMP-09: Control families', () => {
  it('should define compliance control families', () => {
    const types = readContent(join(PKG_DIR, 'src/types.ts'))
    expect(types).toContain('CONTROL_FAMILIES')
    expect(types).toContain('access')
    expect(types).toContain('change-mgmt')
    expect(types).toContain('incident-response')
    expect(types).toContain('integrity')
  })
})
