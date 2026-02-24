/**
 * POST /api/admin/seed-test-data
 *
 * Seeds the full CLC organizational hierarchy:
 *   - CLC (congress, level 0)
 *   - 13 Provincial/Territorial Federations (federation, level 1)
 *   - 12 National/International Union Affiliates (union, level 1)
 *   - 16 Sample locals + 2 district labour councils (level 2-3)
 *   - Corresponding organization_relationships rows
 *
 * Idempotent — safe to call multiple times.
 * Requires app_owner / admin role.
 */
import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/role-middleware';
import { seedOrganizationHierarchy } from '@/db/seeds/seed-org-hierarchy';
import { seedChildOrganizations } from '@/db/seeds/seed-child-orgs';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRoleAuth('admin', async (_request, context) => {
  try {
    const hierarchy = await seedOrganizationHierarchy();
    const children = await seedChildOrganizations();
    logger.info('Full org seed completed (GET)', { userId: context.userId, hierarchy, children });
    return NextResponse.json({
      success: true,
      message: `Seeded: CLC + ${hierarchy.federationsCreated} federations + ${hierarchy.affiliatesCreated} affiliates + ${children.localsCreated} locals + ${children.districtsCreated} districts. Skipped: ${hierarchy.skipped.length + children.skipped.length}.`,
      data: { hierarchy, children },
    });
  } catch (error) {
    logger.error('Seed org hierarchy failed', { error });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
});

export const POST = withRoleAuth('admin', async (_request, context) => {
  try {
    const hierarchy = await seedOrganizationHierarchy();
    const children = await seedChildOrganizations();
    logger.info('Full org seed completed (POST)', { userId: context.userId, hierarchy, children });
    return NextResponse.json({
      success: true,
      message: `Seeded: CLC + ${hierarchy.federationsCreated} federations + ${hierarchy.affiliatesCreated} affiliates + ${children.localsCreated} locals + ${children.districtsCreated} districts. Skipped: ${hierarchy.skipped.length + children.skipped.length}.`,
      data: { hierarchy, children },
    });
  } catch (error) {
    logger.error('Seed org hierarchy failed', { error });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
});

