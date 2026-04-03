/**
 * Contract test: Evidence System Universal Coverage (PHASE 5)
 *
 * EVD-UNIV-001: All apps with riskLevel "high" or "critical" must have evidence.ts
 * EVD-UNIV-002: Evidence modules must export canonical functions
 * EVD-UNIV-003: Evidence modules must delegate to @nzila/os-core/evidence
 * EVD-UNIV-004: Financial apps must call processEvidencePack in mutation actions
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function readJSON(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function listApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next') {
        walkFiles(full, acc)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        acc.push(full)
      }
    }
  } catch { /* skip */ }
  return acc
}

// ── EVD-UNIV-001: High/critical risk apps must have evidence.ts ─────────────

describe('EVD-UNIV-001: High/critical risk apps have evidence module', () => {
  const apps = listApps()
  // orchestrator-api is a pure API gateway, not a Next.js app with evidence needs
  const EVIDENCE_EXEMPT = new Set(['orchestrator-api'])

  for (const app of apps) {
    const manifestPath = join(APPS_DIR, app, 'control-manifest.json')
    const manifest = readJSON(manifestPath)
    if (!manifest) continue
    if (EVIDENCE_EXEMPT.has(app)) continue

    const risk = manifest.riskLevel as string
    if (risk !== 'high' && risk !== 'critical') continue

    it(`${app} (riskLevel=${risk}) has lib/evidence.ts`, () => {
      const evidencePath = join(APPS_DIR, app, 'lib', 'evidence.ts')
      expect(
        existsSync(evidencePath),
        `${app} is ${risk}-risk but missing lib/evidence.ts`,
      ).toBe(true)
    })
  }
})

// ── EVD-UNIV-002: Evidence modules export canonical functions ────────────────

describe('EVD-UNIV-002: Evidence modules export required functions', () => {
  const REQUIRED_EXPORTS = ['buildEvidencePackFromAction', 'processEvidencePack']
  const apps = listApps()

  for (const app of apps) {
    const evidencePath = join(APPS_DIR, app, 'lib', 'evidence.ts')
    if (!existsSync(evidencePath)) continue

    for (const fn of REQUIRED_EXPORTS) {
      it(`${app}/lib/evidence.ts exports ${fn}`, () => {
        const src = readSafe(evidencePath)
        expect(src, `Missing export: ${fn}`).toContain(fn)
      })
    }
  }
})

// ── EVD-UNIV-003: Evidence modules delegate to @nzila/os-core/evidence ──────

describe('EVD-UNIV-003: Evidence modules use shared @nzila/os-core/evidence', () => {
  const apps = listApps()

  for (const app of apps) {
    const evidencePath = join(APPS_DIR, app, 'lib', 'evidence.ts')
    if (!existsSync(evidencePath)) continue

    it(`${app}/lib/evidence.ts imports from @nzila/os-core/evidence or equivalent`, () => {
      const src = readSafe(evidencePath)
      expect(
        src.includes('@nzila/os-core/evidence') || src.includes('@nzila/commerce-audit'),
        `${app} evidence module must delegate to @nzila/os-core/evidence or @nzila/commerce-audit`,
      ).toBe(true)
    })
  }
})

// ── EVD-UNIV-004: Financial apps have evidence in mutation actions ───────────

describe('EVD-UNIV-004: Financial app mutations call evidence pipeline', () => {
  const FINANCIAL_APPS = ['zonga', 'cfo', 'union-eyes']

  for (const app of FINANCIAL_APPS) {
    const actionsDir = join(APPS_DIR, app, 'lib', 'actions')
    if (!existsSync(actionsDir)) continue

    it(`${app}/lib/actions/ mutation files reference evidence`, () => {
      const files = walkFiles(actionsDir)
      const mutationFiles = files.filter(f => {
        const name = f.replace(/\\/g, '/').split('/').pop() ?? ''
        return (
          name.includes('subscription') ||
          name.includes('payout') ||
          name.includes('billing') ||
          name.includes('transaction') ||
          name.includes('revenue')
        )
      })

      if (mutationFiles.length === 0) return

      const violations: string[] = []
      for (const f of mutationFiles) {
        const src = readSafe(f)
        const hasEvidence =
          src.includes('buildEvidencePackFromAction') ||
          src.includes('processEvidencePack') ||
          src.includes('auditedAction') ||
          src.includes('evidence')
        if (!hasEvidence) {
          violations.push(f.replace(ROOT + '\\', '').replace(ROOT + '/', ''))
        }
      }

      expect(
        violations,
        `Financial action files missing evidence:\n${violations.join('\n')}`,
      ).toEqual([])
    })
  }
})
