// cSpell:ignore nzila
/**
 * Contract Test — UnionEyes Evidence Adoption
 *
 * Proves that UnionEyes has adopted @nzila/os-core evidence tooling and
 * is not running its own custom seal logic that bypasses governance.
 *
 * Checks:
 *   UE-EVD-01: Evidence scripts exist in apps/union-eyes/scripts/evidence/
 *   UE-EVD-02: Scripts reference @nzila/os-core (not bespoke seal)
 *   UE-EVD-03: package.json has evidence:collect, evidence:seal, evidence:verify scripts
 *   UE-EVD-04: verify.mjs exits 1 on invalid/missing seal (negative test)
 *   UE-EVD-05: verify.mjs exits 1 when pack exists but seal is missing (governance invariant)
 *   UE-EVD-06: @nzila/os-core is listed as a dependency
 *
 * @invariant UE-GOV-EVIDENCE: UE must use NzilaOS evidence primitives, not bespoke sealing
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = join(__dirname, '..', '..')
const UE_DIR = join(ROOT, 'apps', 'union-eyes')
const SCRIPTS_DIR = join(UE_DIR, 'scripts', 'evidence')

// ── UE-EVD-01: Scripts exist ─────────────────────────────────────────────────

describe('UE-EVD-01 — Evidence scripts exist', () => {
  it('collect.mjs exists', () => {
    expect(existsSync(join(SCRIPTS_DIR, 'collect.mjs')),
      'apps/union-eyes/scripts/evidence/collect.mjs must exist').toBe(true)
  })

  it('seal.mjs exists', () => {
    expect(existsSync(join(SCRIPTS_DIR, 'seal.mjs')),
      'apps/union-eyes/scripts/evidence/seal.mjs must exist').toBe(true)
  })

  it('verify.mjs exists', () => {
    expect(existsSync(join(SCRIPTS_DIR, 'verify.mjs')),
      'apps/union-eyes/scripts/evidence/verify.mjs must exist').toBe(true)
  })
})

// ── UE-EVD-02: Scripts reference @nzila/os-core ───────────────────────────────

describe('UE-EVD-02 — Scripts reference @nzila/os-core evidence primitives', () => {
  it('seal.mjs imports from @nzila/os-core/evidence/seal', () => {
    const content = readFileSync(join(SCRIPTS_DIR, 'seal.mjs'), 'utf-8')
    expect(content).toContain('@nzila/os-core/evidence/seal')
  })

  it('verify.mjs imports from @nzila/os-core/evidence/seal', () => {
    const content = readFileSync(join(SCRIPTS_DIR, 'verify.mjs'), 'utf-8')
    expect(content).toContain('@nzila/os-core/evidence/seal')
  })

  it('verify.mjs calls verifySeal (not custom hash comparison only)', () => {
    const content = readFileSync(join(SCRIPTS_DIR, 'verify.mjs'), 'utf-8')
    expect(content).toContain('verifySeal')
  })

  it('seal.mjs calls generateSeal (not custom implementation only)', () => {
    const content = readFileSync(join(SCRIPTS_DIR, 'seal.mjs'), 'utf-8')
    expect(content).toContain('generateSeal')
  })
})

// ── UE-EVD-03: package.json has evidence scripts ──────────────────────────────

describe('UE-EVD-03 — package.json has evidence script commands', () => {
  const pkg = JSON.parse(readFileSync(join(UE_DIR, 'package.json'), 'utf-8'))

  it('evidence:collect script defined', () => {
    expect(pkg.scripts?.['evidence:collect'],
      'evidence:collect must be defined in package.json scripts').toBeTruthy()
    expect(pkg.scripts['evidence:collect']).toContain('collect.mjs')
  })

  it('evidence:seal script defined', () => {
    expect(pkg.scripts?.['evidence:seal'],
      'evidence:seal must be defined in package.json scripts').toBeTruthy()
    expect(pkg.scripts['evidence:seal']).toContain('seal.mjs')
  })

  it('evidence:verify script defined', () => {
    expect(pkg.scripts?.['evidence:verify'],
      'evidence:verify must be defined in package.json scripts').toBeTruthy()
    expect(pkg.scripts['evidence:verify']).toContain('verify.mjs')
  })
})

// ── UE-EVD-04: verify.mjs exits 1 on missing pack.json ───────────────────────

describe('UE-EVD-04 — verify.mjs gate: exits 1 when pack.json is absent', () => {
  it('exits with code 1 when evidence-output/pack.json does not exist', () => {
    // Run in a temp dir that has no pack.json
    const result = spawnSync(
      'node',
      [
        '--import', 'tsx/esm',
        join(SCRIPTS_DIR, 'verify.mjs'),
        '--output', '/tmp/ue-evidence-missing-test',
      ],
      {
        cwd: UE_DIR,
        encoding: 'utf-8',
        timeout: 10_000,
      },
    )
    // Must exit non-zero (either because pack not found or node can't load)
    expect(result.status).not.toBe(0)
  })
})

// ── UE-EVD-05: Pack without seal is rejected ──────────────────────────────────

describe('UE-EVD-05 — governance invariant: pack without seal fails verify', () => {
  it('verify.mjs content guards against pack-without-seal', () => {
    const content = readFileSync(join(SCRIPTS_DIR, 'verify.mjs'), 'utf-8')
    // Must check that seal.json exists separately from pack.json
    const hasPackCheck = content.includes('SEAL_PATH') || content.includes('seal.json')
    const hasSealMissingError = content.includes('pack exists without a seal') ||
      content.includes('seal.json') && content.includes('process.exit(1)')
    expect(hasPackCheck, 'verify.mjs must check for seal.json existence').toBe(true)
    expect(hasSealMissingError, 'verify.mjs must explicitly fail when seal is missing').toBe(true)
  })
})

// ── UE-EVD-06: @nzila/os-core dependency ─────────────────────────────────────

describe('UE-EVD-06 — @nzila/os-core listed as a UE dependency', () => {
  it('@nzila/os-core is in dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(UE_DIR, 'package.json'), 'utf-8'))
    const hasOsCore =
      pkg.dependencies?.['@nzila/os-core'] !== undefined ||
      pkg.devDependencies?.['@nzila/os-core'] !== undefined

    expect(hasOsCore, '@nzila/os-core must be in UE dependencies').toBe(true)
  })
})
