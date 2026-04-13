import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runOpsReadinessAudit } from '../ops-readiness-audit.js'

// ── Test fixtures ───────────────────────────────────────────────────────────

const TEMP_ROOT = join(process.cwd(), '__ops-audit-test-root__')

function setupFixture(packages: Record<string, Record<string, string>>) {
  if (existsSync(TEMP_ROOT)) rmSync(TEMP_ROOT, { recursive: true })
  mkdirSync(TEMP_ROOT, { recursive: true })
  writeFileSync(join(TEMP_ROOT, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

  const pkgRoot = join(TEMP_ROOT, 'packages')
  mkdirSync(pkgRoot, { recursive: true })

  for (const [pkgName, files] of Object.entries(packages)) {
    const pkgDir = join(pkgRoot, pkgName)
    const srcDir = join(pkgDir, 'src')
    mkdirSync(srcDir, { recursive: true })

    for (const [fileName, content] of Object.entries(files)) {
      writeFileSync(join(srcDir, fileName), content)
    }
  }
}

function cleanupFixture() {
  if (existsSync(TEMP_ROOT)) rmSync(TEMP_ROOT, { recursive: true })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ops-readiness-audit', () => {
  afterEach(cleanupFixture)

  it('returns empty report for missing packages dir', () => {
    const tempDir = join(process.cwd(), '__empty-test__')
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), '')
    try {
      const report = runOpsReadinessAudit(tempDir)
      expect(report.totalPackages).toBe(0)
      expect(report.maturityScore).toBe(0)
    } finally {
      rmSync(tempDir, { recursive: true })
    }
  })

  it('skips non-platform packages', () => {
    setupFixture({
      'some-utility': {
        'index.ts': 'export const foo = 1;\nconsole.log("hello")\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.totalPackages).toBe(0)
  })

  it('detects bare console.* as errors in platform packages', () => {
    setupFixture({
      'platform-foo': {
        'index.ts': 'export const x = 1;\n',
        'service.ts': 'console.log("oops");\nconsole.error("bad");\n',
        'util.ts': 'export function y() { return 2; }\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.totalPackages).toBe(1)
    const pkg = report.packages[0]!
    expect(pkg.bareConsoleCount).toBe(2)
    expect(report.findingsBySeverity.error).toBe(2)
  })

  it('no bare-console error when StructuredLogger is present in same file', () => {
    setupFixture({
      'platform-bar': {
        'index.ts': 'export const x = 1;\n',
        'service.ts':
          'import { StructuredLogger } from "@nzila/platform-observability";\nconsole.log("debug");\n',
        'util.ts': 'export function y() { return 2; }\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const pkg = report.packages[0]!
    // The bare console finding should be suppressed when the same file uses StructuredLogger
    expect(pkg.bareConsoleCount).toBe(0)
  })

  it('detects missing structured logging', () => {
    setupFixture({
      'platform-baz': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const logging = report.packages[0]!.findings.find(f => f.rule === 'needs-structured-logging')
    expect(logging).toBeDefined()
    expect(logging!.severity).toBe('warning')
  })

  it('detects missing health check', () => {
    setupFixture({
      'platform-health-test': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
        'd.ts': 'export const d = 4;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const health = report.packages[0]!.findings.find(f => f.rule === 'needs-health-check')
    expect(health).toBeDefined()
    expect(health!.severity).toBe('warning')
  })

  it('recognises all ops maturity markers', () => {
    setupFixture({
      'platform-mature': {
        'index.ts': 'export const x = 1;\n',
        'logging.ts': 'import { StructuredLogger } from "@nzila/platform-observability";\n',
        'health.ts': 'export function healthCheck() { return true; }\n',
        'metrics.ts': 'const collector = new MetricsRegistry();\n',
        'telemetry.ts': 'import { integrationTelemetry } from "@nzila/platform-observability";\n',
        'errors.ts': 'import { classifyFailure } from "@nzila/platform-ops";\n',
        'circuit.ts': 'import { CircuitBreaker } from "@nzila/integrations-runtime";\n',
        'audit.ts': 'export function withAudit() {}\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const pkg = report.packages[0]!
    expect(pkg.hasStructuredLogging).toBe(true)
    expect(pkg.hasHealthCheck).toBe(true)
    expect(pkg.hasMetrics).toBe(true)
    expect(pkg.hasTelemetryContract).toBe(true)
    expect(pkg.hasErrorClassification).toBe(true)
    expect(pkg.hasCircuitBreaker).toBe(true)
    expect(pkg.hasAuditEmission).toBe(true)
    expect(pkg.bareConsoleCount).toBe(0)
  })

  it('computes maturity score correctly', () => {
    // Package with all 4 key markers: 100%
    setupFixture({
      'platform-full': {
        'index.ts': 'export const x = 1;\n',
        'log.ts': 'const logger = new StructuredLogger();\n',
        'health.ts': 'export function healthCheck() {}\n',
        'met.ts': 'const m = new MetricsRegistry();\n',
        'aud.ts': 'export function withAudit() {}\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.maturityScore).toBe(100)
  })

  it('computes partial maturity score', () => {
    // Package with 2/4 key markers: 50%
    setupFixture({
      'platform-half': {
        'index.ts': 'export const x = 1;\n',
        'log.ts': 'const logger = new StructuredLogger();\n',
        'health.ts': 'export function healthCheck() {}\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.maturityScore).toBe(50)
  })

  it('scans integrations- and ai- prefixed packages', () => {
    setupFixture({
      'integrations-foo': {
        'index.ts': 'export const x = 1;\n',
      },
      'ai-bar': {
        'index.ts': 'export const y = 2;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.totalPackages).toBe(2)
    expect(report.packages.map(p => p.name).sort()).toEqual(['ai-bar', 'integrations-foo'])
  })

  it('scans ml- prefixed packages', () => {
    setupFixture({
      'ml-core': {
        'index.ts': 'export const x = 1;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    expect(report.totalPackages).toBe(1)
    expect(report.packages[0]!.name).toBe('ml-core')
  })

  it('detects missing metrics when >3 src files', () => {
    setupFixture({
      'platform-metrics-test': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
        'd.ts': 'export const d = 4;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const metrics = report.packages[0]!.findings.find(f => f.rule === 'needs-metrics')
    expect(metrics).toBeDefined()
    expect(metrics!.severity).toBe('warning')
  })

  it('does not flag needs-metrics when <=3 src files', () => {
    setupFixture({
      'platform-small': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const metrics = report.packages[0]!.findings.find(f => f.rule === 'needs-metrics')
    expect(metrics).toBeUndefined()
  })

  it('detects missing error classification when >5 src files', () => {
    setupFixture({
      'platform-errors-test': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
        'd.ts': 'export const d = 4;\n',
        'e.ts': 'export const e = 5;\n',
        'f.ts': 'export const f = 6;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const errorClass = report.packages[0]!.findings.find(f => f.rule === 'needs-error-classification')
    expect(errorClass).toBeDefined()
    expect(errorClass!.severity).toBe('info')
  })

  it('does not flag needs-error-classification when <=5 src files', () => {
    setupFixture({
      'platform-small-err': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
        'd.ts': 'export const d = 4;\n',
        'e.ts': 'export const e = 5;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const errorClass = report.packages[0]!.findings.find(f => f.rule === 'needs-error-classification')
    expect(errorClass).toBeUndefined()
  })

  it('skips packages without src directory', () => {
    // Create a platform package with no src/ dir
    const pkgDir = join(TEMP_ROOT, 'packages', 'platform-nosrc')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'README.md'), '# No Source')

    setupFixture({
      'platform-withsrc': {
        'index.ts': 'export const x = 1;\n',
      },
    })
    // platform-nosrc was created before setupFixture, but setupFixture recreates TEMP_ROOT
    // So recreate it after scaffold
    const pkgDir2 = join(TEMP_ROOT, 'packages', 'platform-nosrc')
    mkdirSync(pkgDir2, { recursive: true })
    writeFileSync(join(pkgDir2, 'README.md'), '# No Source')

    const report = runOpsReadinessAudit(TEMP_ROOT)
    // platform-nosrc should be skipped
    expect(report.packages.find(p => p.name === 'platform-nosrc')).toBeUndefined()
    expect(report.packages.find(p => p.name === 'platform-withsrc')).toBeDefined()
  })

  it('aggregates findings by rule across multiple packages', () => {
    setupFixture({
      'platform-a': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
      },
      'platform-b': {
        'a.ts': 'export const a = 1;\n',
        'b.ts': 'export const b = 2;\n',
        'c.ts': 'export const c = 3;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    // Both packages should get 'needs-structured-logging' (> 2 files)
    expect(report.findingsByRule['needs-structured-logging']).toBe(2)
  })

  it('correctly counts bare console across multiple files', () => {
    setupFixture({
      'platform-console-test': {
        'a.ts': 'console.log("one");\nconsole.warn("two");\n',
        'b.ts': 'console.error("three");\n',
        'c.ts': 'export const clean = true;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const pkg = report.packages[0]!
    expect(pkg.bareConsoleCount).toBe(3)
    expect(report.findingsBySeverity.error).toBe(3)
  })

  it('flags bare console in file A even when file B has StructuredLogger', () => {
    setupFixture({
      'platform-mixed-logging': {
        'logger.ts': 'import { StructuredLogger } from "@nzila/platform-observability";\nexport const log = new StructuredLogger();\n',
        'service.ts': 'console.log("unstructured");\nconsole.error("also bad");\n',
        'helper.ts': 'export const h = 1;\n',
      },
    })
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const pkg = report.packages[0]!
    // service.ts has bare console but no StructuredLogger in THAT file,
    // so it should be flagged even though logger.ts uses StructuredLogger
    expect(pkg.hasStructuredLogging).toBe(true)
    expect(pkg.bareConsoleCount).toBe(2)
    expect(report.findingsBySeverity.error).toBe(2)
  })

  it('skips packages with src dir but no .ts files', () => {
    const pkgDir = join(TEMP_ROOT, 'packages', 'platform-empty-src')
    mkdirSync(join(pkgDir, 'src'), { recursive: true })
    writeFileSync(join(TEMP_ROOT, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    mkdirSync(join(TEMP_ROOT, 'packages'), { recursive: true })
    // src exists but has only a .json file
    writeFileSync(join(pkgDir, 'src', 'config.json'), '{}')
    const report = runOpsReadinessAudit(TEMP_ROOT)
    // Should be skipped because srcFiles.length === 0
    expect(report.packages.find(p => p.name === 'platform-empty-src')).toBeUndefined()
  })

  it('walks nested subdirectories but skips node_modules', () => {
    setupFixture({
      'platform-nested': {
        'index.ts': 'export const x = 1;\n',
      },
    })
    // Add a nested subdir with a .ts file
    const nested = join(TEMP_ROOT, 'packages', 'platform-nested', 'src', 'sub')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'deep.ts'), 'console.log("deep");\n')
    // Add node_modules inside src (should be skipped)
    const nm = join(TEMP_ROOT, 'packages', 'platform-nested', 'src', 'node_modules')
    mkdirSync(nm, { recursive: true })
    writeFileSync(join(nm, 'skip.ts'), 'console.log("should not count");\n')
    const report = runOpsReadinessAudit(TEMP_ROOT)
    const pkg = report.packages[0]!
    // index.ts (clean) + sub/deep.ts (bare console), but NOT node_modules/skip.ts
    expect(pkg.srcFileCount).toBe(2)
    expect(pkg.bareConsoleCount).toBe(1)
  })
})

// ── CLI entry + markdown generation tests ─────────────────────────────────

describe('ops-readiness-audit CLI entry', () => {
  let tmpDir: string
  const origArgv1 = process.argv[1]

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'ops-cli-'))
    mkdirSync(join(tmpDir, 'packages'), { recursive: true })
    writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
  })

  afterEach(() => {
    process.argv[1] = origArgv1
    vi.restoreAllMocks()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes JSON and markdown reports when invoked as CLI', async () => {
    // Create a platform package with some findings
    const srcDir = join(tmpDir, 'packages', 'platform-test', 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(srcDir, 'a.ts'), 'console.log("bare");\n')
    writeFileSync(join(srcDir, 'b.ts'), 'export const b = 1;\n')
    writeFileSync(join(srcDir, 'c.ts'), 'export const c = 2;\n')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/ops-readiness-audit'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetModules()
    await import('../ops-readiness-audit.js')

    expect(existsSync(join(tmpDir, 'reports', 'ops-readiness-audit.json'))).toBe(true)
    expect(existsSync(join(tmpDir, 'reports', 'ops-readiness-audit.md'))).toBe(true)

    const json = JSON.parse(readFileSync(join(tmpDir, 'reports', 'ops-readiness-audit.json'), 'utf-8'))
    expect(json.totalPackages).toBeGreaterThanOrEqual(1)

    const md = readFileSync(join(tmpDir, 'reports', 'ops-readiness-audit.md'), 'utf-8')
    expect(md).toContain('Operational Readiness')
    expect(md).toContain('Maturity Score')
    expect(md).toContain('platform-test')
  })
})
