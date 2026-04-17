import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'apps/console/app/api/integrations/connect/route.ts',
  'apps/console/app/api/integrations/deliveries/route.ts',
  'apps/console/app/api/integrations/dlq/route.ts',
  'apps/console/app/api/integrations/dlq/replay/route.ts',
  'apps/console/app/api/integrations/health/route.ts',
  'apps/console/app/api/integrations/health/[provider]/route.ts',
  'apps/console/app/api/integrations/sla/route.ts',
  'apps/console/lib/integrations-runtime-store.ts',
]

const missing = requiredFiles.filter((file) => !existsSync(path.join(root, file)))
if (missing.length > 0) {
  console.error('Missing required integration readiness files:')
  for (const file of missing) {
    console.error(` - ${file}`)
  }
  process.exit(1)
}

const bannedPhrases = ['coming soon']
const integrationPages = [
  'apps/console/app/(dashboard)/integrations/page.tsx',
  'apps/console/app/(dashboard)/integrations/dlq/page.tsx',
  'apps/console/app/(dashboard)/integrations/deliveries/page.tsx',
  'apps/console/app/(dashboard)/integrations/[provider]/page.tsx',
]

for (const page of integrationPages) {
  const fullPath = path.join(root, page)
  if (!existsSync(fullPath)) continue
  const content = readFileSync(fullPath, 'utf8').toLowerCase()
  for (const phrase of bannedPhrases) {
    if (content.includes(phrase)) {
      console.error(`Integration readiness failed: '${phrase}' found in ${page}`)
      process.exit(1)
    }
  }
}

console.log('Integration readiness checks passed.')
