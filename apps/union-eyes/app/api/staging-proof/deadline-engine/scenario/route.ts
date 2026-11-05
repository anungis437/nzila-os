/**
 * Deadline Engine Staging Proof — RETIRED
 *
 * This HMAC-gated route ran the deadline engine (scheduling, rescheduling, cancellation) end to end against the staging database, as the system role, inside one
 * transaction it always rolled back, so that a session-less caller could produce a lifecycle proof. It cannot run under the authority model the database enforces,
 * and it answers HTTP 501 to a caller it still authenticates:
 *
 * - The case the engine schedules reminders for (a grievance and its deadline) has to exist first. The system role holds no INSERT on grievances
 *   (db/__tests__/pilot-fixture-bootstrap.postgres.test.ts: a seed cannot be a platform-role write), and granting it for a staging-only harness would grant it in
 *   every environment.
 * - The tenant role is reachable only through a session user with an active membership (lib/db/with-rls-context.ts), which an HMAC caller never has.
 * - A SECURITY DEFINER seeding function is refused by the catalog admission contract.
 *
 * The proof is unbuilt, not passed: the deadline capabilities stay exactly as the capability registry states them. A replacement seeds through the tenant path as an
 * operator who holds a membership, the way the pilot bootstrap does.
 *
 * The gates stay as they were: the route answers only an image built for staging, with the runtime switches and a valid HMAC over a fresh timestamp, and every other
 * request is an empty HTTP 404.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isAuthorizedStagingProofEnvironment,
  STAGING_PROOF_SCENARIOS,
  verifyProofAuthorization,
} from '@/lib/staging-proof/deadline-engine-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RequestBody = z.object({ scenario: z.enum(STAGING_PROOF_SCENARIOS) }).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = {
    // Referenced literally so the bundler inlines the value the image was built with.
    BUILD_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    STAGING_PROOFS_ENABLED: process.env.STAGING_PROOFS_ENABLED,
    UNION_EYES_RUNTIME_ID: process.env.UNION_EYES_RUNTIME_ID,
    STAGING_PROOF_SECRET: process.env.STAGING_PROOF_SECRET,
    UE_ENVIRONMENT: process.env.UE_ENVIRONMENT,
    NZILA_MODE: process.env.NZILA_MODE,
  };
  if (!isAuthorizedStagingProofEnvironment(env)) return new NextResponse(null, { status: 404 });

  const parsed = RequestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid proof request' }, { status: 400 });

  const authorization = verifyProofAuthorization({
    env,
    scenario: parsed.data.scenario,
    headers: {
      timestamp: request.headers.get('x-staging-proof-timestamp'),
      nonce: request.headers.get('x-staging-proof-nonce'),
      signature: request.headers.get('x-staging-proof-signature'),
    },
  });
  if (!authorization.authorized) return new NextResponse(null, { status: 404 });

  return NextResponse.json(
    {
      error: 'not_implemented',
      reason: 'The deadline-engine staging proof is retired: a session-less caller cannot seed the case the engine schedules reminders for under the hardened database roles.',
    },
    { status: 501 },
  );
}
