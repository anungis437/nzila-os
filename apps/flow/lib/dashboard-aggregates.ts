/**
 * Flow dashboard aggregate queries.
 *
 * Lives under `apps/flow/lib/` (exempt in db-boundary contract test) so that
 * page-level callers stay free of direct `@nzila/db` imports.
 *
 * Each function takes an explicit `orgId` and applies it as a `WHERE` clause —
 * org isolation is enforced by the caller passing the orgId resolved from the
 * authenticated read context.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, commerceQuoteLines, commerceQuotes } from '@nzila/db'

export interface QuoteOutcomeCounts {
  won: number
  lost: number
}

export async function getQuoteOutcomeCounts(orgId: string): Promise<QuoteOutcomeCounts> {
  const [wonRow, lostRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceQuotes)
      .where(and(eq(commerceQuotes.orgId, orgId), eq(commerceQuotes.status, 'accepted'))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(commerceQuotes)
      .where(
        and(
          eq(commerceQuotes.orgId, orgId),
          inArray(commerceQuotes.status, ['declined', 'expired', 'cancelled']),
        ),
      ),
  ])

  return {
    won: Number(wonRow[0]?.count ?? 0),
    lost: Number(lostRow[0]?.count ?? 0),
  }
}

export interface TopWonSkuRow {
  sku: string | null
  units: number
  lineValue: number
}

export async function getTopWonSkus(orgId: string, limit = 5): Promise<TopWonSkuRow[]> {
  return db
    .select({
      sku: commerceQuoteLines.sku,
      units: sql<number>`coalesce(sum(${commerceQuoteLines.quantity}), 0)`,
      lineValue: sql<number>`coalesce(sum(${commerceQuoteLines.lineTotal}), 0)`,
    })
    .from(commerceQuoteLines)
    .innerJoin(commerceQuotes, eq(commerceQuoteLines.quoteId, commerceQuotes.id))
    .where(
      and(
        eq(commerceQuotes.orgId, orgId),
        eq(commerceQuotes.status, 'accepted'),
        sql`${commerceQuoteLines.sku} is not null`,
      ),
    )
    .groupBy(commerceQuoteLines.sku)
    .orderBy(desc(sql`coalesce(sum(${commerceQuoteLines.lineTotal}), 0)`))
    .limit(limit)
}
