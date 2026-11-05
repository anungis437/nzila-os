const fs = require('fs')
const rw = (file, fn) => {
  const t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const out = fn(t)
  if (out === t) throw new Error(`${file}: unchanged`)
  fs.writeFileSync(file, out)
}

// 1. The report definition collection and item are read by an officer-level author, not any member.
for (const f of ['app/api/reports/route.ts', 'app/api/reports/[id]/route.ts']) {
  rw(f, (t) => t.replace("readRole: 'member'", "// A report definition names the data sources and filters it reads, and the registry executes only at an officer floor.\n  readRole: 'steward'"))
}

// 2. Facades: these paths advertise a builder, schedule or sample but are the report-definition factory.
rw('scripts/codemods/f02-domain-facades-501.cjs', (t) =>
  t.replace(
    "  'events/[id]/occurrences':",
    `  'reports/builder': 'the generic CRUD factory over report definitions (a definition list under a builder name; nothing is built)',
  'reports/scheduled': 'the generic CRUD factory over report definitions (no schedule row, recipient or next run exists behind it)',
  'reports/scheduled/[id]': 'the generic CRUD factory over report definitions (a definition item under a schedule name; its DELETE removed the report)',
  'reports/datasources/sample': 'the generic CRUD factory over report definitions (no sample rows are read from any data source)',
  'events/[id]/occurrences':`,
  ),
)
rw('lib/api/__tests__/roster-facades.contract.test.ts', (t) =>
  t.replace("'reports/[id]/execute', 'reports/[id]/run',", "'reports/[id]/execute', 'reports/[id]/run', 'reports/builder', 'reports/scheduled', 'reports/scheduled/[id]', 'reports/datasources/sample',"),
)
console.log('ok')
