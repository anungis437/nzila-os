import { describe, it, expect } from 'vitest'
import {
  SCHEMA_CORE_VERSION,
  canonicalEntityBaseSchema,
  actorContextSchema,
  userIdentitySchema,
  orgScopeSchema,
  canonicalEventSchema,
  canonicalAuditRecordSchema,
  evidenceArtifactSchema,
  evidenceExportSchema,
  workflowStateSchema,
  workflowTransitionRecordSchema,
  documentMetadataSchema,
  correlationContextSchema,
  moduleRegistrationSchema,
  financialRecordSchema,
  integrationRecordSchema,
  platformErrorSchema,
  fieldErrorSchema,
  createPlatformError,
  getHttpStatus,
  ok,
  fail,
  isCanonicalEntity,
  isCanonicalEvent,
  isCanonicalAuditRecord,
  hasOrgScope,
  hasCorrelation,
} from '../index'

describe('schema-core version', () => {
  it('exports SCHEMA_CORE_VERSION', () => {
    expect(SCHEMA_CORE_VERSION).toBe('1.0.0')
  })
})

describe('entity', () => {
  const valid = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    entityType: 'claim',
    orgId: 'org-1',
    sourceModule: 'union-eyes',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  }

  it('accepts valid entity', () => {
    const result = canonicalEntityBaseSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('applies schema version default', () => {
    const result = canonicalEntityBaseSchema.parse(valid)
    expect(result.schemaVersion).toBe('1.0.0')
  })

  it('rejects invalid uuid', () => {
    const result = canonicalEntityBaseSchema.safeParse({ ...valid, id: 'not-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('actor', () => {
  it('accepts valid actor context', () => {
    const result = actorContextSchema.safeParse({
      userId: 'u-1',
      orgId: 'org-1',
      orgRole: 'admin',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid user identity', () => {
    const result = userIdentitySchema.safeParse({
      userId: 'u-1',
      email: 'test@example.com',
      displayName: 'Test User',
      onboarded: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('org', () => {
  it('accepts valid org scope', () => {
    const result = orgScopeSchema.safeParse({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid slug', () => {
    const result = orgScopeSchema.safeParse({
      id: 'org-1',
      name: 'Test Org',
      slug: 'Invalid Slug!',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('event', () => {
  it('accepts valid event', () => {
    const result = canonicalEventSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'claim.created',
      sourceModule: 'union-eyes',
      orgId: 'org-1',
      actorId: 'u-1',
      timestamp: '2026-01-01T00:00:00Z',
      payload: { claimId: '123' },
    })
    expect(result.success).toBe(true)
  })
})

describe('audit', () => {
  it('accepts valid audit record', () => {
    const result = canonicalAuditRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00Z',
      action: 'claim.approved',
      actorId: 'u-1',
      orgId: 'org-1',
      sourceModule: 'union-eyes',
      resourceType: 'claim',
      severity: 'info',
    })
    expect(result.success).toBe(true)
  })
})

describe('evidence', () => {
  it('accepts valid artifact', () => {
    const result = evidenceArtifactSchema.safeParse({
      artifactId: 'a-1',
      type: 'audit-log',
      format: 'json',
      sizeBytes: 1024,
      hash: 'sha256:abc',
      generatedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid export', () => {
    const result = evidenceExportSchema.safeParse({
      app: 'union-eyes',
      orgId: 'org-1',
      exportId: 'e-1',
      artifacts: [],
      chainHash: 'sha256:def',
      exportedAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('workflow', () => {
  it('accepts valid workflow state', () => {
    const result = workflowStateSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workflowKey: 'claim-lifecycle',
      currentState: 'open',
      previousState: null,
      entityId: '550e8400-e29b-41d4-a716-446655440001',
      entityType: 'claim',
      orgId: 'org-1',
      sourceModule: 'union-eyes',
      lastTransitionBy: 'u-1',
      lastTransitionAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid transition record', () => {
    const result = workflowTransitionRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workflowId: '550e8400-e29b-41d4-a716-446655440001',
      fromState: 'open',
      toState: 'in-review',
      trigger: 'submit',
      actorId: 'u-1',
      timestamp: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('document', () => {
  it('accepts valid document metadata', () => {
    const result = documentMetadataSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: 'org-1',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      storagePath: '/docs/report.pdf',
      uploadedAt: '2026-01-01T00:00:00Z',
      uploadedBy: 'u-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('correlation', () => {
  it('accepts valid correlation context', () => {
    const result = correlationContextSchema.safeParse({
      correlationId: 'corr-1',
      traceId: 'trace-1',
      spanId: 'span-1',
    })
    expect(result.success).toBe(true)
  })
})

describe('module', () => {
  it('accepts valid module registration', () => {
    const result = moduleRegistrationSchema.safeParse({
      id: 'union-eyes',
      name: 'Union Eyes',
      basePath: '/union-eyes',
      tier: 'PRODUCTION',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid module id', () => {
    const result = moduleRegistrationSchema.safeParse({
      id: 'Invalid Module',
      name: 'Test',
      basePath: '/test',
      tier: 'PRODUCTION',
    })
    expect(result.success).toBe(false)
  })
})

describe('financial', () => {
  it('accepts valid financial record', () => {
    const result = financialRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      transactionType: 'payment',
      amountMinor: 10000,
      currency: 'USD',
      orgId: 'org-1',
      sourceModule: 'cfo',
      status: 'completed',
      timestamp: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('integration', () => {
  it('accepts valid integration record', () => {
    const result = integrationRecordSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      provider: 'stripe',
      direction: 'inbound',
      operation: 'payment.sync',
      status: 'success',
      orgId: 'org-1',
      sourceModule: 'cfo',
      timestamp: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('error', () => {
  it('accepts valid platform error', () => {
    const result = platformErrorSchema.safeParse({
      code: 'NOT_FOUND',
      message: 'Resource not found',
      category: 'resource',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid field error', () => {
    const result = fieldErrorSchema.safeParse({
      field: 'email',
      message: 'Invalid email',
    })
    expect(result.success).toBe(true)
  })

  it('createPlatformError produces valid error', () => {
    const err = createPlatformError('VALIDATION_ERROR', 'Bad input')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.category).toBe('validation')
    expect(err.retryable).toBe(false)
  })

  it('getHttpStatus returns correct status', () => {
    expect(getHttpStatus('NOT_FOUND')).toBe(404)
    expect(getHttpStatus('RATE_LIMITED')).toBe(429)
    expect(getHttpStatus('AUTH_REQUIRED')).toBe(401)
  })
})

describe('result', () => {
  it('ok returns success result', () => {
    const result = ok({ id: '1' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: '1' })
  })

  it('fail returns failure result', () => {
    const result = fail('NOT_FOUND', 'Not found')
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('guards', () => {
  const validEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    entityType: 'claim',
    orgId: 'org-1',
    sourceModule: 'union-eyes',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  }

  it('isCanonicalEntity returns true for valid entity', () => {
    expect(isCanonicalEntity(validEntity)).toBe(true)
  })

  it('isCanonicalEntity returns false for invalid data', () => {
    expect(isCanonicalEntity({ foo: 'bar' })).toBe(false)
  })

  it('isCanonicalEvent returns true for valid event', () => {
    expect(isCanonicalEvent({
      id: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'claim.created',
      sourceModule: 'union-eyes',
      orgId: 'org-1',
      actorId: 'u-1',
      timestamp: '2026-01-01T00:00:00Z',
      payload: {},
    })).toBe(true)
  })

  it('isCanonicalAuditRecord validates correctly', () => {
    expect(isCanonicalAuditRecord({
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-01T00:00:00Z',
      action: 'test',
      actorId: 'u-1',
      orgId: 'org-1',
      sourceModule: 'test',
      resourceType: 'test',
      severity: 'info',
    })).toBe(true)
  })

  it('hasOrgScope detects orgId', () => {
    expect(hasOrgScope({ orgId: 'org-1' })).toBe(true)
    expect(hasOrgScope({ foo: 'bar' })).toBe(false)
  })

  it('hasCorrelation detects correlation context', () => {
    expect(hasCorrelation({ correlationId: 'c-1' })).toBe(true)
    expect(hasCorrelation({})).toBe(false)
  })
})
