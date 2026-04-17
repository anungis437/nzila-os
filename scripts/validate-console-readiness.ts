import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'apps/console/app/api/health/route.ts',
  'apps/console/app/api/metrics/route.ts',
  'apps/console/lib/evidence.ts',
  'apps/console/lib/policy-enforcement.ts',
  'apps/console/lib/demoSeed.ts',
  'apps/console/e2e/console.spec.ts',
  'apps/console/docs/DOMAIN_MODEL.md',
  'apps/console/docs/pilot-playbook.md',
  'apps/console/docs/demo-flow.md',
]

const missing = requiredFiles.filter((file) => !existsSync(path.join(root, file)))
if (missing.length > 0) {
  console.error('Console readiness failed: missing required files:')
  for (const file of missing) console.error(` - ${file}`)
  process.exit(1)
}

const checks: Array<{ file: string; mustInclude: string[]; mustExclude?: string[] }> = [
  {
    file: 'apps/console/app/api/health/route.ts',
    mustInclude: ['status', 'app', 'buildInfo'],
  },
  {
    file: 'apps/console/app/api/metrics/route.ts',
    mustInclude: ['request_count', 'error_rate', 'latency_ms'],
  },
  {
    file: 'apps/console/lib/evidence.ts',
    mustInclude: ['processEvidencePack', 'recordGovernanceAction'],
  },
  {
    file: 'apps/console/lib/policy-enforcement.ts',
    mustInclude: ['enforcePolicies', 'evaluateViaControlPlane'],
  },
  {
    file: 'apps/console/lib/demoSeed.ts',
    mustInclude: ['seedDemo'],
  },
  {
    file: 'apps/console/e2e/console.spec.ts',
    mustInclude: ['@playwright/test', 'Console E2E', '/api/health'],
  },
  {
    file: 'apps/console/app/(dashboard)/console/page.tsx',
    mustInclude: ['App Launcher', 'Public Website', 'Control Plane'],
  },
]

for (const check of checks) {
  const full = path.join(root, check.file)
  const content = readFileSync(full, 'utf8')

  for (const token of check.mustInclude) {
    if (!content.includes(token)) {
      console.error(`Console readiness failed: ${check.file} missing '${token}'`)
      process.exit(1)
    }
  }

  for (const token of check.mustExclude ?? []) {
    if (content.includes(token)) {
      console.error(`Console readiness failed: ${check.file} contains forbidden token '${token}'`)
      process.exit(1)
    }
  }
}

console.log('Console readiness checks passed.')
