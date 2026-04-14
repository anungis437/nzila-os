/**
 * k6 Load Test — Zonga Media Platform
 *
 * Profiles:
 *   baseline   — 100 VUs,  5 min  (~10K concurrent users)
 *   scale100k  — 500 VUs,  10 min (~100K concurrent users)
 *   scale1m    — 2000 VUs, 15 min (~1M concurrent users)
 *
 * Run:
 *   k6 run --env PROFILE=baseline tests/load/zonga.js
 *   k6 run --env PROFILE=scale100k tests/load/zonga.js
 *   k6 run --env PROFILE=scale1m  tests/load/zonga.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthLatency = new Trend('health_latency', true);
const playbackLatency = new Trend('playback_url_latency', true);
const catalogLatency = new Trend('catalog_latency', true);
const metricsLatency = new Trend('metrics_endpoint_latency', true);
const liveLatency = new Trend('live_stream_latency', true);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.ZONGA_URL || 'https://nzila-os-zonga.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
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
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    errors: ['rate<0.02'],
    health_latency: ['p(95)<200'],
    playback_url_latency: ['p(95)<400'],
    catalog_latency: ['p(95)<500'],
    metrics_endpoint_latency: ['p(95)<300'],
    live_stream_latency: ['p(95)<600'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const headers = AUTH_TOKEN
  ? { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' };

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
  // 1. Health check (verifies DB + Redis + Blob connectivity)
  get('/api/health', healthLatency);
  sleep(0.2);

  // 2. Metrics endpoint (Prometheus scrape simulation)
  get('/api/metrics', metricsLatency);
  sleep(0.2);

  // 3. Media catalog listing (exercises DB + pagination)
  get('/api/media?page=1&limit=20', catalogLatency);
  sleep(0.3);

  // 4. Playback URL generation (exercises CloudFront signed URL / circuit breaker)
  // Uses a synthetic media ID — expect 404 on missing content, circuit breaker on failures
  get(`/api/media/playback/test-media-${__VU}`, playbackLatency);
  sleep(0.3);

  // 5. Live streams listing (exercises IVS integration path)
  get('/api/live/channels', liveLatency);
  sleep(0.3);

  // 6. Static asset (tests Next.js chunk caching)
  get('/_next/static/chunks/main.js', null);
  sleep(0.5);
}
