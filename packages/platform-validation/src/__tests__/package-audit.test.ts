import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runPackageAudit, type PackageAuditReport } from '../package-audit'

// ── Helpers ─────────────────────────────────────────────────────────────────

function scaffold(tmpDir: string) {
  mkdirSync(join(tmpDir, 'packages'), { recursive: true })
  mkdirSync(join(tmpDir, 'apps'), { recursive: true })
  writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
}

/** Create a minimal package within packages/ */
function createPackage(
  tmpDir: string,
  name: string,
  opts: {
    pkgJson?: Record<string, unknown>
    readme?: boolean
    tsconfig?: boolean
    barrel?: boolean
    srcFiles?: Record<string, string>
    testFiles?: Record<string, string>
    deprecated?: boolean
    noPkgJson?: boolean
  } = {},
) {
  const pkgDir = join(tmpDir, 'packages', name)
  const srcDir = join(pkgDir, 'src')
  mkdirSync(srcDir, { recursive: true })

  if (!opts.noPkgJson) {
    const pkg: Record<string, unknown> = {
      name: opts.pkgJson?.name ?? `@nzila/${name}`,
      version: '0.1.0',
      type: 'module',
      ...opts.pkgJson,
    }
    if (opts.deprecated) pkg.deprecated = true
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2))
  }

  if (opts.readme) writeFileSync(join(pkgDir, 'README.md'), `# ${name}`)
  if (opts.tsconfig) writeFileSync(join(pkgDir, 'tsconfig.json'), '{}')
  if (opts.barrel) writeFileSync(join(srcDir, 'index.ts'), 'export {}')

  if (opts.srcFiles) {
    for (const [file, content] of Object.entries(opts.srcFiles)) {
      const dir = join(srcDir, file, '..')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(srcDir, file), content)
    }
  }
  if (opts.testFiles) {
    for (const [file, content] of Object.entries(opts.testFiles)) {
      mkdirSync(join(srcDir, '__tests__'), { recursive: true })
      writeFileSync(join(srcDir, '__tests__', file), content)
    }
  }
}

/** Create a minimal app within apps/ */
function createApp(
  tmpDir: string,
  name: string,
  opts: {
    pkgJson?: Record<string, unknown>
    readme?: boolean
    tsconfig?: boolean
    srcFiles?: Record<string, string>
    testFiles?: Record<string, string>
  } = {},
) {
  const appDir = join(tmpDir, 'apps', name)
  mkdirSync(appDir, { recursive: true })

  const pkg: Record<string, unknown> = {
    name: opts.pkgJson?.name ?? `@nzila/${name}`,
    version: '0.1.0',
    type: 'module',
    ...opts.pkgJson,
  }
  writeFileSync(join(appDir, 'package.json'), JSON.stringify(pkg, null, 2))

  if (opts.readme) writeFileSync(join(appDir, 'README.md'), `# ${name}`)
  if (opts.tsconfig) writeFileSync(join(appDir, 'tsconfig.json'), '{}')

  if (opts.srcFiles) {
    for (const [file, content] of Object.entries(opts.srcFiles)) {
      const filePath = join(appDir, file)
      mkdirSync(join(filePath, '..'), { recursive: true })
      writeFileSync(filePath, content)
    }
  }

  if (opts.testFiles) {
    for (const [file, content] of Object.entries(opts.testFiles)) {
      const testsDir = join(appDir, '__tests__')
      mkdirSync(testsDir, { recursive: true })
      writeFileSync(join(testsDir, file), content)
    }
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('runPackageAudit', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'pkg-audit-'))
    scaffold(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── Empty monorepo ──────────────────────────────────────────────────────

  it('returns empty report for empty monorepo', () => {
    const report = runPackageAudit(tmpDir)
    expect(report.totalPackages).toBe(0)
    expect(report.totalApps).toBe(0)
    expect(report.summary).toEqual({
      'production-ready': 0,
      functional: 0,
      'scaffold-only': 0,
      deprecated: 0,
      unknown: 0,
    })
    expect(report.crossCutting.circularDeps).toEqual([])
    expect(report.crossCutting.orphanedPackages).toEqual([])
    expect(report.crossCutting.namingViolations).toEqual([])
    expect(report.crossCutting.duplicateResponsibilities).toEqual([])
  })

  // ── Maturity: unknown (no package.json) ─────────────────────────────────

  it('classifies package without package.json as unknown', () => {
    createPackage(tmpDir, 'ghost', { noPkgJson: true })
    const report = runPackageAudit(tmpDir)
    // Package without package.json is filtered out at the top level
    // (the main function filters by existsSync(join(d, 'package.json')))
    expect(report.totalPackages).toBe(0)
  })

  // ── Maturity: deprecated ────────────────────────────────────────────────

  it('classifies package with deprecated flag as deprecated', () => {
    createPackage(tmpDir, 'old-pkg', { deprecated: true, barrel: true, srcFiles: { 'a.ts': 'export const a = 1' } })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.maturity).toBe('deprecated')
    expect(report.packages[0]!.findings.some(f => f.message.includes('deprecated'))).toBe(true)
  })

  it('classifies package with "deprecated" in name as deprecated', () => {
    createPackage(tmpDir, 'deprecated-lib', {
      pkgJson: { name: '@nzila/deprecated-lib' },
      srcFiles: { 'a.ts': 'export const a = 1' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.maturity).toBe('deprecated')
  })

  // ── Maturity: scaffold-only ─────────────────────────────────────────────

  it('classifies package with no src files as scaffold-only', () => {
    createPackage(tmpDir, 'empty-pkg', { readme: true, tsconfig: true })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.maturity).toBe('scaffold-only')
    expect(report.packages[0]!.srcFileCount).toBe(0)
    expect(report.packages[0]!.findings.some(f => f.message.includes('No source files'))).toBe(true)
  })

  // ── Maturity: production-ready ──────────────────────────────────────────

  it('classifies full package as production-ready', () => {
    createPackage(tmpDir, 'complete-pkg', {
      readme: true,
      tsconfig: true,
      barrel: true,
      srcFiles: { 'utils.ts': 'export const x = 1' },
      testFiles: { 'utils.test.ts': 'it("works", () => {})' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.maturity).toBe('production-ready')
    expect(report.packages[0]!.hasReadme).toBe(true)
    expect(report.packages[0]!.hasTests).toBe(true)
    expect(report.packages[0]!.hasBarrelExport).toBe(true)
    expect(report.packages[0]!.hasTypeConfig).toBe(true)
  })

  // ── Maturity: functional ────────────────────────────────────────────────

  it('classifies package with src but no tests/readme/tsconfig/barrel as functional', () => {
    createPackage(tmpDir, 'partial-pkg', {
      srcFiles: { 'index.ts': 'export const x = 1' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.maturity).toBe('functional')
    expect(report.packages[0]!.srcFileCount).toBeGreaterThan(0)
  })

  it('classifies package with src+tests but missing readme/tsconfig as functional', () => {
    createPackage(tmpDir, 'almost-pkg', {
      barrel: true,
      srcFiles: { 'a.ts': 'export const a = 1' },
      testFiles: { 'a.test.ts': 'it("works", () => {})' },
    })
    const report = runPackageAudit(tmpDir)
    // Has tests + barrel, but missing readme + tsconfig → functional
    expect(report.packages[0]!.maturity).toBe('functional')
  })

  // ── App maturity ────────────────────────────────────────────────────────

  it('classifies app with src+readme+tsconfig as production-ready', () => {
    createApp(tmpDir, 'web', {
      readme: true,
      tsconfig: true,
      srcFiles: { 'src/page.tsx': 'export default function Page() {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.apps[0]!.maturity).toBe('production-ready')
  })

  it('classifies app with src but no readme as functional', () => {
    createApp(tmpDir, 'web-noreadme', {
      tsconfig: true,
      srcFiles: { 'src/page.tsx': 'export default function Page() {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.apps[0]!.maturity).toBe('functional')
  })

  // ── Findings ────────────────────────────────────────────────────────────

  it('reports missing README as warning for apps', () => {
    createApp(tmpDir, 'my-app', {
      tsconfig: true,
      srcFiles: { 'src/app.ts': 'export const app = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const finding = report.apps[0]!.findings.find(f => f.message.includes('Missing README'))
    expect(finding).toBeDefined()
    expect(finding!.type).toBe('warning')
  })

  it('reports missing README as warning for critical platform packages', () => {
    createPackage(tmpDir, 'platform-core', {
      tsconfig: true,
      barrel: true,
      srcFiles: { 'a.ts': 'export const a = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const finding = report.packages[0]!.findings.find(f => f.message.includes('Missing README'))
    expect(finding).toBeDefined()
    expect(finding!.type).toBe('warning')
  })

  it('reports scope and type:module findings', () => {
    createPackage(tmpDir, 'bad-scope', {
      pkgJson: { name: 'bad-scope', type: 'commonjs' },
      srcFiles: { 'a.ts': 'export const a = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const scopeFinding = report.packages[0]!.findings.find(f => f.message.includes("@nzila/ scope"))
    expect(scopeFinding).toBeDefined()
    const moduleFinding = report.packages[0]!.findings.find(f => f.message.includes('type": "module"'))
    expect(moduleFinding).toBeDefined()
  })

  // ── Exports ─────────────────────────────────────────────────────────────

  it('parses package.json exports field', () => {
    createPackage(tmpDir, 'with-exports', {
      pkgJson: {
        name: '@nzila/with-exports',
        exports: { '.': './src/index.ts', './utils': './src/utils.ts' },
      },
      barrel: true,
      srcFiles: { 'utils.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.exports).toEqual(['.', './utils'])
  })

  // ── Dependencies parsing ────────────────────────────────────────────────

  it('parses dependencies and devDependencies', () => {
    createPackage(tmpDir, 'with-deps', {
      pkgJson: {
        name: '@nzila/with-deps',
        dependencies: { '@nzila/config': '^1.0.0', zod: '^3.0.0' },
        devDependencies: { vitest: '^4.0.0' },
      },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.dependencies).toContain('@nzila/config')
    expect(report.packages[0]!.dependencies).toContain('zod')
    expect(report.packages[0]!.devDependencies).toContain('vitest')
    expect(report.packages[0]!.hasDependencies).toBe(true)
  })

  // ── Circular dependency detection ───────────────────────────────────────

  it('detects no circular deps when there are none', () => {
    createPackage(tmpDir, 'a', {
      pkgJson: { name: '@nzila/a', dependencies: { '@nzila/b': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'b', {
      pkgJson: { name: '@nzila/b' },
      srcFiles: { 'b.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.circularDeps).toEqual([])
  })

  it('detects circular dependencies between packages', () => {
    createPackage(tmpDir, 'alpha', {
      pkgJson: { name: '@nzila/alpha', dependencies: { '@nzila/beta': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'beta', {
      pkgJson: { name: '@nzila/beta', dependencies: { '@nzila/alpha': '*' } },
      srcFiles: { 'b.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.circularDeps.length).toBeGreaterThan(0)
    // The cycle should contain both @nzila/alpha and @nzila/beta
    const cycle = report.crossCutting.circularDeps[0]!
    expect(cycle).toContain('@nzila/alpha')
    expect(cycle).toContain('@nzila/beta')
  })

  // ── Orphaned packages ───────────────────────────────────────────────────

  it('detects orphaned packages (not depended on by anything)', () => {
    createPackage(tmpDir, 'used', {
      pkgJson: { name: '@nzila/used' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'orphan', {
      pkgJson: { name: '@nzila/orphan' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'consumer', {
      pkgJson: { name: '@nzila/consumer', dependencies: { '@nzila/used': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    // orphan and consumer are both orphaned (nothing depends on them)
    expect(report.crossCutting.orphanedPackages).toContain('@nzila/orphan')
    expect(report.crossCutting.orphanedPackages).toContain('@nzila/consumer')
    expect(report.crossCutting.orphanedPackages).not.toContain('@nzila/used')
  })

  it('does not count apps as orphaned', () => {
    createApp(tmpDir, 'web', {
      pkgJson: { name: '@nzila/web' },
      srcFiles: { 'app.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.orphanedPackages).not.toContain('@nzila/web')
  })

  // ── Naming violations ───────────────────────────────────────────────────

  it('detects missing @nzila/ scope', () => {
    createPackage(tmpDir, 'no-scope', {
      pkgJson: { name: 'no-scope' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.namingViolations.some(v => v.includes('missing @nzila/ scope'))).toBe(true)
  })

  it('detects uppercase in package name', () => {
    createPackage(tmpDir, 'MyPkg', {
      pkgJson: { name: '@nzila/MyPkg' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.namingViolations.some(v => v.includes('not lowercase'))).toBe(true)
  })

  it('detects non-kebab characters', () => {
    createPackage(tmpDir, 'bad_name', {
      pkgJson: { name: '@nzila/bad_name' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.namingViolations.some(v => v.includes('non-kebab'))).toBe(true)
  })

  it('passes naming for valid kebab-case @nzila/ name', () => {
    createPackage(tmpDir, 'valid-name', {
      pkgJson: { name: '@nzila/valid-name' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    const violations = report.crossCutting.namingViolations.filter(v => v.includes('valid-name'))
    expect(violations).toEqual([])
  })

  // ── Duplicate responsibilities ──────────────────────────────────────────

  it('detects duplicate responsibilities when >3 packages share a word', () => {
    // Create 4+ packages sharing the word "sync"
    for (let i = 0; i < 5; i++) {
      createPackage(tmpDir, `sync-${i}`, {
        pkgJson: { name: `@nzila/sync-${i}` },
        srcFiles: { 'a.ts': 'export {}' },
      })
    }
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.duplicateResponsibilities.some(d => d.includes('sync'))).toBe(true)
  })

  it('ignores common filler words (platform, commerce, etc)', () => {
    for (let i = 0; i < 5; i++) {
      createPackage(tmpDir, `platform-${i}`, {
        pkgJson: { name: `@nzila/platform-${i}` },
        srcFiles: { 'a.ts': 'export {}' },
      })
    }
    const report = runPackageAudit(tmpDir)
    // "platform" is in the exclusion list
    expect(report.crossCutting.duplicateResponsibilities.some(d => d.includes('"platform"'))).toBe(false)
  })

  // ── Report structure ────────────────────────────────────────────────────

  it('report has generatedAt timestamp', () => {
    const report = runPackageAudit(tmpDir)
    expect(report.generatedAt).toBeTruthy()
    expect(() => new Date(report.generatedAt)).not.toThrow()
  })

  it('counts packages and apps separately in summary', () => {
    createPackage(tmpDir, 'pkg-a', {
      readme: true,
      tsconfig: true,
      barrel: true,
      srcFiles: { 'a.ts': 'export {}' },
      testFiles: { 'a.test.ts': 'it("a", () => {})' },
    })
    createApp(tmpDir, 'app-a', {
      readme: true,
      tsconfig: true,
      srcFiles: { 'app/page.tsx': 'export default function() {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.totalPackages).toBe(1)
    expect(report.totalApps).toBe(1)
    // summary only counts packages (not apps)
    expect(report.summary['production-ready']).toBe(1)
  })

  // ── Missing dirs ────────────────────────────────────────────────────────

  it('handles missing packages/ and apps/ dirs gracefully', () => {
    // Create a temp with just pnpm-workspace.yaml but no packages or apps dirs
    const bare = mkdtempSync(join(os.tmpdir(), 'pkg-audit-bare-'))
    writeFileSync(join(bare, 'pnpm-workspace.yaml'), '')
    try {
      const report = runPackageAudit(bare)
      expect(report.totalPackages).toBe(0)
      expect(report.totalApps).toBe(0)
    } finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })

  // ── DevDependencies in orphan detection ─────────────────────────────────

  it('recognises devDependencies references for orphan detection', () => {
    createPackage(tmpDir, 'test-utils', {
      pkgJson: { name: '@nzila/test-utils' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'consumer', {
      pkgJson: { name: '@nzila/consumer', devDependencies: { '@nzila/test-utils': '*' } },
      srcFiles: { 'b.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.orphanedPackages).not.toContain('@nzila/test-utils')
  })

  // ── Corrupted/invalid package.json ──────────────────────────────────────

  it('classifies package with invalid JSON as having no pkg data', () => {
    const pkgDir = join(tmpDir, 'packages', 'broken')
    const srcDir = join(pkgDir, 'src')
    mkdirSync(srcDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{ invalid json !!!!')
    writeFileSync(join(srcDir, 'a.ts'), 'export {}')
    const report = runPackageAudit(tmpDir)
    // safeReadJson returns null → maturity unknown
    const pkg = report.packages.find(p => p.name === 'broken')!
    expect(pkg.maturity).toBe('unknown')
    expect(pkg.findings.some(f => f.message.includes('Missing package.json'))).toBe(true)
  })

  // ── No hasDependencies ──────────────────────────────────────────────────

  it('hasDependencies is false when no deps listed', () => {
    createPackage(tmpDir, 'standalone', {
      pkgJson: { name: '@nzila/standalone' },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.packages[0]!.hasDependencies).toBe(false)
  })

  // ── Multiple findings on same package ───────────────────────────────────

  it('accumulates multiple findings per package', () => {
    createPackage(tmpDir, 'many-issues', {
      pkgJson: { name: 'bad-scope', type: 'commonjs' },
      // No readme, no tsconfig, no barrel, no tests
    })
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages[0]!
    expect(pkg.findings.length).toBeGreaterThan(3)
  })

  // ── Three-node circular dependency ──────────────────────────────────────

  it('detects 3-node circular dependency chain', () => {
    createPackage(tmpDir, 'x', {
      pkgJson: { name: '@nzila/x', dependencies: { '@nzila/y': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'y', {
      pkgJson: { name: '@nzila/y', dependencies: { '@nzila/z': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    createPackage(tmpDir, 'z', {
      pkgJson: { name: '@nzila/z', dependencies: { '@nzila/x': '*' } },
      srcFiles: { 'a.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.crossCutting.circularDeps.length).toBeGreaterThan(0)
  })

  // ── Critical package detection for os- prefix ───────────────────────────

  it('warns for missing tests on os-* critical packages', () => {
    createPackage(tmpDir, 'os-core', {
      pkgJson: { name: '@nzila/os-core' },
      readme: true,
      tsconfig: true,
      barrel: true,
      srcFiles: { 'a.ts': 'export const x = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const finding = report.packages[0]!.findings.find(f => f.message.includes('No test files'))
    expect(finding).toBeDefined()
    expect(finding!.type).toBe('warning')
  })

  // ── App with multiple source files counted correctly ─────────────────────

  it('counts ts/tsx source files in apps from all subdirs', () => {
    createApp(tmpDir, 'big-app', {
      readme: true,
      tsconfig: true,
      srcFiles: {
        'src/page.tsx': 'export default function() {}',
        'src/layout.tsx': 'export default function() {}',
        'lib/utils.ts': 'export const u = 1',
      },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.apps[0]!.srcFileCount).toBeGreaterThanOrEqual(3)
  })

  // ── Barrel export: apps always count as having barrel ────────────────────

  it('apps always have hasBarrelExport=true', () => {
    createApp(tmpDir, 'simple', {
      srcFiles: { 'app.tsx': 'export default function App() {}' },
    })
    const report = runPackageAudit(tmpDir)
    expect(report.apps[0]!.hasBarrelExport).toBe(true)
  })

  // ── App with no source files → scaffold-only maturity ────────────────

  it('app with no source files gets scaffold-only maturity', () => {
    const appDir = join(tmpDir, 'apps', 'empty-app')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, 'package.json'), JSON.stringify({
      name: '@nzila/empty-app',
      version: '0.1.0',
    }))
    const report = runPackageAudit(tmpDir)
    const app = report.apps.find(a => a.name === '@nzila/empty-app')!
    expect(app.maturity).toBe('scaffold-only')
  })

  // ── Deprecated package detection ─────────────────────────────────────

  it('classifies package with deprecated flag', () => {
    createPackage(tmpDir, 'old-pkg', {
      deprecated: true,
      srcFiles: { 'a.ts': 'export const x = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/old-pkg')!
    expect(pkg.maturity).toBe('deprecated')
    expect(pkg.findings.some(f => f.message.includes('deprecated'))).toBe(true)
  })

  it('classifies package with deprecated in name', () => {
    createPackage(tmpDir, 'deprecated-utils', {
      srcFiles: { 'a.ts': 'export const x = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/deprecated-utils')!
    expect(pkg.maturity).toBe('deprecated')
  })

  // ── Package exports parsing ──────────────────────────────────────────

  it('parses package exports from package.json', () => {
    createPackage(tmpDir, 'exported', {
      pkgJson: {
        name: '@nzila/exported',
        exports: { '.': './src/index.ts', './utils': './src/utils.ts' },
      },
      srcFiles: { 'index.ts': 'export {}', 'utils.ts': 'export {}' },
    })
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/exported')!
    expect(pkg.exports).toEqual(['.', './utils'])
  })

  // ── Non-module type ──────────────────────────────────────────────────

  it('flags non-module type packages', () => {
    createPackage(tmpDir, 'cjs-pkg', {
      pkgJson: { name: '@nzila/cjs-pkg', type: 'commonjs' },
      srcFiles: { 'a.ts': 'export const x = 1' },
    })
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/cjs-pkg')!
    expect(pkg.findings.some(f => f.message.includes('type'))).toBe(true)
  })

  // ── production-ready app ─────────────────────────────────────────────

  it('classifies app with readme + tsconfig as production-ready', () => {
    createApp(tmpDir, 'ready-app', {
      readme: true,
      tsconfig: true,
      srcFiles: { 'page.tsx': 'export default function Page() {}' },
    })
    const report = runPackageAudit(tmpDir)
    const app = report.apps.find(a => a.name === '@nzila/ready-app')!
    expect(app.maturity).toBe('production-ready')
  })

  // ── functional app (missing readme or tsconfig) ──────────────────────

  it('classifies app without readme as functional', () => {
    createApp(tmpDir, 'no-readme-app', {
      tsconfig: true,
      srcFiles: { 'page.tsx': 'export default function Page() {}' },
    })
    const report = runPackageAudit(tmpDir)
    const app = report.apps.find(a => a.name === '@nzila/no-readme-app')!
    expect(app.maturity).toBe('functional')
  })

  // ── Package without src/ directory (countFiles existsSync branch) ────

  it('handles package with package.json but no src directory', () => {
    const pkgDir = join(tmpDir, 'packages', 'no-src-pkg')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
      name: '@nzila/no-src-pkg', version: '0.1.0', type: 'module',
    }))
    // No src/ directory
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/no-src-pkg')!
    expect(pkg.srcFileCount).toBe(0)
    expect(pkg.maturity).toBe('scaffold-only')
  })

  // ── Package with node_modules in src (exclude branch in countFiles) ──

  it('excludes node_modules subdir from src file count', () => {
    createPackage(tmpDir, 'with-nested-nm', {
      srcFiles: { 'index.ts': 'export const x = 1' },
    })
    // Create a node_modules inside src
    const nmDir = join(tmpDir, 'packages', 'with-nested-nm', 'src', 'node_modules', 'dep')
    mkdirSync(nmDir, { recursive: true })
    writeFileSync(join(nmDir, 'file.ts'), 'export const y = 2')
    const report = runPackageAudit(tmpDir)
    const pkg = report.packages.find(p => p.name === '@nzila/with-nested-nm')!
    // Should only count index.ts, not the dep/file.ts in node_modules
    expect(pkg.srcFileCount).toBe(1)
  })

  // ── Empty app (isApp + srcFileCount=0 → else branch → scaffold-only) ──

  it('classifies app with no source files as scaffold-only', () => {
    createApp(tmpDir, 'empty-app', {
      readme: true,
      tsconfig: true,
      // No srcFiles — so srcFileCount === 0
    })
    const report = runPackageAudit(tmpDir)
    const app = report.apps.find(a => a.name === '@nzila/empty-app')!
    expect(app.maturity).toBe('scaffold-only')
  })
})

// ── CLI entry + generateMarkdown tests ────────────────────────────────────

describe('package-audit CLI entry', () => {
  let tmpDir: string
  const origArgv1 = process.argv[1]

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'pkg-cli-'))
    mkdirSync(join(tmpDir, 'packages'), { recursive: true })
    mkdirSync(join(tmpDir, 'apps'), { recursive: true })
    writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
  })

  afterEach(() => {
    process.argv[1] = origArgv1
    vi.restoreAllMocks()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes JSON and markdown reports when invoked as CLI', async () => {
    // Create a simple package to get meaningful output
    const pkgDir = join(tmpDir, 'packages', 'platform-core', 'src')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(tmpDir, 'packages', 'platform-core', 'package.json'), JSON.stringify({
      name: '@nzila/platform-core', version: '1.0.0', type: 'module',
    }))
    writeFileSync(join(pkgDir, 'index.ts'), 'export const x = 1')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/package-audit'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetModules()
    await import('../package-audit.js')

    expect(existsSync(join(tmpDir, 'reports', 'package-audit.json'))).toBe(true)
    expect(existsSync(join(tmpDir, 'reports', 'package-audit.md'))).toBe(true)

    const json = JSON.parse(readFileSync(join(tmpDir, 'reports', 'package-audit.json'), 'utf-8'))
    expect(json.totalPackages).toBeGreaterThanOrEqual(1)

    const md = readFileSync(join(tmpDir, 'reports', 'package-audit.md'), 'utf-8')
    expect(md).toContain('Package Audit')
    expect(md).toContain('platform-core')
  })
})
