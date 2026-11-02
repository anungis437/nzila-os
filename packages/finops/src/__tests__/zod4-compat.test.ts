import { describe, expect, it } from 'vitest';
import { UsageRecordSchema, createUsageMeter } from '../metering';
import { QuotaPolicySchema } from '../quotas';
const record = { orgId: 'org-a', resource: 'api_calls', quantity: 2, unit: 'requests', timestamp: '2026-11-02T00:00:00Z', metadata: { source: 'api' } };
describe('Zod 4 FinOps tenant and metadata contracts', () => {
  it('accepts keyed metadata and isolates meter records by org', () => {
    expect(UsageRecordSchema.parse(record).metadata).toEqual({ source: 'api' });
    const meter = createUsageMeter();
    meter.record(record);
    meter.record({ ...record, orgId: 'org-b' });
    expect(meter.getRecords('org-a')).toHaveLength(1);
    expect(meter.getRecords('org-b')).toHaveLength(1);
  });
  it('rejects arrays, non-string metadata and negative quantities', () => {
    expect(UsageRecordSchema.safeParse({ ...record, metadata: ['api'] }).success).toBe(false);
    expect(UsageRecordSchema.safeParse({ ...record, metadata: { source: 10 } }).success).toBe(false);
    expect(UsageRecordSchema.safeParse({ ...record, quantity: -1 }).success).toBe(false);
  });
  it('preserves quota defaults and rejects unsupported resources', () => {
    const quota = { orgId: 'org-a', resource: 'api_calls', limit: 100, period: 'daily', enforcement: 'hard' };
    expect(QuotaPolicySchema.parse(quota).warningThreshold).toBe(80);
    expect(QuotaPolicySchema.safeParse({ ...quota, resource: 'unlimited' }).success).toBe(false);
  });
});
