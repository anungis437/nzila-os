const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
// The organization is part of the lookup, so another organization's id answers 404 exactly as a missing one does.
edit('app/api/social-media/posts/route.ts', [
  [
    "        .leftJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))\n        .where(eq(socialPosts.id, postId))\n        .limit(1);\n\n      if (!post?.id) {\n        return standardErrorResponse(\n      ErrorCode.RESOURCE_NOT_FOUND,\n      'Post not found'\n    );\n      }\n\n      if (organizationId !== post.orgId) {\n        return standardErrorResponse(\n          ErrorCode.FORBIDDEN,\n          'Unauthorized'\n        );\n      }\n",
    "        .innerJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))\n        .where(and(eq(socialPosts.id, postId), eq(socialAccounts.organizationId, organizationId)))\n        .limit(1);\n\n      if (!post?.id) {\n        return standardErrorResponse(\n      ErrorCode.RESOURCE_NOT_FOUND,\n      'Post not found'\n    );\n      }\n",
  ],
])
edit('app/api/social-media/analytics/route.ts', [
  [
    "        .where(eq(socialCampaigns.id, campaignId))\n        .limit(1);\n\n      if (!campaign) {\n        return standardErrorResponse(\n      ErrorCode.RESOURCE_NOT_FOUND,\n      'Campaign not found'\n    );\n      }\n\n      if (organizationId !== campaign.organizationId) {\n        return standardErrorResponse(\n          ErrorCode.FORBIDDEN,\n          'Unauthorized'\n        );\n      }\n",
    "        .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))\n        .limit(1);\n\n      if (!campaign) {\n        return standardErrorResponse(\n      ErrorCode.RESOURCE_NOT_FOUND,\n      'Campaign not found'\n    );\n      }\n",
  ],
])
