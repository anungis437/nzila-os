import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getUnionEyesSiteTopology,
  buildMarketingUrl,
  buildAppUrl,
} from '../site-topology';

describe('lib/site-topology', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to development with production-style URLs', () => {
    vi.stubEnv('UE_ENVIRONMENT', '');
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '');
    vi.stubEnv('NODE_ENV', 'development');
    const topo = getUnionEyesSiteTopology();
    expect(topo.environment).toBe('development');
    expect(topo.isStaging).toBe(false);
    expect(topo.marketingUrl).toBe('https://unioneyes.app');
    expect(topo.titleSuffix).toBe('');
  });

  it('resolves the staging environment and suffix', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'staging');
    const topo = getUnionEyesSiteTopology();
    expect(topo.environment).toBe('staging');
    expect(topo.isStaging).toBe(true);
    expect(topo.marketingUrl).toBe('https://staging.unioneyes.app');
    expect(topo.titleSuffix).toBe(' [Staging]');
  });

  it('recognizes production and test environments', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    expect(getUnionEyesSiteTopology().environment).toBe('production');
    vi.stubEnv('UE_ENVIRONMENT', 'test');
    expect(getUnionEyesSiteTopology().environment).toBe('test');
  });

  it('strips an accidental :3000 port from a public host', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL_PRODUCTION', 'https://unioneyes.app:3000/');
    expect(getUnionEyesSiteTopology().productionMarketingUrl).toBe('https://unioneyes.app');
  });

  it('keeps :3000 for localhost hosts', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL_PRODUCTION', 'http://localhost:3000');
    expect(getUnionEyesSiteTopology().productionMarketingUrl).toBe('http://localhost:3000');
  });

  it('falls back when an invalid URL is supplied', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL_PRODUCTION', 'not a url');
    expect(getUnionEyesSiteTopology().productionMarketingUrl).toBe('https://unioneyes.app');
  });

  it('builds marketing and app URLs from the topology', () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    expect(buildMarketingUrl('/pricing')).toBe('https://unioneyes.app/pricing');
    expect(buildAppUrl('/dashboard')).toBe('https://app.unioneyes.app/dashboard');
    expect(buildMarketingUrl()).toBe('https://unioneyes.app/');
  });
});
