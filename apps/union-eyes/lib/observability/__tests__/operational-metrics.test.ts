import { describe, expect, it } from 'vitest';
import { authenticateOperationalMetrics, toPrometheus } from '../operational-metrics';

const request = (key?: string) => new Request('https://example.test/api/metrics/prometheus', {
  headers: key ? { 'x-service-key': key } : {},
});

describe('operational metrics contract', () => {
  it('requires a distinct configured capability credential', () => {
    const key = 'm'.repeat(40);
    expect(authenticateOperationalMetrics(request(key), { UE_METRICS_SERVICE_KEY: key } as NodeJS.ProcessEnv)).toBe('allowed');
    expect(authenticateOperationalMetrics(request('wrong'), { UE_METRICS_SERVICE_KEY: key } as NodeJS.ProcessEnv)).toBe('denied');
    expect(authenticateOperationalMetrics(request(key), { UE_METRICS_SERVICE_KEY: key, AI_SERVICE_KEY: key } as NodeJS.ProcessEnv)).toBe('unconfigured');
  });

  it('emits fixed label-free Prometheus gauges and no tenant identifiers', () => {
    const body = toPrometheus({ queueDepth: 6, queueActive: 1, queueReserved: 2, queueScheduled: 3, queueFailed: 4 });
    expect(body).toContain('# TYPE union_eyes_queue_depth gauge');
    expect(body).toContain('union_eyes_queue_depth 6');
    expect(body).not.toContain('{');
    expect(body).not.toMatch(/organization|tenant|user_id/);
  });
});
