const fs = require('fs')
const targets = {
  'app/api/cba-intelligence/extraction/route.ts': ['POST'],
  'app/api/cba-intelligence/ingestion/route.ts': ['POST'],
  'app/api/cba-intelligence/ingestion/run/route.ts': ['POST'],
  'app/api/cba-intelligence/ingestion/seed/route.ts': ['POST'],
  'app/api/cba-intelligence/sources/route.ts': ['POST'],
  'app/api/cba-intelligence/sources/[id]/route.ts': ['PATCH'],
}
for (const [file, methods] of Object.entries(targets)) {
  let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  for (const method of methods) {
    const start = t.indexOf(`export const ${method} = withApi(`)
    if (start < 0) throw new Error(`${file}: no ${method}`)
    const asyncAt = t.indexOf('async (', start)
    const arrow = t.indexOf('=> {\n', asyncAt)
    if (asyncAt < 0 || arrow < 0) throw new Error(`${file}: handler shape`)
    const insertAt = arrow + '=> {\n'.length
    t = t.slice(0, insertAt) + '    // The dataset is platform-wide (no organization column): changing it is platform authority, not an organization administrator\'s.\n    await requireSystemAdmin();\n' + t.slice(insertAt)
  }
  const importLine = 'import { requireSystemAdmin } from "@/lib/api-auth-guard";\n'
  const firstImport = t.indexOf('import ')
  t = t.slice(0, firstImport) + importLine + t.slice(firstImport)
  fs.writeFileSync(file, t)
}
console.log('ok')
