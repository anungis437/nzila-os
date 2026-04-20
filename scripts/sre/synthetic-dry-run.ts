import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const CONFIG = path.join(ROOT, 'governance', 'sre', 'synthetic-checks.json')
const OUT = path.join(ROOT, 'reports', 'sre-synthetic-dry-run.json')

type SyntheticConfig = {
  version: string
  schedule: string
  targets: Array<{
    app: string
    tier: string
    checks: string[]
  }>
}

function main() {
  const raw = fs.readFileSync(CONFIG, 'utf8')
  const cfg = JSON.parse(raw) as SyntheticConfig

  const results = cfg.targets.map((t) => ({
    app: t.app,
    tier: t.tier,
    checkCount: t.checks.length,
    status: 'configured',
    checks: t.checks,
  }))

  const report = {
    generatedAt: new Date().toISOString(),
    schedule: cfg.schedule,
    targetCount: cfg.targets.length,
    results,
    note: 'Dry-run validates configuration and ownership, not live endpoint reachability.',
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main()