/**
 * CourtLens tenant resolver — Phase 2B.
 *
 * Maps a public-facing tenant slug to an internal orgId.
 * Used by public intake to resolve tenant scope server-side so callers
 * never need to know or pass raw orgIds in public requests.
 *
 * ## Phase 2B design decision: tenantSlug === orgId
 *
 * The `abr_organizations` table has no dedicated `slug` column.
 * ABR org IDs are already slug-style strings (e.g., `metro-university`).
 * Phase 2B treats the org ID as the canonical public slug.
 *
 * Phase 3+ migration path: add `slug text UNIQUE` column to
 * `abr_organizations` to decouple public URLs from internal IDs and
 * support org renames without breaking intake links.
 *
 * ## Error behavior
 *
 * `TenantNotFoundError` uses a generic message that does not confirm
 * whether the slug exists, is inactive, or has a different problem.
 * This prevents enumeration of registered tenants.
 */

import { db } from '@nzila/db';
import { sql } from 'drizzle-orm';
import { DEMO_ORGS } from '@/modules/incidents/demo-seed';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantRecord {
  /** Internal org identifier. Equal to slug in Phase 2B. */
  orgId: string;
  /** Org name — used for audit logging only, never in public response. */
  name: string;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class TenantNotFoundError extends Error {
  constructor(public readonly slug: string) {
    // Generic message — does not confirm whether the org exists.
    super('Tenant not found or intake is not available for this organisation.');
    this.name = 'TenantNotFoundError';
  }
}

// ── Slug validation ───────────────────────────────────────────────────────────
// Same regex as resolveOrgContext (lib/org-context.ts) for consistency.
// Validated at format level before any org lookup is attempted.

const SLUG_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/;

export function isValidTenantSlug(slug: string): boolean {
  return typeof slug === 'string' && SLUG_REGEX.test(slug);
}

// ── DB helper ─────────────────────────────────────────────────────────────────

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve a tenant slug to an org record.
 *
 * Throws `TenantNotFoundError` if:
 * - slug is empty or malformed
 * - no organisation with that ID exists in the registry
 *
 * In DB mode: queries `abr_organizations` by primary key.
 * In in-memory/demo mode: checks against known demo org IDs.
 *
 * Phase 2B: slug === orgId. See module doc for Phase 3+ migration note.
 */
export async function resolveTenantSlug(slug: string): Promise<TenantRecord> {
  if (!isValidTenantSlug(slug)) {
    throw new TenantNotFoundError(slug);
  }

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT id, name
      FROM abr_organizations
      WHERE id = ${slug}
      LIMIT 1
    `)) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      throw new TenantNotFoundError(slug);
    }

    return {
      orgId: String(rows[0].id),
      name: String(rows[0].name),
    };
  }

  // In-memory/demo mode: only registered demo orgs are resolvable.
  const org = DEMO_ORGS.find((o) => o.id === slug);
  if (!org) {
    throw new TenantNotFoundError(slug);
  }

  return { orgId: org.id, name: org.name };
}
