import { NextRequest, NextResponse } from 'next/server';
import { auth, requireSystemAdmin } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { organizations } from '@/db/schema';
import { eq, and, sql, inArray, asc, type SQL } from 'drizzle-orm';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { MAX_HIERARCHY_DEPTH } from '@/lib/utils/hierarchy-validation';
import {
  isAdministrativeRole,
  readableOrganizationIds,
  resolveOrganizationAccess,
  UUID_PATTERN,
} from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

/** Canonical organization types (see types/organization.ts) */
const ORGANIZATION_TYPES = ['platform', 'congress', 'federation', 'union', 'local', 'region', 'district'] as const;
type OrganizationType = typeof ORGANIZATION_TYPES[number];

function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === 'string' && (ORGANIZATION_TYPES as readonly string[]).includes(value);
}

/** Active grievance statuses (not closed/settled/withdrawn/denied) */
const _ACTIVE_CLAIM_STATUSES = [
  'draft', 'filed', 'acknowledged', 'investigating',
  'response_due', 'response_received', 'escalated', 'mediation', 'arbitration',
];

/** Most organizations one list call returns. */
const MAX_LISTED_ORGANIZATIONS = 1000;
const STATUS_FILTER_PATTERN = /^[a-z_]{1,32}$/;

/**
 * GET /api/organizations — the organizations the caller may read.
 *
 * Being signed in is not enough. The list is the caller's own active memberships, the organizations below one they
 * administer, read as the system role after the organization scope is decided here. A platform staff
 * title alone grants no access to another union or affiliate. Contact details, billing contact, subscription tier, settings and
 * provenance are returned only for organizations the caller administers; elsewhere the entry is the public profile.
 * Grievance counts (include_stats) are likewise administrative.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const parentId = searchParams.get('parent');
  const statusFilter = searchParams.get('status');
  const includeStats = searchParams.get('include_stats') === 'true';

  if (parentId && !UUID_PATTERN.test(parentId)) return NextResponse.json({ error: 'Invalid parent organization id' }, { status: 400 });
  if (statusFilter && !STATUS_FILTER_PATTERN.test(statusFilter)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const access = await resolveOrganizationAccess(userId);
  const readable = readableOrganizationIds(access);
  if (readable && readable.length === 0) return NextResponse.json({ data: [] });

  const conditions: SQL[] = [];
  if (readable) conditions.push(inArray(organizations.id, readable));
  if (parentId) conditions.push(eq(organizations.parentId, parentId));
  if (statusFilter) conditions.push(eq(organizations.status, statusFilter));

  const where = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const mapped = await withSystemContext(async () => {
    const rows = await db.select().from(organizations).where(where).orderBy(asc(organizations.hierarchyLevel), asc(organizations.name)).limit(MAX_LISTED_ORGANIZATIONS);

    // When include_stats is requested, count active claims and children per org
    const claimsByOrg: Record<string, number> = {};
    const childrenByOrg: Record<string, number> = {};
    if (includeStats && rows.length > 0) {
      const orgIds = rows.map(r => r.id);
      const administered = orgIds.filter((id) => isAdministrativeRole(access.direct.get(id)));
      if (administered.length > 0) {
        const claimCounts = await db.execute(
          sql`SELECT organization_id::text as org_id, count(*)::int as cnt
              FROM grievances
              WHERE organization_id::text IN (${sql.join(administered.map(id => sql`${id}`), sql`,`)})
                AND status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration')
              GROUP BY organization_id`
        );
        for (const row of Array.from(claimCounts) as Array<{ org_id: string; cnt: number }>) {
          claimsByOrg[row.org_id] = Number(row.cnt);
        }
      }

      const childCounts = await db.execute(
        sql`SELECT parent_id::text as parent, count(*)::int as cnt
            FROM organizations
            WHERE parent_id::text IN (${sql.join(orgIds.map(id => sql`${id}`), sql`,`)})
            GROUP BY parent_id`
      );
      for (const row of Array.from(childCounts) as Array<{ parent: string; cnt: number }>) {
        childrenByOrg[row.parent] = Number(row.cnt);
      }
    }

    // Build parent name lookup from fetched rows
    const nameById = new Map(rows.map(r => [r.id, r.name]));

    // Map camelCase DB fields to snake_case expected by frontend
    return rows.map(row => {
      // Parent-body hierarchy does not itself authorize reading a child's
      // billing, contact, subscription, settings, provenance or grievance data.
      const administrative = isAdministrativeRole(access.direct.get(row.id));
      return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      display_name: row.displayName,
      short_name: row.shortName,
      organization_type: row.organizationType,
      parent_id: row.parentId,
      parentName: row.parentId ? nameById.get(row.parentId) ?? null : null,
      hierarchy_path: row.hierarchyPath,
      hierarchy_level: row.hierarchyLevel,
      province_territory: row.provinceTerritory,
      sectors: row.sectors,
      website: row.website,
      clc_affiliated: row.clcAffiliated,
      affiliation_date: row.affiliationDate,
      // Member counts are not public directory fields; federation ancestry
      // is not an independently ratified data-sharing instrument.
      ...(administrative ? {
        member_count: row.memberCount,
        memberCount: row.memberCount ?? 0,
        active_member_count: row.activeMemberCount,
        last_member_count_update: row.lastMemberCountUpdate,
      } : {}),
      features_enabled: row.featuresEnabled ?? [],
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      ...(administrative ? {
        email: row.email,
        phone: row.phone,
        address: row.address,
        charter_number: row.charterNumber,
        subscription_tier: row.subscriptionTier,
        billing_contact_id: row.billingContactId,
        settings: row.settings ?? {},
        created_by: row.createdBy,
        legacy_org_id: row.legacyOrgId,
      } : {}),
      ...(includeStats ? {
        childCount: childrenByOrg[row.id] ?? 0,
        ...(administrative ? { activeClaims: claimsByOrg[row.id] ?? 0 } : {}),
      } : {}),
      };
    });
  });

  return NextResponse.json({ data: mapped });
}

/** POST /api/organizations — create organization in DB */
/** POST /api/organizations — create a new organization (system-admin only) */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Organization/tenant creation fails closed to platform/system administration.
  // Delegated tenant-admin child-org provisioning is a separate, not-yet-proven
  // permission model and is intentionally not implemented here.
  //
  // AUTHORIZATION HAPPENS HERE, BEFORE any DB access — requireSystemAdmin() is
  // the authorization decision, not withSystemContext() below. withSystemContext
  // is only the execution mechanism (PR #752 round 7 correction): 0108's
  // organizations RLS policy is `id = current_org_id` for SELECT/INSERT/UPDATE/
  // DELETE on union_eyes_runtime, so a NEW organization row (whose id is freshly
  // generated and therefore can never equal the caller's own current_org_id)
  // can never satisfy that INSERT ... WITH CHECK under the ordinary tenant
  // connection — this previously ran the parent lookup and INSERT through
  // withRLSContext() (tenant runtime), which would fail (or, if no org context
  // was set for a system-admin session, throw "Organization context required")
  // for any genuinely new organization.
  try {
    await requireSystemAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden: system administrator privileges required' }, { status: 403 });
  }

  const body = await req.json();

  // Known callers post the organization type under three different field names
  // (type, organization_type, organizationType) — normalize rather than pick one
  // and silently drop the others (see #713-class DTO mismatch: this previously
  // always fell through to 'union' because the New Organization page posts `type`
  // while this handler only read `organization_type`).
  const requestedType = body.type ?? body.organization_type ?? body.organizationType;
  if (!isOrganizationType(requestedType)) {
    return NextResponse.json(
      { error: `Invalid organization type: ${String(requestedType)}. Must be one of: ${ORGANIZATION_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const parentId: string | null = body.parent_id ?? body.parentId ?? body.parentOrganizationId ?? null;

  // PR #752 round 8: parent lookup + hierarchy derivation + INSERT now run
  // inside ONE withSystemContext transaction (previously two independent
  // transactions) — closes a TOCTOU window where a concurrent write to the
  // parent's hierarchyPath/hierarchyLevel between the lookup and the
  // insert could produce an inconsistent child hierarchyPath.
  class OrganizationCreateValidationError extends Error {
    constructor(readonly status: number, readonly payload: Record<string, unknown>) {
      super('organization creation validation failed');
    }
  }

  let created: Record<string, unknown>;
  try {
    created = await withSystemContext(async (tx) => {
      let hierarchyPath: string[] = [];
      let hierarchyLevel = 0;
      if (parentId) {
        const parentRows = await db
          .select({ hierarchyPath: organizations.hierarchyPath, hierarchyLevel: organizations.hierarchyLevel })
          .from(organizations)
          .where(eq(organizations.id, parentId));
        const [parent] = parentRows as Array<{ hierarchyPath: string[] | null; hierarchyLevel: number | null }>;
        if (!parent) {
          throw new OrganizationCreateValidationError(400, { error: `Parent organization not found: ${parentId}` });
        }
        hierarchyPath = [...(parent.hierarchyPath ?? []), parentId];
        hierarchyLevel = (parent.hierarchyLevel ?? 0) + 1;
        if (hierarchyPath.length > MAX_HIERARCHY_DEPTH) {
          throw new OrganizationCreateValidationError(400, {
            error: `Hierarchy depth ${hierarchyPath.length} would exceed maximum ${MAX_HIERARCHY_DEPTH}`,
          });
        }
      }

      const [row] = await db
        .insert(organizations)
        .values({
          name: body.name,
          slug: body.slug,
          displayName: body.display_name,
          organizationType: requestedType,
          parentId,
          hierarchyPath,
          hierarchyLevel,
          sectors: body.sectors ?? [],
          email: body.email,
          phone: body.phone,
          website: body.website,
          status: body.status ?? 'active',
          clcAffiliated: body.clc_affiliated ?? false,
          memberCount: body.member_count ?? 0,
          activeMemberCount: body.active_member_count ?? 0,
          settings: body.settings ?? {},
          featuresEnabled: body.features_enabled ?? [],
        })
        .returning();
      await persistAtomicAudit(tx as RLSTx, {
        organizationId: row.id,
        userId,
        action: 'organization.create',
        resourceType: 'organizations',
        resourceId: row.id,
        details: { organizationType: requestedType, parentId },
      });
      return row;
    });
  } catch (err) {
    if (err instanceof OrganizationCreateValidationError) {
      return NextResponse.json(err.payload, { status: err.status });
    }
    throw err;
  }

  return NextResponse.json({ data: created }, { status: 201 });
}