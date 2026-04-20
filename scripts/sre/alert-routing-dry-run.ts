import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OWNERS = path.join(ROOT, 'governance', 'sre', 'oncall-ownership-matrix.json')
const POLICY = path.join(ROOT, 'governance', 'sre', 'alert-policy.json')
const OUT = path.join(ROOT, 'reports', 'sre-alert-routing-dry-run.json')

type OwnerMatrix = {
  ownership: Array<{
    app: string
    team: string
    primary: string
    secondary: string
  }>
}

function main() {
  const owners = JSON.parse(fs.readFileSync(OWNERS, 'utf8')) as OwnerMatrix
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8')) as { severity: Record<string, { ackSlaMinutes: number }> }

  const routes = owners.ownership.map((o) => ({
    app: o.app,
    team: o.team,
    primary: o.primary,
    secondary: o.secondary,
    p1AckMinutes: policy.severity.p1.ackSlaMinutes,
    p2AckMinutes: policy.severity.p2.ackSlaMinutes,
  }))

  const missing = routes.filter((r) => !r.primary || !r.secondary)
  const report = {
    generatedAt: new Date().toISOString(),
    routes,
    ownerlessAlerts: missing.map((m) => m.app),
    passed: missing.length === 0,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify(report, null, 2))
  if (missing.length > 0) {
    process.exit(1)
  }
}

main()