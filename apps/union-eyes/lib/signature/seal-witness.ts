/**
 * The seal records kept in the platform audit log, read back.
 *
 * SignatureService seal() repeats the chain head in the platform's own audit log (canonical ledger or legacy table, whichever the
 * deployment writes). Until now nothing read it back, so a trail whose newest events had been removed still verified. This returns what
 * was recorded, for the integrity statement to check the trail against. Only the head and the event count are read, never other details.
 */
import { sql } from 'drizzle-orm'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import type { RLSTx } from '@/lib/db/with-rls-context'
import type { ChainWitness } from './audit-chain'

export const SEAL_AUDIT_ACTION = 'signature.document.sealed'

type WitnessRow = { chain_head: string | null; chained_events: string | number | null }

// postgres-js (the application driver) returns the rows themselves; node-postgres and PGlite wrap them.
const rowsOf = (result: unknown): WitnessRow[] => (Array.isArray(result) ? result : ((result as { rows?: WitnessRow[] }).rows ?? [])) as WitnessRow[]

const toWitness = (row: WitnessRow): ChainWitness | null => {
  const events = Number(row.chained_events)
  return typeof row.chain_head === 'string' && row.chain_head.length > 0 && Number.isInteger(events) && events > 0 ? { head: row.chain_head, events } : null
}

export async function readSealWitnesses(tx: RLSTx, organizationId: string, documentId: string): Promise<ChainWitness[]> {
  const legacy = rowsOf(await tx.execute(
    sql`SELECT metadata->>'chainHead' AS chain_head, metadata->>'chainedEvents' AS chained_events
        FROM audit_security.audit_logs
        WHERE organization_id = ${organizationId}::uuid AND action = ${SEAL_AUDIT_ACTION} AND resource_id = ${documentId}::uuid`,
  ))
  const witnesses = legacy.map(toWitness)
  if (currentStateContextEnabled()) {
    const canonical = rowsOf(await tx.execute(
      sql`SELECT details->>'chainHead' AS chain_head, details->>'chainedEvents' AS chained_events
          FROM public.audit_logs
          WHERE organization_id = ${organizationId}::uuid AND action = ${SEAL_AUDIT_ACTION} AND resource_id = ${documentId}`,
    ))
    witnesses.push(...canonical.map(toWitness))
  }
  return witnesses.filter((witness): witness is ChainWitness => witness !== null)
}
