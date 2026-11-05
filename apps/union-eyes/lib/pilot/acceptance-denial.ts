/**
 * What is kept when a commercial transition is refused because the counterpart's acceptance is not verified.
 *
 * The refusal rolls the transition back, so the record cannot depend on it: it is written in its own transaction. Two things are kept:
 *   - an audit entry for the refused operation (which state, which policy, what evidence the effect would have rested on), and
 *   - when the refused request carried an acceptance claim, the claim itself on the contract, as a claim. It is evidence that someone said the
 *     counterpart accepted. It does not appear as an acceptance, does not change the contract's status, and is never promoted later.
 * The audit entry holds no name: the claimed signer is on the contract, not in the audit log.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { commercialContracts } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withSystemContext } from '@/lib/db/with-rls-context';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import {
  COUNTERPART_ACCEPTANCE_POLICY,
  withRecordedAcceptanceClaim,
  type AcceptanceDecision,
  type CounterpartAcceptanceClaim,
  type RecordedAcceptanceClaim,
} from './counterpart-acceptance';

export interface AcceptanceDenial {
  organizationId: string;
  applicationId: string;
  fromState: string;
  targetState: string;
  blocked: NonNullable<AcceptanceDecision['blocked']>;
  contractId?: string | null;
  claim?: CounterpartAcceptanceClaim | null;
}

const sameClaim = (a: Partial<RecordedAcceptanceClaim>, b: RecordedAcceptanceClaim) =>
  a.channelClaimed === b.channelClaimed && a.evidenceReference === b.evidenceReference && a.claimedByRole === b.claimedByRole;

/** Returns whether the refusal was durably recorded. A failure to record never lets the transition through; it is reported. */
export async function recordAcceptanceDenial(denial: AcceptanceDenial, userId: string, now: Date = new Date()): Promise<boolean> {
  try {
    await withSystemContext(async () =>
      db.transaction(async (tx) => {
        let claimRecorded = false;
        if (denial.contractId && denial.claim) {
          const [contract] = await tx
            .select({ metadata: commercialContracts.metadata })
            .from(commercialContracts)
            .where(and(eq(commercialContracts.id, denial.contractId), eq(commercialContracts.organizationId, denial.organizationId)))
            .limit(1);
          if (contract) {
            const claim: RecordedAcceptanceClaim = {
              claimedByRole: denial.claim.acceptedByRole,
              channelClaimed: denial.claim.channel,
              evidenceReference: denial.claim.evidenceReference,
              recordedBy: userId,
              recordedAt: now.toISOString(),
              standing: 'unverified_claim',
              reason: denial.blocked.operation,
              policyVersion: COUNTERPART_ACCEPTANCE_POLICY.version,
            };
            const earlier = ((contract.metadata as { acceptanceClaims?: Partial<RecordedAcceptanceClaim>[] } | null)?.acceptanceClaims ?? []);
            if (!earlier.some((entry) => sameClaim(entry, claim))) {
              await tx
                .update(commercialContracts)
                .set({ metadata: withRecordedAcceptanceClaim(contract.metadata, claim) })
                .where(and(eq(commercialContracts.id, denial.contractId), eq(commercialContracts.organizationId, denial.organizationId)));
            }
            claimRecorded = true;
          }
        }
        await persistAtomicAudit(
          tx as unknown as RLSTx,
          {
            organizationId: denial.organizationId,
            userId,
            action: 'pilot.commercial_transition.acceptance_refused',
            resourceType: 'pilot_applications',
            resourceId: denial.applicationId,
            details: {
              blockedOperation: denial.blocked.operation,
              fromState: denial.fromState,
              targetState: denial.targetState,
              evidence: denial.blocked.evidence,
              requires: denial.blocked.requires,
              policyVersion: denial.blocked.policyVersion,
              policyApprovedBy: denial.blocked.policyApprovedBy,
              contractId: denial.contractId ?? null,
              claimRecorded,
              channelClaimed: denial.claim?.channel ?? null,
            },
          },
          'failure',
        );
      }),
    );
    return true;
  } catch (error) {
    logger.error('pilot_commercial_transition:acceptance_denial_not_recorded', { error: (error as Error).message });
    return false;
  }
}
