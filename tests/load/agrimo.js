/**
 * k6 Load Test — Agrimo Platform
 *
 * Tests cooperative management, farmer profiles, and harvest data ingestion under scale.
 * Workload patterns: 50% profile reads, 30% data ingestion (harvest reports), 20% mutations (member updates).
 *
 * Run:
 *   k6 run --env PROFILE=baseline tests/load/agrimo.js
 *   k6 run --env PROFILE=scale10k tests/load/agrimo.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { loadMatrix, sloTargets, buildStages, buildThresholds } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const healthLatency = new Trend('health_latency', true)
const profileLatency = new Trend('profile_latency', true)
const harvestLatency = new Trend('harvest_ingestion_latency', true)
const memberUpdateLatency = new Trend('member_update_latency', true)

const BASE_URL = __ENV.AGRIMO_URL || 'https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

const profile = loadMatrix[__ENV.PROFILE || 'baseline']

export const options = {
  stages: buildStages(profile),
  thresholds: buildThresholds({
    health: 3,
    readonly: 50, // farmer profile reads
    mutation: 20, // member updates
    ingestion: 27, // harvest data ingestion
  }),
}

const headers = AUTH_TOKEN
  ? { Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' }

function trackLatency(res, metric) {
  metric.add(res.timings.duration)
  return res
}

export default function () {
  const coopId = `coop-${(__VU % 20) + 1}` // 20 cooperatives for regional testing
  const farmerId = `farmer-${(__VU % 500) + 1}` // 500 farmers per coop

  // 1. Health check
  let res = trackLatency(
    http.get(`${BASE_URL}/api/health`, { headers, tags: { endpoint: 'health' } }),
    healthLatency,
  )
  const ok = check(res, { 'health 200': (r) => r.status === 200 })
  errorRate.add(!ok)
  sleep(0.1)

  // 2. Farmer profile read (50% of traffic)
  res = trackLatency(
    http.get(
      `${BASE_URL}/api/farmers/${farmerId}?coop=${coopId}`,
      { headers, tags: { endpoint: 'readonly' } },
    ),
    profileLatency,
  )
  check(res, { 'profile 200': (r) => r.status === 200 })
  errorRate.add(res.status !== 200)
  sleep(0.1)

  // 3. Cooperative members list (related query)
  res = trackLatency(
    http.get(
      `${BASE_URL}/api/coops/${coopId}/members?limit=200`,
      { headers, tags: { endpoint: 'readonly' } },
    ),
    profileLatency,
  )
  check(res, { 'members-list 200': (r) => r.status === 200 })
  errorRate.add(res.status !== 200)
  sleep(0.2)

  // 4. Harvest data ingestion (27% of traffic)
  if (__VU % 4 === 0 || __VU % 4 === 1) {
    const harvestPayload = JSON.stringify({
      farmerId,
      coopId,
      harvestDate: new Date().toISOString().split('T')[0],
      cropType: ['maize', 'beans', 'cassava', 'millet'][Math.floor(Math.random() * 4)],
      quantityKg: Math.floor(Math.random() * 5000) + 100,
      gradeA: Math.floor(Math.random() * 80),
      gradeB: Math.floor(Math.random() * 100),
    })
    res = trackLatency(
      http.post(`${BASE_URL}/api/harvests`, harvestPayload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { endpoint: 'ingestion' },
      }),
      harvestLatency,
    )
    check(res, { 'harvest-create 201': (r) => r.status === 201 || r.status === 200 })
    errorRate.add(![201, 200].includes(res.status))
    sleep(0.3)
  }

  // 5. Member profile update (20% of traffic)
  if (__VU % 5 === 0) {
    const updatePayload = JSON.stringify({
      farmerId,
      name: `Farmer ${farmerId}`,
      phone: `+256${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      lastUpdatedAt: new Date().toISOString(),
    })
    res = trackLatency(
      http.patch(`${BASE_URL}/api/farmers/${farmerId}`, updatePayload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { endpoint: 'mutation' },
      }),
      memberUpdateLatency,
    )
    check(res, { 'member-update 200': (r) => r.status === 200 })
    errorRate.add(res.status !== 200)
    sleep(0.3)
  }

  sleep(0.5)
}
