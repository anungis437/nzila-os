/**
 * Per-tenant sharing policy. This route must never be a CRUD alias over
 * organizations: the organization profile cannot be modified or archived
 * by an endpoint named sharing-settings.
 *
 * Gate 0 containment: only restrictive settings may be changed until
 * explicit union adoption and per-resource publication review are built.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { organizationSharingSettings } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { isAdministrativeRole, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

const restrictivePatchSchema = z.object({
  allowFederationSharing: z.literal(false).optional(),
  allowSectorSharing: z.literal(false).optional(),
  allowProvinceSharing: z.literal(false).optional(),
  allowCongressSharing: z.literal(false).optional(),
  autoShareClauses: z.literal(false).optional(),
  autoSharePrecedents: z.literal(false).optional(),
  requireAnonymization: z.literal(true).optional(),
  sharingApprovalRequired: z.literal(true).optional(),
  sharingApproverRole: z.literal('admin').optional(),
  defaultSharingLevel: z.literal('private').optional(),
  allowedSharingLevels: z.array(z.literal('private')).max(1).optional(),
  maxSharedClauses: z.number().int().min(0).max(10000).optional(),
  maxSharedPrecedents: z.number().int().min(0).max(10000).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one valid setting is required');

async function permittedOrganization(params: Params): Promise<{ id: string; userId: string } | Response> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
  const access = await resolveOrganizationAccess(userId);
  // Deliberately exclude platform-only and federation/parent administrator bypass.
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden: direct organization administrator required' }, { status: 403 });
  }
  return { id, userId };
}

/** A missing column, relation or RLS grant is a deployment qualification failure. */
function storageNotQualified(error: unknown): boolean {
  const cause = error as { code?: string; cause?: { code?: string } } | null;
  return ['42703', '42P01', '42501'].includes(cause?.code ?? cause?.cause?.code ?? '');
}

function unavailableResponse() {
  return NextResponse.json({
    error: 'Organization sharing policy storage has not completed qualification',
    code: 'SHARING_POLICY_STORAGE_UNQUALIFIED',
  }, { status: 503 });
}

const safeDefaults = {
  allowFederationSharing: false,
  allowSectorSharing: false,
  allowProvinceSharing: false,
  allowCongressSharing: false,
  autoShareClauses: false,
  autoSharePrecedents: false,
  requireAnonymization: true,
  sharingApprovalRequired: true,
  sharingApproverRole: 'admin',
  defaultSharingLevel: 'private',
  allowedSharingLevels: ['private'],
};

export async function GET(_req: NextRequest, params: Params) {
  const access = await permittedOrganization(params);
  if (access instanceof Response) return access;
  const rows = await withRLSContext({ organizationId: access.id }, async tx =>
    tx.select().from(organizationSharingSettings)
      .where(eq(organizationSharingSettings.organizationId, access.id)).limit(1),
  ).catch(error => {
    if (storageNotQualified(error)) return null;
    throw error;
  });
  if (!rows) return unavailableResponse();
  const row = rows[0];
  return NextResponse.json({
    data: row ?? { organizationId: access.id, ...safeDefaults },
    storageStatus: row ? 'PERSISTED' : 'UNCONFIGURED',
    governanceStatus: 'HOLD_UNRATIFIED',
  });
}

export async function PATCH(req: NextRequest, params: Params) {
  const access = await permittedOrganization(params);
  if (access instanceof Response) return access;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = restrictivePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Settings require union ratification and a reviewed sharing workflow before widening access',
    }, { status: 400 });
  }
  const patch = parsed.data;
  const result = await withRLSContext({ organizationId: access.id }, async tx => {
    // Django's legacy stub did not declare the Drizzle unique constraint.
    // Never use ON CONFLICT without a proven unique key; and never update
    // multiple rows if the historic table contains duplicates.
    const existing = await tx.select({
      id: organizationSharingSettings.id,
      maxSharedClauses: organizationSharingSettings.maxSharedClauses,
      maxSharedPrecedents: organizationSharingSettings.maxSharedPrecedents,
    })
      .from(organizationSharingSettings)
      .where(eq(organizationSharingSettings.organizationId, access.id))
      .limit(2).for('update');
    if (existing.length !== 1) {
      return { error: 'The organization sharing record requires single-owner storage reconciliation', status: 409 } as const;
    }
    // Numeric caps are restrictive only when they stay the same or decrease.
    // A syntactically valid larger cap would still broaden publication policy.
    for (const key of ['maxSharedClauses', 'maxSharedPrecedents'] as const) {
      const previous = existing[0][key];
      const requested = patch[key];
      if (requested !== undefined && previous !== null && previous !== undefined && requested > previous) {
        return { error: 'Increasing a publication cap requires union ratification', status: 409 } as const;
      }
    }
    const [updated] = await tx.update(organizationSharingSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(
        eq(organizationSharingSettings.id, existing[0].id),
        eq(organizationSharingSettings.organizationId, access.id),
      ))
      .returning();
    if (!updated) {
      return { error: 'The organization sharing record changed concurrently', status: 409 } as const;
    }
    await persistAtomicAudit(tx, {
      organizationId: access.id,
      userId: access.userId,
      action: 'organization.sharing_settings_restrict',
      resourceType: 'organization_sharing_settings',
      resourceId: updated.id,
      details: { changedKeys: Object.keys(patch) },
    });
    return { data: updated } as const;
  }).catch(error => {
    if (storageNotQualified(error)) {
      return { error: 'Organization sharing policy storage has not completed qualification', status: 503 } as const;
    }
    throw error;
  });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
