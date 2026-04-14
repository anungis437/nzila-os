/**
 * @nzila/platform-integrations — Identity Linker
 *
 * Manages external ↔ internal identity mappings.
 * Resolves external IDs to internal Nzila entity IDs safely and org-scoped.
 */
import type {
  ExternalIdentityLink,
  CreateIdentityLinkInput,
  ResolveIdentityInput,
  IdentityResolutionResult,
  LinkableEntityType,
} from '@nzila/platform-integrations-types'
import type { IntegrationAuditHooks } from './audit-hooks'

// ─── Identity Link Store Interface ───────────────────────────────────────────

export interface IdentityLinkStore {
  create(input: CreateIdentityLinkInput): Promise<ExternalIdentityLink>
  getById(id: string): Promise<ExternalIdentityLink | null>
  resolve(input: ResolveIdentityInput): Promise<ExternalIdentityLink | null>
  resolveInternal(orgId: string, entityType: LinkableEntityType, internalId: string): Promise<ExternalIdentityLink[]>
  listByConnection(connectionId: string, entityType?: LinkableEntityType): Promise<ExternalIdentityLink[]>
  listByOrg(orgId: string, entityType?: LinkableEntityType): Promise<ExternalIdentityLink[]>
  markStale(id: string): Promise<void>
  delete(id: string): Promise<boolean>
  update(id: string, metadataJson: Record<string, unknown>): Promise<void>
}

// ─── Identity Linker ─────────────────────────────────────────────────────────

export class IdentityLinker {
  private readonly store: IdentityLinkStore
  private readonly auditHooks: IntegrationAuditHooks

  constructor(store: IdentityLinkStore, auditHooks: IntegrationAuditHooks) {
    this.store = store
    this.auditHooks = auditHooks
  }

  /**
   * Create a new external ↔ internal identity link.
   */
  async link(input: CreateIdentityLinkInput, actorId: string): Promise<ExternalIdentityLink> {
    // Check for existing link to prevent duplicates
    const existing = await this.store.resolve({
      orgId: input.orgId,
      entityType: input.entityType,
      externalId: input.externalId,
      externalSystem: input.externalSystem,
    })

    if (existing) {
      // Update metadata if link already exists
      if (input.metadataJson) {
        await this.store.update(existing.id, input.metadataJson)
      }
      return existing
    }

    const link = await this.store.create(input)

    await this.auditHooks.recordIntegrationAction({
      orgId: input.orgId,
      actorId,
      action: 'identity.linked',
      resource: 'external_identity_link',
      resourceId: link.id,
      payload: {
        entityType: input.entityType,
        internalId: input.internalId,
        externalId: input.externalId,
        externalSystem: input.externalSystem,
      },
    })

    return link
  }

  /**
   * Resolve an external ID to an internal Nzila ID.
   */
  async resolve(input: ResolveIdentityInput): Promise<IdentityResolutionResult> {
    const link = await this.store.resolve(input)

    if (!link) {
      return { found: false, internalId: null, link: null, stale: false }
    }

    return {
      found: true,
      internalId: link.internalId,
      link,
      stale: link.staleAt !== null,
    }
  }

  /**
   * Find all external links for an internal entity.
   */
  async findLinksForInternal(
    orgId: string,
    entityType: LinkableEntityType,
    internalId: string,
  ): Promise<ExternalIdentityLink[]> {
    return this.store.resolveInternal(orgId, entityType, internalId)
  }

  /**
   * Mark a link as stale (e.g., external system no longer recognizes the ID).
   */
  async markStale(linkId: string, orgId: string, actorId: string): Promise<void> {
    await this.store.markStale(linkId)

    await this.auditHooks.recordIntegrationAction({
      orgId,
      actorId,
      action: 'identity.marked_stale',
      resource: 'external_identity_link',
      resourceId: linkId,
      payload: {},
    })
  }

  /**
   * Remove an identity link.
   */
  async unlink(linkId: string, orgId: string, actorId: string): Promise<boolean> {
    const result = await this.store.delete(linkId)

    if (result) {
      await this.auditHooks.recordIntegrationAction({
        orgId,
        actorId,
        action: 'identity.unlinked',
        resource: 'external_identity_link',
        resourceId: linkId,
        payload: {},
      })
    }

    return result
  }
}
