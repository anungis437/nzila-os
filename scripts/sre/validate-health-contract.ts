import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

const REQUIRED = [
  'union-eyes', 'abr', 'flow', 'web', 'partners', 'cfo',
  'zonga', 'agrimo', 'cora', 'trade', 'mobility',
  'console', 'control-plane', 'orchestrator-api',
] as const

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

function appEndpoints(app: string) {
  if (app === 'orchestrator-api') {
    return {
      health: exists('apps/orchestrator-api/src/routes/health.ts'),
      ready: exists('apps/orchestrator-api/src/routes/ready.ts'),
      version: exists('apps/orchestrator-api/src/routes/version.ts'),
    }
  }

  return {
    health: exists(`apps/${app}/app/api/health/route.ts`),
    ready: exists(`apps/${app}/app/api/ready/route.ts`),
    version: exists(`apps/${app}/app/api/version/route.ts`),
  }
}

function main() {
  const failures: string[] = []

  for (const app of REQUIRED) {
    const e = appEndpoints(app)
    if (!e.health || !e.ready || !e.version) {
      failures.push(`${app}: health=${e.health}, ready=${e.ready}, version=${e.version}`)
    }
  }

  if (failures.length > 0) {
    console.error('Health contract check failed.')
    for (const f of failures) {
      console.error(`- ${f}`)
    }
    process.exit(1)
  }

  console.log('Health contract check passed for all portfolio apps.')
}

main()