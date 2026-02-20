/**
 * Contract Test — Pre-commit Guardrails
 *
 * Verifies:
 *   1. Lefthook config exists with required hooks
 *   2. Gitleaks config exists with custom rules
 *   3. CI secret-scan workflow references the repo config
 *   4. `prepare` script installs lefthook
 *   5. Documentation exists for secret scanning
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

describe('Pre-commit guardrails', () => {
  describe('Lefthook configuration', () => {
    const lefthookPath = resolve(ROOT, 'lefthook.yml')

    it('lefthook.yml exists', () => {
      expect(existsSync(lefthookPath)).toBe(true)
    })

    it('has pre-commit hooks for gitleaks, lint, and typecheck', () => {
      const content = readContent(lefthookPath)
      expect(content).toContain('pre-commit:')
      expect(content).toContain('gitleaks')
      expect(content).toContain('lint')
      expect(content).toContain('typecheck')
    })

    it('has pre-push hooks for contract tests', () => {
      const content = readContent(lefthookPath)
      expect(content).toContain('pre-push:')
      expect(content).toContain('contract-tests')
    })
  })

  describe('Gitleaks configuration', () => {
    const gitleaksPath = resolve(ROOT, '.gitleaks.toml')

    it('.gitleaks.toml exists', () => {
      expect(existsSync(gitleaksPath)).toBe(true)
    })

    it('extends default rules', () => {
      const content = readContent(gitleaksPath)
      expect(content).toContain('useDefault = true')
    })

    it('has Nzila-specific custom rules', () => {
      const content = readContent(gitleaksPath)
      // Must have custom rules for key secret types in the platform
      expect(content).toContain('nzila-clerk-secret-key')
      expect(content).toContain('nzila-stripe-secret-key')
      expect(content).toContain('nzila-database-url-with-password')
    })

    it('allowlists CI placeholder values', () => {
      const content = readContent(gitleaksPath)
      expect(content).toContain('sk_test_placeholder')
      expect(content).toContain('pk_test_placeholder')
    })
  })

  describe('CI secret-scan workflow', () => {
    const workflowPath = resolve(
      ROOT,
      '.github/workflows/secret-scan.yml'
    )

    it('workflow exists', () => {
      expect(existsSync(workflowPath)).toBe(true)
    })

    it('references .gitleaks.toml config', () => {
      const content = readContent(workflowPath)
      expect(content).toContain('.gitleaks.toml')
    })

    it('runs both TruffleHog and Gitleaks', () => {
      const content = readContent(workflowPath)
      expect(content).toContain('trufflehog')
      expect(content).toContain('gitleaks')
    })
  })

  describe('package.json prepare script', () => {
    it('prepare script installs lefthook', () => {
      const pkg = JSON.parse(
        readContent(resolve(ROOT, 'package.json'))
      )
      expect(pkg.scripts?.prepare).toContain('lefthook install')
    })

    it('lefthook is a devDependency', () => {
      const pkg = JSON.parse(
        readContent(resolve(ROOT, 'package.json'))
      )
      expect(pkg.devDependencies?.lefthook).toBeDefined()
    })
  })

  describe('Documentation', () => {
    it('secrets hardening doc exists', () => {
      expect(
        existsSync(resolve(ROOT, 'docs/hardening/secrets.md'))
      ).toBe(true)
    })
  })
})
