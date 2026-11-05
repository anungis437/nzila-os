/**
 * POST /api/pilot/bootstrap/cupe
 *
 * One-click pilot packaging endpoint for platform staff: creates (or finds) the CUPE pilot organization, seeds its members and demo
 * grievances, initializes the onboarding checklist and emits pilot events.
 *
 * It acts across organizations, so it needs platform-staff authority (a role title is not enough) and a pilot or demo runtime. The system
 * role creates the organization and writes its marker; the tenant rows are written as the runtime role bound to that organization, so
 * the operator needs an active membership in it. Every row the bootstrap creates is recorded in the origin ledger, and a reset deletes
 * exactly those rows and refuses when the organization holds any other (lib/pilot/fixture-bootstrap.ts). `dryRun` rehearses the request
 * without changing anything.
 */
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding';
import { ApiError, RATE_LIMITS, withApi, z } from '@/lib/api/framework';
import { assertPilotDemoMutationRuntime } from '@/lib/config/pilot-demo-runtime';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import {
  FixtureUnavailableError,
  applyFixture,
  fixtureSlug,
  loadCupeFixture,
  recordFixtureDenial,
  resolveFixtureOrganization,
} from '@/lib/pilot/fixture-bootstrap';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';

const bodySchema = z.object({
  reset: z.boolean().default(false),
  // A reset names the organization it will clear, so it cannot be triggered by a stray or replayed request.
  confirmReset: z.string().optional(),
  // Runs the same statements and rolls them back; only the rehearsal is recorded.
  dryRun: z.boolean().default(false),
  includeDemoScript: z.boolean().default(true),
});

const DEMO_SCRIPT = [
  'Open the dashboard and verify the CUPE fixture organization context.',
  'Navigate to Cases and inspect the fixture grievances actually persisted.',
  'Open pilot onboarding and review the canonical checklist; uncompleted tasks remain pending.',
  'Verify SLA, summary and billing features separately before demonstrating their outcomes.',
];

export const POST = withApi(
  {
    auth: { minRole: 'system_admin' },
    body: bodySchema,
    rateLimit: RATE_LIMITS.ORG_WRITE,
    openapi: {
      tags: ['Pilot'],
      summary: 'Bootstrap or reset the CUPE pilot organization from the fixture, recording every row it creates',
    },
  },
  async ({ body, userId, organizationId: actingOrganizationId }) => {
    if (!userId) throw ApiError.unauthorized();

    let runtimeMode: string;
    try {
      runtimeMode = assertPilotDemoMutationRuntime();
    } catch (error) {
      throw ApiError.forbidden(error instanceof Error ? error.message : 'Pilot bootstrap is disabled in this runtime');
    }

    await requirePlatformStaffAuthority({ userId, organizationId: actingOrganizationId }, 'platform.pilot_fixture.manage');

    let fixture;
    try {
      fixture = await loadCupeFixture();
    } catch (error) {
      if (error instanceof FixtureUnavailableError) throw ApiError.internal(error.message);
      throw error;
    }

    const slug = fixtureSlug(fixture);
    if (body.reset && !body.dryRun && body.confirmReset !== slug) {
      throw ApiError.badRequest('reset requires confirmReset to name the organization slug');
    }

    const resolved = await withSystemContext((tx) =>
      resolveFixtureOrganization(tx, { slug, name: fixture.org.name, userId, dryRun: body.dryRun, runtimeMode }),
    );
    if (resolved.kind === 'refused') {
      throw ApiError.conflict(
        'An organization already exists at the fixture slug but was not created by the pilot bootstrap, so none of its rows can be proven to be fixture data. Nothing was changed.',
      );
    }
    if (resolved.kind === 'would_create') {
      return {
        success: true,
        dryRun: true,
        organizationId: null,
        organizationName: fixture.org.name,
        wouldCreateOrganization: true,
        reset: body.reset,
        planned: { members: fixture.members.length, cases: fixture.cases.length },
        demoScript: [],
      };
    }

    const { organizationId } = resolved;
    let result;
    try {
      result = await withRLSContext({ organizationId, userId }, (tx) =>
        applyFixture(tx, {
          organizationId,
          userId,
          fixture,
          reset: body.reset,
          dryRun: body.dryRun,
          organizationCreated: resolved.created,
          runtimeMode,
        }),
      );
    } catch (error) {
      if (!(error instanceof AuthOrgBindingError)) throw error;
      try {
        await withSystemContext((tx) =>
          recordFixtureDenial(tx, { organizationId, userId, runtimeMode, reason: 'membership_required', details: { code: error.code } }),
        );
      } catch (recordError) {
        // The refusal stands whether or not it could be recorded.
        logger.error('pilot_fixture_denial_not_recorded', { error: recordError instanceof Error ? recordError.message : 'unknown' });
      }
      throw ApiError.forbidden(
        'The fixture organization exists, but its members and grievances are tenant data: they can be seeded or reset only by an operator who holds an active membership in it. Nothing was changed.',
      );
    }

    if (result.kind === 'refused') {
      throw ApiError.conflict(
        result.reason === 'foreign_rows'
          ? `Reset refused: the organization holds ${result.foreign.members} member rows and ${result.foreign.grievances} grievance rows that this bootstrap did not create. Nothing was changed.`
          : 'Reset refused: a fixture row is still referenced by records this bootstrap did not create. Nothing was changed.',
      );
    }

    return {
      success: true,
      dryRun: result.dryRun,
      organizationId,
      organizationName: fixture.org.name,
      organizationCreated: resolved.created,
      reset: body.reset,
      seeded: {
        worksites: 0,
        worksitesAvailableInFixtureNotSeeded: fixture.worksites.length,
        members: result.seeded.members,
        cases: result.seeded.cases,
      },
      alreadyPresent: result.alreadyPresent,
      caseNumbersInUse: result.caseNumbersInUse,
      removed: result.removed,
      clearedStale: result.clearedStale,
      onboarding: result.onboarding,
      demoScript: body.includeDemoScript ? DEMO_SCRIPT : [],
    };
  },
);
