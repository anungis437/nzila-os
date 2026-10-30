import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq, sql } from 'drizzle-orm'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { requireUserForOrganization, requireSystemAdmin, ROLE_HIERARCHY } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { canAdministerOrganization, canReadOrganization, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

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

/** A raw query answers an array on the production driver and { rows } on others; both are rows. */
const rowsOf = <T,>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] } | null)?.rows ?? Array.from((result ?? []) as Iterable<T>))

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
  if (!canReadOrganization(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [row] = await withSystemContext(() =>
    db.select().from(organizations).where(eq(organizations.id, id)),
  )
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Counts are computed under explicit authority. A bare pooled connection has no
  // tenant identity and can silently return zero or leak cross-tenant aggregates.
  const claimCounts = (tx: typeof db) => tx.execute(sql`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active
        FROM grievances WHERE organization_id = ${id}`)
  // Direct members are bound through tenant RLS. A platform or parent administrator
  // may be authorized for a descendant without direct membership; canonical binding
  // correctly rejects impersonating that descendant, so use the system role only
  // after the explicit canReadOrganization check and the exact organization predicate.
  const readClaims = access.platform || !access.direct.has(id)
    ? withSystemContext(async () => rowsOf<{ total: number; active: number }>(await claimCounts(db)))
    : withRLSContext({ organizationId: id }, async (tx) => rowsOf<{ total: number; active: number }>(await claimCounts(tx)))
  const [claimRows, childRows] = await Promise.all([
    readClaims,
    withSystemContext(async () => rowsOf<{ cnt: number }>(
      await db.execute(sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`),
    )),
  ])
  const claims = claimRows[0] ?? { total: 0, active: 0 }

  // Settings, the billing contact and provenance belong to the organization's administrators.
  const { settings: _settings, billing_contact_id: _billing, created_by: _createdBy, legacy_org_id: _legacy, subscription_tier: _tier, ...profile } = mapOrg(row)
  const administrative = canAdministerOrganization(access, id)
  const mapped = administrative ? mapOrg(row) : profile
  return NextResponse.json({
    data: {
      ...mapped,
      memberCount: row.memberCount ?? 0,
      activeClaims: claims.active,
      totalClaims: claims.total,
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
    if (parentChanged || statusChanged) {
      try {
        await requireSystemAdmin()
      } catch {
        return 'forbidden' as const
      }
    } else {
      delete updates.parentId
      delete updates.status
    }

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
      { error: 'Forbidden: changing parent affiliation or status requires platform governance' },
      { status: 403 },
    )
  }
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: mapOrg(updated) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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

  // Archiving changes institutional standing. Local administrators cannot retire their own organization.
  // The same platform-governance authority required for PATCH status transitions is mandatory here.
  try {
    await requireSystemAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden: organization archival requires platform governance' }, { status: 403 })
  }

  // An archive request changes membership eligibility, descendant availability and billing.
  // No durable independent-approval workflow or second-approver evidence is available here.
  // Even a platform administrator must not bypass that institutional decision by direct UPDATE.
  return NextResponse.json(
    { error: 'Organization archival requires an approved institutional lifecycle workflow; this endpoint cannot archive directly' },
    { status: 501 },
  )
}
