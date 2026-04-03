/**
 * Cast votes for a council election
 *
 * POST /api/elections/[id]/vote
 *
 * Body: { votes: Record<string, number> }
 *   votes is a map of candidate name → votes received (ballot count increment).
 *
 * Increments the `votes` field on each matching candidate in the `candidates` jsonb array
 * and updates `totalVotes` accordingly.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { councilElections } from '@/db/schema/governance-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface Candidate {
  name: string;
  union?: string;
  platform?: string;
  votes: number;
}

export const POST = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'Submit votes for a council election',
      description: 'Increments candidate vote counts for the specified election.',
    },
  },
  async ({ request, params }) => {
    const body = await request.json() as { votes?: Record<string, number> };
    const votes = body.votes ?? {};

    if (Object.keys(votes).length === 0) {
      throw ApiError.badRequest('votes object is required and must not be empty');
    }

    // Fetch current election record
    const [election] = await db
      .select()
      .from(councilElections)
      .where(eq(councilElections.id, params.id));

    if (!election) throw ApiError.notFound('Election not found');

    const candidates = (election.candidates ?? []) as Candidate[];
    let additionalVotes = 0;

    // Apply increments
    const updatedCandidates = candidates.map((c) => {
      const increment = votes[c.name] ?? 0;
      additionalVotes += increment;
      return { ...c, votes: (c.votes ?? 0) + increment };
    });

    const newTotal = (election.totalVotes ?? 0) + additionalVotes;

    const [updated] = await db
      .update(councilElections)
      .set({
        candidates: updatedCandidates,
        totalVotes: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(councilElections.id, params.id))
      .returning();

    return { data: updated };
  },
);
