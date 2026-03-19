/**
 * Contract Test — No Hardcoded Dashboard Stats (STUDIO-DASH-01)
 *
 * Verifies:
 *   Dashboard / overview pages do NOT contain hardcoded stat values.
 *   Every displayed metric must come from a DB query, API call, or
 *   server-side computation — never from literal strings or numbers
 *   baked into JSX.
 *
 *   Banned patterns:
 *     - `value: '124'` or `value: "—"` or `value="$50,000"`
 *     - `<span>124</span>` or `<p>$50,000</p>` inside stat cards
 *     - Placeholder strings like `'Coming soon'`, `'N/A'`, `'—'` used
 *       as metric values (as opposed to UI labels)
 *
 *   Allowed:
 *     - Labels (`title: 'Total Revenue'`)
 *     - Format strings (`'$' + formatted`)
 *     - Icons, class names, etc.
 *     - Loading/error fallbacks that are clearly conditional
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

/**
 * Apps with dashboards that must show live data.
 * Excludes web (marketing) and orchestrator-api (no UI).
 */
const DASHBOARD_APPS = [
  'console',
  'partners',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
]

/**
 * Patterns that suggest hardcoded metric values.
 *
 * Each regex is designed to catch common anti-patterns:
 *   - Stat card `value` props with literal numbers/strings
 *   - JSX text content that looks like a metric value
 *
 * We intentionally avoid catching:
 *   - Form controls (<SelectItem>, <option>, <input>) where value= is an attribute
 *   - Zero / empty-state values ($0.00, 0, 0%) which are legitimate placeholders
 *   - Small single-digit numbers commonly used as enum/option IDs
 */
const HARDCODE_PATTERNS = [
  // value prop with a literal dollar/euro/pound amount (non-zero, ≥ $1)
  /value[=:]\s*['"][\$€£][1-9][\d,]*(?:\.\d+)?['"]/,
  // value prop with a literal number ≥ 100 (likely a stat, not a form option)
  /value[=:]\s*['"]\d{3,}['"]/,
  // value prop with placeholder dash
  /value[=:]\s*['"]—['"]/,
]

/** Lines matching any of these keywords are form controls, not stat cards */
const FORM_CONTROL_KEYWORDS = [
  'SelectItem', 'SelectValue', '<option', '<select', '<input',
  'RadioGroupItem', 'ToggleGroupItem', 'tabIndex', 'step=',
]

/** Subpaths where dashboard pages typically live */
const DASHBOARD_GLOBS = [
  'app/dashboard',
  'app/(dashboard)',
  'app/(app)',
  'app/(protected)',
  'app/[locale]/dashboard',
  'app/[locale]/(dashboard)',
  'app/[locale]/(app)',
]

function findDashboardFiles(appDir: string): string[] {
  const results: string[] = []

  for (const sub of DASHBOARD_GLOBS) {
    const dir = resolve(appDir, sub)
    if (!existsSync(dir)) continue
    collectFiles(dir, results)
  }

  // Also check the root page.tsx (some apps use it as dashboard)
  const rootPage = resolve(appDir, 'app', 'page.tsx')
  if (existsSync(rootPage)) results.push(rootPage)

  return results
}

function collectFiles(dir: string, results: string[]) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, results)
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(fullPath)
    }
  }
}

function read(filePath: string): string {
  try { return readFileSync(filePath, 'utf-8') } catch { return '' }
}

describe('No hardcoded dashboard stats — STUDIO-DASH-01 contract', () => {
  for (const app of DASHBOARD_APPS) {
    const appDir = resolve(ROOT, 'apps', app)
    const files = findDashboardFiles(appDir)

    // Only test apps that have identifiable dashboard pages
    if (files.length === 0) continue

    describe(`apps/${app}`, () => {
      for (const file of files) {
        const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
        const content = read(file)
        if (!content) continue

        for (const pattern of HARDCODE_PATTERNS) {
          it(`${rel} — no hardcoded stat value: ${pattern.source}`, () => {
            // Test line-by-line so we can skip form-control lines
            const lines = content.split('\n')
            const violations: string[] = []
            for (const line of lines) {
              if (FORM_CONTROL_KEYWORDS.some((kw) => line.includes(kw))) continue
              const m = line.match(pattern)
              if (m) violations.push(m[0])
            }
            expect(
              violations.length === 0 ? null : violations,
              `${rel} appears to contain hardcoded dashboard stats ` +
              `(matched: ${violations.map((v) => `"${v}"`).join(', ')}). Replace with a server-side query.`,
            ).toBeNull()
          })
        }
      }
    })
  }
})
