/**
 * What the member rewards pages read: the wallet of the signed-in member and the colleagues they can recognize.
 *
 * Both are tenant tables (reward_wallet_ledger, organization_members). Outside withRLSContext({ organizationId }) the database handle has no
 * organization and row-level security shows both as empty, so a wallet page rendered an empty wallet and the recognition page a form with
 * nobody to pick. A database failure is not an empty wallet: it propagates to the page's error boundary.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { organizationMembers } from '@/db/schema';
import { rewardWalletLedger, recognitionPrograms, type RewardWalletLedgerEntry } from '@/db/schema/domains/infrastructure/rewards';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { calculateRewardTotals } from '@/lib/utils/rewards-stats-utils';

export const WALLET_PAGE_SIZE = 20;

export interface WalletOverview {
  balance: number;
  entries: RewardWalletLedgerEntry[];
  totalEarned: number;
  totalRedeemed: number;
}

/** The balance after the newest ledger entry of one member: what the redemption page offers to spend. A database failure rejects. */
export function loadWalletBalance(organizationId: string, userId: string): Promise<number> {
  return withRLSContext({ organizationId }, async (tx) => {
    const [latest] = await tx
      .select({ balanceAfter: rewardWalletLedger.balanceAfter })
      .from(rewardWalletLedger)
      .where(and(eq(rewardWalletLedger.orgId, organizationId), eq(rewardWalletLedger.userId, userId)))
      .orderBy(desc(rewardWalletLedger.createdAt))
      .limit(1);
    return latest?.balanceAfter ?? 0;
  });
}

/**
 * The organization's active recognition program: the newest active one, the same the recognition page offers, or null when it has none. A
 * redemption is recorded against it and an administrator creates awards in it. A database failure rejects.
 */
export function loadActiveProgram(organizationId: string): Promise<{ id: string; name: string } | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const [program] = await tx
      .select({ id: recognitionPrograms.id, name: recognitionPrograms.name })
      .from(recognitionPrograms)
      .where(and(eq(recognitionPrograms.orgId, organizationId), eq(recognitionPrograms.status, 'active')))
      .orderBy(desc(recognitionPrograms.createdAt))
      .limit(1);
    return program ?? null;
  });
}

export const HISTORY_PAGE_SIZES = [25, 50, 100, 200] as const;
export const LEDGER_EVENT_TYPES = ['earn', 'spend', 'expire', 'revoke', 'refund', 'adjust'] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export interface CreditHistoryQuery {
  eventType: 'all' | LedgerEventType;
  limit: (typeof HISTORY_PAGE_SIZES)[number];
  page: number;
}

/** The query string of the history page, made safe: an unknown event type is "all", the page size is one of the offered sizes, the page is a whole number from 1. */
export function parseCreditHistoryQuery(query: { eventType?: string; limit?: string; page?: string }): CreditHistoryQuery {
  const eventType = (LEDGER_EVENT_TYPES as readonly string[]).includes(query.eventType ?? '') ? (query.eventType as LedgerEventType) : 'all';
  const requested = Number.parseInt(query.limit ?? '', 10);
  const limit = (HISTORY_PAGE_SIZES as readonly number[]).includes(requested) ? (requested as CreditHistoryQuery['limit']) : 50;
  const page = Number.parseInt(query.page ?? '1', 10);
  return { eventType, limit, page: Number.isFinite(page) && page >= 1 ? page : 1 };
}

export interface CreditHistory {
  /** The requested page of the entries that match the event type, newest first. */
  entries: RewardWalletLedgerEntry[];
  /** How many entries match the event type: what the pages are counted from. */
  matching: number;
  /** Every entry of the member, and the credits earned, spent and expired over ALL of them (not over the page shown). */
  totalTransactions: number;
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
}

/** One page of a member's ledger, filtered by event type in the database, with the totals over the whole ledger. A database failure rejects. */
export function loadCreditHistory(organizationId: string, userId: string, query: CreditHistoryQuery): Promise<CreditHistory> {
  return withRLSContext({ organizationId }, async (tx) => {
    const owned = and(eq(rewardWalletLedger.orgId, organizationId), eq(rewardWalletLedger.userId, userId));
    const matchingRows = query.eventType === 'all' ? owned : and(owned, eq(rewardWalletLedger.eventType, query.eventType));

    const entries = await tx
      .select()
      .from(rewardWalletLedger)
      .where(matchingRows)
      .orderBy(desc(rewardWalletLedger.createdAt), desc(rewardWalletLedger.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    const perType = await tx
      .select({
        eventType: rewardWalletLedger.eventType,
        entries: sql<number>`count(*)::int`,
        credits: sql<number>`coalesce(sum(${rewardWalletLedger.amountCredits}), 0)::int`,
      })
      .from(rewardWalletLedger)
      .where(owned)
      .groupBy(rewardWalletLedger.eventType);

    const of = (eventType: LedgerEventType) => perType.find((row) => row.eventType === eventType);
    return {
      entries,
      matching: query.eventType === 'all' ? perType.reduce((sum, row) => sum + row.entries, 0) : (of(query.eventType)?.entries ?? 0),
      totalTransactions: perType.reduce((sum, row) => sum + row.entries, 0),
      totalEarned: of('earn')?.credits ?? 0,
      totalSpent: Math.abs(of('spend')?.credits ?? 0),
      totalExpired: Math.abs(of('expire')?.credits ?? 0),
    };
  });
}

/**
 * The balance, the latest ledger entries and the all-time totals of one member's wallet. The balance is the balance after the newest entry,
 * read with the entries in one statement, so the figure shown beside the list always agrees with its first row.
 */
export function loadWalletOverview(organizationId: string, userId: string): Promise<WalletOverview> {
  return withRLSContext({ organizationId }, async (tx) => {
    const entries = await tx
      .select()
      .from(rewardWalletLedger)
      .where(and(eq(rewardWalletLedger.orgId, organizationId), eq(rewardWalletLedger.userId, userId)))
      .orderBy(desc(rewardWalletLedger.createdAt))
      .limit(WALLET_PAGE_SIZE);
    const totals = await calculateRewardTotals(userId, organizationId);

    return {
      balance: entries[0]?.balanceAfter ?? 0,
      entries,
      totalEarned: totals.totalEarned,
      totalRedeemed: totals.totalRedeemed,
    };
  });
}

export interface RecognitionCandidate {
  userId: string;
  name: string;
  /** Present only when the caller asked for it, which only an administrator page does: a member's picker lists names, not e-mail addresses. */
  email?: string;
}

/**
 * The current members of the organization a recognition can go to: the same people createAward and nominatePeer accept as recipients. A
 * member picking a colleague needs a name, so a name is all that is returned; `includeEmail` is for an administrator page that has already
 * checked the viewer may see members' e-mail addresses.
 */
export function listRecognitionCandidates(
  organizationId: string,
  options: { includeEmail?: boolean } = {},
): Promise<RecognitionCandidate[]> {
  return withRLSContext({ organizationId }, async (tx) => {
    const members = await tx
      .select({
        userId: organizationMembers.userId,
        name: organizationMembers.name,
        email: organizationMembers.email,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active'),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .orderBy(asc(organizationMembers.name));

    return members.map((member) => ({
      userId: member.userId,
      name: member.name || 'Unknown',
      ...(options.includeEmail ? { email: member.email || '' } : {}),
    }));
  });
}

/** The names of some of the organization's members by user id, for an administrator list that would otherwise show opaque ids. A person with no member row is simply absent. */
export function loadMemberNames(organizationId: string, userIds: readonly string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return Promise.resolve({});
  return withRLSContext({ organizationId }, async (tx) => {
    const members = await tx
      .select({ userId: organizationMembers.userId, name: organizationMembers.name })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.userId, [...userIds])));

    return Object.fromEntries(members.filter((member) => member.name).map((member) => [member.userId, member.name]));
  });
}
