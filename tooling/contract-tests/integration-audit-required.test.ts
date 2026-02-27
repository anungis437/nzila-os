/**
 * Contract Test — Integration Audit Required
 *
 * Structural invariant: The integration dispatcher MUST emit audit
 * events for every delivery lifecycle transition (queued, sent, failed, dlq).
 * The event taxonomy must be defined in integrations-core.
 *
 * @invariant INTEGRATION_AUDIT_REQUIRED_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Required audit event types ──────────────────────────────────────────────

const requiredAuditEvents = [
  'integration.delivery.queued',
  'integration.delivery.sent',
  'integration.delivery.failed',
  'integration.delivery.dlq',
]

const requiredWebhookAuditEvents = [
  'integration.webhook.delivered',
  'integration.webhook.failed',
]

// ── Tests ───────────────────────────────────────────────────────────────────

describe('INTEGRATION_AUDIT_REQUIRED_001 — Every send emits audit events', () => {
  it('integrations-core defines all required audit event types', () => {
    const eventsPath = join(ROOT, 'packages', 'integrations-core', 'src', 'events.ts')
    expect(existsSync(eventsPath), 'integrations-core/src/events.ts must exist').toBe(true)

    const content = readFileSync(eventsPath, 'utf-8')

    for (const event of requiredAuditEvents) {
      expect(
        content.includes(event),
        `Event '${event}' must be defined in events.ts taxonomy`
      ).toBe(true)
    }
  })

  it('dispatcher emits queued event before sending', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    expect(existsSync(dispatcherPath), 'dispatcher.ts must exist').toBe(true)

    const content = readFileSync(dispatcherPath, 'utf-8')

    // Must emit queued event
    expect(
      content.includes('delivery.queued'),
      'Dispatcher must emit delivery.queued audit event'
    ).toBe(true)

    // Must call audit emitter
    expect(
      content.includes('emitAudit') || content.includes('emit'),
      'Dispatcher must call audit emission function'
    ).toBe(true)
  })

  it('dispatcher emits sent event on success', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    const content = readFileSync(dispatcherPath, 'utf-8')

    expect(
      content.includes('delivery.sent'),
      'Dispatcher must emit delivery.sent audit event'
    ).toBe(true)
  })

  it('dispatcher emits failed + dlq events on failure', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    const content = readFileSync(dispatcherPath, 'utf-8')

    expect(
      content.includes('delivery.failed'),
      'Dispatcher must emit delivery.failed audit event'
    ).toBe(true)
    expect(
      content.includes('delivery.dlq'),
      'Dispatcher must emit delivery.dlq audit event'
    ).toBe(true)
  })

  it('dispatcher records delivery to database', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    const content = readFileSync(dispatcherPath, 'utf-8')

    // Must interact with delivery repository
    expect(
      content.includes('recordDelivery') || content.includes('deliveryRepo'),
      'Dispatcher must record deliveries to the database'
    ).toBe(true)
  })

  it('webhooks outbound emits audit events for webhook deliveries', () => {
    const outboundPath = join(ROOT, 'packages', 'webhooks', 'src', 'outbound.ts')
    expect(existsSync(outboundPath), 'webhooks/src/outbound.ts must exist').toBe(true)

    const content = readFileSync(outboundPath, 'utf-8')

    for (const event of requiredWebhookAuditEvents) {
      expect(
        content.includes(event),
        `Outbound webhook dispatcher must emit '${event}'`
      ).toBe(true)
    }
  })

  it('integrations-core event taxonomy includes all lifecycle events', () => {
    const eventsPath = join(ROOT, 'packages', 'integrations-core', 'src', 'events.ts')
    const content = readFileSync(eventsPath, 'utf-8')

    // Must export event types object
    expect(content).toContain('IntegrationEventTypes')

    // Must include config lifecycle
    expect(content).toContain('config.created')
    expect(content).toContain('config.updated')

    // Must include health events
    expect(content).toContain('health.checked')

    // Must include delivery lifecycle
    expect(content).toContain('delivery.queued')
    expect(content).toContain('delivery.sent')
    expect(content).toContain('delivery.failed')
    expect(content).toContain('delivery.dlq')
  })
})
