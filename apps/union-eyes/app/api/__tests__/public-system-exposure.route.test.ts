import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B1-VERSION-UNAUTH-TOPOLOGY, DEF-0B1-DOCS-UNAUTH-API-SURFACE: the version route disclosed environment, host,
// deployment type, feature profile and image digests to anyone, and the complete OpenAPI inventory was served
// anonymously. The proxy does not authenticate API calls (route handlers do), so each route is the only gate.

const m = vi.hoisted(() => ({ roles: [] as string[] }));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: (...a: unknown[]) => Promise<unknown>) => {
    m.roles.push(role);
    return handler;
  },
}));
vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: (app: string) => ({
    app,
    environment: 'production',
    gitSha: 'abc123',
    buildTimestamp: '2026-10-27T00:00:00Z',
    artifactId: 'artifact-1',
    releaseId: 'release-1',
    appVersion: '1.2.3',
    timestamp: '2026-10-27T00:00:01Z',
  }),
}));
vi.mock('@/lib/runtime/environment', () => ({
  getEnvironmentSnapshot: () => ({ environment: 'production', deploymentType: 'azure-container-apps', featureProfile: 'operational' }),
}));
vi.mock('@/lib/api/openapi', () => ({ generateOpenAPISpec: () => ({ openapi: '3.0.0', paths: { '/api/admin/secret': {} } }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const TOKEN = 'probe-token-value-1234567890';
const TOPOLOGY_KEYS = ['environment', 'configuredEnvironment', 'surfaceEnvironment', 'runtimeEnvironment', 'deploymentType', 'featureProfile', 'requestHost', 'frontendImageDigest', 'backendImageDigest'];

const version = async (authorization?: string) => {
  const { GET } = await import('../version/route');
  return GET(new Request('https://staging.unioneyes.app/api/version', { headers: authorization ? { authorization, host: 'staging.unioneyes.app' } : { host: 'staging.unioneyes.app' } }));
};

describe('GET /api/version', () => {
  beforeEach(() => {
    process.env.UE_CANDIDATE_PROBE_TOKEN = TOKEN;
    process.env.UE_FRONTEND_IMAGE_DIGEST = 'sha256:front';
    process.env.UE_BACKEND_IMAGE_DIGEST = 'sha256:back';
  });

  it('gives an anonymous caller only the build identity', async () => {
    const response = await version();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ app: 'union-eyes', gitSha: 'abc123', buildTimestamp: '2026-10-27T00:00:00Z', appVersion: '1.2.3', releaseId: 'release-1', artifactId: 'artifact-1' });
    for (const key of TOPOLOGY_KEYS) expect(body).not.toHaveProperty(key);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('withholds topology and digests from a wrong, malformed or differently sized credential', async () => {
    for (const header of [`Bearer ${TOKEN}x`, 'Bearer wrong', TOKEN, 'Basic abc', 'Bearer ']) {
      const body = await (await version(header)).json();
      for (const key of TOPOLOGY_KEYS) expect(body, header).not.toHaveProperty(key);
    }
  });

  it('gives the deployment probe the topology and image digests', async () => {
    const body = await (await version(`Bearer ${TOKEN}`)).json();
    expect(body).toMatchObject({ gitSha: 'abc123', surfaceEnvironment: 'staging', deploymentType: 'azure-container-apps', frontendImageDigest: 'sha256:front', backendImageDigest: 'sha256:back' });
  });

  it('never authorizes anyone when no probe token is configured', async () => {
    delete process.env.UE_CANDIDATE_PROBE_TOKEN;
    for (const header of ['Bearer ', 'Bearer undefined', 'Bearer ']) {
      const body = await (await version(header)).json();
      expect(body).not.toHaveProperty('frontendImageDigest');
    }
  });
});

describe('complete OpenAPI inventory routes', () => {
  beforeEach(() => { m.roles.length = 0; });

  it('/api/docs requires an administrator and is neither cached nor opened to other origins', async () => {
    const { GET } = await import('../docs/route');
    expect(m.roles).toContain('admin');
    const json = await (GET as any)(new NextRequest('http://localhost/api/docs'));
    expect(json.headers.get('cache-control')).toBe('private, no-store');
    expect(json.headers.get('access-control-allow-origin')).toBeNull();
    const html = await (GET as any)(new NextRequest('http://localhost/api/docs?format=html'));
    expect(html.headers.get('cache-control')).toBe('private, no-store');
  });

  it('/api/docs exports no unauthenticated HEAD handler that advertises a wildcard origin', async () => {
    const mod = await import('../docs/route');
    expect((mod as Record<string, unknown>).HEAD).toBeUndefined();
  });

  it('/api/docs/openapi requires an administrator', async () => {
    await import('../docs/openapi/route');
    expect(m.roles).toContain('admin');
  });
});
