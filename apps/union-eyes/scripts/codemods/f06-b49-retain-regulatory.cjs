const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('lib/api/crud-factory.ts', [
  [
    "  /** A condition added to every GET, whatever the caller's role",
    "  /**\n   * A regulatory or evidentiary record that is never deleted through the generic route: DELETE answers 409 before any write, so the\n   * row (and what cascades from it) survives, and the record is changed only through its governed correction or withdrawal process.\n   */\n  retainOnDelete?: boolean;\n  /** A condition added to every GET, whatever the caller's role",
  ],
  [
    "        assertCrudWrite(governance);\n        const id = params[paramName];\n        const conditions: SQL[] = [eq(pkCol, id)];\n        if (orgScoped && orgCol && organizationId) {\n          conditions.push(eq(orgCol, organizationId));\n        }\n        const parentScoped = parentCondition(organizationId);\n        if (parentScoped) conditions.push(parentScoped);\n        if (ownerCol && userId) {\n          conditions.push(eq(ownerCol, userId));\n        }\n\n        // Never write an invented",
    "        assertCrudWrite(governance);\n        if (opts.retainOnDelete) {\n          throw ApiError.conflict(`${resourceName} records are retained and cannot be deleted; use the governed correction or withdrawal process.`);\n        }\n        const id = params[paramName];\n        const conditions: SQL[] = [eq(pkCol, id)];\n        if (orgScoped && orgCol && organizationId) {\n          conditions.push(eq(orgCol, organizationId));\n        }\n        const parentScoped = parentCondition(organizationId);\n        if (parentScoped) conditions.push(parentScoped);\n        if (ownerCol && userId) {\n          conditions.push(eq(ownerCol, userId));\n        }\n\n        // Never write an invented",
  ],
])
for (const p of ['app/api/cnesst/anti-scab/[id]/route.ts', 'app/api/cnesst/right-of-refusal/[id]/route.ts']) {
  edit(p, [["  itemRoute: true,\n", "  itemRoute: true,\n  retainOnDelete: true,\n"]])
}
