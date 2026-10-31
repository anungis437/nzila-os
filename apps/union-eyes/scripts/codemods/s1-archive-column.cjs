const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  const crlf = s.includes('\r\n')
  s = s.replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s)
}
edit('lib/api/crud-factory.ts', [
  [
    "  retainOnDelete?: boolean;\n",
    "  retainOnDelete?: boolean;\n  /**\n   * Name of a boolean column that marks a row inactive. DELETE sets it to false (an archive: the row, its history and what cascades from it\n   * stay) instead of removing the row. The route lists active rows only, through its own readCondition.\n   */\n  archiveColumn?: string;\n",
  ],
  [
    "        const parentScoped = parentCondition(organizationId);\n        if (parentScoped) conditions.push(parentScoped);\n        if (ownerCol && userId) {\n          conditions.push(eq(ownerCol, userId));\n        }\n\n        // Never write an invented",
    "        const parentScoped = parentCondition(organizationId);\n        if (parentScoped) conditions.push(parentScoped);\n        if (ownerCol && userId) {\n          conditions.push(eq(ownerCol, userId));\n        }\n\n        if (opts.archiveColumn) {\n          const flag = getColumn(table, opts.archiveColumn);\n          if (!flag) throw ApiError.internal(`${resourceName} has no ${opts.archiveColumn} column to archive with`);\n          const archived = await audited(organizationId, userId, 'delete', [opts.archiveColumn], async (tx) => (await tx.update(table)\n            .set({ [opts.archiveColumn as string]: false, ...(getColumn(table, 'updatedAt') ? { updatedAt: new Date() } : {}) } as Record<string, unknown>)\n            .where(and(...conditions))\n            .returning())[0] as Record<string, unknown> | undefined);\n          if (!archived) throw ApiError.notFound(`${resourceName} not found`);\n          return { data: shape(archived) };\n        }\n\n        // Never write an invented",
  ],
])
const active = (table) => `  // An archived row is not listed.\n  readCondition: sql\`\${${table}.isActive} IS NOT FALSE\`,\n`
for (const [p, table] of [
  ['app/api/communications/templates/route.ts', 'messageTemplates'],
  ['app/api/messaging/templates/route.ts', 'messageTemplates'],
  ['app/api/communications/distribution-lists/route.ts', 'newsletterDistributionLists'],
]) {
  edit(p, [
    ["import { crudRoutes } from '@/lib/api/crud-factory';\n", "import { crudRoutes } from '@/lib/api/crud-factory';\nimport { sql } from 'drizzle-orm';\n"],
    ["  orgScoped: true,\n", "  orgScoped: true,\n" + active(table)],
  ])
}
for (const p of ['app/api/communications/templates/[id]/route.ts', 'app/api/messaging/templates/[id]/route.ts', 'app/api/communications/distribution-lists/[id]/route.ts']) {
  edit(p, [
    ["  // A removed template or list takes its history with it (a list's subscribed and unsubscribed trail cascades); it is retained.\n  retainOnDelete: true,\n", "  // A removed template or list is archived, not deleted: a list's subscribed and unsubscribed trail cascades from it, so it is kept.\n  archiveColumn: 'isActive',\n"],
  ])
}
