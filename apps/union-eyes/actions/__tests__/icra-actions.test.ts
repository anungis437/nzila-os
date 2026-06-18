import { beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const queue: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit']) chain[m] = (..._a: unknown[]) => chain;
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    const r = queue.length ? queue.shift() : [];
    if (r instanceof Error) return Promise.reject(r).then(resolve, reject);
    return Promise.resolve(r).then(resolve, reject);
  };
  return { queue, chain, resolveAdaptiveContext: vi.fn() };
});

function setResults(...results: unknown[]) {
  mocks.queue.length = 0;
  mocks.queue.push(...results);
}

vi.mock('@/db', () => ({ db: mocks.chain }));
vi.mock('@/db/schema/icra-schema', () => ({ icraMaturityProfiles: {}, icraAssessments: {} }));
vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));
vi.mock('@/lib/icra/adaptation', () => ({ resolveAdaptiveContext: mocks.resolveAdaptiveContext }));
vi.mock('@/lib/icra/questions', () => ({ ALL_QUESTIONS: [], QUESTION_BANK_VERSION: 'v1' }));

import { getIcraProfile } from '../icra/get-profile';
import { getIcraAdaptiveResolution } from '../icra/get-adaptive-resolution';

describe('icra actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue.length = 0;
  });

  describe('getIcraProfile', () => {
    it('returns the profile payload when a row exists', async () => {
      setResults([{ profilePayload: { maturity: 'high' } }]);
      const result = await getIcraProfile('a1');
      expect(result).toEqual({ maturity: 'high' });
    });

    it('returns null when no row is found', async () => {
      setResults([]);
      expect(await getIcraProfile('a1')).toBeNull();
    });

    it('returns null on error', async () => {
      setResults(new Error('db down'));
      expect(await getIcraProfile('a1')).toBeNull();
    });
  });

  describe('getIcraAdaptiveResolution', () => {
    it('resolves the adaptive context when a row exists', async () => {
      setResults([{ organizationContext: { size: 'large' } }]);
      mocks.resolveAdaptiveContext.mockReturnValue({ kind: 'persisted' });
      const result = await getIcraAdaptiveResolution('a1');
      expect(result).toEqual({ kind: 'persisted' });
      expect(mocks.resolveAdaptiveContext).toHaveBeenCalled();
    });

    it('returns null when no row is found', async () => {
      setResults([]);
      expect(await getIcraAdaptiveResolution('a1')).toBeNull();
    });

    it('returns null on error', async () => {
      setResults(new Error('db down'));
      expect(await getIcraAdaptiveResolution('a1')).toBeNull();
    });
  });
});
