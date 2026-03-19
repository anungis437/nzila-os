/**
 * Golden Path contract tests.
 *
 * Validates that the scaffold generator and golden path documentation
 * are structurally sound and produce valid governed apps.
 *
 *   GP-001: Scaffold generator script exists
 *   GP-002: Developer guide exists
 *   GP-003: Scaffold generates valid control-manifest.json
 *   GP-004: Scaffold generates required governance files
 *   GP-005: Template app-adoption directory is complete
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = join(__dirname, '..', '..')
const SCAFFOLD_SCRIPT = join(ROOT, 'tooling', 'golden-path', 'scaffold-governed-app.ts')
const GUIDE_PATH = join(ROOT, 'docs', 'GOLDEN_PATH_DEVELOPER_GUIDE.md')
const TEST_APP = 'test-scaffold-gp'
const TEST_APP_DIR = join(ROOT, 'apps', TEST_APP)

// ── GP-001: Scaffold generator exists ───────────────────────────────────────

describe('GP-001: scaffold generator', () => {
  it('scaffold-governed-app.ts exists', () => {
    expect(existsSync(SCAFFOLD_SCRIPT)).toBe(true)
  })

  it('scaffold script is TypeScript', () => {
    const content = readFileSync(SCAFFOLD_SCRIPT, 'utf-8')
    expect(content).toContain('import')
    expect(content).toContain('process.argv')
  })
})

// ── GP-002: Developer guide exists ──────────────────────────────────────────

describe('GP-002: developer guide', () => {
  it('GOLDEN_PATH_DEVELOPER_GUIDE.md exists', () => {
    expect(existsSync(GUIDE_PATH)).toBe(true)
  })

  it('guide covers key topics', () => {
    const content = readFileSync(GUIDE_PATH, 'utf-8')
    expect(content).toContain('Quick Start')
    expect(content).toContain('control-manifest.json')
    expect(content).toContain('enforcement')
    expect(content).toContain('Policy Profile')
    expect(content).toContain('Exception Waiver')
  })
})

// ── GP-003 + GP-004: Scaffold generates valid output ────────────────────────

describe('GP-003/004: scaffold output', () => {
  beforeAll(() => {
    if (existsSync(TEST_APP_DIR)) rmSync(TEST_APP_DIR, { recursive: true })
    execSync(
      `npx tsx "${SCAFFOLD_SCRIPT}" ${TEST_APP} --risk=high --profile=commerce`,
      { cwd: ROOT, stdio: 'pipe' }
    )
  })

  afterAll(() => {
    if (existsSync(TEST_APP_DIR)) rmSync(TEST_APP_DIR, { recursive: true })
  })

  it('creates app directory', () => {
    expect(existsSync(TEST_APP_DIR)).toBe(true)
  })

  it('creates control-manifest.json', () => {
    const p = join(TEST_APP_DIR, 'control-manifest.json')
    expect(existsSync(p)).toBe(true)
  })

  it('control-manifest has correct app name', () => {
    const m = JSON.parse(readFileSync(join(TEST_APP_DIR, 'control-manifest.json'), 'utf-8'))
    expect(m.app).toBe(TEST_APP)
  })

  it('control-manifest has correct risk level', () => {
    const m = JSON.parse(readFileSync(join(TEST_APP_DIR, 'control-manifest.json'), 'utf-8'))
    expect(m.riskLevel).toBe('high')
  })

  it('control-manifest has correct profile', () => {
    const m = JSON.parse(readFileSync(join(TEST_APP_DIR, 'control-manifest.json'), 'utf-8'))
    expect(m.policyProfile).toBe('commerce')
  })

  it('high-risk app has enforcement enabled', () => {
    const m = JSON.parse(readFileSync(join(TEST_APP_DIR, 'control-manifest.json'), 'utf-8'))
    expect(m.controls.enforcement).toBe(true)
    expect(m.controls.governance).toBe(true)
  })

  it('creates app-architecture.meta.json', () => {
    expect(existsSync(join(TEST_APP_DIR, 'app-architecture.meta.json'))).toBe(true)
  })

  it('creates package.json', () => {
    expect(existsSync(join(TEST_APP_DIR, 'package.json'))).toBe(true)
  })

  it('creates tsconfig.json', () => {
    expect(existsSync(join(TEST_APP_DIR, 'tsconfig.json'))).toBe(true)
  })

  it('creates enforcement handler for high risk', () => {
    expect(existsSync(join(TEST_APP_DIR, 'lib', 'enforcement.ts'))).toBe(true)
  })

  it('enforcement handler imports from @nzila/enforcement', () => {
    const content = readFileSync(join(TEST_APP_DIR, 'lib', 'enforcement.ts'), 'utf-8')
    expect(content).toContain('@nzila/enforcement')
  })

  it('creates health endpoint', () => {
    expect(existsSync(join(TEST_APP_DIR, 'app', 'api', 'health', 'route.ts'))).toBe(true)
  })

  it('creates root page', () => {
    expect(existsSync(join(TEST_APP_DIR, 'app', 'page.tsx'))).toBe(true)
  })

  it('creates README', () => {
    const content = readFileSync(join(TEST_APP_DIR, 'README.md'), 'utf-8')
    expect(content).toContain(TEST_APP)
    expect(content).toContain('high')
  })
})

// ── GP-005: Template app-adoption directory ─────────────────────────────────

describe('GP-005: app-adoption templates', () => {
  const templateDir = join(ROOT, 'templates', 'app-adoption')

  it('templates/app-adoption exists', () => {
    expect(existsSync(templateDir)).toBe(true)
  })

  it('has README.md', () => {
    expect(existsSync(join(templateDir, 'README.md'))).toBe(true)
  })
})
