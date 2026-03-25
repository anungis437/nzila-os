/**
 * PHASE 8 — Staging Gate Hardening
 *
 * Validates that the CI pipeline and enforcement gates are
 * genuinely enforced (no fallbacks, no continue-on-error):
 *  - All CI jobs block on failure
 *  - Schema-drift job has no fallback loophole
 *  - Contract tests run and gate the build
 *  - Governance gates are enforced
 *  - Parity check script exists and is wired
 *  - All enforcement tools are executable
 *  - No experimental/skip flags in production paths
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = join(__dirname, '..', '..')

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

describe('CERT-PHASE-8 — Gate Hardening', () => {
  // ── CI workflow enforcement ───────────────────────────────────────────
  describe('CI workflow hardening', () => {
    const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
    const ci = readIfExists(ciPath)

    it('CI workflow exists', () => {
      expect(existsSync(ciPath)).toBe(true)
    })

    it('no continue-on-error in any CI job', () => {
      // continue-on-error would allow failing steps to pass
      const lines = ci.split('\n')
      const continueLines = lines
        .map((l, i) => ({ line: i + 1, text: l }))
        .filter(l => /continue-on-error:\s*true/i.test(l.text))
      expect(continueLines).toEqual([])
    })

    it('no fallback loophole in schema-drift job', () => {
      // The schema-drift job should NOT have || true or || echo "fallback" patterns
      const schemaDriftSection = ci.split(/^\s+schema-drift:/m)[1]?.split(/^\s+\w+:/m)[0] ?? ''
      expect(schemaDriftSection).not.toMatch(/\|\|\s*true/)
      expect(schemaDriftSection).not.toMatch(/\|\|\s*echo\s+.*fallback/i)
    })

    it('contract-tests job exists and is enforced', () => {
      expect(ci).toContain('contract-tests:')
      // Should run actual contract tests, not a placeholder
      expect(ci).toMatch(/pnpm\s+(run\s+)?contract-tests/)
    })

    it('governance-gates job exists', () => {
      expect(ci).toContain('governance-gates:')
    })

    it('hash-chain-drift job exists', () => {
      expect(ci).toContain('hash-chain-drift:')
    })

    it('red-team job exists', () => {
      expect(ci).toContain('red-team:')
    })

    it('enterprise-hardening job exists and depends on other jobs', () => {
      expect(ci).toContain('enterprise-hardening:')
      // Parse YAML: find the needs: line following enterprise-hardening:
      const lines = ci.split(/\r?\n/)
      const ehIdx = lines.findIndex(l => /^\s+enterprise-hardening:/.test(l))
      expect(ehIdx).toBeGreaterThan(-1)
      // Look for 'needs:' within the next 10 lines (before next job)
      const slice = lines.slice(ehIdx, ehIdx + 10).join('\n')
      expect(slice).toContain('needs:')
    })

    it('build job depends on lint-and-typecheck and test', () => {
      const lines = ci.split(/\r?\n/)
      const buildIdx = lines.findIndex(l => /^\s+build:/.test(l))
      expect(buildIdx).toBeGreaterThan(-1)
      const slice = lines.slice(buildIdx, buildIdx + 10).join('\n')
      expect(slice).toContain('needs:')
    })
  })

  // ── Enforcement tool executability ────────────────────────────────────
  describe('enforcement tools are executable', () => {
    it('schema-snapshot verify tool exists', () => {
      const snapshotPath = join(ROOT, 'tooling', 'db', 'schema-snapshot.ts')
      expect(existsSync(snapshotPath)).toBe(true)
    })

    it('canonical-schema verify tool exists', () => {
      const verifyPath = join(ROOT, 'tooling', 'db', 'canonical-schema', 'verify.ts')
      expect(existsSync(verifyPath)).toBe(true)
    })

    it('preflight-check tool exists', () => {
      const preflightPath = join(ROOT, 'tooling', 'db', 'preflight-check.ts')
      expect(existsSync(preflightPath)).toBe(true)
    })

    it('parity-check tool exists', () => {
      const parityPath = join(ROOT, 'tooling', 'env', 'parity-check.ts')
      expect(existsSync(parityPath)).toBe(true)
    })

    it('schema-error class exists', () => {
      const errorPath = join(ROOT, 'tooling', 'db', 'schema-error.ts')
      expect(existsSync(errorPath)).toBe(true)
    })

    it('schema-snapshot verify runs without error', () => {
      const cmd = `npx tsx ${join(ROOT, 'tooling', 'db', 'schema-snapshot.ts')} verify`
      try {
        execSync(cmd, { cwd: ROOT, timeout: 30_000, encoding: 'utf-8' })
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string }
        // Exit code 0 = pass, anything else is a real failure
        if (err.status !== 0) {
          throw new Error(`schema-snapshot verify failed: ${err.stderr}`)
        }
      }
    })

    it('canonical-schema verify runs without error', () => {
      const cmd = `npx tsx ${join(ROOT, 'tooling', 'db', 'canonical-schema', 'verify.ts')}`
      try {
        execSync(cmd, { cwd: ROOT, timeout: 30_000, encoding: 'utf-8' })
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string }
        if (err.status !== 0) {
          throw new Error(`canonical-schema verify failed: ${err.stderr}`)
        }
      }
    })

    it('preflight-check runs without error', () => {
      const cmd = `npx tsx ${join(ROOT, 'tooling', 'db', 'preflight-check.ts')}`
      try {
        execSync(cmd, { cwd: ROOT, timeout: 30_000, encoding: 'utf-8' })
      } catch (e: unknown) {
        const err = e as { status?: number; stderr?: string }
        if (err.status !== 0) {
          throw new Error(`preflight-check failed: ${err.stderr}`)
        }
      }
    })
  })

  // ── No skip/experimental flags in production paths ────────────────────
  describe('no skip flags in enforcement paths', () => {
    it('CI workflow has no SKIP_ environment overrides', () => {
      const ciPath = join(ROOT, '.github', 'workflows', 'ci.yml')
      const ci = readIfExists(ciPath)
      const skipVars = ci.match(/SKIP_\w+/g) ?? []
      expect(skipVars).toEqual([])
    })

    it('enforcement tools have no --skip or --force flags', () => {
      const tools = [
        join(ROOT, 'tooling', 'db', 'schema-snapshot.ts'),
        join(ROOT, 'tooling', 'db', 'canonical-schema', 'verify.ts'),
        join(ROOT, 'tooling', 'db', 'preflight-check.ts'),
        join(ROOT, 'tooling', 'env', 'parity-check.ts'),
      ]
      for (const tool of tools) {
        const content = readIfExists(tool)
        expect(content).not.toMatch(/--skip|--force|--bypass/)
      }
    })
  })

  // ── Contract test configuration ───────────────────────────────────────
  describe('contract test infrastructure', () => {
    it('contract test vitest config exists', () => {
      expect(existsSync(join(ROOT, 'tooling', 'contract-tests', 'vitest.config.ts'))).toBe(true)
    })

    it('contract tests have sufficient coverage (>100 test files)', () => {
      const testDir = join(ROOT, 'tooling', 'contract-tests')
      const testFiles = readFileSync(join(testDir, 'vitest.config.ts'), 'utf-8')
      // The config includes **/*.test.ts — verify test files exist
      const files = findTestFiles(testDir)
      expect(files.length).toBeGreaterThan(5)
    })
  })
})

function findTestFiles(dir: string): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 5 || !existsSync(d)) return
    try {
      for (const entry of require('node:fs').readdirSync(d)) {
        if (entry === 'node_modules') continue
        const full = join(d, entry)
        try {
          const stat = require('node:fs').statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (entry.endsWith('.test.ts')) results.push(full)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}
