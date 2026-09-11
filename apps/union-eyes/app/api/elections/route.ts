/**
 * Council Elections collection route
 *
 * GET  /api/elections  — list all elections (no org filter — global governance table)
 * POST /api/elections  — create a new election record
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { councilElections } from '@/db/schema/governance-schema';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: { tags: ['Governance'], summary: 'List council elections' },
  },
  async () => {
    const elections = await withSystemContext(async (_tx) =>
      db
        .select()
        .from(councilElections)
        .orderBy(desc(councilElections.electionYear), desc(councilElections.electionDate))
    );

    return { data: elections };
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: { tags: ['Governance'], summary: 'Create a council election record' },
  },
  async ({ request, organizationId, userId }) => {
    const body = await request.json();
    const {
      electionYear,
      electionDate,
      positionsAvailable,
      candidates = [],
      winners = [],
      totalVotes = 0,
      participationRate,
      verifiedBy,
      verificationDate,
      contestedResults = false,
    } = body as {
      electionYear?: number;
      electionDate?: string;
      positionsAvailable?: number;
      candidates?: any[];
      winners?: any[];
      totalVotes?: number;
      participationRate?: number;
      verifiedBy?: string;
      verificationDate?: string;
      contestedResults?: boolean;
    };

    if (!electionYear || !electionDate || !positionsAvailable) {
      throw ApiError.badRequest('electionYear, electionDate, and positionsAvailable are required');
    }

    const [election] = await withSystemContext(async (_tx) =>
      db
        .insert(councilElections)
        .values({
          electionYear,
          electionDate,
          positionsAvailable,
          candidates,
          winners,
          totalVotes,
          participationRate,
          verifiedBy,
          verificationDate,
          contestedResults,
        })
        .returning()
    );

    // Evidence: election record creation audit trail
    buildUnionEvidencePack({
      actionType: 'ELECTION_CREATED',
      orgId: organizationId ?? 'global',
      actorId: userId ?? 'unknown',
      artifacts: [{ type: 'election', data: { electionId: election.id, electionYear, positionsAvailable } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'ELECTION_CREATED' }))

    return NextResponse.json({ data: election }, { status: 201 });
  },
);
