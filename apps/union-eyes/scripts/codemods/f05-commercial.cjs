const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}

edit('app/api/contracts/route.ts', [
  ["import { db } from '@/db';\nimport { commercialContracts } from '@/db/schema';\nimport { eq, desc } from 'drizzle-orm';", "import { db } from '@/db';\nimport { commercialContracts, billingAccounts, orgSubscriptions } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';\nimport { eq, desc } from 'drizzle-orm';"],
  [
    "  {\n    auth: { minRole: 'member' },\n    entitlement: 'commercial_reporting',\n    openapi: {\n      tags: ['Contracts'],\n      summary: 'List commercial contracts for the organization',",
    "  {\n    // Contract value, term and renewal conditions are the organization's commercial position: an officer reads them.\n    auth: { minRole: 'officer' },\n    entitlement: 'commercial_reporting',\n    openapi: {\n      tags: ['Contracts'],\n      summary: 'List commercial contracts for the organization',",
  ],
  [
    "    if (!organizationId) throw ApiError.badRequest('Organization context required');\n    const result = await createContract({",
    "    if (!organizationId) throw ApiError.badRequest('Organization context required');\n    // The billing account and the subscription must be the caller's organization's: a contract provisions entitlements from its lines.\n    await assertOrganizationOwns([\n      { field: 'billingAccountId', value: body.billingAccountId, table: billingAccounts },\n      { field: 'subscriptionId', value: body.subscriptionId, table: orgSubscriptions },\n    ], organizationId);\n    const result = await createContract({",
  ],
])
edit('app/api/contracts/[id]/clauses/route.ts', [["auth: { minRole: 'member' },", "auth: { minRole: 'officer' },"]])
edit('app/api/billing/subscriptions/route.ts', [
  ["  {\n    auth: { minRole: 'member' },\n    entitlement: 'financial_intelligence_suite',", "  {\n    auth: { minRole: 'officer' },\n    entitlement: 'financial_intelligence_suite',"],
  ["  {\n    auth: { minRole: 'steward' },\n    entitlement: 'financial_intelligence_suite',\n    body: actionSchema,", "  {\n    // Pausing or resuming billing changes what the organization is charged: an administrator's act.\n    auth: { minRole: 'admin' },\n    entitlement: 'financial_intelligence_suite',\n    body: actionSchema,"],
])
edit('app/api/billing/subscriptions/[id]/route.ts', [["auth: { minRole: 'member' },", "auth: { minRole: 'officer' },"]])
console.log('ok')
