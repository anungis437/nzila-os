/**
 * k6 Load Test — Union Eyes Platform
 *
 * Tests case management, search, and member querying under scale.
 * Workload patterns: 60% reads (list/search), 30% mutations (create case), 10% ingestion (import).
 *
 * Run:
 *   k6 run --env PROFILE=baseline tests/load/union-eyes.js
 *   k6 run --env PROFILE=scale10k tests/load/union-eyes.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { loadMatrix, sloTargets, buildStages, buildThresholds } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const healthLatency = new Trend('health_latency', true)
const searchLatency = new Trend('search_latency', true)
const caseLatency = new Trend('case_creation_latency', true)
const importLatency = new Trend('import_latency', true)

const BASE_URL = __ENV.UE_URL || 'https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

const profile = loadMatrix[__ENV.PROFILE || 'baseline']

export const options = {
  stages: buildStages(profile),
  thresholds: buildThresholds({
    health: 5,
    readonly: 60, // search, list operations
    mutation: 30, // case creation
    ingestion: 5, // bulk import
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
  const orgId = `org-${(__VU % 10) + 1}` // 10 orgs for contention testing

  // 1. Health check
  let res = trackLatency(
    http.get(`${BASE_URL}/api/health`, { headers, tags: { endpoint: 'health' } }),
    healthLatency,
  )
  const ok = check(res, { 'health 200': (r) => r.status === 200 })
  errorRate.add(!ok)
  sleep(0.1)

  // 2. Search cases (60% of traffic)
  res = trackLatency(
    http.get(
      `${BASE_URL}/api/cases/search?org=${orgId}&q=member&limit=50`,
      { headers, tags: { endpoint: 'search' } },
    ),
    searchLatency,
  )
  check(res, { 'search 200': (r) => r.status === 200 })
  errorRate.add(res.status !== 200)
  sleep(0.2)

  // 3. List members (related to case context)
  res = trackLatency(
    http.get(
      `${BASE_URL}/api/members?org=${orgId}&limit=100`,
      { headers, tags: { endpoint: 'search' } },
    ),
    searchLatency,
  )
  check(res, { 'list-members 200': (r) => r.status === 200 })
  errorRate.add(res.status !== 200)
  sleep(0.2)

  // 4. Create case (30% of traffic, ~1/3 of requests)
  if (__VU % 3 === 0) {
    const casePayload = JSON.stringify({
      memberId: `m-${__VU}-${Math.random().toString(36).slice(2, 8)}`,
      caseType: 'representation',
      status: 'open',
      description: `Load test case from VU ${__VU}`,
    })
    res = trackLatency(
      http.post(`${BASE_URL}/api/cases`, casePayload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { endpoint: 'mutation' },
      }),
      caseLatency,
    )
    check(res, { 'case-create 201': (r) => r.status === 201 || r.status === 200 })
    errorRate.add(![201, 200].includes(res.status))
    sleep(0.3)
  }

  // 5. Bulk import simulation (10% of traffic)
  if (__VU % 10 === 0) {
    const members = []
    for (let i = 1; i <= 5; i++) {
      members.push({
        memberId: `batch-${__VU}-${i}`,
        name: `Member ${__VU}-${i}`,
        email: `m${__VU}${i}@example.com`,
      })
    }
    const importPayload = JSON.stringify({
      members,
    })
    res = trackLatency(
      http.post(`${BASE_URL}/api/members/import`, importPayload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { endpoint: 'ingestion' },
      }),
      importLatency,
    )
    check(res, { 'import 200': (r) => r.status === 200 || r.status === 202 })
    errorRate.add(![200, 202].includes(res.status))
  }

  sleep(0.5)
}
