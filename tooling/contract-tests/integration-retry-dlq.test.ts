/**
 * Contract Test — Integration Retry + DLQ
 *
 * Structural invariant: Every failed delivery MUST be retried
 * and then moved to the DLQ if all retries are exhausted.
 * The retry engine must exist and the DLQ table must be defined.
 *
 * @invariant INTEGRATION_RETRY_DLQ_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('INTEGRATION_RETRY_DLQ_001 — Failed deliveries retry then DLQ', () => {
  // ── Retry engine ────────────────────────────────────────────────────────

  it('retry module exists in integrations-runtime', () => {
    const retryPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'retry.ts')
    expect(existsSync(retryPath), 'retry.ts must exist').toBe(true)
  })

  it('retry module exports withRetry function', () => {
    const retryPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'retry.ts')
    const content = readFileSync(retryPath, 'utf-8')

    expect(content).toContain('export')
    expect(content).toContain('withRetry')
    expect(content).toContain('maxAttempts')
  })

  it('retry module implements exponential backoff', () => {
    const retryPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'retry.ts')
    const content = readFileSync(retryPath, 'utf-8')

    expect(
      content.includes('Math.pow') || content.includes('**'),
      'Retry must implement exponential backoff'
    ).toBe(true)
    expect(content).toContain('baseDelayMs')
    expect(content).toContain('maxDelayMs')
  })

  it('retry module has unit tests', () => {
    const testPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'retry.test.ts')
    expect(existsSync(testPath), 'retry.test.ts must exist').toBe(true)
  })

  // ── DLQ infrastructure ─────────────────────────────────────────────────

  it('integration_dlq table is defined in schema', () => {
    const schemaPath = join(ROOT, 'packages', 'integrations-db', 'src', 'schema.ts')
    expect(existsSync(schemaPath), 'integrations-db schema must exist').toBe(true)

    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('integration_dlq')
    expect(content).toContain('delivery_id')
    expect(content).toContain('last_error')
    expect(content).toContain('replayed_at')
  })

  it('DLQ repo port is defined', () => {
    const reposPath = join(ROOT, 'packages', 'integrations-db', 'src', 'repos.ts')
    expect(existsSync(reposPath), 'integrations-db repos must exist').toBe(true)

    const content = readFileSync(reposPath, 'utf-8')
    expect(content).toContain('IntegrationDlqRepo')
    expect(content).toContain('enqueue')
    expect(content).toContain('markReplayed')
  })

  // ── Dispatcher wires retry + DLQ ────────────────────────────────────────

  it('dispatcher imports and uses retry mechanism', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    expect(existsSync(dispatcherPath), 'dispatcher.ts must exist').toBe(true)

    const content = readFileSync(dispatcherPath, 'utf-8')
    expect(
      content.includes('withRetry') || content.includes('retry'),
      'Dispatcher must use retry mechanism'
    ).toBe(true)
  })

  it('dispatcher enqueues to DLQ on exhausted retries', () => {
    const dispatcherPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.ts')
    const content = readFileSync(dispatcherPath, 'utf-8')

    expect(
      content.includes('enqueueDlq') || content.includes('dlq'),
      'Dispatcher must enqueue to DLQ when retries exhausted'
    ).toBe(true)
  })

  it('dispatcher has unit tests covering retry + DLQ flow', () => {
    const testPath = join(ROOT, 'packages', 'integrations-runtime', 'src', 'dispatcher.test.ts')
    expect(existsSync(testPath), 'dispatcher.test.ts must exist').toBe(true)

    const content = readFileSync(testPath, 'utf-8')
    expect(
      content.includes('dlq') || content.includes('DLQ'),
      'Dispatcher tests must cover DLQ path'
    ).toBe(true)
  })

  // ── Webhook retry ───────────────────────────────────────────────────────

  it('outbound webhooks implement retry with attempt tracking', () => {
    const outboundPath = join(ROOT, 'packages', 'webhooks', 'src', 'outbound.ts')
    expect(existsSync(outboundPath), 'outbound.ts must exist').toBe(true)

    const content = readFileSync(outboundPath, 'utf-8')
    expect(content).toContain('maxAttempts')
    expect(content).toContain('attemptNumber')
    expect(content).toContain('recordAttempt')
  })

  // ── Delivery status lifecycle ───────────────────────────────────────────

  it('delivery status enum includes all lifecycle states', () => {
    const schemaPath = join(ROOT, 'packages', 'integrations-db', 'src', 'schema.ts')
    const content = readFileSync(schemaPath, 'utf-8')

    expect(content).toContain("'queued'")
    expect(content).toContain("'sent'")
    expect(content).toContain("'failed'")
    expect(content).toContain("'dlq'")
  })

  it('integrations-core types define DeliveryStatus with all states', () => {
    const typesPath = join(ROOT, 'packages', 'integrations-core', 'src', 'types.ts')
    const content = readFileSync(typesPath, 'utf-8')

    expect(content).toContain('DeliveryStatus')
    expect(content).toContain("'queued'")
    expect(content).toContain("'sent'")
    expect(content).toContain("'failed'")
    expect(content).toContain("'dlq'")
  })
})
