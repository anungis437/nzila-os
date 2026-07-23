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
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { organizations } from '@/db/schema-organizations';
import { organizationMembers, pilotChecklistItems } from '@/db/schema';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { eq } from 'drizzle-orm';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { provisionPlatformParticipant } from '@/lib/organizations/platform-tenant';
import { emitPlatformAuditEvent } from '@/lib/audit/platform-audit-events';

const bodySchema = z.object({
  reset: z.boolean().default(false),
  includeDemoScript: z.boolean().default(true),
});

const CUPE_PILOT_JSON = resolve(
  process.cwd(),
  'fixtures/cupe/pilot-org/cupe-pilot-setup.json',
);

const CHECKLIST_IDS = [
  'org_profile_configured',
  'team_invited',
  'first_case_created',
  'sla_watchdog_enabled',
  'billing_connected',
] as const;

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    body: bodySchema,
    rateLimit: RATE_LIMITS.ORG_WRITE,
    openapi: {
      tags: ['Pilot'],
      summary: 'Bootstrap CUPE pilot org with demo-ready dataset',
    },
  },
  async ({ body, userId }) => {
    const jsonContent = await readFile(CUPE_PILOT_JSON, 'utf-8');
    const fixture = JSON.parse(jsonContent) as {
      org: { name: string; slug?: string };
      members: Array<{ id: string; first_name: string; last_name: string; email: string; role: string; member_number?: string }>;
      cases: Array<{ number: string; case_type: string; status: string; priority?: string; title: string; description: string; filed_at?: string; filed_by: string }>;
      worksites: Array<{ id: string }>;
    };

    const slug = fixture.org.slug ?? 'cupe-local-123';

    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    let orgId = existingOrg[0]?.id;

    if (orgId && body.reset) {
      await withSystemContext(async () => {
        await db.delete(grievances).where(eq(grievances.organizationId, orgId!));
        await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId!));
        await db.delete(pilotChecklistItems).where(eq(pilotChecklistItems.organizationId, orgId!));
      });
    }

    if (!orgId) {
      const [newOrg] = await withSystemContext(async () =>
        db
          .insert(organizations)
          .values({
            name: fixture.org.name,
            slug,
            organizationType: 'local',
            hierarchyPath: [],
          })
          .returning({ id: organizations.id }),
      );
      orgId = newOrg.id;
    }

    if (!orgId) throw ApiError.internal('Failed to resolve bootstrap organization');

    // Phase 0B.2R §7 — provision the platform participant mapping so the
    // CUPE pilot org has a valid platform tenant id. Idempotent (ON CONFLICT
    // DO NOTHING) so it is safe to call for both freshly-created and
    // pre-existing orgs. This is what makes the emitPlatformAuditEvent call
    // below succeed instead of throwing PlatformTenantMappingRequired.
    await withSystemContext(async () =>
      provisionPlatformParticipant({
        organizationId: orgId!,
        legalName: fixture.org.name,
        jurisdiction: 'CA',
      }),
    );

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
        membersInserted += 1;
      }
    });

    let casesInserted = 0;
    await withSystemContext(async () => {
      for (const c of fixture.cases) {
        const grievantMember = fixture.members.find((m) => m.id === c.filed_by);

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
          .onConflictDoNothing();
        casesInserted += 1;
      }
    });

    await withSystemContext(async () => {
      for (const itemId of CHECKLIST_IDS) {
        await db
          .insert(pilotChecklistItems)
          .values({
            organizationId: orgId!,
            itemId,
            completed: itemId === 'org_profile_configured' || itemId === 'team_invited' || itemId === 'first_case_created',
            completedAt: itemId === 'org_profile_configured' || itemId === 'team_invited' || itemId === 'first_case_created' ? new Date() : null,
            completedBy: userId ?? 'system:pilot-bootstrap',
          })
          .onConflictDoNothing();
      }
    });

    await trackPilotEvent({
      userId: userId ?? 'system:pilot-bootstrap',
      organizationId: orgId,
      sessionId: `pilot-bootstrap:${orgId}`,
      eventType: 'org_created',
      metadata: {
        source: 'api/pilot/bootstrap/cupe',
        reset: body.reset,
      },
    });

    await trackPilotEvent({
      userId: userId ?? 'system:pilot-bootstrap',
      organizationId: orgId,
      sessionId: `pilot-bootstrap:${orgId}`,
      eventType: 'feature_used',
      metadata: {
        feature: 'one_click_bootstrap',
      },
    });

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      userId: userId ?? undefined,
      organizationId: orgId,
      resource: 'pilot_bootstrap',
      action: 'cupe_bootstrap_executed',
      details: {
        membersInserted,
        casesInserted,
        worksites: fixture.worksites.length,
      },
    });

    // Phase 0B.2R §7 — mirror the bootstrap event onto the platform-owned
    // audit_events chain via the resolver-enforced helper. This is a real
    // production callsite of requirePlatformTenantId → PostgreSQL and is
    // the counterpart to the integration test at
    // apps/union-eyes/lib/__tests__/platform-audit-events.integration.test.ts
    await emitPlatformAuditEvent({
      organizationId: orgId,
      actorUserId: userId ?? 'system:pilot-bootstrap',
      actorRole: userId ? 'admin' : 'system',
      action: 'pilot.cupe_bootstrap_executed',
      targetType: 'organization',
      targetId: orgId,
      afterJson: {
        membersInserted,
        casesInserted,
        worksites: fixture.worksites.length,
        reset: body.reset,
      },
    });

    const demoScript = [
      'Open dashboard and verify seeded CUPE organization context.',
      'Navigate to Cases and show pre-seeded grievance lifecycle across statuses.',
      'Run /api/cron/sla-watchdog then show SLA risk and breach events in analytics.',
      'Trigger weekly summary endpoint and review generated recommendations.',
      'Open Billing replay endpoint on a generated invoice to prove lineage and deterministic replay.',
    ];

    return {
      success: true,
      organizationId: orgId,
      organizationName: fixture.org.name,
      reset: body.reset,
      seeded: {
        worksites: fixture.worksites.length,
        members: membersInserted,
        cases: casesInserted,
      },
      onboarding: {
        checklistInitialized: CHECKLIST_IDS.length,
        completed: 3,
        pending: 2,
      },
      demoScript: body.includeDemoScript ? demoScript : [],
    };
  },
);
