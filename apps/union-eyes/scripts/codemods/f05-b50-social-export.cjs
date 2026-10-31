const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/social-media/analytics/route.ts', [
  ["import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';\n", "import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';\nimport { csvCell } from '@/lib/employer-execution/csv-cell';\n"],
  ["const MAX_ANALYTICS_ROWS = 5000;\n", "const MAX_ANALYTICS_ROWS = 5000;\nconst MAX_EXPORT_ROWS = 5000;\n\n// The campaign export names its columns differently from its header text, so each header maps to its own row key.\nconst CAMPAIGN_EXPORT_KEYS: Record<string, string> = {\n  Campaign: 'name',\n  'Start Date': 'start_date',\n  'End Date': 'end_date',\n  Status: 'status',\n  Platforms: 'platforms',\n  'Total Posts': 'total_posts',\n  Impressions: 'total_impressions',\n  Engagement: 'total_engagement',\n  Likes: 'total_likes',\n  Comments: 'total_comments',\n  Shares: 'total_shares',\n  Clicks: 'total_clicks',\n};\n"],
  [
    "export const DELETE = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {\n  try {\n      const { _userId, organizationId } = context;\n\n      if (!organizationId) {\n        return standardErrorResponse(\n          ErrorCode.FORBIDDEN,\n          'No organization found'\n        );\n      }\n",
    "// An export of the organization's posts, account figures and campaigns is a staff read.\nexport const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {\n  try {\n      const { userId, organizationId } = context;\n\n      if (!organizationId) {\n        return standardErrorResponse(\n          ErrorCode.FORBIDDEN,\n          'No organization found'\n        );\n      }\n\n      const exportLimit = await checkRateLimit(`social-analytics-export:${userId}`, RATE_LIMITS.SOCIAL_MEDIA_API);\n      if (!exportLimit.allowed) {\n        return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn: exportLimit.resetIn });\n      }\n",
  ],
  ["            .orderBy(desc(socialPosts.publishedAt));\n\n          data = exportPosts;", "            .orderBy(desc(socialPosts.publishedAt))\n            .limit(MAX_EXPORT_ROWS);\n\n          data = exportPosts;"],
  ["            .orderBy(asc(socialAnalytics.analyticsDate));\n\n          data = exportAnalytics;", "            .orderBy(asc(socialAnalytics.analyticsDate))\n            .limit(MAX_EXPORT_ROWS);\n\n          data = exportAnalytics;"],
  ["            .orderBy(desc(socialCampaigns.createdAt));\n\n          data = await Promise.all(", "            .orderBy(desc(socialCampaigns.createdAt))\n            .limit(MAX_EXPORT_ROWS);\n\n          data = await Promise.all("],
  [
    "                const key = header.toLowerCase().replace(/ /g, '_');\n                // eslint-disable-next-line @typescript-eslint/no-explicit-any\n                let value: any = row[key] || '';\n",
    "                const key = data_type === 'campaigns' ? CAMPAIGN_EXPORT_KEYS[header] : header.toLowerCase().replace(/ /g, '_');\n                // eslint-disable-next-line @typescript-eslint/no-explicit-any\n                let value: any = row[key] ?? '';\n",
  ],
  [
    "                // Escape quotes and wrap in quotes if contains comma\n                value = String(value).replace(/\"/g, '\"\"');\n                return value.includes(',') ? `\"${value}\"` : value;",
    "                // Text a spreadsheet would read as a formula is neutralised, then quoted where needed.\n                return csvCell(String(value));",
  ],
])
