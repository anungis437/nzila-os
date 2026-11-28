/**
 * Writes imported memberships inside the caller's tenant transaction, reconciling each one against the identities already held.
 *
 * Every candidate has already resolved to exactly one directory identity (`userId`). A candidate may also carry the member's stable id in an
 * external system of record (`external`). Per candidate, in order:
 *   - an external id already bound to another member of this organization: not imported (`EXTERNAL_ID_BOUND_TO_OTHER_MEMBER`);
 *   - the person is already a member bound to a different external id: not imported (`MEMBER_BOUND_TO_OTHER_EXTERNAL_ID`);
 *   - the person is already a member with no external id: the external id is bound to that membership (`bound`), nothing else changes;
 *   - the person is already a member with the same binding, or without one and none is offered: nothing changes (`unchanged`);
 *   - otherwise a plain active membership is inserted with its binding (`inserted`).
 * Nothing is ever matched on a name or an email, and no membership is merged, moved or deleted.
 *
 * Concurrency: one membership per (organization, user) and one per (organization, source, external id) are unique indexes (platform 0089). Two
 * imports racing to bind the same identity cannot both commit: the loser's statement fails, its whole transaction rolls back, and
 * `MembershipImportConflictError` is raised so the caller reports a conflict with nothing written.
 */
import { and, eq } from 'drizzle-orm';
import { organizationMembers } from '@/db/schema-organizations';
import type { RLSTx } from '@/lib/db/with-rls-context';

export interface MembershipImportCandidate {
  /** The CSV line (or other source position) the candidate came from, for reporting. */
  line: number;
  userId: string;
  name: string;
  email: string;
  external?: { source: string; id: string };
}

export type MembershipReconciliationReason = 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER' | 'MEMBER_BOUND_TO_OTHER_EXTERNAL_ID';

export interface MembershipImportOutcome {
  inserted: number;
  bound: number;
  unchanged: number;
  conflicts: Array<{ row: number; reason: MembershipReconciliationReason }>;
}

export class MembershipImportConflictError extends Error {
  constructor(cause: unknown) {
    super('Another change bound the same member identity at the same time; nothing was imported');
    this.name = 'MembershipImportConflictError';
    this.cause = cause;
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current = error as { code?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.code === '23505') return true;
    current = current.cause as typeof current;
  }
  return false;
}

type Executor = Pick<RLSTx, 'select' | 'insert' | 'update'>;

export async function importMemberships(
  tx: Executor,
  organizationId: string,
  candidates: MembershipImportCandidate[],
): Promise<MembershipImportOutcome> {
  const outcome: MembershipImportOutcome = { inserted: 0, bound: 0, unchanged: 0, conflicts: [] };
  try {
    for (const candidate of candidates) {
      const external = candidate.external;

      if (external) {
        const holders = await tx
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.externalMemberSource, external.source),
            eq(organizationMembers.externalMemberId, external.id),
          ))
          .limit(1);
        if (holders.length > 0 && holders[0].userId !== candidate.userId) {
          outcome.conflicts.push({ row: candidate.line, reason: 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER' });
          continue;
        }
      }

      const existing = await tx
        .select({
          id: organizationMembers.id,
          externalMemberSource: organizationMembers.externalMemberSource,
          externalMemberId: organizationMembers.externalMemberId,
        })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, candidate.userId)))
        .limit(1);

      if (existing.length > 0) {
        const member = existing[0];
        if (!external) { outcome.unchanged++; continue; }
        if (member.externalMemberId === null) {
          await tx
            .update(organizationMembers)
            .set({ externalMemberSource: external.source, externalMemberId: external.id, updatedAt: new Date() })
            .where(and(eq(organizationMembers.id, member.id), eq(organizationMembers.organizationId, organizationId)));
          outcome.bound++;
        } else if (member.externalMemberSource === external.source && member.externalMemberId === external.id) {
          outcome.unchanged++;
        } else {
          outcome.conflicts.push({ row: candidate.line, reason: 'MEMBER_BOUND_TO_OTHER_EXTERNAL_ID' });
        }
        continue;
      }

      await tx.insert(organizationMembers).values({
        organizationId,
        userId: candidate.userId,
        name: candidate.name,
        email: candidate.email,
        role: 'member',
        status: 'active',
        externalMemberSource: external?.source ?? null,
        externalMemberId: external?.id ?? null,
      });
      outcome.inserted++;
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new MembershipImportConflictError(error);
    throw error;
  }
  return outcome;
}
