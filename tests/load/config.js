/**
 * Load Test Matrix Configuration — Nzila OS
 * 
 * Defines scaling profiles used across all apps for consistent capacity planning.
 * Maps VU count to estimated concurrent users and expected resource utilization.
 * 
 * @module tests/load/config
 */

export const loadMatrix = {
  smoke: {
    name: 'Smoke Test',
    vus: 1,
    duration: '1m',
    rampUp: '0s',
    description: 'Single VU sanity check',
  },
  baseline: {
    name: 'Baseline — 100 VUs',
    vus: 100,
    duration: '5m',
    rampUp: '1m',
    estimatedConcurrentUsers: 100,
    estimatedResourcesPerNode: { cpu: '~250m', memory: '~150MB' },
    description: 'Normal operating load',
  },
  scale1k: {
    name: 'Scale 1K — 1000 VUs',
    vus: 1000,
    duration: '10m',
    rampUp: '2m',
    estimatedConcurrentUsers: 1000,
    estimatedResourcesPerNode: { cpu: '~2.5 CPU', memory: '~1.5GB' },
    description: '10x baseline; validates linear scaling',
  },
  scale10k: {
    name: 'Scale 10K — 10000 VUs',
    vus: 10000,
    duration: '15m',
    rampUp: '3m',
    estimatedConcurrentUsers: 10000,
    estimatedResourcesPerNode: { cpu: '~4 CPU', memory: '~4GB' },
    description: '100x baseline; validates system throughput ceiling',
  },
  scale100k: {
    name: 'Scale 100K — 50000 VUs',
    vus: 50000,
    duration: '20m',
    rampUp: '5m',
    estimatedConcurrentUsers: 100000,
    estimatedResourcesPerNode: { cpu: '~8 CPU', memory: '~8GB' },
    description: '500x baseline; stress test for African launch readiness',
  },
}

/**
 * SLO targets per endpoint type. Used to establish pass/fail thresholds.
 */
export const sloTargets = {
  health: {
    p95_ms: 200,
    p99_ms: 500,
    errorRate: 0.001,
  },
  readonly: {
    p95_ms: 500,
    p99_ms: 2000,
    errorRate: 0.005,
  },
  mutation: {
    p95_ms: 1500,
    p99_ms: 5000,
    errorRate: 0.01,
  },
  ingestion: {
    p95_ms: 2000,
    p99_ms: 10000,
    errorRate: 0.02,
  },
}

/**
 * Capacity planning thresholds. Used to trigger scaling alerts.
 */
export const capacityThresholds = {
  cpuPercentage: 75,
  memoryPercentage: 80,
  pgsqlConnectionPoolUtilization: 85,
  redisMemoryUsage: 90,
  diskIopsUtilization: 80,
}

export function getProfile(profileName) {
  return loadMatrix[profileName] || loadMatrix.baseline
}

export function buildStages(profile) {
  return [
    { duration: profile.rampUp, target: profile.vus },
    { duration: profile.duration, target: profile.vus },
    { duration: '2m', target: 0 }, // cooldown
  ]
}

export function buildThresholds(endpoints = {}) {
  // Default thresholds for typical endpoint mix
  const defaultEndpoints = {
    health: 3,
    readonly: 70,
    mutation: 25,
    ingestion: 2,
  }

  const endpointMix = { ...defaultEndpoints, ...endpoints }
  const thresholds = {}

  if (endpointMix.health > 0) {
    thresholds['health_latency'] = [`p(95)<${sloTargets.health.p95_ms}`, `p(99)<${sloTargets.health.p99_ms}`]
  }
  if (endpointMix.readonly > 0) {
    thresholds['readonly_latency'] = [`p(95)<${sloTargets.readonly.p95_ms}`, `p(99)<${sloTargets.readonly.p99_ms}`]
  }
  if (endpointMix.mutation > 0) {
    thresholds['mutation_latency'] = [`p(95)<${sloTargets.mutation.p95_ms}`, `p(99)<${sloTargets.mutation.p99_ms}`]
  }
  if (endpointMix.ingestion > 0) {
    thresholds['ingestion_latency'] = [`p(95)<${sloTargets.ingestion.p95_ms}`, `p(99)<${sloTargets.ingestion.p99_ms}`]
  }

  thresholds['errors'] = ['rate<0.01']
  thresholds['http_req_duration'] = ['p(95)<2000']

  return thresholds
}
