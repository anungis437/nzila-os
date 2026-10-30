import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq, sql } from 'drizzle-orm'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { requireUserForOrganization, ROLE_HIERARCHY } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { canReadOrganization, isAdministrativeRole, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

function mapOrg(row: typeof organizations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    display_name: row.displayName,
    short_name: row.shortName,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    hierarchy_path: row.hierarchyPath,
    hierarchy_level: row.hierarchyLevel,
    province_territory: row.provinceTerritory,
    sectors: row.sectors,
    email: row.email,
    phone: row.phone,
    website: row.website,
    address: row.address,
    clc_affiliated: row.clcAffiliated,
    affiliation_date: row.affiliationDate,
    charter_number: row.charterNumber,
    member_count: row.memberCount,
    active_member_count: row.activeMemberCount,
    last_member_count_update: row.lastMemberCountUpdate,
    subscription_tier: row.subscriptionTier,
    billing_contact_id: row.billingContactId,
    settings: row.settings ?? {},
    features_enabled: row.featuresEnabled ?? [],
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy,
    legacy_org_id: row.legacyOrgId,
  }
}

type Params = { params: Promise<{ id: string }> }

function assertOrgIdParam(id: string): NextResponse | null {
  if (id === 'current' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })
  }
  return null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invalid = assertOrgIdParam(id)
  if (invalid) return invalid
  // The organizations table is read as the system role, which is not tenant-scoped: the caller must hold an active
  // membership here, administer an organization above it, or be a platform administrator. Otherwise it does not exist.
  const access = await resolveOrganizationAccess(userId)
  // A platform title or parent-body authority alone grants no private tenant record access.
  if (!canReadOrganization(access, id) || !access.direct.has(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [row] = await withSystemContext(() =>
    db.select().from(organizations).where(eq(organizations.id, id)),
  )
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Grievance workload and private contacts require a DIRECT administrative
  // office in this tenant. Neither ordinary membership nor parent ancestry
  // confers permission to infer a local's case volume.
  const administrative = isAdministrativeRole(access.direct.get(id))
  let claims: { total: number; active: number } | null = null
  if (administrative) {
    const rows = Array.from(
      await db.execute(
        sql`SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active
            FROM grievances WHERE organization_id = ${id}`,
      ),
    ) as Array<{ total: number; active: number }>
    claims = rows[0] ?? { total: 0, active: 0 }
  }

  const childRows = Array.from(
    await db.execute(sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`),
  ) as Array<{ cnt: number }>

  // Do not replace redacted counts with zero: that would fabricate data.
  const {
    settings: _settings, billing_contact_id: _billing, created_by: _createdBy,
    legacy_org_id: _legacy, subscription_tier: _tier,
    email: _email, phone: _phone, address: _address,
    member_count: _memberCount, active_member_count: _activeCount,
    last_member_count_update: _countUpdate,
    ...profile
  } = mapOrg(row)
  const mapped = administrative ? mapOrg(row) : profile
  return NextResponse.json({
    data: {
      ...mapped,
      ...(administrative ? {
        memberCount: row.memberCount ?? 0,
        activeClaims: claims!.active,
        totalClaims: claims!.total,
      } : {}),
      childCount: childRows[0]?.cnt ?? 0,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  {
    const invalid = assertOrgIdParam(id)
    if (invalid) return invalid
  }

  // Require caller to be a member of THIS org with admin+ role
  let userCtx
  try {
    userCtx = await requireUserForOrganization(id)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const userRole = userCtx.roles[0] || 'member'
  if ((ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] ?? 0) < ROLE_HIERARCHY.admin) {
    return NextResponse.json({ error: 'Forbidden: requires admin role' }, { status: 403 })
  }

  // Only a direct active administrator, not a platform admin or parent-body role,
  // may modify its organization record on this endpoint.
  const access = await resolveOrganizationAccess(userCtx.userId)
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden: direct organization administrator required' }, { status: 403 })
  }

  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.slug !== undefined) updates.slug = body.slug
  if (body.display_name !== undefined) updates.displayName = body.display_name
  if (body.status !== undefined) updates.status = body.status
  if (body.email !== undefined) updates.email = body.email
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.website !== undefined) updates.website = body.website
  if (body.sectors !== undefined) updates.sectors = body.sectors
  if (body.parent_id !== undefined) updates.parentId = body.parent_id
  if (body.settings !== undefined) updates.settings = body.settings
  updates.updatedAt = new Date()

  const updated = await withRLSContext(async (tx) => {
    const [current] = await tx.select().from(organizations).where(eq(organizations.id, id))
    if (!current) return null

    // Parent affiliation and lifecycle status define the federation boundary and the institution's standing: an
    // organization's own administrator may resubmit the current values but may not change them.
    const parentChanged = body.parent_id !== undefined && (body.parent_id ?? null) !== (current.parentId ?? null)
    const statusChanged = body.status !== undefined && body.status !== current.status
    // Parent changes require both organizations' consent; lifecycle changes
    // require a separate verified dual-review. A platform role alone cannot
    // substitute for those instruments. This route has neither approval proof.
    if (parentChanged || statusChanged) return 'forbidden' as const
    delete updates.parentId
    delete updates.status

    const [row] = await tx.update(organizations).set(updates).where(eq(organizations.id, id)).returning()
    if (!row) return null
    await persistAtomicAudit(tx, {
      organizationId: id,
      userId: userCtx.userId,
      action: 'organization.update',
      resourceType: 'organizations',
      resourceId: id,
      details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })
    return row
  })
  if (updated === 'forbidden') {
    return NextResponse.json(
      { error: 'Forbidden: parent and lifecycle changes require governed, independently approved workflow' },
      { status: 403 },
    )
  }
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: mapOrg(updated) })
}

// Organization archival is not a single-admin DELETE action. Until a separate
// governed workflow records board/second-officer review, contract retention and
// legal-hold checks, refuse the mutation without claiming an archive occurred.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const invalid = assertOrgIdParam(id)
  if (invalid) return invalid
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await resolveOrganizationAccess(userId)
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({
    error: 'Archival requires a separately approved lifecycle request with two independent reviewers, retention and legal-hold verification. No change was made.',
  }, { status: 409 })
}
