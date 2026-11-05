import { beforeEach, describe, expect, it, vi } from 'vitest';
import { txDouble } from '@/lib/page-data/__tests__/tx-double';

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());

import { loadUploaderNames } from './uploader-names';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';

beforeEach(() => txDouble.reset());

describe('loadUploaderNames', () => {
  it('names the uploaders who are members of the organization, once each, leaving out a blank name', async () => {
    txDouble.queue([
      { userId: 'u1', name: 'Alice Member' },
      { userId: 'u2', name: '' },
    ]);

    expect(await loadUploaderNames(ORG, ['u1', 'u2', 'u1', 'u3'])).toEqual({ u1: 'Alice Member' });

    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.systemContexts).toBe(0);
    expect(txDouble.statements).toHaveLength(1);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'u1', 'u2', 'u3']);
  });

  it('opens no transaction when no document names an uploader', async () => {
    expect(await loadUploaderNames(ORG, [null, undefined, ''])).toEqual({});

    expect(txDouble.contexts).toEqual([]);
    expect(txDouble.statements).toEqual([]);
  });

  it('rejects, rather than naming nobody, when the members cannot be read', async () => {
    txDouble.queue(new Error('connection lost'));

    await expect(loadUploaderNames(ORG, ['u1'])).rejects.toThrow('connection lost');
  });
});
