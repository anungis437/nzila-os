const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/bargaining/tentative-agreements/route.ts', [
  ["import { tentativeAgreements, negotiations } from '@/db/schema';\nimport { eq, and, desc, sql } from 'drizzle-orm';", "import { tentativeAgreements, negotiations, bargainingProposals } from '@/db/schema';\nimport { eq, and, desc, sql, inArray } from 'drizzle-orm';\nimport { assertOriginalClauseOwned } from '@/lib/clause-library/original-clause';"],
  ["  relatedProposalIds: z.array(z.string()).optional(),", "  relatedProposalIds: z.array(z.guid()).max(50).optional(),"],
  [
    "      const [row] = await tx\n        .insert(tentativeAgreements)",
    "      // A reference names a row of this negotiation (proposals) or of the organization (clause), never another one's.\n      const proposalIds = [...new Set(fields.relatedProposalIds ?? [])];\n      if (proposalIds.length > 0) {\n        const found = await tx\n          .select({ id: bargainingProposals.id })\n          .from(bargainingProposals)\n          .where(and(inArray(bargainingProposals.id, proposalIds), eq(bargainingProposals.negotiationId, negotiationId)));\n        if (found.length !== proposalIds.length) throw ApiError.notFound('relatedProposalIds');\n      }\n      await assertOriginalClauseOwned(tx, fields.relatedClauseId, organizationId);\n\n      const [row] = await tx\n        .insert(tentativeAgreements)",
  ],
])
edit('app/api/cnesst/filings/route.ts', [
  ["  ownerColumn: 'memberId',\n", "  ownerColumn: 'memberId',\n  // The collection is a steward read: the owner scope applies below that floor, as the item route does, so staff see the organization's filings.\n  staffReadsAll: true,\n"],
])
