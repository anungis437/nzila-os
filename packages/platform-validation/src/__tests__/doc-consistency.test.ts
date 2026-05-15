import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runDocConsistency } from '../doc-consistency'

// ── Helpers ─────────────────────────────────────────────────────────────────

function scaffold(tmpDir: string) {
  mkdirSync(join(tmpDir, 'packages'), { recursive: true })
  mkdirSync(join(tmpDir, 'apps'), { recursive: true })
  mkdirSync(join(tmpDir, 'docs'), { recursive: true })
  mkdirSync(join(tmpDir, 'governance'), { recursive: true })
  writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
}

function writeFile(tmpDir: string, relPath: string, content: string) {
  const full = join(tmpDir, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('runDocConsistency', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'doc-audit-'))
    scaffold(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── Empty monorepo ──────────────────────────────────────────────────────

  it('returns report with structure even for minimally populated monorepo', () => {
    const report = runDocConsistency(tmpDir)
    expect(report.generatedAt).toBeTruthy()
    expect(report.filesScanned).toBeGreaterThanOrEqual(0)
    expect(report.findingsBySeverity).toEqual(expect.objectContaining({
      error: expect.any(Number),
      warning: expect.any(Number),
      info: expect.any(Number),
    }))
  })

  // ── Stale references (broken markdown links) ───────────────────────────

  it('detects broken markdown link to non-existent file', () => {
    writeFile(tmpDir, 'README.md', '# My Project\n\nSee [setup](docs/setup-guide.md) for details.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-reference')
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0]!.message).toContain('setup-guide.md')
  })

  it('does not flag valid markdown link to existing file', () => {
    writeFile(tmpDir, 'docs/setup.md', '# Setup\n\nInstructions here.\n')
    writeFile(tmpDir, 'README.md', '# My Project\n\nSee [setup](docs/setup.md) for details.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('setup.md'),
    )
    expect(findings).toEqual([])
  })

  it('skips external URLs', () => {
    writeFile(tmpDir, 'README.md', '# Docs\n\n[GitHub](https://github.com/nzila)\n[Mail](mailto:info@nzila.io)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-reference')
    expect(findings).toEqual([])
  })

  it('skips anchor-only links', () => {
    writeFile(tmpDir, 'README.md', '# Docs\n\n[Section](#overview)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-reference')
    expect(findings).toEqual([])
  })

  it('skips image links', () => {
    writeFile(tmpDir, 'README.md', '# Docs\n\n[Logo](assets/logo.png)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-reference')
    expect(findings).toEqual([])
  })

  // ── Stale package references ────────────────────────────────────────────

  it('detects reference to non-existent @nzila/ package', () => {
    writeFile(tmpDir, 'README.md', '# Architecture\n\nUse `@nzila/phantom-pkg` for integration.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-package-ref')
    expect(findings.length).toBe(1)
    expect(findings[0]!.message).toContain('phantom-pkg')
  })

  it('does not flag reference to existing package', () => {
    const pkgDir = join(tmpDir, 'packages', 'real-pkg')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/real-pkg"}')
    writeFile(tmpDir, 'README.md', '# Architecture\n\nUse `@nzila/real-pkg` for integration.\n')

    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-package-ref' && f.message.includes('real-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── Naming inconsistencies ──────────────────────────────────────────────

  it('flags "nzila-os" as naming inconsistency (should be NzilaOS)', () => {
    writeFile(tmpDir, 'README.md', '# Welcome to nzila-os\n\nThis is the platform.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'naming-inconsistency')
    expect(findings.some(f => f.message.includes('NzilaOS'))).toBe(true)
  })

  it('flags "Nzila OS" as naming inconsistency', () => {
    writeFile(tmpDir, 'README.md', '# Nzila OS Platform\n\nOverview.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'naming-inconsistency')
    expect(findings.some(f => f.message.includes('NzilaOS'))).toBe(true)
  })

  it('does not flag canonical "NzilaOS" name', () => {
    writeFile(tmpDir, 'README.md', '# NzilaOS Platform\n\nAll good.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('"NzilaOS"'),
    )
    // Should not report NzilaOS as inconsistent with itself
    expect(findings).toEqual([])
  })

  // ── Stale dates ─────────────────────────────────────────────────────────

  it('flags document with date >90 days old', () => {
    writeFile(tmpDir, 'README.md', '# Docs\n\nLast updated: 2024-01-15\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-date')
    expect(findings.length).toBe(1)
    expect(findings[0]!.message).toContain('2024-01-15')
  })

  it('does not flag recent date', () => {
    // Use a date within the last 30 days
    const recent = new Date()
    recent.setDate(recent.getDate() - 10)
    const dateStr = recent.toISOString().split('T')[0]
    writeFile(tmpDir, 'README.md', `# Docs\n\nLast updated: ${dateStr}\n`)
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'stale-date')
    expect(findings).toEqual([])
  })

  // ── Missing required docs ───────────────────────────────────────────────

  it('reports missing required docs', () => {
    // The scaffold has none of the required docs
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'missing-required-doc')
    // Should flag at least ARCHITECTURE.md, README.md, SECURITY.md, etc.
    expect(findings.length).toBeGreaterThan(0)
    const missingPaths = findings.map(f => f.file)
    expect(missingPaths).toContain('ARCHITECTURE.md')
    expect(missingPaths).toContain('SECURITY.md')
  })

  it('does not flag existing required docs', () => {
    writeFile(tmpDir, 'ARCHITECTURE.md', '# Architecture')
    writeFile(tmpDir, 'README.md', '# README')
    writeFile(tmpDir, 'CONTRIBUTING.md', '# Contributing')
    writeFile(tmpDir, 'SECURITY.md', '# Security')
    writeFile(tmpDir, 'CHANGELOG.md', '# Changelog')
    writeFile(tmpDir, 'docs/procurement-pack.md', '# Procurement')
    writeFile(tmpDir, 'docs/disaster-recovery.md', '# DR')
    writeFile(tmpDir, 'docs/incident-response.md', '# IR')

    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f => f.rule === 'missing-required-doc')
    expect(findings).toEqual([])
  })

  // ── Missing package READMEs ─────────────────────────────────────────────

  it('reports package without README', () => {
    const pkgDir = join(tmpDir, 'packages', 'no-readme')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/no-readme"}')

    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'missing-package-readme' && f.file.includes('no-readme'),
    )
    expect(findings.length).toBe(1)
  })

  it('does not report package with README', () => {
    const pkgDir = join(tmpDir, 'packages', 'has-readme')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/has-readme"}')
    writeFileSync(join(pkgDir, 'README.md'), '# Has README')

    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'missing-package-readme' && f.file.includes('has-readme'),
    )
    expect(findings).toEqual([])
  })

  it('skips directories without package.json', () => {
    const pkgDir = join(tmpDir, 'packages', 'not-a-pkg')
    mkdirSync(pkgDir, { recursive: true })
    // No package.json → should not be flagged
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'missing-package-readme' && f.file.includes('not-a-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── Aggregation ─────────────────────────────────────────────────────────

  it('correctly aggregates findings by rule', () => {
    // Two packages without README
    for (const name of ['pkg-a', 'pkg-b']) {
      const pkgDir = join(tmpDir, 'packages', name)
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), `{"name":"@nzila/${name}"}`)
    }
    const report = runDocConsistency(tmpDir)
    expect(report.findingsByRule['missing-package-readme']).toBe(2)
  })

  it('totalFindings matches sum of findings array length', () => {
    writeFile(tmpDir, 'README.md', '# Docs\n\nSee [broken](does-not-exist.md)\n\nLast updated: 2023-01-01\n')
    const report = runDocConsistency(tmpDir)
    expect(report.totalFindings).toBe(report.findings.length)
  })

  // ── Scans docs/ and governance/ ─────────────────────────────────────────

  it('scans markdown files in docs/ subdirectory', () => {
    writeFile(tmpDir, 'docs/guide.md', '# Guide\n\nSee [missing](broken-link.md) for more.\n')
    const report = runDocConsistency(tmpDir)
    expect(report.filesScanned).toBeGreaterThanOrEqual(1)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('docs/guide.md'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('scans markdown files in governance/ subdirectory', () => {
    writeFile(tmpDir, 'governance/policy.md', '# Policy\n\nUse `@nzila/missing-gov-pkg` for compliance.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-package-ref' && f.file.includes('governance/policy.md'),
    )
    expect(findings.length).toBe(1)
  })

  // ── Link with anchor strips correctly ───────────────────────────────────

  it('strips anchor before checking link target', () => {
    writeFile(tmpDir, 'docs/real.md', '# Real Doc')
    writeFile(tmpDir, 'README.md', '# Links\n\n[Section](docs/real.md#installation)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('real.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Naming inconsistency variants ───────────────────────────────────────

  it('flags "nzila os" (lowercase) as naming inconsistency', () => {
    writeFile(tmpDir, 'docs/about.md', '# About\n\nnzila os is a platform.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('NzilaOS'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('flags "NZILA OS" (uppercase) as naming inconsistency', () => {
    writeFile(tmpDir, 'docs/about.md', '# About\n\nNZILA OS is a platform.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('NzilaOS'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('flags "orgId" as naming inconsistency (should be org_id)', () => {
    writeFile(tmpDir, 'docs/api.md', '# API\n\nPass orgId in the request.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('org_id'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('flags "organizationId" as naming inconsistency', () => {
    writeFile(tmpDir, 'docs/api.md', '# API\n\nUse organizationId for tenant.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('org_id'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('flags "evidence bundle" as naming inconsistency', () => {
    writeFile(tmpDir, 'docs/audit.md', '# Audit\n\nUpload the evidence bundle.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('evidence pack'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  it('flags "procurement bundle" as naming inconsistency', () => {
    writeFile(tmpDir, 'docs/procurement.md', '# Procurement\n\nDownload the procurement bundle.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.message.includes('procurement pack'),
    )
    expect(findings.length).toBeGreaterThan(0)
  })

  // ── Stale reference edge cases ──────────────────────────────────────────

  it('skips external URLs in link check', () => {
    writeFile(tmpDir, 'README.md', '# Links\n\n[Google](https://www.google.com)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('google'),
    )
    expect(findings).toEqual([])
  })

  it('skips mailto links in link check', () => {
    writeFile(tmpDir, 'README.md', '# Contact\n\n[Email](mailto:team@nzila.com)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('mailto'),
    )
    expect(findings).toEqual([])
  })

  it('skips image file links', () => {
    writeFile(tmpDir, 'README.md', '# Logo\n\n[Logo](logo.png)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('.png'),
    )
    expect(findings).toEqual([])
  })

  it('skips anchor-only links', () => {
    writeFile(tmpDir, 'README.md', '# Section\n\n[Jump](#section)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('#section'),
    )
    expect(findings).toEqual([])
  })

  // ── Date: "Month D, YYYY" format ────────────────────────────────────────

  it('detects stale date in "Month D, YYYY" format', () => {
    writeFile(tmpDir, 'docs/old.md', '# Old\n\nLast updated: January 1, 2020\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-date' && f.file.includes('old.md'),
    )
    expect(findings.length).toBe(1)
    expect(findings[0]!.message).toContain('days old')
  })

  it('does not flag recent date', () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 10)
    const dateStr = recent.toISOString().split('T')[0]
    writeFile(tmpDir, 'docs/recent.md', `# Recent\n\nLast updated: ${dateStr}\n`)
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-date' && f.file.includes('recent.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Stale package reference ─────────────────────────────────────────────

  it('reports reference to non-existent @nzila/ package', () => {
    writeFile(tmpDir, 'README.md', '# Packages\n\nUse `@nzila/really-missing-pkg` for auth.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-package-ref' && f.message.includes('really-missing-pkg'),
    )
    expect(findings.length).toBe(1)
  })

  it('does not flag existing package reference', () => {
    const pkgDir = join(tmpDir, 'packages', 'existing-pkg')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@nzila/existing-pkg"}')
    writeFile(tmpDir, 'README.md', '# Packages\n\nUse `@nzila/existing-pkg` for auth.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-package-ref' && f.message.includes('existing-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── Link resolution from docs/ subdirectory ─────────────────────────────

  it('resolves links from docs/ relative to file location', () => {
    writeFile(tmpDir, 'docs/sub/guide.md', '# Guide')
    writeFile(tmpDir, 'docs/index.md', '# Index\n\n[Guide](sub/guide.md)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('docs/index.md') && f.message.includes('guide'),
    )
    expect(findings).toEqual([])
  })

  // ── Files in packages subdirectory non-directory entry ──────────────────

  it('ignores non-directory entries in packages/ for readme check', () => {
    // Create a file (not directory) directly in packages/
    writeFileSync(join(tmpDir, 'packages', 'stray-file.txt'), 'not a package')
    const report = runDocConsistency(tmpDir)
    // Should not crash and should not flag a file as missing README
    const findings = report.findings.filter(f =>
      f.file.includes('stray-file'),
    )
    expect(findings).toEqual([])
  })

  // ── Link with query param strips correctly ────────────────────────────

  it('strips query param before checking link target', () => {
    writeFile(tmpDir, 'docs/real.md', '# Real Doc')
    writeFile(tmpDir, 'README.md', '# Links\n\n[Section](docs/real.md?ref=main)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('README.md') && f.message.includes('real.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Link resolves from root when not relative ─────────────────────────

  it('resolves link from root when file-relative fails', () => {
    writeFile(tmpDir, 'ARCHITECTURE.md', '# Architecture')
    writeFile(tmpDir, 'docs/intro.md', '# Intro\n\n[Arch](ARCHITECTURE.md)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('docs/intro.md') && f.message.includes('ARCHITECTURE'),
    )
    expect(findings).toEqual([])
  })

  // ── Multiple naming inconsistencies in one file ───────────────────────

  it('counts multiple naming inconsistencies per file', () => {
    writeFile(tmpDir, 'docs/mixed.md', '# About\n\nnzila os uses orgId for the NZILA OS tenant.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'naming-inconsistency' && f.file.includes('docs/mixed.md'),
    )
    expect(findings.length).toBeGreaterThanOrEqual(2)
  })

  // ── Date with "as of" prefix ──────────────────────────────────────────

  it('detects stale "as of" date', () => {
    writeFile(tmpDir, 'docs/old-ref.md', '# Status\n\nAs of: 2020-06-15, all systems are operational.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-date' && f.file.includes('old-ref.md'),
    )
    expect(findings.length).toBe(1)
  })

  // ── Date with "generated" prefix ──────────────────────────────────────

  it('detects stale "generated" date', () => {
    writeFile(tmpDir, 'docs/gen.md', '# Report\n\nGenerated: 2021-03-01\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-date' && f.file.includes('gen.md'),
    )
    expect(findings.length).toBe(1)
  })

  // ── Scan .md files in root ────────────────────────────────────────────

  it('scans root-level markdown files', () => {
    writeFile(tmpDir, 'CHANGELOG.md', '# Changelog\n\nSee `@nzila/definitely-missing-root-pkg` for details.\n')
    const report = runDocConsistency(tmpDir)
    expect(report.filesScanned).toBeGreaterThanOrEqual(1)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-package-ref' && f.message.includes('definitely-missing-root-pkg'),
    )
    expect(findings.length).toBe(1)
  })

  // ── Link whose target is ONLY an anchor (#foo) → cleanTarget empty ────

  it('does not flag anchor-only link target as broken (#heading)', () => {
    // After stripping the '#heading' anchor, cleanTarget = '' → continue
    writeFile(tmpDir, 'docs/anchors.md', '# Title\n\n[Back to top](#title)\n[Another](#section)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('anchors.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Link with query-only target (?foo) → cleanTarget empty ────────────

  it('does not flag query-only link target as broken', () => {
    // target = '?sort=name', after split('#')[0].split('?')[0] → ''
    writeFile(tmpDir, 'docs/query.md', '# Filters\n\n[Filter](?sort=name)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('query.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Link with anchor AND valid file → strips anchor, resolves file ────

  it('strips anchor from link before resolution', () => {
    writeFile(tmpDir, 'docs/target.md', '# Target')
    writeFile(tmpDir, 'docs/refs.md', '# Refs\n\n[Section](target.md#heading)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.file.includes('refs.md'),
    )
    expect(findings).toEqual([])
  })

  // ── Non-.md file skipped by walkMarkdown ──────────────────────────────

  it('walkMarkdown ignores non-.md files in root', () => {
    writeFile(tmpDir, 'notes.txt', 'This is not markdown and has `@nzila/phantom-txt-pkg`.\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.message.includes('phantom-txt-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── walkMarkdown skips .git directory ──────────────────────────────────

  it('walkMarkdown skips .git directory', () => {
    const gitDir = join(tmpDir, '.git')
    mkdirSync(gitDir, { recursive: true })
    writeFileSync(join(gitDir, 'HEAD.md'), '# Not scanned\n\n`@nzila/hidden-git-pkg`\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.message.includes('hidden-git-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── walkMarkdown skips node_modules ────────────────────────────────────

  it('walkMarkdown skips node_modules', () => {
    const nmDir = join(tmpDir, 'node_modules', 'somepkg')
    mkdirSync(nmDir, { recursive: true })
    writeFileSync(join(nmDir, 'README.md'), '# Dep\n\n`@nzila/nm-phantom-pkg`\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.message.includes('nm-phantom-pkg'),
    )
    expect(findings).toEqual([])
  })

  // ── Protocol-relative links skipped ───────────────────────────────────

  it('skips protocol-relative links (//)', () => {
    // codeql[js/incomplete-url-substring-sanitization] - test data for doc-consistency checker, not user input
    writeFile(tmpDir, 'README.md', '# Links\n\n[CDN](//cdn.example.com/lib.js)\n')
    const report = runDocConsistency(tmpDir)
    const findings = report.findings.filter(f =>
      f.rule === 'stale-reference' && f.message.includes('cdn.example.com'),
    )
    expect(findings).toEqual([])
  })
})

// ── CLI entry + generateMarkdown tests ────────────────────────────────────

describe('doc-consistency CLI entry', () => {
  let tmpDir: string
  const origArgv1 = process.argv[1]

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'doc-cli-'))
    mkdirSync(join(tmpDir, 'packages'), { recursive: true })
    mkdirSync(join(tmpDir, 'apps'), { recursive: true })
    mkdirSync(join(tmpDir, 'docs'), { recursive: true })
    writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*')
  })

  afterEach(() => {
    process.argv[1] = origArgv1
    vi.restoreAllMocks()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes JSON and markdown reports when invoked as CLI', async () => {
    // Create docs with issues
    writeFileSync(join(tmpDir, 'docs', 'guide.md'), '# Guide\n\nnzila os uses orgId\n')
    writeFileSync(join(tmpDir, 'README.md'), '# README\n\nSee `@nzila/nonexistent-pkg` for info.\n')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/doc-consistency'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetModules()
    await import('../doc-consistency.js')

    expect(existsSync(join(tmpDir, 'reports', 'doc-consistency.json'))).toBe(true)
    expect(existsSync(join(tmpDir, 'reports', 'doc-consistency.md'))).toBe(true)

    const json = JSON.parse(readFileSync(join(tmpDir, 'reports', 'doc-consistency.json'), 'utf-8'))
    expect(json.filesScanned).toBeGreaterThanOrEqual(1)

    const md = readFileSync(join(tmpDir, 'reports', 'doc-consistency.md'), 'utf-8')
    expect(md).toContain('Documentation Consistency')
    expect(md).toContain('Findings')
  })

  it('reports zero findings for clean docs', async () => {
    writeFileSync(join(tmpDir, 'ARCHITECTURE.md'), '# Architecture\nNzilaOS design.\n')
    writeFileSync(join(tmpDir, 'README.md'), '# NzilaOS\nMain readme.\n')
    writeFileSync(join(tmpDir, 'CONTRIBUTING.md'), '# Contributing\n')
    writeFileSync(join(tmpDir, 'SECURITY.md'), '# Security\n')
    writeFileSync(join(tmpDir, 'CHANGELOG.md'), '# Changelog\n')
    writeFileSync(join(tmpDir, 'docs', 'procurement-pack.md'), '# Procurement Pack\n')
    writeFileSync(join(tmpDir, 'docs', 'disaster-recovery.md'), '# DR\n')
    writeFileSync(join(tmpDir, 'docs', 'incident-response.md'), '# IR\n')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    process.argv[1] = '/some/path/doc-consistency'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.resetModules()
    await import('../doc-consistency.js')

    const json = JSON.parse(readFileSync(join(tmpDir, 'reports', 'doc-consistency.json'), 'utf-8'))
    expect(json.findingsBySeverity.error).toBe(0)
  })
})
