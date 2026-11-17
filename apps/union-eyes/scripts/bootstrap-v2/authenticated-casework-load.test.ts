import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  AUTHENTICATED_CASEWORK_PROFILE,
  assertCaseProjection,
  assertOwnedLocalOrigin,
  assessStage,
  runScheduledStage,
} from './authenticated-casework-load'

const principal = {
  role: 'member' as const,
  cookie: 'nzila_session=private-synthetic-cookie',
  caseId: 'owned-case',
  organizationId: 'owned-org',
  userId: 'owned-member',
  representedMemberUserId: 'owned-member',
}
const caseBody = {
  data: {
    claimId: principal.caseId,
    organizationId: principal.organizationId,
    memberId: principal.userId,
  },
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('reusable owned authenticated casework profile', () => {
  it('retains every recovered profile constraint without shortening the measured stages', () => {
    const prior = JSON.parse(
      readFileSync(
        new URL(
          '../../../../docs/union-eyes/staging/evidence/ue-v2-runtime-repairs-41dba402/observed-prior-candidate-delta.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    expect(AUTHENTICATED_CASEWORK_PROFILE).toEqual(prior.authenticatedCaseworkLoad.profile)
    expect(
      AUTHENTICATED_CASEWORK_PROFILE.stages.map(
        (stage) => stage.durationSeconds * stage.requestsPerSecond,
      ),
    ).toEqual([300, 3600])
  })

  it('rejects external, credential-bearing, redirect-like and unowned HTTP origins', () => {
    expect(assertOwnedLocalOrigin('http://127.0.0.1:43210')).toBe('http://127.0.0.1:43210')
    for (const url of [
      'https://staging.example.invalid',
      'http://localhost:43210',
      'http://127.0.0.1:80',
      'http://u:p@127.0.0.1:43210',
      'http://127.0.0.1:43210/case',
      'http://127.0.0.1:43210/?target=x',
    ])
      expect(() => assertOwnedLocalOrigin(url)).toThrow()
  })

  it('fails empty, insufficient, slow and erroring samples using the full scheduled denominator', () => {
    expect(assessStage([], 0, 300).passed).toBe(false)
    expect(assessStage(Array(284).fill(1), 0, 300).passed).toBe(false)
    expect(assessStage(Array(285).fill(1), 0, 300).passed).toBe(true)
    expect(assessStage(Array(300).fill(501), 0, 300).passed).toBe(false)
    expect(assessStage(Array(300).fill(1), 1, 300).passed).toBe(false)
    const tail = [...Array(295).fill(1), ...Array(5).fill(1501)]
    expect(assessStage(tail, 0, 300)).toMatchObject({
      p95Ms: 1,
      p99Ms: 1501,
      passed: false,
      latencyBuckets: { '<=100ms': 295, '>1500ms': 5 },
    })
  })

  it('rejects successful HTTP projections for a different case, tenant or represented member', () => {
    expect(() => assertCaseProjection(caseBody, principal)).not.toThrow()
    for (const patch of [
      { claimId: 'other' },
      { organizationId: 'foreign' },
      { memberId: 'other' },
    ])
      expect(() =>
        assertCaseProjection({ data: { ...caseBody.data, ...patch } }, principal),
      ).toThrow()
    expect(() => assertCaseProjection({ data: {} }, principal)).toThrow('CASE_RESPONSE_SHAPE')
  })

  it('caps concurrent requests, records missed schedule slots and retains no cookie or case body', async () => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] })
    let active = 0,
      peak = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        peak = Math.max(peak, ++active)
        await new Promise((resolve) => setTimeout(resolve, 300))
        active--
        return new Response(JSON.stringify(caseBody), { status: 200 })
      }),
    )
    const pending = runScheduledStage(
      'http://127.0.0.1:43210',
      [principal],
      { concurrency: 1, durationSeconds: 1, requestsPerSecond: 5 },
      { remaining: 10000 },
    )
    await vi.advanceTimersByTimeAsync(1500)
    const result = await pending
    expect(peak).toBe(1)
    expect(result).toMatchObject({
      scheduledRequests: 5,
      requests: 3,
      skipped: 2,
      errors: 0,
      passed: false,
    })
    expect(JSON.stringify(result)).not.toContain(principal.cookie)
    expect(JSON.stringify(result)).not.toContain(principal.caseId)
  })

  it('counts HTTP and cross-resource response errors and enforces the shared request budget', async () => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout'] })
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ...caseBody.data, organizationId: 'foreign' } }), {
          status: 200,
        }),
      )
    vi.stubGlobal('fetch', request)
    const pending = runScheduledStage(
      'http://127.0.0.1:43210',
      [principal],
      { concurrency: 5, durationSeconds: 1, requestsPerSecond: 5 },
      { remaining: 2 },
    )
    await vi.advanceTimersByTimeAsync(1500)
    const result = await pending
    expect(request).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      scheduledRequests: 5,
      requests: 2,
      skipped: 3,
      errors: 2,
      errorRate: 1,
      passed: false,
    })
    expect(result.failureMetadata.map((f) => f.kind)).toEqual([
      'REQUEST_OR_RESPONSE_FAILURE',
      'RESOURCE_OR_TENANT_BOUNDARY',
    ])
  })
})
