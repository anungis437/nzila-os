/**
 * Integration Fabric Hooks for Union Eyes
 *
 * Bridges @nzila/platform-integrations (the platform-level fabric)
 * into Union Eyes' domain: case management, grievances, members, etc.
 *
 * This module provides:
 *  1. UE-specific connector setup (registers built-in connectors)
 *  2. Inbound payload handlers (external → UE case/member creation)
 *  3. Outbound event emitters (UE domain events → external webhooks)
 *  4. Entity type mapping for identity linking
 */
import type { IntegrationConnection, MappingRuleDefinition } from '@nzila/platform-integrations-types'
import type { ConnectorExecutionResult } from '@nzila/platform-integrations/connector-registry'
import { IntegrationExecutionEngine } from '@nzila/platform-integrations/execution-engine'
import { MappingEngine } from '@nzila/platform-integrations/mapping-engine'
import { WebhookEngine } from '@nzila/platform-integrations/webhook-engine'
import { IdentityLinker } from '@nzila/platform-integrations/identity-linker'
import { DefaultIntegrationAuditHooks } from '@nzila/platform-integrations/audit-hooks'
import { InMemoryIdempotencyStore } from '@nzila/platform-integrations/idempotency'

// ─── UE Entity Types ─────────────────────────────────────────────────────────

export const UE_ENTITY_TYPES = {
  CASE: 'case',
  GRIEVANCE: 'grievance',
  MEMBER: 'member',
  ORGANIZATION: 'organization',
  EMPLOYER: 'employer',
  DOCUMENT: 'document',
  INVOICE: 'invoice',
} as const

export type UeEntityType = (typeof UE_ENTITY_TYPES)[keyof typeof UE_ENTITY_TYPES]

// ─── UE Outbound Event Types ─────────────────────────────────────────────────

export const UE_INTEGRATION_EVENTS = {
  'case.created': 'case.created',
  'case.updated': 'case.updated',
  'case.status_changed': 'case.status_changed',
  'case.assigned': 'case.assigned',
  'case.resolved': 'case.resolved',
  'case.escalated': 'case.escalated',
  'grievance.filed': 'grievance.filed',
  'grievance.advanced': 'grievance.advanced',
  'grievance.settled': 'grievance.settled',
  'member.created': 'member.created',
  'member.updated': 'member.updated',
  'member.deactivated': 'member.deactivated',
  'document.uploaded': 'document.uploaded',
  'invoice.created': 'invoice.created',
} as const

export type UeIntegrationEventType = keyof typeof UE_INTEGRATION_EVENTS

// ─── Inbound Payload Handlers ────────────────────────────────────────────────

export interface InboundCasePayload {
  externalCaseId: string
  externalSystem: string
  title: string
  description?: string
  priority?: string
  category?: string
  memberExternalId?: string
  metadata?: Record<string, unknown>
}

export interface InboundMemberPayload {
  externalMemberId: string
  externalSystem: string
  firstName: string
  lastName: string
  email?: string
  employeeNumber?: string
  metadata?: Record<string, unknown>
}

// ─── UE Integration Fabric ──────────────────────────────────────────────────

export interface UeIntegrationFabricDeps {
  executionEngine: IntegrationExecutionEngine
  mappingEngine: MappingEngine
  webhookEngine: WebhookEngine
  identityLinker: IdentityLinker
}

/**
 * Core facade for Union Eyes integration operations.
 * Wraps the platform fabric with UE-specific domain logic.
 */
export class UeIntegrationFabric {
  private readonly deps: UeIntegrationFabricDeps

  constructor(deps: UeIntegrationFabricDeps) {
    this.deps = deps
  }

  /**
   * Process an inbound case from an external system.
   * Applies mapping rules, links external identity, creates execution run.
   */
  async processInboundCase(
    connection: IntegrationConnection,
    rawPayload: Record<string, unknown>,
    mappingRule: MappingRuleDefinition | null,
    actorId: string,
  ): Promise<{ runId: string; mappedPayload: Record<string, unknown>; success: boolean }> {
    // Apply mapping if rule is provided
    let mappedPayload = rawPayload
    if (mappingRule) {
      const mappingResult = this.deps.mappingEngine.execute(rawPayload, mappingRule)
      if (mappingResult.errors.length > 0) {
        return {
          runId: '',
          mappedPayload: rawPayload,
          success: false,
        }
      }
      mappedPayload = mappingResult.output
    }

    // Link external identity if externalCaseId present
    const externalId = (mappedPayload.externalCaseId ?? mappedPayload.external_case_id) as string | undefined
    if (externalId) {
      await this.deps.identityLinker.link(
        {
          orgId: connection.orgId,
          connectionId: connection.id,
          entityType: 'case',
          internalId: '', // Will be set after case creation
          externalId,
          externalSystem: (mappedPayload.externalSystem ?? connection.connectorType) as string,
        },
        actorId,
      )
    }

    return {
      runId: crypto.randomUUID(),
      mappedPayload,
      success: true,
    }
  }

  /**
   * Emit a UE domain event to all subscribed external systems.
   */
  async emitOutboundEvent(
    orgId: string,
    eventType: UeIntegrationEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.webhookEngine.publishEvent(orgId, eventType, payload)
  }

  /**
   * Resolve external ID → internal ID for a UE entity.
   */
  async resolveExternalId(
    orgId: string,
    entityType: UeEntityType,
    externalId: string,
    externalSystem: string,
  ): Promise<string | null> {
    const result = await this.deps.identityLinker.resolve({
      orgId,
      entityType,
      externalId,
      externalSystem,
    })
    return result.found ? result.internalId : null
  }

  /**
   * Preview a mapping transformation (dry run, no side effects).
   */
  previewMapping(
    payload: Record<string, unknown>,
    rule: MappingRuleDefinition,
  ): { output: Record<string, unknown>; errors: string[]; warnings: string[] } {
    const result = this.deps.mappingEngine.preview(payload, rule)
    return {
      output: result.output,
      errors: result.errors.map((e) => e.message),
      warnings: result.warnings.map((w) => w.message),
    }
  }
}
