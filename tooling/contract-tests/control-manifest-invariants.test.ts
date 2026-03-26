/**
 * Contract tests for control manifests.
 *
 * Validates structural invariants of the per-app control manifest system:
 *   CM-CT-001: Every app directory has a control-manifest.json
 *   CM-CT-002: Manifests have required fields with correct types
 *   CM-CT-003: Immutable controls are never waived
 *   CM-CT-004: High/critical risk apps declare enforcement + governance
 *   CM-CT-005: Validator script exists and is executable
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

/** Exclude ephemeral scaffold dirs created by golden-path-invariants tests */
const SCAFFOLD_EXCLUSIONS = ['test-scaffold-gp']

const APP_NAMES = readdirSync(APPS_DIR).filter(d =>
  statSync(join(APPS_DIR, d)).isDirectory() && !SCAFFOLD_EXCLUSIONS.includes(d)
)

const REQUIRED_FIELDS = ['app', 'version', 'riskLevel', 'policyProfile', 'controls', 'exceptions']
const CONTROL_FLAGS = [
  'enforcement', 'governance', 'audit', 'observability',
  'security', 'aiControl', 'contracts', 'events',
]
const VALID_RISK = ['critical', 'high', 'medium', 'low', 'none']
const IMMUTABLE_CONTROLS = [
  'org-isolation', 'audit-emission', 'evidence-sealing', 'hash-chain-integrity',
  'secret-scanning', 'dependency-audit', 'contract-tests', 'eslint-governance-rules',
]

function loadManifest(app: string) {
  const p = join(APPS_DIR, app, 'control-manifest.json')
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf-8'))
}

// ── CM-CT-001 ───────────────────────────────────────────────────────────────

describe('CM-CT-001: every app has control-manifest.json', () => {
  for (const app of APP_NAMES) {
    it(`${app} has control-manifest.json`, () => {
      const p = join(APPS_DIR, app, 'control-manifest.json')
      expect(existsSync(p), `${app}/control-manifest.json missing`).toBe(true)
    })
  }
})

// ── CM-CT-002 ───────────────────────────────────────────────────────────────

describe('CM-CT-002: manifests have required fields', () => {
  for (const app of APP_NAMES) {
    it(`${app} manifest schema`, () => {
      const m = loadManifest(app)
      expect(m).not.toBeNull()

      for (const f of REQUIRED_FIELDS) {
        expect(m).toHaveProperty(f)
      }
      expect(m.app).toBe(app)
      expect(VALID_RISK).toContain(m.riskLevel)
      expect(typeof m.controls).toBe('object')
      for (const flag of CONTROL_FLAGS) {
        expect(typeof m.controls[flag]).toBe('boolean')
      }
      expect(Array.isArray(m.exceptions)).toBe(true)
    })
  }
})

// ── CM-CT-003 ───────────────────────────────────────────────────────────────

describe('CM-CT-003: immutable controls never waived', () => {
  for (const app of APP_NAMES) {
    it(`${app} does not waive immutable controls`, () => {
      const m = loadManifest(app)
      if (!m) return

      const waivedImmutables = m.exceptions.filter(
        (e: { control: string }) => IMMUTABLE_CONTROLS.includes(e.control)
      )
      expect(waivedImmutables).toHaveLength(0)
    })
  }
})

// ── CM-CT-004 ───────────────────────────────────────────────────────────────

describe('CM-CT-004: high/critical risk apps require enforcement + governance', () => {
  for (const app of APP_NAMES) {
    it(`${app} risk-appropriate controls`, () => {
      const m = loadManifest(app)
      if (!m) return
      if (m.riskLevel !== 'critical' && m.riskLevel !== 'high') return

      expect(m.controls.enforcement).toBe(true)
      expect(m.controls.governance).toBe(true)
    })
  }
})

// ── CM-CT-005 ───────────────────────────────────────────────────────────────

describe('CM-CT-005: validator script exists', () => {
  it('validate-control-manifests.ts exists', () => {
    const p = join(ROOT, 'tooling', 'governance', 'validate-control-manifests.ts')
    expect(existsSync(p)).toBe(true)
  })

  it('validate:control:manifests script in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    expect(pkg.scripts['validate:control:manifests']).toBeDefined()
  })
})
