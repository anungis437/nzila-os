/**
 * k6 Load Test — Nzila OS Scale Validation
 *
 * Profiles:
 *   baseline   — 100 VUs,  5 min  (~10K concurrent users)
 *   scale100k  — 500 VUs,  10 min (~100K concurrent users)
 *   scale1m    — 2000 VUs, 15 min (~1M concurrent users)
 *
 * Run:
 *   k6 run --env PROFILE=baseline tests/load/smoke.js
 *   k6 run --env PROFILE=scale100k tests/load/smoke.js
 *   k6 run --env PROFILE=scale1m  tests/load/smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const claimLatency = new Trend('claim_list_latency', true);
const memberSearchLatency = new Trend('member_search_latency', true);
const dashboardLatency = new Trend('dashboard_latency', true);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://nzila-os-web.delightfulisland-0d503d3c.eastus.azurecontainerapps.io';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

const profiles = {
  baseline: { vus: 100, duration: '5m', rampUp: '1m' },
  scale100k: { vus: 500, duration: '10m', rampUp: '2m' },
  scale1m: { vus: 2000, duration: '15m', rampUp: '3m' },
};

const profile = profiles[__ENV.PROFILE || 'baseline'];

export const options = {
  stages: [
    { duration: profile.rampUp, target: profile.vus },
    { duration: profile.duration, target: profile.vus },
    { duration: '1m', target: 0 }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    errors: ['rate<0.02'],       // < 2% error rate
    claim_list_latency: ['p(95)<400'],
    member_search_latency: ['p(95)<300'],
    dashboard_latency: ['p(95)<600'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const headers = AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};

function get(path, latencyMetric) {
  const res = http.get(`${BASE_URL}${path}`, { headers, tags: { endpoint: path } });
  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'body not empty': (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);
  if (latencyMetric) latencyMetric.add(res.timings.duration);
  return res;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export default function () {
  // 1. Health check (warm-up / synthetic monitor)
  get('/api/health', null);

  // 2. Dashboard load (heaviest aggregation query)
  get('/api/analytics/dashboard', dashboardLatency);
  sleep(0.5);

  // 3. Claims list with pagination
  get('/api/claims?page=1&limit=25', claimLatency);
  sleep(0.3);

  // 4. Member search (exercises FTS GIN index)
  const query = `member_${__VU}_${__ITER}`;
  get(`/api/members/search?q=${query}`, memberSearchLatency);
  sleep(0.3);

  // 5. Static asset (tests CDN / image cache)
  get('/_next/static/chunks/main.js', null);
  sleep(0.5);
}
