const fs = require('fs')
const f = 'app/api/social-media/analytics/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap(
  "      const accountId = searchParams.get('account_id');\n\n      // Build query with Drizzle",
  "      const accountId = searchParams.get('account_id');\n\n      // The range and the account id are validated and bounded before they reach a query.\n      const isDay = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));\n      if (!isDay(startDate) || !isDay(endDate) || startDate > endDate) {\n        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'start_date and end_date must be valid YYYY-MM-DD dates in order');\n      }\n      if ((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 > 366) {\n        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'The date range may not exceed 366 days');\n      }\n      if (accountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {\n        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'account_id must be a valid id');\n      }\n\n      // Build query with Drizzle",
)
swap(
  "        .orderBy(asc(socialAnalytics.analyticsDate));\n\n      // Group analytics by account",
  "        .orderBy(asc(socialAnalytics.analyticsDate))\n        .limit(MAX_ANALYTICS_ROWS);\n\n      // Group analytics by account",
)
swap("export const GET = withRoleAuth('member',", "const MAX_ANALYTICS_ROWS = 5000;\n\nexport const GET = withRoleAuth('member',")
fs.writeFileSync(f, s)
console.log('ok')
