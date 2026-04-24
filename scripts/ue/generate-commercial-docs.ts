#!/usr/bin/env tsx
/**
 * ue:docs:generate — Generate buyer-facing commercial documents for Union Eyes.
 *
 * Reads source-of-truth from:
 *   - apps/union-eyes/maturity.json
 *   - reports/dr/ (latest restore-drill JSON)
 *   - git log (current SHA)
 *
 * Fills {{TOKEN}} placeholders in docs/templates/*.md and writes outputs to:
 *   artifacts/commercial/
 *
 * Usage:
 *   pnpm ue:docs:generate
 *   pnpm ue:docs:generate --preview      (print to stdout, no write)
 *   pnpm ue:docs:generate --doc=procurement-pack
 *
 * Exit codes:
 *   0 = success
 *   1 = one or more templates failed to render
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as child_process from 'node:child_process'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..')
const TEMPLATES_DIR = path.join(ROOT, 'docs', 'templates')
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 'commercial')
const MATURITY_PATH = path.join(ROOT, 'apps', 'union-eyes', 'maturity.json')
const DR_REPORTS_DIR = path.join(ROOT, 'reports', 'dr')

// ── Types ─────────────────────────────────────────────────────────────────────

interface MaturityJson {
  status: string
  portfolio_tier: string
  data_integrity: string
  observability: string
  contracts_complete: boolean
  maturity_gaps: {
    backup_restore?: { target?: string; severity?: string }
    observability?: { target?: string }
    access_reviews?: { target?: string }
    contracts_complete?: { target?: string }
  }
}

interface DrDrillJson {
  timestamp?: string
  rtoTarget?: string
  rtoActual?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  // Also handle --name=value
  const prefix = `${name}=`
  const match = process.argv.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

function gitSha(): string {
  try {
    return child_process.execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function latestDrillJson(): DrDrillJson {
  if (!fs.existsSync(DR_REPORTS_DIR)) return {}
  const files = fs.readdirSync(DR_REPORTS_DIR)
    .filter((f) => f.startsWith('restore-drill-') && f.endsWith('.json'))
    .sort()
    .reverse()
  if (!files[0]) return {}
  try {
    return JSON.parse(fs.readFileSync(path.join(DR_REPORTS_DIR, files[0]), 'utf-8')) as DrDrillJson
  } catch {
    return {}
  }
}

function nextDrillDate(maturity: MaturityJson): string {
  return maturity.maturity_gaps?.backup_restore?.target ?? '2026-Q2'
}

function quarterLabel(date: Date): string {
  const q = Math.ceil((date.getMonth() + 1) / 3)
  return `${date.getFullYear()}-Q${q}`
}

// ── Build context ─────────────────────────────────────────────────────────────

function buildContext(maturity: MaturityJson, drill: DrDrillJson): Record<string, string> {
  const now = new Date()
  const drillDate = drill.timestamp ? drill.timestamp.slice(0, 10) : '2026-04-24'

  return {
    VERSION: '1.0',
    GENERATED_AT: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    GIT_SHA: gitSha(),
    STATUS: maturity.status,
    PORTFOLIO_TIER: maturity.portfolio_tier,
    DATA_INTEGRITY: maturity.data_integrity,
    OBSERVABILITY: maturity.observability,
    CONTRACTS_STATUS: maturity.contracts_complete ? 'complete' : 'partial',
    DRILL_DATE: drillDate,
    NEXT_DRILL_DATE: nextDrillDate(maturity),
    BACKUP_TARGET: maturity.maturity_gaps?.backup_restore?.target ?? '2026-Q2',
    OBSERVABILITY_TARGET: maturity.maturity_gaps?.observability?.target ?? '2026-07-15',
    ACCESS_REVIEW_TARGET: maturity.maturity_gaps?.access_reviews?.target ?? '2026-06-15',
    CONTRACTS_TARGET: maturity.maturity_gaps?.contracts_complete?.target ?? '2026-Q2',
    REVENUE_MILESTONE: 'H2 2026',
    PILOT_DURATION: '90',
    PILOT_DURATION_WEEKS: '13',
    PILOT_FEE: '$5k–25k (negotiated)',
    USER_LIMIT: 'Agreed cohort size',
    ORG_NAME: '[Prospective Organisation]',
    QUARTER: quarterLabel(now),
  }
}

function renderTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? `{{${key}}}`)
}

// ── Templates to render ───────────────────────────────────────────────────────

const TEMPLATES = [
  'pilot-proposal',
  'procurement-pack',
  'security-onepager',
  'executive-brief',
  'business-continuity-summary',
  'trust-center-summary',
]

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const preview = hasFlag('--preview')
  const onlyDoc = parseArg('--doc')

  // Load source of truth
  let maturity: MaturityJson
  try {
    maturity = JSON.parse(fs.readFileSync(MATURITY_PATH, 'utf-8')) as MaturityJson
  } catch {
    process.stderr.write('ERROR: Cannot read apps/union-eyes/maturity.json\n')
    process.exit(1)
  }

  const drill = latestDrillJson()
  const ctx = buildContext(maturity, drill)

  const targets = onlyDoc ? [onlyDoc] : TEMPLATES
  let failCount = 0
  const written: string[] = []

  if (!preview) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (const name of targets) {
    const templatePath = path.join(TEMPLATES_DIR, `${name}.md`)
    if (!fs.existsSync(templatePath)) {
      process.stderr.write(`  WARN: Template not found: docs/templates/${name}.md\n`)
      failCount++
      continue
    }

    const template = fs.readFileSync(templatePath, 'utf-8')
    const rendered = renderTemplate(template, ctx)

    if (preview) {
      process.stdout.write(`\n${'─'.repeat(60)}\n`)
      process.stdout.write(`Template: ${name}.md\n`)
      process.stdout.write(`${'─'.repeat(60)}\n`)
      process.stdout.write(rendered.slice(0, 1000))
      if (rendered.length > 1000) process.stdout.write('\n...(truncated)\n')
    } else {
      const outPath = path.join(OUTPUT_DIR, `${name}.md`)
      fs.writeFileSync(outPath, rendered, 'utf-8')
      written.push(path.relative(ROOT, outPath))
    }
  }

  if (!preview) {
    process.stdout.write(`\n── Commercial Documents Generated ───────────────────\n`)
    process.stdout.write(`  Git SHA:   ${ctx.GIT_SHA}\n`)
    process.stdout.write(`  Generated: ${ctx.GENERATED_AT}\n`)
    process.stdout.write(`  Status:    ${ctx.STATUS}\n`)
    process.stdout.write('\n  Files:\n')
    for (const f of written) {
      process.stdout.write(`    ${f}\n`)
    }
    process.stdout.write('\n')
  }

  if (failCount > 0) {
    process.exit(1)
  }
}

main()
