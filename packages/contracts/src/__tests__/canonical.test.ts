import { describe, it, expect } from 'vitest'
import {
  CANONICAL_SCHEMA_VERSION,
  canonicalEntitySchema,
  canonicalEventSchema,
  canonicalMetricSchema,
  canonicalAuditRecordSchema,
  canonicalWorkflowStateSchema,
  canonicalFinancialRecordSchema,
  canonicalUserContextSchema,
  canonicalOrgContextSchema,
  createCanonicalMapper,
  createSafeCanonicalMapper,
} from '../canonical.js'

const NOW = new Date().toISOString()
const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('Canonical Schema Version', () => {
  it('exports a valid semver version', () => {
    expect(CANONICAL_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('NzilaCanonicalEntity', () => {
  const validEntity = {
    id: UUID,
    entityType: 'claim',
    orgId: 'org_123',
    sourceModule: 'union-eyes',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'user_123',
  }

  it('validates a complete entity', () => {
    const result = canonicalEntitySchema.safeParse(validEntity)
    expect(result.success).toBe(true)
  })

  it('rejects entity without orgId', () => {
    const { orgId: _, ...noOrg } = validEntity
    const result = canonicalEntitySchema.safeParse(noOrg)
    expect(result.success).toBe(false)
  })

  it('accepts extensions', () => {
    const result = canonicalEntitySchema.safeParse({
      ...validEntity,
      extensions: { claimType: 'grievance', priority: 'high' },
    })
    expect(result.success).toBe(true)
  })

  it('defaults schemaVersion', () => {
    const result = canonicalEntitySchema.parse(validEntity)
    expect(result.schemaVersion).toBe(CANONICAL_SCHEMA_VERSION)
  })
})

describe('NzilaCanonicalEvent', () => {
  const validEvent = {
    id: UUID,
    eventType: 'claim.created',
    sourceModule: 'union-eyes',
    orgId: 'org_123',
    actorId: 'user_123',
    timestamp: NOW,
    payload: { claimId: UUID },
  }

  it('validates a complete event', () => {
    const result = canonicalEventSchema.safeParse(validEvent)
    expect(result.success).toBe(true)
  })

  it('rejects event without actorId', () => {
    const { actorId: _, ...noActor } = validEvent
    const result = canonicalEventSchema.safeParse(noActor)
    expect(result.success).toBe(false)
  })

  it('accepts correlation/causation IDs', () => {
    const result = canonicalEventSchema.safeParse({
      ...validEvent,
      correlationId: 'corr-123',
      causationId: 'cause-456',
    })
    expect(result.success).toBe(true)
  })
})

describe('NzilaCanonicalMetric', () => {
  const validMetric = {
    name: 'request_latency_ms',
    type: 'histogram' as const,
    value: 42.5,
    unit: 'ms',
    sourceModule: 'flow',
    timestamp: NOW,
  }

  it('validates a complete metric', () => {
    const result = canonicalMetricSchema.safeParse(validMetric)
    expect(result.success).toBe(true)
  })

  it('accepts labels', () => {
    const result = canonicalMetricSchema.safeParse({
      ...validMetric,
      labels: { endpoint: '/api/orders', method: 'POST' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid metric type', () => {
    const result = canonicalMetricSchema.safeParse({
      ...validMetric,
      type: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('NzilaCanonicalAuditRecord', () => {
  const validRecord = {
    id: UUID,
    timestamp: NOW,
    action: 'claim.approved',
    actorId: 'user_123',
    orgId: 'org_123',
    sourceModule: 'union-eyes',
    resourceType: 'claim',
    severity: 'info' as const,
  }

  it('validates a complete audit record', () => {
    const result = canonicalAuditRecordSchema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('accepts before/after snapshots', () => {
    const result = canonicalAuditRecordSchema.safeParse({
      ...validRecord,
      severity: 'critical',
      evidenceGrade: true,
      before: { status: 'pending' },
      after: { status: 'approved' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts evidence chain fields', () => {
    const result = canonicalAuditRecordSchema.safeParse({
      ...validRecord,
      evidenceGrade: true,
      hash: 'sha256:abc123',
      previousHash: 'sha256:def456',
    })
    expect(result.success).toBe(true)
  })
})

describe('NzilaCanonicalWorkflowState', () => {
  const validWorkflow = {
    id: UUID,
    workflowKey: 'claim-lifecycle',
    currentState: 'investigating',
    previousState: 'filed',
    entityId: UUID,
    entityType: 'claim',
    orgId: 'org_123',
    sourceModule: 'union-eyes',
    lastTransitionBy: 'user_123',
    lastTransitionAt: NOW,
    createdAt: NOW,
  }

  it('validates a complete workflow state', () => {
    const result = canonicalWorkflowStateSchema.safeParse(validWorkflow)
    expect(result.success).toBe(true)
  })

  it('accepts error state', () => {
    const result = canonicalWorkflowStateSchema.safeParse({
      ...validWorkflow,
      error: { code: 'TIMEOUT', message: 'Step timed out', retryable: true },
    })
    expect(result.success).toBe(true)
  })
})

describe('NzilaCanonicalFinancialRecord', () => {
  const validFinancial = {
    id: UUID,
    transactionType: 'payment',
    amountMinor: 9999,
    currency: 'USD',
    orgId: 'org_123',
    sourceModule: 'flow',
    status: 'completed' as const,
    timestamp: NOW,
  }

  it('validates a complete financial record', () => {
    const result = canonicalFinancialRecordSchema.safeParse(validFinancial)
    expect(result.success).toBe(true)
  })

  it('rejects invalid currency length', () => {
    const result = canonicalFinancialRecordSchema.safeParse({
      ...validFinancial,
      currency: 'US',
    })
    expect(result.success).toBe(false)
  })

  it('accepts negative amounts (refunds)', () => {
    const result = canonicalFinancialRecordSchema.safeParse({
      ...validFinancial,
      amountMinor: -5000,
      transactionType: 'refund',
    })
    expect(result.success).toBe(true)
  })
})

describe('NzilaCanonicalUserContext', () => {
  it('validates a complete user context', () => {
    const result = canonicalUserContextSchema.safeParse({
      userId: 'user_123',
      orgId: 'org_123',
      orgRole: 'admin',
    })
    expect(result.success).toBe(true)
  })
})

describe('NzilaCanonicalOrgContext', () => {
  it('validates a complete org context', () => {
    const result = canonicalOrgContextSchema.safeParse({
      orgId: 'org_123',
      orgName: 'Acme Corp',
      status: 'active',
      createdAt: NOW,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = canonicalOrgContextSchema.safeParse({
      orgId: 'org_123',
      orgName: 'Acme Corp',
      status: 'deleted',
      createdAt: NOW,
    })
    expect(result.success).toBe(false)
  })
})

describe('createCanonicalMapper', () => {
  interface AppClaim {
    id: string
    type: string
    org: string
    claimant: string
    state: string
    created: string
  }

  const mapClaimToEntity = createCanonicalMapper(
    canonicalEntitySchema,
    (claim: AppClaim) => ({
      id: claim.id,
      entityType: 'claim',
      orgId: claim.org,
      sourceModule: 'union-eyes',
      status: claim.state,
      createdAt: claim.created,
      updatedAt: claim.created,
      createdBy: claim.claimant,
    }),
  )

  it('maps app-specific data to canonical entity', () => {
    const result = mapClaimToEntity({
      id: UUID,
      type: 'grievance',
      org: 'org_123',
      claimant: 'user_456',
      state: 'filed',
      created: NOW,
    })
    expect(result.entityType).toBe('claim')
    expect(result.sourceModule).toBe('union-eyes')
    expect(result.orgId).toBe('org_123')
  })

  it('throws on invalid mapping', () => {
    expect(() =>
      mapClaimToEntity({
        id: 'not-a-uuid',
        type: 'grievance',
        org: 'org_123',
        claimant: 'user_456',
        state: 'filed',
        created: NOW,
      }),
    ).toThrow()
  })
})

describe('createSafeCanonicalMapper', () => {
  const safMapper = createSafeCanonicalMapper(
    canonicalMetricSchema,
    (input: { name: string; val: number }) => ({
      name: input.name,
      type: 'gauge' as const,
      value: input.val,
      unit: 'count',
      sourceModule: 'test',
      timestamp: NOW,
    }),
  )

  it('returns success for valid input', () => {
    const result = safMapper({ name: 'test_metric', val: 42 })
    expect(result.success).toBe(true)
  })

  it('returns error for invalid output', () => {
    const result = safMapper({ name: '', val: 42 })
    expect(result.success).toBe(false)
  })
})
