const fs = require('fs')
const f = 'app/api/employer-execution/timesheets/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 70)}`); s = s.replace(a, b) }
swap(
  "  periodStart: z.string(),\n  periodEnd: z.string(),\n  sourceFileName: z.string(),\n  csvContent: z.string(),\n});",
  "  // Dates are calendar dates, the file name is a bounded label and the CSV is capped: an uncapped string was hashed, parsed and stored whole.\n  periodStart: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, 'periodStart must be YYYY-MM-DD'),\n  periodEnd: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, 'periodEnd must be YYYY-MM-DD'),\n  sourceFileName: z.string().trim().min(1).max(255),\n  csvContent: z.string().min(1).max(MAX_CSV_CHARACTERS),\n}).refine((value) => value.periodStart <= value.periodEnd, { message: 'periodStart must not be after periodEnd', path: ['periodEnd'] });\n\nconst MAX_CSV_CHARACTERS = 2_000_000;",
)
swap(
  "    auth: { minRole: \"member\" },\n    entitlement: \"employer_timesheet_ingest\",",
  "    // A batch names the employer's workers and their hours: a financial reader's data, not a member's.\n    auth: { minRole: \"officer\" },\n    entitlement: \"employer_timesheet_ingest\",",
)
swap(
  "      .where(eq(employerTimesheetBatches.organizationId, organizationId))\n      .orderBy(desc(employerTimesheetBatches.createdAt));",
  "      .where(eq(employerTimesheetBatches.organizationId, organizationId))\n      .orderBy(desc(employerTimesheetBatches.createdAt))\n      .limit(200);",
)
fs.writeFileSync(f, s)
console.log('ok')
