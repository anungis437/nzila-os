/**
 * Contract Test — ESLint Governance Rules Enforcement
 *
 * Validates that all ESLint governance boundary rules are:
 *   1. Present as config files in the repository
 *   2. Wired into every app's ESLint configuration
 *   3. Contain the required restriction patterns
 *
 * @invariant INV-14: All apps enforce governance ESLint rules
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Required governance ESLint rules ────────────────────────────────────────

const GOVERNANCE_RULES = [
  {
    name: 'no-shadow-ai',
    configPath: 'packages/ai-sdk/eslint-no-shadow-ai.mjs',
    importName: 'noShadowAi',
    mustContain: ['openai', '@nzila/ai-core/providers'],
  },
  {
    name: 'no-shadow-ml',
    configPath: 'packages/ml-sdk/eslint-no-shadow-ml.mjs',
    importName: 'noShadowMl',
    mustContain: ['@nzila/ml-core'],
  },
  {
    name: 'no-shadow-db',
    configPath: 'packages/db/eslint-no-shadow-db.mjs',
    importName: 'noShadowDb',
    mustContain: ['@nzila/db/raw', 'createScopedDb'],
  },
  {
    name: 'no-direct-provider-import',
    configPath: 'packages/config/eslint-no-direct-provider.mjs',
    importName: 'noDirectProvider',
    mustContain: ['stripe', '@nzila/payments-stripe'],
  },
] as const

// Apps that must have ESLint governance rules
function getAppDirs(): string[] {
  const appsDir = join(ROOT, 'apps')
  if (!existsSync(appsDir)) return []
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(appsDir, d.name))
}

// ── Rule config files exist ─────────────────────────────────────────────────

describe('INV-14 — Governance ESLint rule configs exist', () => {
  for (const rule of GOVERNANCE_RULES) {
    it(`${rule.name} config file exists at ${rule.configPath}`, () => {
      expect(
        existsSync(join(ROOT, rule.configPath)),
        `${rule.configPath} must exist`,
      ).toBe(true)
    })

    it(`${rule.name} contains required restriction patterns`, () => {
      const content = readFileSync(join(ROOT, rule.configPath), 'utf-8')
      for (const pattern of rule.mustContain) {
        expect(
          content,
          `${rule.name} must contain restriction for "${pattern}"`,
        ).toContain(pattern)
      }
    })
  }
})

// ── All apps wire governance rules ──────────────────────────────────────────

describe('INV-14 — All apps wire governance ESLint rules', () => {
  const appDirs = getAppDirs()

  for (const rule of GOVERNANCE_RULES) {
    it(`every app with eslint config includes ${rule.name}`, () => {
      const missing: string[] = []
      for (const appDir of appDirs) {
        const eslintConfig = join(appDir, 'eslint.config.mjs')
        if (!existsSync(eslintConfig)) continue
        const content = readFileSync(eslintConfig, 'utf-8')
        if (!content.includes(rule.importName) && !content.includes(rule.name)) {
          missing.push(relative(ROOT, appDir))
        }
      }
      expect(
        missing,
        `Apps missing ${rule.name} ESLint rule:\n${missing.join('\n')}`,
      ).toEqual([])
    })
  }
})

// ── No bypass flags in ESLint configs ───────────────────────────────────────

describe('INV-14 — No governance rule bypass in ESLint configs', () => {
  const appDirs = getAppDirs()

  it('no app ESLint config disables no-restricted-imports', () => {
    const violations: string[] = []
    for (const appDir of appDirs) {
      const eslintConfig = join(appDir, 'eslint.config.mjs')
      if (!existsSync(eslintConfig)) continue
      const content = readFileSync(eslintConfig, 'utf-8')
      if (
        content.includes("'no-restricted-imports': 'off'") ||
        content.includes("'no-restricted-imports': 0") ||
        content.includes('"no-restricted-imports": "off"')
      ) {
        violations.push(relative(ROOT, appDir))
      }
    }
    expect(
      violations,
      `Apps disabling no-restricted-imports:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
