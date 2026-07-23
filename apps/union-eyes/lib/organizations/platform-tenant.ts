/**
 * Phase 0B — Platform tenant mapping resolver.
 *
 * This module is the single sanctioned entry point for crossing the boundary
 * between the two schema lineages surfaced by Phase 0B:
 *
 *   (a) Platform lineage  → packages/db/drizzle/*.sql  → creates `orgs`
 *   (b) Application lineage → drizzle-kit push        → creates `organizations`
 *
 * Migration `packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql`
 * added a nullable FK column `organizations.platform_tenant_id uuid` with:
 *
 *   * FK   `organizations_platform_tenant_id_fk`             → orgs(id)
 *   * CHECK `organizations_platform_tenant_id_equals_id`      (same-UUID)
 *   * Partial index on rows where platform_tenant_id IS NOT NULL
 *
 * Every callsite that needs the platform-side identifier for an
 * organizations row MUST go through this module. Direct FK writes are
 * forbidden — the DB CHECK will reject any mismatch, but code paths that
 * silently substitute organizations.id in platform-scoped tables would
 * bypass provisioning (`orgs` row absence → FK violations on downstream
 * tables such as `audit_events`, `pilot_metrics`, `ai_budgets`).
 *
 * Semantics of `platform_tenant_id`:
 *   * NULL      — pure labour-hierarchy entity (federation, district, or
 *                 non-participating union/local). Not present in `orgs`.
 *                 KPI + audit ingestion for this org MUST fail closed.
 *   * NOT NULL  — organization participates in the platform domain. Value
 *                 EQUALS organizations.id (same-UUID contract, enforced
 *                 by CHECK).
 *
 * See:
 *   * reports/audits/cupe-national-phase-0/organization-model-decision.md
 *   * reports/audits/cupe-national-phase-0/organization-model-dependency-map.md
 *
 * @module apps/union-eyes/lib/organizations/platform-tenant
 */

import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { orgs } from '@nzila/db/schema'
import { eq, sql } from 'drizzle-orm'

// ── Errors ──────────────────────────────────────────────────────────────────

/**
 * Raised when a callsite requires a platform-side tenant id for an
 * organization that has none set. Callers MUST treat this as fail-closed:
 * do not fall back to organizations.id, do not substitute the default
 * organization, do not silently no-op. Instead surface the requirement
 * upstream so an operator can either provision the organization onto the
 * platform (via `provisionPlatformParticipant`) or exclude it from the
 * platform-scoped feature entirely.
 */
export class PlatformTenantMappingRequired extends Error {
  readonly code = 'PLATFORM_TENANT_MAPPING_REQUIRED'
  readonly organizationId: string
  constructor(organizationId: string) {
    super(
      `Organization ${organizationId} has no platform_tenant_id set. ` +
        `Either provision it via provisionPlatformParticipant() or route ` +
        `this workflow to a code path that does not require a platform-scoped tenant.`,
    )
    this.name = 'PlatformTenantMappingRequired'
    this.organizationId = organizationId
  }
}

// ── Minimal executor type (matches Drizzle db or a tx handle) ───────────────

type Executor = typeof db

// ── Read paths ──────────────────────────────────────────────────────────────

/**
 * Resolve `platform_tenant_id` for an organizations.id.
 *
 * Returns:
 *   * string — the platform tenant id (always equal to organizationId per
 *     the same-UUID CHECK).
 *   * null   — organizations row exists but is not a platform participant.
 *   * null   — organizations row does not exist at all.
 *
 * Callers that require a platform tenant id must use `requirePlatformTenantId`.
 */
export async function resolvePlatformTenantId(
  organizationId: string,
  tx: Executor = db,
): Promise<string | null> {
  const rows = await tx
    .select({ platformTenantId: sql<string | null>`platform_tenant_id` })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (rows.length === 0) return null
  return rows[0].platformTenantId ?? null
}

/**
 * Resolve `platform_tenant_id` or throw `PlatformTenantMappingRequired`.
 * Use this at boundaries where the workflow cannot proceed without a
 * platform-scoped tenant (KPI ingestion, audit-events emit, ai-budget
 * lookup, pilot metrics, etc.).
 */
export async function requirePlatformTenantId(
  organizationId: string,
  tx: Executor = db,
): Promise<string> {
  const id = await resolvePlatformTenantId(organizationId, tx)
  if (id === null) throw new PlatformTenantMappingRequired(organizationId)
  return id
}

// ── Provisioning path ───────────────────────────────────────────────────────

export interface ProvisionPlatformParticipantInput {
  organizationId: string
  legalName: string
  jurisdiction: string
  policyConfig?: Record<string, unknown>
}

/**
 * Provision the platform-side `orgs` row for an existing organizations row
 * and wire `organizations.platform_tenant_id` to it.
 *
 * Contract:
 *   * The organizations row for `organizationId` MUST exist. If it does
 *     not, this function throws (no silent create — that would violate
 *     the ownership boundary of the application-schema lineage).
 *   * Same-UUID: the `orgs` row is inserted with `id = organizationId`.
 *     Any pre-existing `orgs` row with that id is left untouched
 *     (ON CONFLICT (id) DO NOTHING) — provisioning is fully idempotent.
 *   * `organizations.platform_tenant_id` is set to organizationId. The
 *     DB CHECK enforces the same-UUID invariant; passing anything else
 *     is unreachable through this API.
 *
 * Returns the platform tenant id (== organizationId) on success.
 */
export async function provisionPlatformParticipant(
  input: ProvisionPlatformParticipantInput,
  tx: Executor = db,
): Promise<string> {
  const { organizationId, legalName, jurisdiction, policyConfig } = input

  // (1) Precondition: organizations row must exist.
  const orgRow = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)

  if (orgRow.length === 0) {
    throw new Error(
      `provisionPlatformParticipant: organizations row ${organizationId} does not exist. Create the organization first (application-schema lineage) before provisioning it onto the platform.`,
    )
  }

  // (2) Insert orgs row (idempotent via ON CONFLICT DO NOTHING).
  await tx
    .insert(orgs)
    .values({
      id: organizationId,
      legalName,
      jurisdiction,
      policyConfig: policyConfig ?? {},
      status: 'active',
    })
    .onConflictDoNothing({ target: orgs.id })

  // (3) Wire platform_tenant_id (idempotent — no-op when already set).
  await tx.execute(sql`
    UPDATE ${organizations}
       SET platform_tenant_id = ${organizationId}::uuid
     WHERE id = ${organizationId}::uuid
       AND platform_tenant_id IS NULL
  `)

  return organizationId
}
