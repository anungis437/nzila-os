/**
 * CRUD collection route for pilot applications
 * POST also syncs the applicant to HubSpot as a lead.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';
import { db } from '@/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import { upsertContact, createDeal } from '@/lib/services/crm-service';

export const dynamic = 'force-dynamic';

// PILOT_PLATFORM_ACCESS_MIN_LEVEL-equivalent gate (PR #752 round 17): this
// table has no organizationId column (orgScoped can never filter it), and its
// rows are sensitive prospective-customer intake data (contact info, member
// counts, internal "challenges"/"goals") for organizations across the WHOLE
// platform, not the caller's own org — matches lib/pilot/pilot-ownership.ts's
// own choice of system_admin as the minimum cross-org pilot-data access
// level. Previously gated only by an ordinary per-org steward-level role,
// letting any steward at any org enumerate every other org's pilot
// applications.
const { GET: listPilotApplications } = crudRoutes({
  table: pilotApplications,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'system_admin',
  writeRole: 'member',
});

// Every caller reaching this handler is already system_admin+ (above), so
// the underlying query always runs cross-org by design — execute it on the
// system connection rather than the ordinary tenant runtime pool (PR #752
// round 18), consistent with lib/pilot/pilot-ownership.ts's own platform-tier
// execution model for the per-item routes.
export const GET = (
  request: NextRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> },
) => withSystemContext((_tx) => listPilotApplications(request, context));

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationName,
      contactName,
      contactEmail,
      contactPhone,
      memberCount,
      organizationType,
      jurisdictions,
      sectors,
      currentSystem,
      challenges,
      goals,
      responses,
      assessment,
    } = body;

    if (!organizationName || !contactEmail || !contactName) {
      return NextResponse.json(
        { error: 'Organization name, contact name, and email are required' },
        { status: 400 },
      );
    }

    // Insert into DB
    const [row] = await db
      .insert(pilotApplications)
      .values({
        organizationName,
        organizationType: organizationType ?? 'local',
        contactName,
        contactEmail,
        contactPhone: contactPhone ?? null,
        memberCount: memberCount ?? 0,
        jurisdictions: jurisdictions ?? [],
        sectors: sectors ?? [],
        currentSystem: currentSystem ?? null,
        challenges: challenges ?? [],
        goals: goals ?? [],
        readinessScore: assessment?.score?.toString() ?? null,
        responses: responses ?? {},
      })
      .returning();

    logger.info('pilot_application:created', {
      id: row.id,
      organization: organizationName,
      email: contactEmail,
    });

    // Sync to HubSpot (fire-and-forget — gracefully skips if unconfigured)
    const [firstName, ...rest] = contactName.split(' ');
    const contactId = await upsertContact({
      email: contactEmail,
      firstName,
      lastName: rest.join(' ') || undefined,
      properties: {
        company: organizationName,
        phone: contactPhone || undefined,
        ue_source: 'pilot-application',
        ue_member_count: String(memberCount ?? ''),
        ue_org_type: organizationType || undefined,
      },
    });

    if (contactId) {
      await createDeal({
        name: `Pilot application — ${organizationName}`,
        stage: 'pilot_applied',
        contactId,
        properties: {
          ue_readiness_score: assessment?.score?.toString() ?? '',
          ue_member_count: String(memberCount ?? ''),
          ue_pilot_app_id: row.id,
        },
      });
    }

    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (err) {
    logger.error('pilot_application:error', { error: (err as Error).message });
    return NextResponse.json(
      { error: 'Failed to submit pilot application' },
      { status: 500 },
    );
  }
}
