/**
 * Nzila OS — Integration DB: Repository layer
 *
 * Org-scoped repositories for integration configs, deliveries, and DLQ.
 * Accepts a Drizzle DB instance via dependency injection (port pattern).
 */
import type {
  IntegrationConfig,
  IntegrationDelivery,
  DlqEntry,
  IntegrationType,
  IntegrationProvider,
  DeliveryStatus,
  IntegrationStatus,
} from '@nzila/integrations-core'

// ── Ports ───────────────────────────────────────────────────────────────────

export interface IntegrationDbContext {
  readonly orgId: string
  readonly actorId: string
}

export interface IntegrationReadContext {
  readonly orgId: string
}

// ── Config repository port ──────────────────────────────────────────────────

export interface IntegrationConfigRepo {
  create(
    ctx: IntegrationDbContext,
    data: {
      type: IntegrationType
      provider: IntegrationProvider
      credentialsRef: string
      metadata?: Record<string, unknown>
    },
  ): Promise<IntegrationConfig>

  findById(ctx: IntegrationReadContext, id: string): Promise<IntegrationConfig | null>

  findByOrgAndProvider(
    ctx: IntegrationReadContext,
    provider: IntegrationProvider,
  ): Promise<IntegrationConfig | null>

  listByOrg(ctx: IntegrationReadContext): Promise<readonly IntegrationConfig[]>

  updateStatus(
    ctx: IntegrationDbContext,
    id: string,
    status: IntegrationStatus,
  ): Promise<IntegrationConfig | null>

  update(
    ctx: IntegrationDbContext,
    id: string,
    data: {
      credentialsRef?: string
      status?: IntegrationStatus
      metadata?: Record<string, unknown>
    },
  ): Promise<IntegrationConfig | null>
}

// ── Delivery repository port ────────────────────────────────────────────────

export interface IntegrationDeliveryRepo {
  create(
    ctx: IntegrationDbContext,
    data: {
      configId: string
      channel: IntegrationType
      provider: IntegrationProvider
      recipientRef: string
      templateId?: string
      payload: Record<string, unknown>
      correlationId: string
      maxAttempts?: number
    },
  ): Promise<IntegrationDelivery>

  findById(ctx: IntegrationReadContext, id: string): Promise<IntegrationDelivery | null>

  updateStatus(
    ctx: IntegrationDbContext,
    id: string,
    status: DeliveryStatus,
    update?: {
      providerMessageId?: string
      lastError?: string
      attempts?: number
    },
  ): Promise<IntegrationDelivery | null>

  listByOrg(
    ctx: IntegrationReadContext,
    filters?: {
      provider?: IntegrationProvider
      channel?: IntegrationType
      status?: DeliveryStatus
      limit?: number
      offset?: number
    },
  ): Promise<readonly IntegrationDelivery[]>

  countByOrg(
    ctx: IntegrationReadContext,
    filters?: {
      provider?: IntegrationProvider
      status?: DeliveryStatus
    },
  ): Promise<number>
}

// ── DLQ repository port ─────────────────────────────────────────────────────

export interface IntegrationDlqRepo {
  enqueue(
    ctx: IntegrationDbContext,
    data: {
      deliveryId: string
      provider: IntegrationProvider
      channel: IntegrationType
      lastError: string
      payload: Record<string, unknown>
      attempts: number
    },
  ): Promise<DlqEntry>

  findById(ctx: IntegrationReadContext, id: string): Promise<DlqEntry | null>

  listByOrg(
    ctx: IntegrationReadContext,
    filters?: { provider?: IntegrationProvider; limit?: number; offset?: number },
  ): Promise<readonly DlqEntry[]>

  markReplayed(ctx: IntegrationDbContext, id: string): Promise<DlqEntry | null>
}
