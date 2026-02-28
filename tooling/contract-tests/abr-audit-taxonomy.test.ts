/**
 * Contract Test — ABR Audit Taxonomy Parity
 *
 * Ensures ABR audit events conform to platform-form audit standards.
 *
 * @invariant ABR_AUDIT_TAXONOMY_001: ABR taxonomy file exists with required actions
 * @invariant ABR_AUDIT_FIELDS_002: Every event includes orgId, actorId, appId, correlationId
 * @invariant ABR_AUDIT_BUILDER_003: Builder function produces valid events
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

// ── ABR_AUDIT_TAXONOMY_001 ─────────────────────────────────────────────────

describe('ABR_AUDIT_TAXONOMY_001 — ABR audit taxonomy exists and covers required events', () => {
  const taxonomyPath = join(ROOT, 'packages', 'os-core', 'src', 'audit', 'abr.ts')

  it('ABR audit taxonomy file exists', () => {
    expect(existsSync(taxonomyPath), 'packages/os-core/src/audit/abr.ts must exist').toBe(true)
  })

  const REQUIRED_ACTIONS = [
    'abr.case.created',
    'abr.case.updated',
    'abr.case.status_transitioned',
    'abr.export.generated',
    'abr.integration.sent',
  ]

  it('taxonomy includes all required audit actions', () => {
    const content = readContent(taxonomyPath)
    for (const action of REQUIRED_ACTIONS) {
      expect(
        content.includes(`'${action}'`),
        `ABR audit taxonomy missing required action: ${action}`,
      ).toBe(true)
    }
  })

  it('taxonomy exports AbrAuditAction constant', () => {
    const content = readContent(taxonomyPath)
    expect(content).toContain('export const AbrAuditAction')
  })

  it('taxonomy exports AbrAuditEvent interface', () => {
    const content = readContent(taxonomyPath)
    expect(content).toContain('export interface AbrAuditEvent')
  })

  it('taxonomy exports buildAbrAuditEvent function', () => {
    const content = readContent(taxonomyPath)
    expect(content).toContain('export function buildAbrAuditEvent')
  })
})

// ── ABR_AUDIT_FIELDS_002 ──────────────────────────────────────────────────

describe('ABR_AUDIT_FIELDS_002 — AbrAuditEvent includes required traceability fields', () => {
  const taxonomyPath = join(ROOT, 'packages', 'os-core', 'src', 'audit', 'abr.ts')

  const REQUIRED_FIELDS = ['orgId', 'actorId', 'appId', 'correlationId']

  it('AbrAuditEvent interface includes all required traceability fields', () => {
    const content = readContent(taxonomyPath)

    // Extract the interface block
    const interfaceMatch = content.match(
      /export interface AbrAuditEvent\s*\{[\s\S]*?\n\}/,
    )
    expect(interfaceMatch, 'AbrAuditEvent interface not found').toBeTruthy()

    const interfaceBody = interfaceMatch![0]
    for (const field of REQUIRED_FIELDS) {
      expect(
        interfaceBody.includes(field),
        `AbrAuditEvent missing required field: ${field}`,
      ).toBe(true)
    }
  })
})

// ── ABR_AUDIT_BUILDER_003 ─────────────────────────────────────────────────

describe('ABR_AUDIT_BUILDER_003 — buildAbrAuditEvent produces valid events', () => {
  const taxonomyPath = join(ROOT, 'packages', 'os-core', 'src', 'audit', 'abr.ts')

  it('builder sets appId to "abr"', () => {
    const content = readContent(taxonomyPath)
    expect(
      content.includes("appId: 'abr'"),
      'buildAbrAuditEvent must set appId to "abr"',
    ).toBe(true)
  })

  it('builder generates timestamp', () => {
    const content = readContent(taxonomyPath)
    expect(
      content.includes('new Date().toISOString()'),
      'buildAbrAuditEvent must generate ISO timestamp',
    ).toBe(true)
  })

  it('validateAbrAuditEvent function is exported', () => {
    const content = readContent(taxonomyPath)
    expect(content).toContain('export function validateAbrAuditEvent')
  })
})
