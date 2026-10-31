import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

/**
 * The onboarding helpers read shared peer data on behalf of one organization. The read is recorded in the canonical audit
 * log before the result is returned, and a failed record fails the request: an in-process event with no subscriber is not a trace.
 */
export async function recordOnboardingRead(
  scope: { organizationId: string; userId: string },
  action: 'onboarding.federation_discovery' | 'onboarding.peer_benchmarks' | 'onboarding.clause_suggestions',
  details: Record<string, string | number | null>,
): Promise<void> {
  await withRLSContext({ organizationId: scope.organizationId, userId: scope.userId }, (tx) =>
    persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action,
      resourceType: 'onboarding',
      details,
    }),
  );
}
