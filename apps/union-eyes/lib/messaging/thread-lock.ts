import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'

/** Shared by privacy responses, posts and reassignment; no thread row-lock privilege is needed. */
export async function lockPrivacyThread(tx: RLSTx, organizationId: string, threadId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy:thread:${organizationId.toLowerCase()}:${threadId.toLowerCase()}`},0))`)
}
