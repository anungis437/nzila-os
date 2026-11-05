const fs = require('fs')

let s = fs.readFileSync('lib/social-media/social-media-service.ts', 'utf8').replace(/\r\n/g, '\n')
const marker = '      // Save analytics to database\n      for (const data of analytics) {'
if (!s.includes(marker)) throw new Error('marker')
s = s.replace(
  marker,
  `      // The platform responses above are fetched but not yet transformed, so nothing was collected. Returning an empty list as a
      // successful collection would leave the analytics table unwritten and every dashboard figure at zero without saying so.
      if (analytics.length === 0) {
        throw ApiError.notImplemented(
          \`Analytics collection for \${typedAccount.platform} is not implemented: the platform response is not transformed, so nothing was collected.\`,
        );
      }

${marker}`,
)
s = s.replace("import { db } from '@/db';", "import { db } from '@/db';\nimport { ApiError } from '@/lib/api/errors';")
fs.writeFileSync('lib/social-media/social-media-service.ts', s)

let r = fs.readFileSync('app/api/social-media/analytics/route.ts', 'utf8').replace(/\r\n/g, '\n')
const resp = `      return NextResponse.json({
        accounts: Object.values(accountAnalytics),
        date_range: {
          start_date: startDate,
          end_date: endDate,
        },
      });`
if (!r.includes(resp)) throw new Error('resp')
r = r.replace(
  resp,
  `      // An empty range is not the same as nothing ever collected: no collector writes platform analytics yet, so say which it is
      // rather than let the dashboard read the absence of rows as zero activity.
      let dataCollected = analytics.length > 0;
      if (!dataCollected) {
        const [anyRow] = await db
          .select({ id: socialAnalytics.id })
          .from(socialAnalytics)
          .innerJoin(socialAccounts, eq(socialAnalytics.accountId, socialAccounts.id))
          .where(eq(socialAccounts.organizationId, organizationId))
          .limit(1);
        dataCollected = Boolean(anyRow);
      }

      return NextResponse.json({
        accounts: Object.values(accountAnalytics),
        date_range: {
          start_date: startDate,
          end_date: endDate,
        },
        data_collected: dataCollected,
        ...(dataCollected ? {} : { message: 'Platform analytics have not been collected for this organization, so no figure is available.' }),
      });`,
)
fs.writeFileSync('app/api/social-media/analytics/route.ts', r)
console.log('ok')
