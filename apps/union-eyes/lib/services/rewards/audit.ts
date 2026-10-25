import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

type AuditEntry = Parameters<typeof persistAtomicAudit>[1];

/** Actor recorded for rewards changes that no signed-in person performed (cron, provider webhooks). */
export const REWARDS_SYSTEM_ACTOR = 'system:rewards';

/** A caller-supplied actor, or the system actor when none (the legacy 'system' marker is not a user id). */
export function rewardsActor(userId?: string | null, fallback = REWARDS_SYSTEM_ACTOR): string {
  return userId && userId !== 'system' ? userId : fallback;
}

/** Record the audit on the transaction that holds the rewards write, so the two commit or roll back together. */
export function auditRewards(tx: unknown, entry: AuditEntry): Promise<void> {
  return persistAtomicAudit(tx as RLSTx, entry);
}
