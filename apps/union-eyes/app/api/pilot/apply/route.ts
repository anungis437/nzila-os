/**
 * CRUD collection route for pilot applications
 * POST also syncs the applicant to HubSpot as a lead.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';
import { db } from '@/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { hasMinRole } from '@/lib/api-auth-guard';
import { rateLimit } from '@/lib/rate-limit';
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

// Every caller reaching this handler is already system_admin+ (checked
// below, BEFORE the system connection is ever opened — PR #752 round 19: the
// round-18 version elevated to withSystemContext first and relied on the
// generated crudRoutes handler's own internal auth check, which meant an
// unauthenticated/under-authorized request still triggered a system-
// principal query before being rejected. Authenticate + authorize on the
// ordinary connection first, THEN elevate for the actual cross-org query),
// consistent with lib/pilot/pilot-ownership.ts's own platform-tier
// execution model for the per-item routes.
export const GET = async (
  request: NextRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> },
) => {
  if (!(await hasMinRole('system_admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return withSystemContext((_tx) => listPilotApplications(request, context));
};


// Public, unauthenticated by design (PR #752 round 19: made explicitly
// governed — see PUBLIC_API_ROUTES + validate-api-governance.ts's
// PUBLIC_ROUTE_PREFIXES — rather than public only by omitting an auth
// wrapper). Prospective unions apply before any account/org exists, so no
// auth wrapper is possible here; schema-validate the body and rate-limit by
// IP to bound the unauthenticated attack surface.
const pilotApplicationBodySchema = z.object({
  organizationName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(50).optional().nullable(),
  memberCount: z.number().int().min(0).max(10_000_000).optional(),
  organizationType: z.enum(['local', 'regional', 'national']).optional(),
  jurisdictions: z.array(z.string().trim().max(100)).max(50).optional(),
  sectors: z.array(z.string().trim().max(100)).max(50).optional(),
  currentSystem: z.string().trim().max(500).optional().nullable(),
  challenges: z.array(z.string().trim().max(500)).max(50).optional(),
  goals: z.array(z.string().trim().max(500)).max(50).optional(),
  // Free-form intake context. NEVER treated as a trusted identity/ownership
  // assertion (`responses.organizationId`, if present, is a claim from this
  // unauthenticated submitter — see getPilotClaimedOrganizationId's doc
  // comment in lib/pilot/pilot-ownership.ts).
  responses: z.record(z.unknown()).optional(),
  assessment: z.object({ score: z.union([z.number(), z.string()]).optional() }).passthrough().optional(),
});

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { maxRequests: 5, windowSeconds: 60 * 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many pilot applications submitted. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = pilotApplicationBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pilot application payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
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
    } = parsed.data;

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
        ...(contactPhone ? { phone: contactPhone } : {}),
        ue_source: 'pilot-application',
        ue_member_count: String(memberCount ?? ''),
        ...(organizationType ? { ue_org_type: organizationType } : {}),
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
