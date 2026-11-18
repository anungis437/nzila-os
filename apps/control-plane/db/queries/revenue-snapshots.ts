import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'

export async function countTypeSince(type: string, intervalDays: number): Promise<number> {
  try {
    const rows = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (rows[0] as { cnt: number } | undefined)?.cnt ?? 0
  } catch {
    return 0
  }
}

export async function sumMrrForTypeSince(type: string, intervalDays: number): Promise<number> {
  try {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM((payload->>'mrrUsd')::numeric), 0)::int AS mrr
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (rows[0] as { mrr: number } | undefined)?.mrr ?? 0
  } catch {
    return 0
  }
}

export async function queryEventCount(type: string, intervalDays = 90): Promise<number> {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = ${type}
            AND created_at > NOW() - (${intervalDays} || ' days')::interval`,
    )
    return (result[0] as { cnt: number })?.cnt ?? 0
  } catch {
    return 0
  }
}

export async function queryLeadsBySource(
  intervalDays = 90,
): Promise<Array<{ source: string; count: number }>> {
  try {
    const rows = await db.execute(
      sql`SELECT
            payload->>'source' AS source,
            COUNT(*)::int AS cnt
          FROM platform_events
          WHERE type = 'commercial.lead.created'
            AND created_at > NOW() - (${intervalDays} || ' days')::interval
          GROUP BY payload->>'source'
          ORDER BY cnt DESC`,
    )
    return (rows as unknown as Array<{ source: string; cnt: number }>).map((row) => ({
      source: row.source ?? 'unknown',
      count: row.cnt,
    }))
  } catch {
    return []
  }
}
