/**
 * Publication after commit (INT-08, INT-15).
 *
 * The executor writes an event row in the same transaction as the case and its receipt, so an event exists only for a
 * committed state and only in its own organization (row-level security). This publishes pending rows of one organization
 * and marks each published once. A publisher failure leaves the row pending for the next run; it never re-runs the
 * domain write. Delivery to a subscriber is at least once: a crash between the subscriber's acceptance and the mark is
 * published again, and the payload's receiptId lets the subscriber discard the duplicate.
 */
import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { rowsOf, type InTenantTx } from './durable-inbound-executor'

export interface InboundEvent {
  readonly id: string
  readonly organizationId: string
  readonly eventType: string
  readonly payload: { receiptId: string; caseId: string; sourceId: string; effect: string }
}

export async function publishCommittedInboundEvents(
  inTenantTx: InTenantTx,
  organizationId: string,
  publish: (event: InboundEvent) => Promise<void>,
  limit = 100,
): Promise<{ published: number; failed: number }> {
  let published = 0
  let failed = 0
  const pending = await inTenantTx(organizationId, async (tx: RLSTx) => rowsOf<{ id: string; event_type: string; payload: InboundEvent['payload'] }>(await tx.execute(sql`
    SELECT id::text, event_type, payload FROM ue_integration_outbox
    WHERE organization_id = ${organizationId}::uuid AND published_at IS NULL
    ORDER BY created_at, id LIMIT ${limit}`)))
  for (const row of pending) {
    try {
      // Locked and re-checked: two publishers never both publish the same event.
      const sent = await inTenantTx(organizationId, async (tx: RLSTx) => {
        const [locked] = rowsOf<{ id: string }>(await tx.execute(sql`
          SELECT id::text FROM ue_integration_outbox WHERE id = ${row.id}::uuid AND published_at IS NULL FOR UPDATE SKIP LOCKED`))
        if (!locked) return false
        await publish({ id: row.id, organizationId, eventType: row.event_type, payload: row.payload })
        await tx.execute(sql`UPDATE ue_integration_outbox SET published_at = now() WHERE id = ${row.id}::uuid`)
        return true
      })
      if (sent) published += 1
    } catch {
      failed += 1
    }
  }
  return { published, failed }
}
