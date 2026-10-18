import { db, flowDomainEvents, flowPayments } from '@nzila/db'
import { sql, eq } from 'drizzle-orm'

export async function countAuditEvents() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(flowDomainEvents)
  return row?.count ?? 0
}

export async function countPaymentGateBlocks() {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(flowPayments)
    .where(eq(flowPayments.status, 'overdue'))
  return row?.count ?? 0
}
