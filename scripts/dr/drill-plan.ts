#!/usr/bin/env tsx
/**
 * drill-plan.ts — Generate a printable DR drill plan and pre-drill checklist.
 *
 * Produces a markdown drill plan for the upcoming quarterly restore drill,
 * pre-populated with the current migration count, RTO/RPO targets, and
 * environment details.
 *
 * Usage:
 *   pnpm exec tsx scripts/dr/drill-plan.ts
 *   pnpm exec tsx scripts/dr/drill-plan.ts --out docs/union-eyes/dr/drill-plan-Q2-2026.md
 *
 * Output:
 *   Prints checklist to stdout.
 *   If --out <path> is provided, also writes to that file.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

const ROOT = path.resolve(__dirname, '..', '..')

const MIGRATION_DIRS = [
  'migrations',
  'migrations/platform',
  'apps/union-eyes/db/migrations',
]

function countMigrations(): number {
  let count = 0
  for (const dir of MIGRATION_DIRS) {
    const absDir = path.join(ROOT, dir)
    if (!fs.existsSync(absDir)) continue
    count += fs.readdirSync(absDir).filter((f) => f.endsWith('.sql')).length
  }
  return count
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return undefined
}

function nowDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function quarterLabel(): string {
  const q = Math.ceil((new Date().getMonth() + 1) / 3)
  return `Q${q}-${new Date().getFullYear()}`
}

const migCount = countMigrations()
const drillId = `drill-plan-${nowDate()}-${crypto.randomBytes(3).toString('hex')}`
const outPath = parseArg('--out')

const plan = `# Union Eyes — DR Drill Plan

> **Plan ID:** ${drillId}  
> **Generated:** ${new Date().toISOString()}  
> **Quarter:** ${quarterLabel()}  
> **Operator:** ${process.env.GITHUB_ACTOR ?? process.env.USER ?? 'TBD'}

---

## Drill Objective

Execute a reproducible restore drill on the Union Eyes staging environment to:

1. Measure actual database restore time (RTO component)
2. Validate application health post-restore
3. Confirm hash-chain integrity on audit events
4. Produce evidence for procurement / IT governance

---

## Scope

| Component | In Scope |
|-----------|---------|
| PostgreSQL staging database | Yes |
| Scratch database creation + migration replay | Yes |
| Table count + hash-chain spot check | Yes |
| App health check (staging) | Yes |
| Blob storage object recovery | No (separate drill) |
| Full environment rebuild | No (annual drill) |

---

## Pre-Drill Checklist

Complete every item before starting. Mark each with ✅ or ❌.

- [ ] Drill scheduled with SRE on-call team (ops channel notification sent)
- [ ] Azure CLI authenticated: \`az login\`
- [ ] Staging PostgreSQL credentials available (Key Vault: \`nzila-staging-kv\`)
- [ ] Scratch database name chosen: \`ue_drill_${nowDate().replace(/-/g, '')}\`
- [ ] Staging environment confirmed NOT serving active users
- [ ] \`pnpm install --frozen-lockfile\` run successfully
- [ ] \`scripts/db/restore-drill.ts\` accessible and up to date
- [ ] Migration count confirmed: **${migCount} files** in ${MIGRATION_DIRS.length} directories
- [ ] Operator name and role recorded: _______________
- [ ] Start time recorded: _______________

---

## Commands to Run

\`\`\`bash
# 1. Dry-run first (no live restore)
pnpm exec tsx scripts/db/restore-drill.ts

# 2. Full live restore (record timing)
pnpm exec tsx scripts/db/restore-drill.ts -- --execute

# 3. Post-drill: generate evidence report
pnpm exec tsx scripts/dr/drill-report.ts

# 4. Post-drill: verify app health
curl -s https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/ready | jq .
\`\`\`

---

## Timing Sheet

| Event | Target | Actual |
|-------|--------|--------|
| Drill start | — | ___________ |
| Scratch DB created | < 2 min | ___________ |
| All migrations applied | < 20 min | ___________ |
| Table count verified | < 1 min | ___________ |
| App health check pass | < 10 min | ___________ |
| Evidence report generated | < 2 min | ___________ |
| **Total RTO (restore to healthy)** | **≤ 4 hours** | ___________ |

---

## Evidence to Capture

| Artifact | Location | Captured |
|---------|---------|---------|
| Structured drill JSON | \`reports/db/restore-drill-YYYY-MM.json\` | [ ] |
| Markdown evidence report | \`reports/dr/restore-drill-YYYY-MM-DD.md\` | [ ] |
| JSON summary artifact | \`reports/dr/restore-drill-YYYY-MM-DD.json\` | [ ] |

---

## Post-Drill Sign-Off

- [ ] SRE operator sign-off: _______________
- [ ] Platform Engineering review: _______________
- [ ] Evidence artifacts committed to repo: _______________
- [ ] maturity.json updated with measured RTO: _______________

---

## References

- [Restore Drill Runbook](../../docs/union-eyes/dr/restore-drill-runbook.md)
- [Database Restore Runbook](../../docs/union-eyes/dr/database-restore.md)
- [Drill Script](../../scripts/db/restore-drill.ts)
`

process.stdout.write(plan)

if (outPath) {
  const resolved = path.resolve(process.cwd(), outPath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, plan, 'utf-8')
  process.stderr.write(`\n  Written to: ${outPath}\n`)
}
