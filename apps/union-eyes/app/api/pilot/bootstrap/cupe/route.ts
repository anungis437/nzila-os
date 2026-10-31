/**
 * POST /api/pilot/bootstrap/cupe
 *
 * One-click pilot packaging endpoint:
 * - seeds CUPE pilot org + members + demo grievances
 * - initializes onboarding checklist
 * - emits pilot events
 * - returns demo script for guided activation
 */

import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { organizations } from '@/db/schema-organizations';
import { organizationMembers, pilotChecklistItems, pilotEvents } from '@/db/schema';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { assertPilotDemoMutationRuntime } from '@/lib/config/pilot-demo-runtime';
import { CUPE_BOOTSTRAP_SOURCE, summarizePilotOnboarding } from '@/lib/pilot/cupe-bootstrap-report';

const bodySchema = z.object({
  reset: z.boolean().default(false),
  // A reset names the organization it will clear, so it cannot be triggered by a stray or replayed request.
  confirmReset: z.string().optional(),
  includeDemoScript: z.boolean().default(true),
});

const CUPE_PILOT_JSON = resolve(
  process.cwd(),
  'fixtures/cupe/pilot-org/cupe-pilot-setup.json',
);

// Only this canonical checklist item is evidenced by bootstrap; other onboarding tasks remain pending.
const BOOTSTRAP_CHECKLIST_ITEM = 'org-seeded';

export const POST = withApi(
  {
    // Seeds and, with `reset`, deletes the members and grievances of a fixed organization across tenants: platform
    // authority only, and only where the deployment is explicitly a pilot or demo runtime.
    auth: { minRole: 'system_admin' },
    body: bodySchema,
    rateLimit: RATE_LIMITS.ORG_WRITE,
    openapi: {
      tags: ['Pilot'],
      summary: 'Bootstrap CUPE pilot org with demo-ready dataset',
    },
  },
  async ({ body, userId }) => {
    if (!userId) throw ApiError.unauthorized();

    let runtimeMode: string;
    try {
      runtimeMode = assertPilotDemoMutationRuntime();
    } catch (error) {
      throw ApiError.forbidden(error instanceof Error ? error.message : 'Pilot bootstrap is disabled in this runtime');
    }

    const jsonContent = await readFile(CUPE_PILOT_JSON, 'utf-8');
    const fixture = JSON.parse(jsonContent) as {
      org: { name: string; slug?: string };
      members: Array<{ id: string; first_name: string; last_name: string; email: string; role: string; member_number?: string }>;
      cases: Array<{ number: string; case_type: string; status: string; priority?: string; title: string; description: string; filed_at?: string; filed_by: string }>;
      worksites: Array<{ id: string }>;
    };

    const slug = fixture.org.slug ?? 'cupe-local-123';
    if (body.reset && body.confirmReset !== slug) {
      throw ApiError.badRequest('reset requires confirmReset to name the organization slug');
    }

    // Every write below, and the audit record, is one system transaction: a failure leaves no half-seeded organization.
    const outcome = await withSystemContext(async (tx) => {
      const existingOrg = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      let orgId = existingOrg[0]?.id;
      if (orgId) {
        // A matching slug alone does not prove that an organization is a disposable fixture.
        const [marker] = await tx.select({ id: pilotEvents.id }).from(pilotEvents)
          .where(and(
            eq(pilotEvents.organizationId, orgId),
            eq(pilotEvents.sessionId, `pilot-bootstrap:${orgId}`),
            eq(pilotEvents.eventType, 'org_created'),
            sql`${pilotEvents.metadata}->>'source' = ${CUPE_BOOTSTRAP_SOURCE}`,
          )).limit(1);
        if (!marker) throw ApiError.conflict('Existing organization is not marked as a CUPE bootstrap fixture');
      }

      let resetCounts: { grievances: number; members: number } | null = null;
      if (orgId && body.reset) {
        // A reset removes only the rows this bootstrap seeds. If the organization holds any member or grievance that is
        // not a fixture row, it is no longer a demo organization and the reset is refused rather than deleting it.
        const fixtureMemberIds = fixture.members.map((m) => m.id);
        const fixtureCaseNumbers = fixture.cases.map((c) => c.number);
        const heldMembers = await tx
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, orgId));
        const heldCases = await tx
          .select({ number: grievances.grievanceNumber })
          .from(grievances)
          .where(eq(grievances.organizationId, orgId));
        if (
          heldMembers.some((row) => !fixtureMemberIds.includes(row.userId as string)) ||
          heldCases.some((row) => !fixtureCaseNumbers.includes(row.number as string))
        ) {
          throw ApiError.conflict('Reset refused: the organization holds data that this bootstrap did not seed');
        }
        const removedGrievances = await tx
          .delete(grievances)
          .where(and(eq(grievances.organizationId, orgId), inArray(grievances.grievanceNumber, fixtureCaseNumbers)))
          .returning({ id: grievances.id });
        const removedMembers = await tx
          .delete(organizationMembers)
          .where(and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.userId, fixtureMemberIds)))
          .returning({ id: organizationMembers.id });
        // Never erase independently completed onboarding checklist tasks during fixture reset.
        resetCounts = { grievances: removedGrievances.length, members: removedMembers.length };
      }

      if (!orgId) {
        const [newOrg] = await tx
          .insert(organizations)
          .values({
            name: fixture.org.name,
            slug,
            organizationType: 'local',
            hierarchyPath: [],
          })
          .returning({ id: organizations.id });
        orgId = newOrg.id;
      }

      if (!orgId) throw ApiError.internal('Failed to resolve bootstrap organization');
      const organizationId = orgId;

      let membersInserted = 0;
      for (const m of fixture.members) {
        const inserted = await tx
          .insert(organizationMembers)
          .values({
            userId: m.id,
            organizationId,
            name: `${m.first_name} ${m.last_name}`,
            email: m.email,
            role: m.role,
            status: 'active',
            membershipNumber: m.member_number,
          })
          .onConflictDoNothing()
          .returning({ id: organizationMembers.id });
        membersInserted += inserted.length;
      }

      let casesInserted = 0;
      for (const c of fixture.cases) {
        const grievantMember = fixture.members.find((m) => m.id === c.filed_by);

        const inserted = await tx
          .insert(grievances)
          .values({
            grievanceNumber: c.number,
            organizationId,
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
            priority:
              c.priority === 'low' || c.priority === 'medium' || c.priority === 'high' || c.priority === 'urgent'
                ? c.priority
                : 'medium',
            title: c.title,
            description: c.description,
            grievantName: grievantMember ? `${grievantMember.first_name} ${grievantMember.last_name}` : undefined,
            grievantEmail: grievantMember?.email,
            filedDate: c.filed_at ? new Date(c.filed_at) : undefined,
          })
          .onConflictDoNothing()
          .returning({ id: grievances.id });
        casesInserted += inserted.length;
      }

      await tx.insert(pilotChecklistItems).values({
        organizationId,
        itemId: BOOTSTRAP_CHECKLIST_ITEM,
        completed: true,
        completedAt: new Date(),
        completedBy: userId,
      }).onConflictDoNothing();

      const checklistRows = await tx.select({
        itemId: pilotChecklistItems.itemId,
        completed: pilotChecklistItems.completed,
      }).from(pilotChecklistItems).where(eq(pilotChecklistItems.organizationId, organizationId));
      const onboarding = summarizePilotOnboarding(checklistRows);

      const sessionId = `pilot-bootstrap:${organizationId}`;
      await tx.insert(pilotEvents).values([
        {
          userId,
          organizationId,
          sessionId,
          eventType: 'org_created',
          metadata: { source: CUPE_BOOTSTRAP_SOURCE, reset: body.reset },
        },
        {
          userId,
          organizationId,
          sessionId,
          eventType: 'feature_used',
          metadata: { feature: 'one_click_bootstrap' },
        },
      ]);

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pilot.bootstrap.cupe',
        resourceType: 'organizations',
        resourceId: organizationId,
        details: {
          reset: body.reset,
          runtimeMode,
          membersInserted,
          casesInserted,
          worksitesInFixtureNotSeeded: fixture.worksites.length,
          ...(resetCounts ? { removed: resetCounts } : {}),
        },
      });

      return { organizationId, membersInserted, casesInserted, onboarding };
    });

    const { organizationId: orgId, membersInserted, casesInserted, onboarding } = outcome;

    const demoScript = [
      'Open the dashboard and verify the CUPE fixture organization context.',
      'Navigate to Cases and inspect the fixture grievances actually persisted.',
      'Open pilot onboarding and review the canonical checklist; uncompleted tasks remain pending.',
      'Verify SLA, summary and billing features separately before demonstrating their outcomes.',
    ];

    return {
      success: true,
      organizationId: orgId,
      organizationName: fixture.org.name,
      reset: body.reset,
      seeded: {
        worksites: 0,
        worksitesAvailableInFixtureNotSeeded: fixture.worksites.length,
        members: membersInserted,
        cases: casesInserted,
      },
      onboarding,
      demoScript: body.includeDemoScript ? demoScript : [],
    };
  },
);
