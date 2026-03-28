/**
 * Vote verification route
 * POST /api/voting/verify — verify a vote using receipt ID
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votes, votingOptions, votingSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: z.object({
      receiptId: z.string().min(1),
      verificationCode: z.string().optional(),
    }),
    openapi: {
      tags: ['Governance'],
      summary: 'Verify a vote',
      description: 'Verify that a vote was recorded correctly using the receipt ID.',
    },
  },
  async ({ body }) => {
    const { receiptId, verificationCode } = body;

    // Look up the vote by receipt ID
    const vote = await db.query.votes.findFirst({
      where: eq(votes.receiptId, receiptId),
    });

    if (!vote) {
      return { verified: false, reason: 'Receipt not found' };
    }

    // If verification code provided, check it
    if (verificationCode && vote.verificationCode !== verificationCode) {
      return { verified: false, reason: 'Verification code mismatch' };
    }

    // Get the option and session details
    const [option, session] = await Promise.all([
      db.query.votingOptions.findFirst({
        where: eq(votingOptions.id, vote.optionId),
      }),
      db.query.votingSessions.findFirst({
        where: eq(votingSessions.id, vote.sessionId),
      }),
    ]);

    return {
      verified: true,
      vote: {
        sessionTitle: session?.title ?? 'Unknown',
        optionText: option?.text ?? 'Unknown',
        castAt: vote.castAt,
        isAnonymous: vote.isAnonymous,
      },
    };
  }
);
