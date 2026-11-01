const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/employer-execution/compliance/route.ts', [
  [`import { and, desc, eq } from "drizzle-orm";`, `import { and, desc, eq } from "drizzle-orm";\nimport { FINANCIAL_MEMBER_DATA_ROLES } from "@/lib/finance/financial-authority";`],
  [`const createSchema = z.object({
  payrollRunId: z.guid().optional(),
  remittanceRunId: z.guid().optional(),
  eventCode: z.string(),
  severity: z.enum(["info", "warning", "error", "critical"]).default("warning"),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
  blocking: z.enum(["yes", "no"]).default("no"),
});`, `// A person flags a run for review; the engine raises error, critical and blocking events itself. A manual flag therefore
// cannot carry those severities, cannot block an approval, and cannot take the code of an engine event.
const createSchema = z.object({
  payrollRunId: z.guid().optional(),
  remittanceRunId: z.guid().optional(),
  eventCode: z.string().trim().regex(/^[a-z0-9_]{1,60}$/, "eventCode is lower-case letters, digits and underscores"),
  severity: z.enum(["info", "warning"]).default("warning"),
  summary: z.string().trim().min(1).max(500),
  details: z.record(z.string(), z.unknown()).default({}),
}).strict();`],
  [`  {
    auth: { minRole: "member" },
    entitlement: "employer_execution_compliance",
    openapi: { tags: ["Employer Execution"], summary: "List compliance events" },`, `  {
    // The events describe payroll and remittance runs, which the financial roles hold; a member reads none of them.
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_execution_compliance",
    openapi: { tags: ["Employer Execution"], summary: "List compliance events" },`],
  [`      .orderBy(desc(employerExecutionComplianceEvents.detectedAt));
    return { data: rows };`, `      .orderBy(desc(employerExecutionComplianceEvents.detectedAt))
      .limit(500);
    return { data: rows };`],
  [`  {
    auth: { minRole: "steward" },
    entitlement: "employer_execution_compliance",
    body: createSchema,`, `  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: "employer_execution_compliance",
    body: createSchema,`],
  [`          eventCode: body.eventCode,`, `          eventCode: body.eventCode.startsWith("manual_") ? body.eventCode : \`manual_\${body.eventCode}\`,`],
  [`          blocking: body.blocking,`, `          blocking: "no",`],
])
console.log('ok')
