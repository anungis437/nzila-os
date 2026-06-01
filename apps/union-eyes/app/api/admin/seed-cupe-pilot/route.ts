/**
 * API Route: Load CUPE Pilot Fixtures
 * POST /api/admin/seed-cupe-pilot
 *
 * Allows admins to load CUPE pilot demo data for readiness testing.
 * Supports both regular load and reset modes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { organizations } from '@/db/schema-organizations';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { eq } from 'drizzle-orm';

const logger = createLogger('admin:seed-cupe-pilot');

interface SeedRequest {
  reset?: boolean;
}

const CUPE_PILOT_JSON = resolve(
  process.cwd(),
  'fixtures/cupe/pilot-org/cupe-pilot-setup.json'
);

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: SeedRequest = await request.json();
    const { reset = false } = body;

    // Load fixture JSON
    const jsonContent = await readFile(CUPE_PILOT_JSON, 'utf-8');
    const fixture = JSON.parse(jsonContent);

    // Find or create the configured CUPE pilot organization
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, fixture.org.slug ?? 'cupe-local-123'))
      .limit(1);

    let orgId: string;

    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;

      if (reset) {
        // Delete existing pilot data for this org
        await withSystemContext(async () => {
          await db.delete(grievances).where(eq(grievances.organizationId, orgId));
          await db
            .delete(organizationMembers)
            .where(eq(organizationMembers.organizationId, orgId));
        });
        logger.info('Reset: cleared existing CUPE pilot data', { orgId });
      }
    } else {
      // Insert the organization
      const [newOrg] = await withSystemContext(async () =>
        db
          .insert(organizations)
          .values({
            name: fixture.org.name,
            slug: fixture.org.slug ?? 'cupe-local-123',
            organizationType: 'local',
            hierarchyPath: [],
          })
          .returning({ id: organizations.id })
      );
      orgId = newOrg.id;
      logger.info('Created CUPE pilot organization', { orgId });
    }

    // Seed members
    let membersInserted = 0;
    await withSystemContext(async () => {
      for (const m of fixture.members) {
        await db
          .insert(organizationMembers)
          .values({
            userId: m.id,
            organizationId: orgId,
            name: `${m.first_name} ${m.last_name}`,
            email: m.email,
            role: m.role,
            status: 'active',
            membershipNumber: m.member_number,
          })
          .onConflictDoNothing();
        membersInserted++;
      }
    });

    // Seed grievance cases
    let casesInserted = 0;
    await withSystemContext(async () => {
      for (const c of fixture.cases) {
        const grievantMember = fixture.members.find(
          (m: { id: string }) => m.id === c.filed_by,
        );
        const _assignedMember = c.assigned_to
          ? fixture.members.find(
              (m: { id: string }) => m.id === c.assigned_to,
            )
          : null;

        await db
          .insert(grievances)
          .values({
            grievanceNumber: c.number,
            organizationId: orgId,
            type: c.case_type === 'wage_dispute'
              ? 'contract'
              : c.case_type === 'harassment'
                ? 'harassment'
                : c.case_type === 'discipline'
                  ? 'discipline'
                  : c.case_type === 'benefits_denial'
                    ? 'contract'
                    : 'other',
            status: c.status === 'settled'
              ? 'settled'
              : c.status === 'investigating'
                ? 'investigating'
                : c.status === 'acknowledged'
                  ? 'acknowledged'
                  : 'filed',
            priority: c.priority ?? 'medium',
            title: c.title,
            description: c.description,
            grievantName: grievantMember
              ? `${grievantMember.first_name} ${grievantMember.last_name}`
              : undefined,
            grievantEmail: grievantMember?.email,
            filedDate: c.filed_at ? new Date(c.filed_at) : undefined,
          })
          .onConflictDoNothing();
        casesInserted++;
      }
    });

    logger.info('CUPE pilot data seeded', {
      orgId,
      membersInserted,
      casesInserted,
      reset,
    });

    return NextResponse.json({
      success: true,
      message: reset
        ? 'CUPE pilot data reset successfully'
        : 'CUPE pilot data loaded successfully',
      data: {
        org: fixture.org.name,
        orgId,
        worksites: fixture.worksites.length,
        members: membersInserted,
        cases: casesInserted,
      },
    });
  } catch (error) {
    logger.error('[/api/admin/seed-cupe-pilot] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to seed CUPE pilot data',
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
});
