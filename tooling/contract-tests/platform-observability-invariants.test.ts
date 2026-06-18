/**
 * Contract Tests — Platform Observability Invariants
 *
 * Structural and behavioral invariants for @nzila/platform-observability.
 * Enforces: package structure, no console.*, no any, W3C Trace Context,
 * Prometheus metrics format, health-check builder.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PKG_DIR = join(ROOT, 'packages/platform-observability')

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

describe('PLAT-OBS-01: Package structure', () => {
  it('should have required scaffolding files', () => {
    expect(existsSync(join(PKG_DIR, 'package.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/index.ts'))).toBe(true)
  })

  it('should have required source modules', () => {
    expect(existsSync(join(PKG_DIR, 'src/types.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/correlation.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/metrics.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/span.ts'))).toBe(true)
    expect(existsSync(join(PKG_DIR, 'src/health.ts'))).toBe(true)
  })

  it('should declare correct package name', () => {
    const pkg = JSON.parse(readContent(join(PKG_DIR, 'package.json')))
    expect(pkg.name).toBe('@nzila/platform-observability')
    expect(pkg.type).toBe('module')
  })
})

// ── No console.* ────────────────────────────────────────────────────────────

describe('PLAT-OBS-02: No console.* in source', () => {
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

describe('PLAT-OBS-03: No any type', () => {
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

describe('PLAT-OBS-04: org nomenclature', () => {
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

// ── W3C Trace Context ───────────────────────────────────────────────────────

describe('PLAT-OBS-05: W3C Trace Context support', () => {
  it('should support traceparent header format', () => {
    const correlation = readContent(join(PKG_DIR, 'src/correlation.ts'))
    expect(correlation).toContain('traceparent')
  })

  it('should generate trace IDs and span IDs', () => {
    const correlation = readContent(join(PKG_DIR, 'src/correlation.ts'))
    expect(correlation).toContain('generateTraceId')
    expect(correlation).toContain('generateSpanId')
  })
})

// ── Prometheus Format ───────────────────────────────────────────────────────

describe('PLAT-OBS-06: Prometheus metrics', () => {
  it('should support Prometheus text exposition format', () => {
    const metrics = readContent(join(PKG_DIR, 'src/metrics.ts'))
    expect(metrics).toContain('renderPrometheus')
    expect(metrics).toContain('HELP')
    expect(metrics).toContain('TYPE')
  })

  it('should support counter, gauge, and histogram metric types', () => {
    const metrics = readContent(join(PKG_DIR, 'src/metrics.ts'))
    expect(metrics).toContain('Counter')
    expect(metrics).toContain('Gauge')
    expect(metrics).toContain('Histogram')
  })
})

// ── Health Check ────────────────────────────────────────────────────────────

describe('PLAT-OBS-07: Health check builder', () => {
  it('should provide a health check registration system', () => {
    const health = readContent(join(PKG_DIR, 'src/health.ts'))
    expect(health).toContain('HealthChecker')
    expect(health).toContain('addCheck')
  })
})
