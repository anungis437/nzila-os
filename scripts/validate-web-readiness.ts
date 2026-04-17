import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'apps/web/app/api/contact/route.ts',
  'apps/web/app/api/telemetry/events/route.ts',
  'apps/web/app/contact/page.tsx',
]

const missing = requiredFiles.filter((file) => !existsSync(path.join(root, file)))
if (missing.length > 0) {
  console.error('Web readiness failed: missing required files:')
  for (const file of missing) console.error(` - ${file}`)
  process.exit(1)
}

const checks: Array<{ file: string; mustInclude: string[]; mustExclude?: string[] }> = [
  {
    file: 'apps/web/app/api/contact/route.ts',
    mustInclude: ['RATE_LIMIT_WINDOW_MS', 'website', 'withRequestContext'],
  },
  {
    file: 'apps/web/app/api/telemetry/events/route.ts',
    mustInclude: ['eventPayloadSchema', 'payload_too_large'],
  },
  {
    file: 'apps/web/app/contact/page.tsx',
    mustInclude: ['contact_submit_success', 'website'],
    mustExclude: ['+1 (234) 567-890'],
  },
]

for (const check of checks) {
  const full = path.join(root, check.file)
  const content = readFileSync(full, 'utf8')

  for (const token of check.mustInclude) {
    if (!content.includes(token)) {
      console.error(`Web readiness failed: ${check.file} missing '${token}'`)
      process.exit(1)
    }
  }

  for (const token of check.mustExclude ?? []) {
    if (content.includes(token)) {
      console.error(`Web readiness failed: ${check.file} contains forbidden token '${token}'`)
      process.exit(1)
    }
  }
}

console.log('Web readiness checks passed.')
