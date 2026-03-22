/**
 * Contract Test — Agri Integrations Dispatcher
 *
 * AGRI_INTEGRATIONS_DISPATCHER_ONLY_002:
 *   1. Agri event emitter must exist
 *   2. Event emitter must not directly import third-party HTTP/SMTP/etc. libraries
 *   3. Event types are centralized in agri-events package
 *   4. No hardcoded external URLs in agri event handlers
 *
 * @invariant AGRI_INTEGRATIONS_DISPATCHER_ONLY_002
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')
const EVENT_EMITTER_PATH = join(
  ROOT,
  'apps',
  'agrimo',
  'lib',
  'events',
  'agri-event-emitter.ts',
)

describe('AGRI-INT-01 — Event emitter exists', () => {
  it('agri-event-emitter.ts exists', () => {
    expect(existsSync(EVENT_EMITTER_PATH)).toBe(true)
  })
})

describe('AGRI-INT-02 — No direct HTTP calls from event emitter', () => {
  it('does not import node-fetch, axios, or got', () => {
    if (!existsSync(EVENT_EMITTER_PATH)) return
    const content = readFileSync(EVENT_EMITTER_PATH, 'utf-8')
    expect(content).not.toContain("from 'node-fetch'")
    expect(content).not.toContain("from 'axios'")
    expect(content).not.toContain("from 'got'")
  })

  it('does not contain hardcoded URLs', () => {
    if (!existsSync(EVENT_EMITTER_PATH)) return
    const content = readFileSync(EVENT_EMITTER_PATH, 'utf-8')
    expect(content).not.toMatch(/https?:\/\/[a-zA-Z0-9]/)
  })
})

describe('AGRI-INT-03 — Event types are centralized in agri-events', () => {
  it('event emitter imports AgriEventTypes from @nzila/agri-events', () => {
    if (!existsSync(EVENT_EMITTER_PATH)) return
    const content = readFileSync(EVENT_EMITTER_PATH, 'utf-8')
    expect(content).toContain('@nzila/agri-events')
    expect(content).toContain('AgriEventTypes')
  })
})

describe('AGRI-INT-04 — Agri event types exist in agri-events', () => {
  it('event-types.ts exists in agri-events/src', () => {
    const path = join(ROOT, 'packages', 'agri-events', 'src', 'event-types.ts')
    expect(existsSync(path)).toBe(true)
  })

  it('defines all required event types', () => {
    const path = join(ROOT, 'packages', 'agri-events', 'src', 'event-types.ts')
    const content = readFileSync(path, 'utf-8')
    const required = [
      'HARVEST_RECORDED',
      'LOT_AGGREGATED',
      'LOT_GRADED',
      'QUALITY_INSPECTED',
      'BATCH_CREATED',
      'SHIPMENT_DISPATCHED',
      'SHIPMENT_ARRIVED',
      'PAYMENT_DISBURSED',
      'CERTIFICATION_ISSUED',
    ]
    for (const event of required) {
      expect(content, `Missing event type: ${event}`).toContain(event)
    }
  })
})
