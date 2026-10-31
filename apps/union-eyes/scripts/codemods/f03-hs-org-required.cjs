const fs = require('fs')
const files = [
  'app/api/health-safety/stats/route.ts',
  'app/api/health-safety/inspections/stats/route.ts',
  'app/api/health-safety/inspections/findings/route.ts',
  'app/api/health-safety/incidents/stats/route.ts',
  'app/api/health-safety/hazards/stats/route.ts',
]
const line = "const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;"
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  if (!s.includes(line)) throw new Error(`${f}: anchor`)
  s = s.replace(line, "// With no organization the query used to run unscoped (1=1) and count every tenant's rows; it now refuses.\n    if (!organizationId) throw ApiError.badRequest('Organization context required');\n    const orgFilter = sql`organization_id = ${organizationId}`;")
  const imp = /import \{([^}]*)\} from '@\/lib\/api\/framework';/.exec(s)
  if (!imp) throw new Error(`${f}: framework import`)
  if (!/\bApiError\b/.test(imp[1])) s = s.replace(imp[0], `import {${imp[1].trimEnd()}, ApiError } from '@/lib/api/framework';`)
  fs.writeFileSync(f, s)
}
console.log('ok')
