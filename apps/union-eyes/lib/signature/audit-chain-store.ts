/**
 * Reads and extends a signature document's audit chain on the executor the caller is working on.
 *
 * New events of one document are serialized by a transaction-scoped advisory lock, so two events logged at once cannot both take the
 * same sequence number and fork the chain. The lock is held to the end of the transaction the event is written in.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { signatureAuditTrail } from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import type { StoredChainRow } from './audit-chain'

type Executor = RLSTx | typeof db

export async function nextChainLink(exec: Executor, documentId: string): Promise<{ seq: number; previousHash: string | null }> {
  await exec.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`signature_audit:${documentId}`}, 0))`)
  const [tail] = await exec
    .select({ hashChain: signatureAuditTrail.hashChain, metadata: signatureAuditTrail.metadata })
    .from(signatureAuditTrail)
    .where(and(eq(signatureAuditTrail.documentId, documentId), sql`(${signatureAuditTrail.metadata}->>'chainSeq') IS NOT NULL`))
    .orderBy(desc(sql`(${signatureAuditTrail.metadata}->>'chainSeq')::int`))
    .limit(1)
  const seq = Number((tail?.metadata as { chainSeq?: unknown } | null | undefined)?.chainSeq ?? 0)
  return { seq: seq + 1, previousHash: tail?.hashChain ?? null }
}

export async function loadChainRows(exec: Executor, documentId: string): Promise<StoredChainRow[]> {
  const rows = await exec.select().from(signatureAuditTrail).where(eq(signatureAuditTrail.documentId, documentId))
  return rows.map((row) => ({
    documentId: row.documentId,
    signerId: row.signerId,
    eventType: row.eventType,
    eventDescription: row.eventDescription,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    geolocation: row.geolocation,
    metadata: row.metadata as Record<string, unknown> | null,
    hashChain: row.hashChain,
  }))
}
