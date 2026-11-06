import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq, sql } from 'drizzle-orm'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { requireUserForOrganization, requireSystemAdmin, ROLE_HIERARCHY } from '@/lib/api-auth-guard'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import {
  canAdministerOrganization,
  canReadOrganization,
  canSeeAffiliation,
  directoryProjection,
  resolveOrganizationAccess,
} from '@/lib/organizations/read-authority'
import { mergeSettings, organizationPatchSchema } from '@/lib/organizations/profile-input'
import { isUniqueViolation } from '@/lib/db/unique-violation'

export const dynamic = 'force-dynamic'

function mapOrg(row: typeof organizations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    display_name: row.displayName,
    short_name: row.shortName,
    description: row.description,
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
  // The organizations table is read as the system role, which is not tenant-scoped, so the decision is made here. The private profile
  // belongs to the organization's own live members; an administrator of an organization above it sees its directory entry only (the
  // hierarchy is an affiliation graph, not an access grant); a platform title confers nothing. Anyone else: it does not exist.
  const access = await resolveOrganizationAccess(userId)
  if (!canSeeAffiliation(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [row] = await withSystemContext(() =>
    db.select().from(organizations).where(eq(organizations.id, id)),
  )
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const childCountOf = async () => {
    const childRows = await withSystemContext(async () => rowsOf<{ cnt: number }>(
      await db.execute(sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`),
    ))
    return childRows[0]?.cnt ?? 0
  }

  // Affiliated only: the directory entry and how many organizations sit below it. No counts of members or grievances are computed.
  if (!canReadOrganization(access, id)) {
    return NextResponse.json({ data: { ...directoryProjection(row), childCount: await childCountOf() } })
  }

  // Settings, the billing contact, provenance, contact details, membership figures and grievance counts belong to the
  // organization's own administrators (as on the organization list); any other member gets the profile, and the
  // grievance count is not even computed for them.
  const administrative = canAdministerOrganization(access, id)

  // Grievance counts are read under the caller's own membership of this organization (tenant row-level security), never as the system role.
  const readClaims = !administrative
    ? Promise.resolve(null)
    : withRLSContext({ organizationId: id }, async (tx) => rowsOf<{ total: number; active: number }>(await tx.execute(sql`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active
        FROM grievances WHERE organization_id = ${id}`)))
  const [claimRows, childCount] = await Promise.all([readClaims, childCountOf()])

  if (administrative) {
    const claims = claimRows?.[0] ?? { total: 0, active: 0 }
    return NextResponse.json({
      data: {
        ...mapOrg(row),
        memberCount: row.memberCount ?? 0,
        activeClaims: claims.active,
        totalClaims: claims.total,
        childCount,
      },
    })
  }

  const {
    settings: _settings, billing_contact_id: _billing, created_by: _createdBy, legacy_org_id: _legacy, subscription_tier: _tier,
    email: _email, phone: _phone, address: _address, charter_number: _charter,
    member_count: _memberCount, active_member_count: _activeMemberCount, last_member_count_update: _memberCountUpdate,
    ...profile
  } = mapOrg(row)
  return NextResponse.json({ data: { ...profile, childCount } })
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

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }
  const parsedBody = organizationPatchSchema.safeParse(raw)
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid organization update', details: parsedBody.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`) }, { status: 400 })
  }
  const body = parsedBody.data

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.slug !== undefined) updates.slug = body.slug
  if (body.display_name !== undefined) updates.displayName = body.display_name
  if (body.description !== undefined) updates.description = body.description
  if (body.charter_number !== undefined) updates.charterNumber = body.charter_number
  if (body.affiliation_date !== undefined) updates.affiliationDate = body.affiliation_date
  if (body.status !== undefined) updates.status = body.status
  if (body.email !== undefined) updates.email = body.email
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.website !== undefined) updates.website = body.website
  if (body.sectors !== undefined) updates.sectors = body.sectors
  if (body.parent_id !== undefined) updates.parentId = body.parent_id
  const settingsPatch = body.settings
  updates.updatedAt = new Date()

  const apply = () => withRLSContext(async (tx) => {
    const [current] = await tx.select().from(organizations).where(eq(organizations.id, id))
    if (!current) return null

    // Parent affiliation and lifecycle status define the federation boundary and the institution's standing. Changing either needs an
    // independently approved institutional workflow that is not built, so no caller (an organization administrator or a platform title)
    // changes them here; resubmitting the current values is accepted.
    const parentChanged = body.parent_id !== undefined && (body.parent_id ?? null) !== (current.parentId ?? null)
    const statusChanged = body.status !== undefined && body.status !== current.status
    if (parentChanged || statusChanged) return 'governed' as const
    delete updates.parentId
    delete updates.status

    // A new slug must be free: paths resolve organizations by slug. Settings are merged into the stored ones, not substituted.
    if (typeof updates.slug === 'string' && updates.slug !== current.slug) {
      const [taken] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, updates.slug)).limit(1)
      if (taken) return 'slug-taken' as const
    }
    if (settingsPatch !== undefined) updates.settings = mergeSettings(current.settings, settingsPatch)

    const [row] = await tx.update(organizations).set(updates).where(eq(organizations.id, id)).returning()
    if (!row) return null
    await persistAtomicAudit(tx, {
      organizationId: id,
      userId: userCtx.userId,
      action: 'organization.update',
      resourceType: 'organizations',
      resourceId: id,
      details: {
        fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
      },
    })
    return row
  })
  let updated: Awaited<ReturnType<typeof apply>>
  try {
    updated = await apply()
  } catch (error) {
    // Two requests for the same new slug: the unique index settles it.
    if (isUniqueViolation(error)) return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 })
    throw error
  }
  if (updated === 'slug-taken') return NextResponse.json({ error: 'That slug is already in use' }, { status: 409 })
  if (updated === 'governed') {
    return NextResponse.json(
      { error: 'Changing parent affiliation or status requires an approved institutional workflow; this endpoint does not change them' },
      { status: 409 },
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
