/**
 * The platform (Nzila) organization in the Authority Kernel.
 *
 * Platform-wide work (creating a tenant, reading every tenant's directory or figures) is authority over every customer
 * organization, so no customer organization's officers may confer it (./capacity.ts). It is conferred only inside the
 * platform pseudo-organization `PLATFORM_ORGANIZATION_ID` (the existing system sentinel), by the same governed kernel every
 * other mandate uses: an issuance rule drafted by a platform executive, adopted by two independent platform executives
 * under a named institutional instrument, activated, then a per-person, time-bound, independently approved and accepted
 * `platform_staff` mandate for staff. The platform owner holds standing authority through an `executive` membership in the platform
 * organization, which they create once (lib/platform/platform-staff.ts; the owner decision is recorded in
 * docs/union-eyes/convergence/decisions/platform-staff-mandate-decision-record.md).
 */
import type { Capacity } from './ontology'

/** The platform pseudo-organization. Equal to `UE_SYSTEM_ORG_ID` (lib/ai/ai-client.ts), pinned by a test. */
export const PLATFORM_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Membership roles inside the platform organization, and only there. A customer-organization role confers nothing here, and
 * these entries confer nothing in a customer organization: `executive` is absent from the customer table on purpose.
 */
export const PLATFORM_ORGANIZATION_ROLE_CAPACITIES: Readonly<Record<string, readonly Capacity[]>> = {
  executive: ['member', 'executive'],
  officer: ['member', 'officer'],
}

/** Every action a platform_staff mandate can carry. A mandate names the exact subset its holder may perform. */
export const PLATFORM_CAPABILITIES = [
  'platform.user_directory.read',
  'platform.member_activity.read',
  'platform.stats.read',
  'platform.pilot_fixture.manage',
  'platform.pilot.manage',
  'platform.organization_directory.read',
  'platform.database_health.read',
  'platform.database.maintain',
  'platform.feature_flags.manage',
  'platform.jobs.manage',
  'platform.email_suppressions.manage',
  'platform.user_directory.manage',
  'platform.document_backfill.manage',
  'platform.ai_cache.manage',
  'platform.organization.manage',
  'platform.icra_review.manage',
  'platform.queue.read',
  'platform.auth_diagnostics.run',
  'platform.marketing_content.publish',
  'platform.cba_dataset.curate',
] as const
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number]

export const isPlatformOrganization = (organizationId: string | null | undefined): boolean =>
  typeof organizationId === 'string' && organizationId.toLowerCase() === PLATFORM_ORGANIZATION_ID
