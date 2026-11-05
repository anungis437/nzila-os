const fs = require('fs')
const f = 'app/api/exit-interviews/analytics/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 50)}`); s = s.replace(a, b) }
swap("import { and, eq, gte } from 'drizzle-orm';", "import { and, eq, gte, sql } from 'drizzle-orm';")
swap("import { exitInterviews, exitInterviewEvents } from '@/db/schema';", "import { exitInterviews, exitInterviewEvents } from '@/db/schema';\nimport { derivedAnalyticsCondition } from '@/lib/knowledge-transfer/governance/interview-access';")
swap(
  "        continuityRiskScore: exitInterviews.continuityRiskScore,\n        consentGranted: exitInterviews.consentGranted,\n      })\n      .from(exitInterviews)",
  "        // A risk score is derived from the interview's content, so it enters the aggregate only for a published interview with consent\n        // and a level that allows derived analytics. The counts of the pipeline carry no content and stay.\n        continuityRiskScore: sql<number | null>`CASE WHEN ${derivedAnalyticsCondition(orgId)} THEN ${exitInterviews.continuityRiskScore} ELSE NULL END`,\n        consentGranted: exitInterviews.consentGranted,\n      })\n      .from(exitInterviews)",
)
fs.writeFileSync(f, s)
console.log('ok')
