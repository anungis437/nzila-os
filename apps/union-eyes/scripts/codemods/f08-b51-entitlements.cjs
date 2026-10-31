const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/entitlements/route.ts', [
  ["import { eq, and } from 'drizzle-orm';\n", "import { eq, and } from 'drizzle-orm';\nimport { checkModuleEntitlement } from '@/services/platform-economics/entitlement-guard';\n"],
  [
    "  const featureKeys = rows.map(r => r.featureKey);\n",
    "  // A client gates features from this list, so it names only what the server-side check would also allow: an expired entitlement\n  // or one whose backing contract has ended is not listed.\n  const checks = await Promise.all(rows.map(async (r) => ((await checkModuleEntitlement(orgId, r.featureKey)).allowed ? r.featureKey : null)));\n  const featureKeys = checks.filter((key): key is string => key !== null);\n",
  ],
  ["    );\n\n  // A client", "    )\n    .limit(200);\n\n  // A client"],
])
