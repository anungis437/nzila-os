/**
 * CRUD collection route for pilot applications
 * POST stores the application and verifies control of the contact address.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications, pilotContactVerifications } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { checkRateLimit, RATE_LIMITS_PER_IP } from '@/lib/rate-limiter';
import { clientAddress } from '@/lib/public-intake/guard';
import { logger } from '@/lib/logger';
import { boundedJsonRecord } from '@/lib/api/bounded-json-record';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';
import { sanitizeResponsesForPublicCreate } from '@/lib/pilot/responses-authority';
import { hasPilotPlatformAuthority } from '@/lib/pilot/pilot-ownership';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// The body is the application plus a free-form `responses` object that is itself capped at 16 KiB below; nothing legitimate is larger.
const MAX_BODY_BYTES = 64 * 1024;

// The table has no organizationId column (orgScoped can never filter it), and its rows are prospective-customer intake data
// (contact details, member counts, challenges and goals) of every applicant: the list is platform-tier only (see GET below).
// readRole stays as the factory's own floor; the platform-staff check before it is what decides.
const { GET: listPilotApplications } = crudRoutes({
  table: pilotApplications,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'system_admin',
  writeRole: 'member',
});

// The list is the platform tier: only the explicit platform-staff authority (hasPilotPlatformAuthority — the canonical
// system-administrator fact or the named allow-list, never a role title such as system_admin, support_agent or data_analyst;
// Gate 0 wave 2, DEF-0B10-PIL-PLATFORM-TIER-…) may read every organization's applications. It is checked on the caller's own
// identity BEFORE the system connection is opened.
export const GET = async (
  request: NextRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> },
) => {
  if (!(await hasPilotPlatformAuthority())) {
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
  responses: boundedJsonRecord({ maxBytes: 16 * 1024, maxKeys: 60, maxDepth: 4 }).optional(),
  // Only the score is read; any other key an anonymous caller adds is dropped rather than carried.
  assessment: z.object({ score: z.union([z.number().finite(), z.string().trim().max(20)]).optional() }).optional(),
  crmConsent: z.object({ granted: z.boolean(), noticeVersion: z.string().min(1).max(100) }),
});

export async function POST(request: NextRequest) {
  // Redis/Upstash-backed, fail-closed distributed limiter (PR #752 round
  // 20) — the in-memory Map-based lib/rate-limit.ts helper used through
  // round 19 is per-process (every instance/restart has independent state)
  // and buckets by IP+User-Agent (trivially evaded by changing UA); this is
  // the same primitive already used for other IP-scoped public/abuse-prone
  // endpoints (see RATE_LIMITS_PER_IP), and fails CLOSED (rejects, not
  // allows) when Redis itself is unavailable, since this route has no other
  // abuse control.
  const ip = clientAddress(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS_PER_IP.PILOT_APPLY);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many pilot applications submitted. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    let rawBody: unknown = null;
    try {
      rawBody = await readBoundedJson(request, MAX_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ error: 'Pilot application is too large' }, { status: 413 });
      }
    }
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
      crmConsent,
    } = parsed.data;

    // Insert into DB. A prospective union applies before any organization exists, so the row has no organization for a tenant policy to
    // match: it is an intake record of the platform, written by the system role, and only after the body has been validated and the
    // caller rate limited above. No contact data leaves the platform before
    // address control and purpose consent have both been established.
    const row = await withSystemContext(async (tx) => {
      const [created] = await tx
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
          // PR #752 round 24: an unauthenticated applicant must never be able
          // to seed a reserved/authoritative key (commercialState,
          // subscriptionPlanId, qualification scores, artifact metadata, ...)
          // straight into a brand-new row — the PATCH-time protection built in
          // rounds 22/23 would then faithfully preserve that attacker-seeded
          // value forever. organizationId (the claim) remains allowed.
          responses: sanitizeResponsesForPublicCreate(responses),
        })
        .returning();
      await tx.insert(pilotContactVerifications).values({
        applicationId: created.id,
        emailKey: contactEmail.trim().toLowerCase(),
        // A challenge cannot be delivered until an approved verification
        // provider is activated. Keep only an unguessable digest and fail closed.
        tokenHash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
        status: 'pending',
        crmConsentStatus: crmConsent.granted ? 'granted' : 'denied',
        crmConsentVersion: crmConsent.noticeVersion,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        deliveryStatus: 'failed',
      });
      return created;
    });

    logger.info('pilot_application:created', {
      id: row.id,
      applicationId: row.id,
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      contactVerification: 'pending_provider_activation',
      crmDisclosure: 'not_queued',
    }, { status: 201 });
  } catch (err) {
    logger.error('pilot_application:error', { error: (err as Error).message });
    return NextResponse.json(
      { error: 'Failed to submit pilot application' },
      { status: 500 },
    );
  }
}
