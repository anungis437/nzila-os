/**
 * G12 contract: audit action constants and adapter source must not embed
 * obvious PII field names in emitted payload shapes.
 *
 * Does not prove live collector delivery (NOT_PROVEN).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const FORBIDDEN_PAYLOAD_KEYS = [
  'email',
  'phone',
  'sin',
  'ssn',
  'dateOfBirth',
  'homeAddress',
  'fullName',
]

describe('G12 telemetry contract (LOCAL_TESTED / NOT live)', () => {
  it('audit adapter source avoids forbidden PII payload keys', () => {
    const src = readFileSync(join(ROOT, 'apps/platform-admin/lib/sage/audit-adapter.ts'), 'utf8')
    for (const key of FORBIDDEN_PAYLOAD_KEYS) {
      // Allow comments mentioning the prohibition; forbid assignment-like shapes.
      const assign = new RegExp(`\\b${key}\\s*:`, 'i')
      assert.equal(assign.test(src), false, `forbidden payload key ${key}`)
    }
  })

  it('incident procedure document exists and keeps G12 NOT_PROVEN honest', () => {
    const doc = readFileSync(
      join(ROOT, 'docs/public-service/operations/sage-acceptance/G12_INCIDENT_PROCEDURE.md'),
      'utf8',
    )
    assert.match(doc, /NOT_PROVEN/)
    assert.match(doc, /Ack SLA/)
  })
})
