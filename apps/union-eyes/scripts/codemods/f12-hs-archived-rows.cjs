const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
const H = 'app/api/health-safety/'
// A removed (archived) incident or hazard is not read, listed or counted.
edit(H + 'hazards/stats/route.ts', [[`          WHERE \${orgFilter}`, `          WHERE \${orgFilter} AND status <> 'archived'`]])
edit(H + 'incidents/stats/route.ts', [[`          WHERE \${orgFilter} AND incident_date >=`, `          WHERE \${orgFilter} AND status <> 'archived' AND incident_date >=`]])
edit(H + 'incidents/trends/route.ts', [[`WHERE organization_id = \${organizationId}
            AND incident_date >=`, `WHERE organization_id = \${organizationId}
            AND status <> 'archived'
            AND incident_date >=`], [`WHERE organization_id = \${organizationId}
          AND incident_date >=`, `WHERE organization_id = \${organizationId}
          AND status <> 'archived'
          AND incident_date >=`]])
edit(H + 'dashboard/route.ts', [
  [`FROM workplace_incidents WHERE \${orgFilter} AND \${dateFilter}\``, `FROM workplace_incidents WHERE \${orgFilter} AND status <> 'archived' AND \${dateFilter}\``],
  [`FROM workplace_incidents WHERE \${orgFilter} AND created_at >=`, `FROM workplace_incidents WHERE \${orgFilter} AND status <> 'archived' AND created_at >=`],
  [`FROM workplace_incidents WHERE \${orgFilter}\``, `FROM workplace_incidents WHERE \${orgFilter} AND status <> 'archived'\``],
  [`(status IS NULL OR status NOT IN ('resolved','closed'))`, `(status IS NULL OR status NOT IN ('resolved','closed','archived'))`],
  [`AND severity = 'critical' AND status != 'closed'`, `AND severity = 'critical' AND status NOT IN ('closed','archived')`],
])
for (const [f, table, imp] of [
  [H + 'hazards/route.ts', 'hazardReports', `import { hazardReports } from '@/db/schema';`],
  [H + 'hazards/[id]/route.ts', 'hazardReports', null],
  [H + 'incidents/route.ts', 'workplaceIncidents', `import { workplaceIncidents } from '@/db/schema';`],
  [H + 'incidents/[id]/route.ts', 'workplaceIncidents', null],
]) {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  if (!s.includes(`readRole: 'health_safety_rep',`)) throw new Error(f + ' readRole')
  s = s.replace(`  readRole: 'health_safety_rep',`, `  readRole: 'health_safety_rep',\n  // A record an administrator removed is archived, and an archived record is neither listed nor returned by id.\n  readCondition: ne(${table}.status, 'archived'),`)
  if (!/from 'drizzle-orm'/.test(s)) s = s.replace(/(import [^\n]*\n)/, `$1import { ne } from 'drizzle-orm';\n`)
  else if (!/\bne\b/.test(s.match(/import \{[^}]*\} from 'drizzle-orm'/)?.[0] ?? '')) s = s.replace(/import \{([^}]*)\} from 'drizzle-orm'/, (m, g) => `import {${g.trimEnd()}, ne } from 'drizzle-orm'`)
  fs.writeFileSync(f, s)
}
console.log('ok')
