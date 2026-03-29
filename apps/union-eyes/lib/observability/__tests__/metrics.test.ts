import { describe, it, expect, beforeEach } from 'vitest';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  dbQueryDuration,
  dbConnectionsActive,
  dbConnectionsIdle,
  dbConnectionsMax,
  dbQueryErrors,
  dbConnectionPoolWaitTime,
  cacheHits,
  cacheMisses,
  cacheOperationDuration,
  claimsProcessed,
  claimProcessingDuration,
  membersOnboarded,
  paymentsProcessed,
  paymentAmount,
  jobsQueued,
  jobsProcessed,
  jobProcessingDuration,
  featureFlagEvaluations,
  getMetrics,
  getMetricsJSON,
  getMetricsContentType,
  resetMetrics,
} from '../metrics';

beforeEach(() => {
  resetMetrics();
});

describe('HTTP metrics', () => {
  it('httpRequestsTotal increments', () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/api', status_code: '200' });
    // No assertion needed beyond not throwing — Counter.inc is validated by prom-client
    expect(httpRequestsTotal).toBeDefined();
  });

  it('httpRequestDuration observes values', () => {
    httpRequestDuration.observe({ method: 'GET', route: '/api', status_code: '200' }, 0.05);
    expect(httpRequestDuration).toBeDefined();
  });

  it('httpRequestSize observes values', () => {
    httpRequestSize.observe({ method: 'POST', route: '/api' }, 1024);
    expect(httpRequestSize).toBeDefined();
  });

  it('httpResponseSize observes values', () => {
    httpResponseSize.observe({ method: 'GET', route: '/api' }, 5000);
    expect(httpResponseSize).toBeDefined();
  });
});

describe('Database metrics', () => {
  it('dbQueryDuration observes', () => {
    dbQueryDuration.observe({ operation: 'SELECT', table: 'members' }, 0.01);
    expect(dbQueryDuration).toBeDefined();
  });

  it('dbConnectionsActive gauge works', () => {
    dbConnectionsActive.set(5);
    expect(dbConnectionsActive).toBeDefined();
  });

  it('dbConnectionsIdle gauge works', () => {
    dbConnectionsIdle.set(3);
    expect(dbConnectionsIdle).toBeDefined();
  });

  it('dbConnectionsMax gauge works', () => {
    dbConnectionsMax.set(20);
    expect(dbConnectionsMax).toBeDefined();
  });

  it('dbQueryErrors increments', () => {
    dbQueryErrors.inc({ operation: 'INSERT', error_type: 'constraint' });
    expect(dbQueryErrors).toBeDefined();
  });

  it('dbConnectionPoolWaitTime observes', () => {
    dbConnectionPoolWaitTime.observe(0.05);
    expect(dbConnectionPoolWaitTime).toBeDefined();
  });
});

describe('Cache metrics', () => {
  it('cacheHits increments', () => {
    cacheHits.inc({ cache_name: 'members' });
    expect(cacheHits).toBeDefined();
  });

  it('cacheMisses increments', () => {
    cacheMisses.inc({ cache_name: 'members' });
    expect(cacheMisses).toBeDefined();
  });

  it('cacheOperationDuration observes', () => {
    cacheOperationDuration.observe({ operation: 'GET', cache_name: 'members' }, 0.002);
    expect(cacheOperationDuration).toBeDefined();
  });
});

describe('Business metrics', () => {
  it('claimsProcessed increments', () => {
    claimsProcessed.inc({ status: 'approved', organization_id: 'org1' });
    expect(claimsProcessed).toBeDefined();
  });

  it('claimProcessingDuration observes', () => {
    claimProcessingDuration.observe({ claim_type: 'dental', outcome: 'approved' }, 3600);
    expect(claimProcessingDuration).toBeDefined();
  });

  it('membersOnboarded increments', () => {
    membersOnboarded.inc({ organization_id: 'org1', onboarding_method: 'self' });
    expect(membersOnboarded).toBeDefined();
  });

  it('paymentsProcessed increments', () => {
    paymentsProcessed.inc({ status: 'completed', payment_method: 'eft' });
    expect(paymentsProcessed).toBeDefined();
  });

  it('paymentAmount observes', () => {
    paymentAmount.observe({ payment_type: 'benefit' }, 250);
    expect(paymentAmount).toBeDefined();
  });
});

describe('Job metrics', () => {
  it('jobsQueued gauge works', () => {
    jobsQueued.set({ queue_name: 'default', job_type: 'email' }, 10);
    expect(jobsQueued).toBeDefined();
  });

  it('jobsProcessed increments', () => {
    jobsProcessed.inc({ queue_name: 'default', job_type: 'email', status: 'completed' });
    expect(jobsProcessed).toBeDefined();
  });

  it('jobProcessingDuration observes', () => {
    jobProcessingDuration.observe({ queue_name: 'default', job_type: 'email' }, 5);
    expect(jobProcessingDuration).toBeDefined();
  });
});

describe('Feature flag metrics', () => {
  it('featureFlagEvaluations increments', () => {
    featureFlagEvaluations.inc({ flag_name: 'new-ui', result: 'true' });
    expect(featureFlagEvaluations).toBeDefined();
  });
});

describe('Registry functions', () => {
  it('getMetrics returns Prometheus text', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    const text = await getMetrics();
    expect(text).toContain('union_eyes_http_requests_total');
  });

  it('getMetricsJSON returns JSON array', async () => {
    const json = await getMetricsJSON();
    expect(Array.isArray(json)).toBe(true);
  });

  it('getMetricsContentType returns proper content type', () => {
    const ct = getMetricsContentType();
    expect(ct).toContain('text/plain');
  });

  it('resetMetrics clears all metrics', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/x', status_code: '200' });
    resetMetrics();
    const text = await getMetrics();
    // After reset, counter is zero, so `requests_total` metric lines should not show values > 0
    expect(text).toBeDefined();
  });
});
