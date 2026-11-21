import { z } from 'zod'
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context'
import { getActiveTenantDb } from '@/db/tenant-context-storage'
import { ensureOwnDirectoryProfile } from '@/lib/members/own-directory-profile'

export const dynamic = 'force-dynamic'

export const POST = withApi({ rlsOrgContext: true, auth: { required: true, minRole: 'member' },
  body: z.object({}).strict(), openapi: { tags: ['Members'], summary: 'Finish the authenticated member contact profile' } }, async () => {
  if (!currentStateContextEnabled()) return NextResponse.json({ error: 'Canonical membership setup is not enabled.' }, { status: 501 })
  const profile = await getCanonicalOrganizationContext()
  const tx = getActiveTenantDb()
  if (!tx) throw new Error('Member setup requires the active tenant transaction')
  return ensureOwnDirectoryProfile(tx, profile)
})
