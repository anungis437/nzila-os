const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 70))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
const IMPORT = "import { parseClauseBody, assertMayPublish, assertOriginalClauseOwned } from '@/lib/clause-library/clause-body';\n"

edit('app/api/clause-library/route.ts', [
  ["import { buildClauseVisibilityCondition, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\n", "import { buildClauseVisibilityCondition, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\n" + IMPORT],
  [
    "  async ({ request, userId, organizationId }) => {\n    if (!organizationId) throw ApiError.badRequest('Organization context required');\n    if (!userId) throw ApiError.badRequest('Authenticated user is required to create a clause.');\n    const body = await request.json();\n",
    "  async ({ request, userId, organizationId, user }) => {\n    if (!organizationId) throw ApiError.badRequest('Organization context required');\n    if (!userId) throw ApiError.badRequest('Authenticated user is required to create a clause.');\n    const body = parseClauseBody(await request.json().catch(() => null), 'create');\n    assertMayPublish(user?.role, body.sharingLevel);\n",
  ],
  [
    "        if (!agreement) throw ApiError.notFound('agreement', body.sourceCbaId);\n      }\n",
    "        if (!agreement) throw ApiError.notFound('agreement', body.sourceCbaId);\n      }\n      await assertOriginalClauseOwned(tx, body.originalClauseId, organizationId);\n",
  ],
])

edit('app/api/clause-library/[id]/route.ts', [
  [
    "  async ({ request, userId, organizationId }) => {\n    const url = new URL(request.url);\n    const id = url.pathname.split('/').filter(Boolean).pop()!;\n    const body = await request.json();\n",
    "  async ({ request, userId, organizationId, user }) => {\n    const url = new URL(request.url);\n    const id = url.pathname.split('/').filter(Boolean).pop()!;\n    const body = parseClauseBody(await request.json().catch(() => null), 'update');\n    assertMayPublish(user?.role, body.sharingLevel);\n",
  ],
])

edit('app/api/clause-library/[id]/share/route.ts', [
  [
    "  async ({ request, userId, organizationId }) => {\n    const url = new URL(request.url);\n    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];\n    const body = await request.json();\n",
    "  async ({ request, userId, organizationId, user }) => {\n    const url = new URL(request.url);\n    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];\n    const body = parseClauseBody(await request.json().catch(() => null), 'share');\n    assertMayPublish(user?.role, body.sharingLevel);\n",
  ],
  ["import { isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\n", "import { isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\n" + IMPORT.replace(', assertOriginalClauseOwned', '')],
])
edit('app/api/clause-library/[id]/route.ts', [
  [
    "import { canReadSharedClause, isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\n",
    "import { canReadSharedClause, isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';\nimport { parseClauseBody, assertMayPublish } from '@/lib/clause-library/clause-body';\n",
  ],
])

edit('app/api/clause-library/compare/route.ts', [
  [
    "      // The counter lives on rows other organizations own, so it is written under the system role. Each increment is\n      // bound to the owning organization the read authorization was evaluated against, and is audited to the comparer.\n      for (const authorized of authorizedRows) {",
    "      // The usage counter is the owner own record: a comparison by another organization is a read and changes nothing\n      // it owns, so only the caller own clauses are counted.\n      for (const authorized of authorizedRows.filter((row) => row.sourceOrganizationId === organizationId)) {",
  ],
])
