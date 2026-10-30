import { describe, expect, it, vi } from 'vitest';
import { API_GROUP_LIMITS, DISPOSABLE_QA_LIMIT_MULTIPLIER, decideApiLimit, isDisposableQaRateProfile } from '../proxy-api-guard';

const local = {
  environment: 'local', qaTestEnv: 'true', syntheticSession: 'true',
  hostname: '127.0.0.1', hostHeader: '127.0.0.1:3002', forwardedHost: null,
};

describe('local disposable QA rate profile — no production bypass', () => {
  it('accepts only explicit synthetic loopback runner configuration', () => {
    expect(isDisposableQaRateProfile(local)).toBe(true);
    for (const unsafe of [
      { environment: 'production' }, { qaTestEnv: 'false' },
      { syntheticSession: 'false' }, { hostname: 'ue.example' },
      { hostHeader: 'ue.example' }, { forwardedHost: 'external.example' },
      { hostname: '127.0.0.1', hostHeader: null },
    ]) {
      expect(isDisposableQaRateProfile({ ...local, ...unsafe })).toBe(false);
    }
  });

  it('retains session and IP buckets in QA and changes no standard policy ceiling', async () => {
    const seen: Array<{ key: string; limit: number }> = [];
    const shared = vi.fn(async (key: string, options: { limit: number }) => {
      seen.push({ key, limit: options.limit });
      return { allowed: true, error: null, limit: options.limit, remaining: options.limit - 1, resetIn: 59 };
    });
    const input = { pathname: '/api/cases', method: 'POST', credential: 'private-session', ip: '127.0.0.1' };
    const memory = vi.fn();
    const standard = await decideApiLimit(input, { shared: shared as never, memory: memory as never });
    expect(standard.allowed).toBe(true);
    expect(standard.limit).toBe(API_GROUP_LIMITS.mutations.max);
    expect(seen.map(x => x.limit)).toEqual([API_GROUP_LIMITS.mutations.max, API_GROUP_LIMITS.mutations.max * 5]);
    seen.length = 0;
    const qa = await decideApiLimit(input, { shared: shared as never, memory: memory as never, profile: 'disposable-qa' });
    expect(qa.allowed).toBe(true);
    expect(seen.map(x => x.limit)).toEqual([
      API_GROUP_LIMITS.mutations.max * DISPOSABLE_QA_LIMIT_MULTIPLIER,
      API_GROUP_LIMITS.mutations.max * DISPOSABLE_QA_LIMIT_MULTIPLIER * 5,
    ]);
    expect(API_GROUP_LIMITS.mutations.max).toBe(60);
  });

  it('never relaxes authentication brute-force thresholds', async () => {
    const seen: number[] = [];
    const shared = vi.fn(async (_key: string, options: { limit: number }) => {
      seen.push(options.limit);
      return { allowed: true, error: null, limit: options.limit, remaining: options.limit - 1, resetIn: 30 };
    });
    await decideApiLimit({ pathname: '/api/auth/sign-in', method: 'POST', credential: null, ip: '127.0.0.1' }, {
      shared: shared as never, memory: vi.fn() as never, profile: 'disposable-qa',
    });
    expect(seen).toEqual([API_GROUP_LIMITS.auth.max * 5]);
  });
});
