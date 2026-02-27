/**
 * Nzila OS — Integration Control Plane: Audit Event Taxonomy
 *
 * Canonical event types emitted by the integrations subsystem.
 */

export const IntegrationEventTypes = {
  // Config lifecycle
  'integration.config.created': 'integration.config.created',
  'integration.config.updated': 'integration.config.updated',
  'integration.config.deactivated': 'integration.config.deactivated',

  // Delivery lifecycle
  'integration.delivery.queued': 'integration.delivery.queued',
  'integration.delivery.sent': 'integration.delivery.sent',
  'integration.delivery.failed': 'integration.delivery.failed',
  'integration.delivery.dlq': 'integration.delivery.dlq',
  'integration.delivery.replayed': 'integration.delivery.replayed',

  // Health
  'integration.health.checked': 'integration.health.checked',
  'integration.health.degraded': 'integration.health.degraded',
  'integration.health.down': 'integration.health.down',

  // Webhook
  'integration.webhook.created': 'integration.webhook.created',
  'integration.webhook.delivered': 'integration.webhook.delivered',
  'integration.webhook.failed': 'integration.webhook.failed',

  // Circuit breaker
  'integration.circuit.opened': 'integration.circuit.opened',
  'integration.circuit.half_open': 'integration.circuit.half_open',
  'integration.circuit.closed': 'integration.circuit.closed',
  'integration.delivery.blocked_by_circuit': 'integration.delivery.blocked_by_circuit',

  // Rate limiting
  'integration.rate_limited': 'integration.rate_limited',

  // Chaos simulation
  'integration.chaos.toggled': 'integration.chaos.toggled',

  // SLA
  'integration.sla.breach': 'integration.sla.breach',

  // CRM
  'integration.crm.contact.upserted': 'integration.crm.contact.upserted',
  'integration.crm.deal.created': 'integration.crm.deal.created',
  'integration.crm.engagement.logged': 'integration.crm.engagement.logged',
} as const

export type IntegrationEventType = keyof typeof IntegrationEventTypes
