/**
 * Integration Fabric Hooks for UnionEyes
 *
 * Bridges @nzila/platform-integrations (the platform-level fabric)
 * into UnionEyes' domain: case management, grievances, members, etc.
 *
 * This module provides:
 *  1. UE-specific connector setup (registers built-in connectors)
 *  2. Inbound payload handlers (external → UE case/member creation)
 *  3. Outbound event emitters (UE domain events → external webhooks)
 *  4. Entity type mapping for identity linking
 */
import type { IntegrationConnection, MappingRuleDefinition } from '@nzila/platform-integrations-types'
import { IntegrationExecutionEngine } from '@nzila/platform-integrations/execution-engine'
import { MappingEngine } from '@nzila/platform-integrations/mapping-engine'
import { WebhookEngine } from '@nzila/platform-integrations/webhook-engine'
import { IdentityLinker } from '@nzila/platform-integrations/identity-linker'
import type { DurableInboundCaseExecutor, InboundDelivery, InboundOutcome } from './inbound/durable-inbound-executor'

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
  /** The durable inbound path (lib/integrations/inbound). Absent: inbound cases are refused, never faked. */
  inboundCaseExecutor?: Pick<DurableInboundCaseExecutor, 'execute'>
}

/**
 * Core facade for UnionEyes integration operations.
 * Wraps the platform fabric with UE-specific domain logic.
 */
export class UeIntegrationFabric {
  private readonly deps: UeIntegrationFabricDeps

  constructor(deps: UeIntegrationFabricDeps) {
    this.deps = deps
  }

  /**
   * Process an inbound case from an external system.
   * Maps for inspection only; durable inbound case execution is not wired.
   */
  async processInboundCase(
    _connection: IntegrationConnection,
    rawPayload: Record<string, unknown>,
    mappingRule: MappingRuleDefinition | null,
    _actorId: string,
  ): Promise<{ runId: string; mappedPayload: Record<string, unknown>; success: boolean; reason?: 'MAPPING_REJECTED' | 'INBOUND_PERSISTENCE_NOT_CONFIGURED' }> {
    // Apply mapping if rule is provided
    let mappedPayload = rawPayload
    if (mappingRule) {
      const mappingResult = this.deps.mappingEngine.execute(rawPayload, mappingRule)
      if (mappingResult.errors.length > 0) {
        return {
          runId: '',
          mappedPayload: rawPayload,
          success: false,
          reason: 'MAPPING_REJECTED',
        }
      }
      mappedPayload = mappingResult.output
    }

    // No authorized domain writer or durable receipt is wired here.
    // Mapping alone cannot create a case or an external identity link.
    return {
      runId: '',
      mappedPayload,
      success: false,
      reason: 'INBOUND_PERSISTENCE_NOT_CONFIGURED',
    }
  }

  /**
   * Execute an inbound case durably: authorized source, claim, versioned mapping, validation, identity reconciliation,
   * case write with audit, receipt and outbox event in one transaction. Without a configured executor it refuses.
   */
  async executeInboundCase(delivery: InboundDelivery): Promise<InboundOutcome | { kind: 'unavailable'; code: 'INBOUND_PERSISTENCE_NOT_CONFIGURED'; persisted: false }> {
    if (!this.deps.inboundCaseExecutor) return { kind: 'unavailable', code: 'INBOUND_PERSISTENCE_NOT_CONFIGURED', persisted: false }
    return this.deps.inboundCaseExecutor.execute(delivery)
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
    return result.found && !result.stale && result.internalId?.trim() ? result.internalId : null
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
