/**
 * CLC Executive Intelligence — Snapshot Persistence
 *
 * Stores and retrieves executive intelligence snapshots for
 * delta comparison between review cycles. Backed by a PostgreSQL
 * JSON column via Drizzle raw SQL. Includes 30-snapshot retention
 * policy per organization.
 *
 * Gracefully returns null when the table does not yet exist,
 * allowing the pipeline to run without persistence on first deploy.
 *
 * @module lib/clc/executive-snapshot-store
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import type { ExecutiveSnapshot } from '@nzila/clc-executive-intelligence';

const MAX_SNAPSHOTS_PER_ORG = 30;

// ── Save Snapshot ───────────────────────────────────────────────────────────

/**
 * Persist an executive intelligence snapshot for the given organization.
 * Enforces a retention policy of MAX_SNAPSHOTS_PER_ORG snapshots.
 * Silently no-ops if the backing table does not exist.
 */
export async function saveExecutiveSnapshot(
  organizationId: string,
  snapshot: ExecutiveSnapshot,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO clc_executive_snapshots (id, organization_id, snapshot_data, generated_at)
      VALUES (
        ${snapshot.id},
        ${organizationId},
        ${JSON.stringify(snapshot)}::jsonb,
        ${snapshot.generatedAt}::timestamptz
      )
    `);

    // Enforce retention policy: delete oldest snapshots beyond limit
    await db.execute(sql`
      DELETE FROM clc_executive_snapshots
      WHERE organization_id = ${organizationId}
        AND id NOT IN (
          SELECT id FROM clc_executive_snapshots
          WHERE organization_id = ${organizationId}
          ORDER BY generated_at DESC
          LIMIT ${MAX_SNAPSHOTS_PER_ORG}
        )
    `);
  } catch {
    // Table may not exist yet — graceful degradation
  }
}

// ── Load Latest Snapshot ────────────────────────────────────────────────────

/**
 * Load the most recent executive snapshot for the given organization.
 * Returns null if no snapshot exists or the table is not yet created.
 */
export async function loadLatestExecutiveSnapshot(
  organizationId: string,
): Promise<ExecutiveSnapshot | null> {
  try {
    const rows = await db.execute(sql`
      SELECT snapshot_data
      FROM clc_executive_snapshots
      WHERE organization_id = ${organizationId}
      ORDER BY generated_at DESC
      LIMIT 1
    `);

    const row = rows[0] as { snapshot_data?: unknown } | undefined;
    if (!row?.snapshot_data) return null;

    return row.snapshot_data as ExecutiveSnapshot;
  } catch {
    // Table may not exist yet — graceful degradation
    return null;
  }
}
