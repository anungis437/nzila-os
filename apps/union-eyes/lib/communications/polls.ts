/**
 * Polls: a steward creates a single-choice poll in their organization and each member of that organization votes on it once.
 *
 * The generic polls collection could not create a poll (the table is READ_ONLY in the CRUD governance table) and the vote path answered 501,
 * so no poll could be created and no vote recorded. This module is the dedicated path:
 *
 *  - a poll is created already open (status active, published now), with server-minted option ids, and with only the settings that operate:
 *    one vote per member, by an authenticated member. A multiple-vote or anonymous poll is not built, so the request is refused rather than
 *    stored with a setting nothing honours;
 *  - a vote is accepted only on an open poll of the caller's own organization, for one of its options; the database's unique key on
 *    (poll_id, user_id) is what makes it one vote per member, so two concurrent votes by the same member store one row and the other is a
 *    conflict;
 *  - the vote, the poll's counters and the audit record commit in one transaction.
 */
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { polls, pollVotes } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';

export interface PollOption {
  id: string;
  text: string;
}

const OPEN_STATUSES = ['active', 'published'] as const;

export const createPollSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(4000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(20),
  closesAt: z.string().datetime({ offset: true }).optional(),
  // Accepted only with the one value that operates, so a client that names them is not silently given something else.
  allowMultipleVotes: z.literal(false).optional(),
  requireAuthentication: z.literal(true).optional(),
}).strict();

export type CreatePollInput = z.infer<typeof createPollSchema>;

export const castVoteSchema = z.object({
  optionId: z.string().trim().min(1).max(50),
}).strict();

/** Normalizes a validated poll request: distinct options with server-minted ids, and a closing time in the future. */
export function buildPollValues(input: CreatePollInput, now: Date = new Date()): { question: string; description: string | null; options: PollOption[]; closesAt: Date | null } {
  const seen = new Set<string>();
  for (const text of input.options) {
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) throw ApiError.badRequest('Poll options must be distinct');
    seen.add(key);
  }
  const closesAt = input.closesAt ? new Date(input.closesAt) : null;
  if (closesAt && closesAt.getTime() <= now.getTime()) throw ApiError.badRequest('closesAt must be in the future');
  return {
    question: input.question,
    description: input.description ?? null,
    options: input.options.map((text, index) => ({ id: `opt-${index + 1}`, text })),
    closesAt,
  };
}

export async function createPoll(tx: RLSTx, args: { organizationId: string; userId: string; input: CreatePollInput; now?: Date }) {
  const now = args.now ?? new Date();
  const values = buildPollValues(args.input, now);
  const [created] = await tx.insert(polls).values({
    organizationId: args.organizationId,
    question: values.question,
    description: values.description,
    options: values.options,
    status: 'active',
    allowMultipleVotes: false,
    requireAuthentication: true,
    showResultsBeforeVote: false,
    publishedAt: now,
    closesAt: values.closesAt,
    totalVotes: 0,
    uniqueVoters: 0,
    createdBy: args.userId,
  }).returning();
  await persistAtomicAudit(tx, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: 'communications.poll.create',
    resourceType: 'polls',
    resourceId: created.id,
    details: { optionCount: values.options.length, closesAt: values.closesAt?.toISOString() ?? null },
  });
  return created;
}

/** Why a poll does not accept a vote now, or null when it does. */
export function pollClosedReason(poll: { status: string; publishedAt: Date | null; closesAt: Date | null }, now: Date): string | null {
  if (!(OPEN_STATUSES as readonly string[]).includes(poll.status)) return `This poll is ${poll.status} and does not accept votes`;
  if (poll.publishedAt && poll.publishedAt.getTime() > now.getTime()) return 'This poll is not open yet';
  if (poll.closesAt && poll.closesAt.getTime() <= now.getTime()) return 'This poll has closed';
  return null;
}

export function pollOptionIds(options: unknown): Set<string> {
  if (!Array.isArray(options)) return new Set();
  return new Set(options.flatMap((option) => (option && typeof option === 'object' && typeof (option as { id?: unknown }).id === 'string' ? [(option as { id: string }).id] : [])));
}

export async function castPollVote(tx: RLSTx, args: { organizationId: string; userId: string; pollId: string; optionId: string; now?: Date }) {
  const now = args.now ?? new Date();
  const [poll] = await tx
    .select({ id: polls.id, status: polls.status, publishedAt: polls.publishedAt, closesAt: polls.closesAt, options: polls.options })
    .from(polls)
    .where(and(eq(polls.id, args.pollId), eq(polls.organizationId, args.organizationId)))
    .limit(1);
  // A poll of another organization is not found, the same as one that does not exist.
  if (!poll) throw ApiError.notFound('Poll');
  const closed = pollClosedReason(poll, now);
  if (closed) throw ApiError.conflict(closed);
  if (!pollOptionIds(poll.options).has(args.optionId)) throw ApiError.badRequest('optionId is not an option of this poll');

  const [vote] = await tx.insert(pollVotes).values({
    organizationId: args.organizationId,
    pollId: poll.id,
    userId: args.userId,
    optionId: args.optionId,
    votedAt: now,
  }).onConflictDoNothing({ target: [pollVotes.pollId, pollVotes.userId] }).returning({ id: pollVotes.id, optionId: pollVotes.optionId, votedAt: pollVotes.votedAt });
  if (!vote) throw ApiError.conflict('You have already voted in this poll');

  await tx.update(polls)
    .set({ totalVotes: sql`${polls.totalVotes} + 1`, uniqueVoters: sql`${polls.uniqueVoters} + 1`, updatedAt: now })
    .where(and(eq(polls.id, poll.id), eq(polls.organizationId, args.organizationId)));
  // The chosen option is not copied into the audit log: the vote row holds it, and the audit trail is read more widely than the poll.
  await persistAtomicAudit(tx, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: 'communications.poll.vote',
    resourceType: 'poll_votes',
    resourceId: vote.id,
    details: { pollId: poll.id },
  });
  return vote;
}

export async function readOwnPollVote(tx: RLSTx, args: { organizationId: string; userId: string; pollId: string }) {
  const [poll] = await tx.select({ id: polls.id }).from(polls)
    .where(and(eq(polls.id, args.pollId), eq(polls.organizationId, args.organizationId))).limit(1);
  if (!poll) throw ApiError.notFound('Poll');
  const [vote] = await tx.select({ optionId: pollVotes.optionId, votedAt: pollVotes.votedAt }).from(pollVotes)
    .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.organizationId, args.organizationId), eq(pollVotes.userId, args.userId))).limit(1);
  return vote ? { voted: true as const, optionId: vote.optionId, votedAt: vote.votedAt } : { voted: false as const, optionId: null, votedAt: null };
}
