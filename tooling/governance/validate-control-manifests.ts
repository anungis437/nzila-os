/**
 * Control Manifest Validator
 *
 * Validates that every governed app has a well-formed control-manifest.json
 * declaring its required governance controls, policy profile, and risk level.
 * Produces a machine-readable report and exits non-zero on any failure.
 *
 * Checks:
 *   CM-001: Every app has a control-manifest.json
 *   CM-002: Manifest conforms to required schema
 *   CM-003: Immutable controls cannot be disabled
 *   CM-004: Risk level matches runtime-adoption-matrix
 *   CM-005: Policy profile references valid profile ID
 *   CM-006: High/critical-risk apps require enforcement + governance
 *   CM-007: Apps with AI routes require ai-control
 *   CM-008: Apps with webhook routes require audit
 *   CM-009: Exception waivers have expiry dates
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename2 = fileURLToPath(import.meta.url)
const __dirname2 = dirname(__filename2)

// ── Types ───────────────────────────────────────────────────────────────────

interface ControlManifest {
  $schema?: string
  app: string
  version: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none'
  policyProfile: string | null
  controls: {
    enforcement: boolean
    governance: boolean
    audit: boolean
    observability: boolean
    security: boolean
    aiControl: boolean
    contracts: boolean
    events: boolean
  }
  exceptions: Array<{
    control: string
    reason: string
    expiresOn: string
    owner: string
  }>
}

interface MatrixApp {
  name: string
  riskLevel: string
  adoption: Record<string, boolean>
  webhookRoutes?: string[]
  aiRoutes?: string[]
}

interface CheckResult {
  name: string
  status: 'pass' | 'fail'
  detail: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = join(__dirname2, '..', '..')
const APPS_DIR = join(ROOT, 'apps')
const MATRIX_PATH = join(ROOT, 'governance', 'runtime-adoption-matrix.json')
const PROFILES_DIR = join(ROOT, 'governance', 'profiles')
const OUTPUT_DIR = join(ROOT, 'ops', 'outputs')
const OUTPUT_FILE = join(OUTPUT_DIR, 'control-manifest-report.json')

const APP_NAMES = [
  'abr', 'cfo', 'console', 'control-plane', 'cora', 'flow',
  'mobility', 'mobility-client-portal', 'nacp-exams',
  'orchestrator-api', 'partners', 'platform-admin', 'pondu',
  'trade', 'union-eyes', 'web', 'zonga',
]

const IMMUTABLE_CONTROLS = [
  'org-isolation', 'audit-emission', 'evidence-sealing', 'hash-chain-integrity',
  'secret-scanning', 'dependency-audit', 'contract-tests', 'eslint-governance-rules',
] as const

const VALID_PROFILES = [
  'union-eyes', 'abr-insights', 'fintech', 'commerce', 'agtech', 'media', 'advisory',
]

const REQUIRED_MANIFEST_FIELDS = ['app', 'version', 'riskLevel', 'policyProfile', 'controls', 'exceptions']
const REQUIRED_CONTROL_FLAGS = [
  'enforcement', 'governance', 'audit', 'observability',
  'security', 'aiControl', 'contracts', 'events',
]
const VALID_RISK_LEVELS = ['critical', 'high', 'medium', 'low', 'none']

// ── Helpers ─────────────────────────────────────────────────────────────────

function check(name: string, fn: () => string): CheckResult {
  try {
    const detail = fn()
    return { name, status: 'pass', detail }
  } catch (err) {
    return { name, status: 'fail', detail: err instanceof Error ? err.message : String(err) }
  }
}

function loadMatrix(): MatrixApp[] {
  const raw = readFileSync(MATRIX_PATH, 'utf-8')
  const data = JSON.parse(raw)
  return data.apps as MatrixApp[]
}

function loadManifest(appName: string): ControlManifest | null {
  const p = join(APPS_DIR, appName, 'control-manifest.json')
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf-8')) as ControlManifest
}

// ── Checks ──────────────────────────────────────────────────────────────────

function runChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const matrix = loadMatrix()

  // CM-001: Every app has a control-manifest.json
  results.push(check('CM-001: all apps have control-manifest.json', () => {
    const missing = APP_NAMES.filter(n => !existsSync(join(APPS_DIR, n, 'control-manifest.json')))
    if (missing.length > 0) throw new Error(`Missing manifests: ${missing.join(', ')}`)
    return `${APP_NAMES.length} manifests found`
  }))

  // CM-002: Manifests conform to schema
  for (const appName of APP_NAMES) {
    results.push(check(`CM-002: ${appName} schema valid`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      for (const f of REQUIRED_MANIFEST_FIELDS) {
        if (!(f in m)) throw new Error(`missing field: ${f}`)
      }
      if (m.app !== appName) throw new Error(`app field "${m.app}" != "${appName}"`)
      if (!VALID_RISK_LEVELS.includes(m.riskLevel)) {
        throw new Error(`invalid riskLevel: ${m.riskLevel}`)
      }
      for (const flag of REQUIRED_CONTROL_FLAGS) {
        if (typeof m.controls[flag as keyof typeof m.controls] !== 'boolean') {
          throw new Error(`controls.${flag} must be boolean`)
        }
      }
      if (!Array.isArray(m.exceptions)) throw new Error('exceptions must be array')
      return 'schema valid'
    }))
  }

  // CM-003: Immutable controls cannot be disabled
  for (const appName of APP_NAMES) {
    results.push(check(`CM-003: ${appName} immutable controls`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      // Immutable controls are platform-level — manifest should not contain
      // any exception waiver targeting an immutable control
      const violating = m.exceptions.filter(e =>
        IMMUTABLE_CONTROLS.includes(e.control as typeof IMMUTABLE_CONTROLS[number])
      )
      if (violating.length > 0) {
        throw new Error(`immutable controls waived: ${violating.map(v => v.control).join(', ')}`)
      }
      return 'no immutable controls waived'
    }))
  }

  // CM-004: Risk level matches runtime-adoption-matrix
  for (const appName of APP_NAMES) {
    results.push(check(`CM-004: ${appName} risk level consistent`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      const matrixApp = matrix.find(a => a.name === appName)
      if (!matrixApp) throw new Error('not in runtime-adoption-matrix')
      if (m.riskLevel !== matrixApp.riskLevel) {
        throw new Error(`manifest="${m.riskLevel}" matrix="${matrixApp.riskLevel}"`)
      }
      return `risk: ${m.riskLevel}`
    }))
  }

  // CM-005: Policy profile references valid profile
  for (const appName of APP_NAMES) {
    results.push(check(`CM-005: ${appName} profile valid`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      if (m.policyProfile === null) return 'no profile (allowed)'
      if (!VALID_PROFILES.includes(m.policyProfile)) {
        throw new Error(`unknown profile: ${m.policyProfile}`)
      }
      return `profile: ${m.policyProfile}`
    }))
  }

  // CM-006: High/critical-risk apps require enforcement + governance
  for (const appName of APP_NAMES) {
    results.push(check(`CM-006: ${appName} high-risk controls`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      if (m.riskLevel !== 'critical' && m.riskLevel !== 'high') return 'not high/critical risk'
      if (!m.controls.enforcement) throw new Error('high-risk app must declare enforcement=true')
      if (!m.controls.governance) throw new Error('high-risk app must declare governance=true')
      return 'enforcement + governance declared'
    }))
  }

  // CM-007: Apps with AI routes require ai-control
  for (const appName of APP_NAMES) {
    results.push(check(`CM-007: ${appName} AI control`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      const matrixApp = matrix.find(a => a.name === appName)
      if (!matrixApp) throw new Error('not in matrix')
      const hasAI = matrixApp.aiRoutes && matrixApp.aiRoutes.length > 0
      if (!hasAI) return 'no AI routes'
      if (!m.controls.aiControl) throw new Error('app has AI routes but aiControl=false')
      return `${matrixApp.aiRoutes!.length} AI routes → aiControl=true`
    }))
  }

  // CM-008: Apps with webhook routes require audit
  for (const appName of APP_NAMES) {
    results.push(check(`CM-008: ${appName} webhook audit`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      const matrixApp = matrix.find(a => a.name === appName)
      if (!matrixApp) throw new Error('not in matrix')
      const hasWebhooks = matrixApp.webhookRoutes && matrixApp.webhookRoutes.length > 0
      if (!hasWebhooks) return 'no webhook routes'
      if (!m.controls.audit) throw new Error('app has webhooks but audit=false')
      return `${matrixApp.webhookRoutes!.length} webhook routes → audit=true`
    }))
  }

  // CM-009: Exception waivers have valid expiry dates
  for (const appName of APP_NAMES) {
    results.push(check(`CM-009: ${appName} exception expiry`, () => {
      const m = loadManifest(appName)
      if (!m) throw new Error('manifest not found')
      if (m.exceptions.length === 0) return 'no exceptions'
      for (const ex of m.exceptions) {
        if (!ex.control || !ex.reason || !ex.expiresOn || !ex.owner) {
          throw new Error(`incomplete exception: ${JSON.stringify(ex)}`)
        }
        const d = new Date(ex.expiresOn)
        if (isNaN(d.getTime())) throw new Error(`invalid date: ${ex.expiresOn}`)
      }
      return `${m.exceptions.length} exceptions, all dated`
    }))
  }

  return results
}

// ── Main ────────────────────────────────────────────────────────────────────

const results = runChecks()
const passed = results.filter(r => r.status === 'pass').length
const failed = results.filter(r => r.status === 'fail').length

console.log('\n┌─────────────────────────────────────────────────┐')
console.log('│        Control Manifest Validation Report        │')
console.log('└─────────────────────────────────────────────────┘\n')

for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : '✗'
  console.log(`  ${icon}  ${r.name}`)
  if (r.status === 'fail') console.log(`     └─ ${r.detail}`)
}

console.log(`\n  Total: ${results.length} | Pass: ${passed} | Fail: ${failed}\n`)

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT_FILE, JSON.stringify({
  timestamp: new Date().toISOString(),
  total: results.length,
  passed,
  failed,
  results,
}, null, 2))
console.log(`  Report: ${OUTPUT_FILE}\n`)

if (failed > 0) process.exit(1)
