/**
 * @nzila/platform-integrations-types — Identity Types
 *
 * Canonical types for external identity linking between
 * internal Nzila entities and external system entities.
 */

// ─── External Identity Link ─────────────────────────────────────────────────

export type LinkableEntityType =
  | 'user'
  | 'case'
  | 'grievance'
  | 'organization'
  | 'member'
  | 'employer'
  | 'document'
  | 'claim'
  | 'agreement'
  | 'custom'

export interface ExternalIdentityLink {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly entityType: LinkableEntityType
  readonly internalId: string
  readonly externalId: string
  readonly externalSystem: string
  readonly metadataJson: Record<string, unknown> | null
  readonly verifiedAt: string | null
  readonly staleAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateIdentityLinkInput {
  readonly orgId: string
  readonly connectionId: string
  readonly entityType: LinkableEntityType
  readonly internalId: string
  readonly externalId: string
  readonly externalSystem: string
  readonly metadataJson?: Record<string, unknown>
}

export interface ResolveIdentityInput {
  readonly orgId: string
  readonly entityType: LinkableEntityType
  readonly externalId: string
  readonly externalSystem: string
}

// ─── Identity Resolution Result ──────────────────────────────────────────────

export interface IdentityResolutionResult {
  readonly found: boolean
  readonly internalId: string | null
  readonly link: ExternalIdentityLink | null
  readonly stale: boolean
}
