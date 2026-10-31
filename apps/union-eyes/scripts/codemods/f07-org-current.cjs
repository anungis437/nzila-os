const fs = require('fs')
const f = 'app/api/organizations/current/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const swap = (a, b) => { if (!s.includes(a)) throw new Error(`missing ${a.slice(0, 50)}`); s = s.replace(a, b) }
swap(
  "import { withRLSContext } from '@/lib/db/with-rls-context';",
  "import { withRLSContext } from '@/lib/db/with-rls-context';\nimport { canAdministerOrganization, canReadOrganization, resolveOrganizationAccess } from '@/lib/organizations/read-authority';",
)
swap(
  "  return withRLSContext({ organizationId }, async () => {",
  "  // The row is read only by someone who holds an active membership here, and its settings, billing contact and provenance are returned\n  // only to the organization's administrators; any other member receives the public profile.\n  const access = await resolveOrganizationAccess(userId);\n  if (!canReadOrganization(access, organizationId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });\n  const administrative = canAdministerOrganization(access, organizationId);\n\n  return withRLSContext({ organizationId }, async () => {",
)
swap(
  "        subscription_tier: row.subscriptionTier,\n        billing_contact_id: row.billingContactId,\n        settings: row.settings ?? {},\n",
  "        ...(administrative ? { subscription_tier: row.subscriptionTier, billing_contact_id: row.billingContactId, settings: row.settings ?? {} } : {}),\n",
)
swap(
  "        created_by: row.createdBy,\n        legacy_org_id: row.legacyOrgId,\n",
  "        ...(administrative ? { created_by: row.createdBy, legacy_org_id: row.legacyOrgId } : {}),\n",
)
fs.writeFileSync(f, s)
console.log('ok')
