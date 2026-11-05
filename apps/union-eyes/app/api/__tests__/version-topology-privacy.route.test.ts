import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: () => ({
    app: 'union-eyes', gitSha: 'test-sha', buildTimestamp: '2026-10-30T00:00:00Z',
    appVersion: '1.0.0', releaseId: 'release-test', artifactId: 'artifact-test',
    environment: 'production',
  }),
}))

vi.mock('@/lib/runtime/environment', () => ({
  getEnvironmentSnapshot: () => ({
    environment: 'production', deploymentType: 'container', featureProfile: 'restricted',
  }),
}))

import { GET } from '../version/route'

afterEach(() => vi.unstubAllEnvs())

const expectedPublicKeys = [
  'app', 'appVersion', 'artifactId', 'buildTimestamp', 'gitSha', 'releaseId',
]

describe('DEF-0B1-VERSION-UNAUTH-TOPOLOGY', () => {
  it('does not disclose deployment topology to anonymous or invalid-token callers', async () => {
    vi.stubEnv('UE_CANDIDATE_PROBE_TOKEN', 'private-probe-token')
    for (const authorization of [undefined, 'Bearer wrong-probe-token']) {
      const headers: Record<string, string> = { host: 'internal-node.example' }
      if (authorization) headers.authorization = authorization
      const response = await GET(new Request('https://example.test/api/version', { headers }))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(Object.keys(body).sort()).toEqual(expectedPublicKeys)
      expect(JSON.stringify(body)).not.toContain('internal-node.example')
    }
  })

  it('exposes operational topology only with the configured deployment-probe credential', async () => {
    vi.stubEnv('UE_CANDIDATE_PROBE_TOKEN', 'private-probe-token')
    const response = await GET(new Request('https://example.test/api/version', {
      headers: { authorization: 'Bearer private-probe-token', host: 'internal-node.example' },
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.requestHost).toBe('internal-node.example')
    expect(body.deploymentType).toBe('container')
    expect(body.featureProfile).toBe('restricted')
  })

  it('fails closed when no deployment-probe secret is configured', async () => {
    vi.stubEnv('UE_CANDIDATE_PROBE_TOKEN', '')
    const response = await GET(new Request('https://example.test/api/version', {
      headers: { authorization: 'Bearer anything', host: 'internal-node.example' },
    }))
    expect(Object.keys(await response.json()).sort()).toEqual(expectedPublicKeys)
  })
})
