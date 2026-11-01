const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/extensions/[id]/route.ts', [
  ["import { apiIntegrations } from '@/db/schema/integration-schema';", "import { apiIntegrations, integrationSyncLogs } from '@/db/schema/integration-schema';"],
  [
    "    return withRLSContext({ organizationId }, async (tx) => {\n      const [deleted] = await tx\n        .delete(apiIntegrations)",
    "    return withRLSContext({ organizationId }, async (tx) => {\n      const [owned] = await tx\n        .select({ id: apiIntegrations.id })\n        .from(apiIntegrations)\n        .where(and(eq(apiIntegrations.id, params.id), eq(apiIntegrations.organizationId, organizationId)))\n        .limit(1);\n      if (!owned) throw ApiError.notFound('Integration');\n\n      // The sync history cascades from the integration, so deleting one that has run would erase its record of what was processed,\n      // what failed and who triggered it. Such an integration is disabled instead, and its history stays.\n      const [history] = await tx\n        .select({ id: integrationSyncLogs.id })\n        .from(integrationSyncLogs)\n        .where(eq(integrationSyncLogs.integrationId, params.id))\n        .limit(1);\n      if (history) {\n        throw ApiError.conflict('This integration has synchronization history that deleting it would erase; disable it instead.');\n      }\n\n      const [deleted] = await tx\n        .delete(apiIntegrations)",
  ],
])
