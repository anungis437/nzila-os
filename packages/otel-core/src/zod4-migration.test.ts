import { describe, expect, it } from 'vitest'
import { CostAttributionSchema, ResourceMetricsSchema } from './cost-attribution.js'
import { EvidenceTraceContextSchema } from './evidence-correlation.js'
import { SLODefinitionSchema } from './slo.js'

describe('Zod 4 telemetry schema compatibility', () => {
  const cost={orgId:'org-a',resourceType:'compute',usage:10,unit:'ms',
    costUSD:0.1,timestamp:new Date('2026-11-02T00:00:00Z'),serviceName:'api'}
  it('preserves environment default and Date semantics', () => {
    const parsed=CostAttributionSchema.parse(cost)
    expect(parsed.environment).toBe('development')
    expect(parsed.orgId).toBe('org-a')
    expect(parsed.timestamp).toBeInstanceOf(Date)
    expect(CostAttributionSchema.safeParse({...cost,timestamp:'2026-11-02'}).success).toBe(false)
  })
  it('rejects negative or coerced resource metrics and malformed trace IDs', () => {
    const metrics={orgId:'org-a',serviceName:'api',durationMs:12,memoryMb:8}
    expect(ResourceMetricsSchema.parse(metrics).orgId).toBe('org-a')
    expect(ResourceMetricsSchema.safeParse({...metrics,memoryMb:-1}).success).toBe(false)
    expect(ResourceMetricsSchema.safeParse({...metrics,durationMs:'12'}).success).toBe(false)
    const trace={traceId:'a'.repeat(32),spanId:'b'.repeat(16),traceFlags:1,traceparent:'00'}
    expect(EvidenceTraceContextSchema.safeParse(trace).success).toBe(true)
    expect(EvidenceTraceContextSchema.safeParse({...trace,traceId:'short'}).success).toBe(false)
  })
  it('rejects invalid service level objectives', () => {
    const slo={name:'availability',service:'api',target:0.999,indicator:'availability'}
    expect(SLODefinitionSchema.safeParse(slo).success).toBe(true)
    expect(SLODefinitionSchema.safeParse({...slo,target:1.1}).success).toBe(false)
  })
})
