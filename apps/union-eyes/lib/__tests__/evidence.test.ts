import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildEvidencePackFromAction: vi.fn(),
  processEvidencePack: vi.fn(),
  generateSeal: vi.fn(),
  verifySeal: vi.fn(),
}));

vi.mock('@nzila/os-core/evidence', () => ({
  buildEvidencePackFromAction: mocks.buildEvidencePackFromAction,
  processEvidencePack: mocks.processEvidencePack,
  generateSeal: mocks.generateSeal,
  verifySeal: mocks.verifySeal,
}));

import { buildUnionEvidencePack, generateSeal, verifySeal } from '../evidence';

describe('evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-exports generateSeal from os-core', () => {
    expect(generateSeal).toBe(mocks.generateSeal);
  });

  it('re-exports verifySeal from os-core', () => {
    expect(verifySeal).toBe(mocks.verifySeal);
  });

  it('buildUnionEvidencePack builds and processes evidence pack', async () => {
    const action = {
      actionType: 'GRIEVANCE_RESOLVED',
      orgId: 'org-1',
      actorId: 'user-1',
      artifacts: [{ type: 'resolution', data: { outcome: 'favorable' } }],
    };
    const rawPack = { id: 'pack-1', artifacts: action.artifacts };
    const processed = { id: 'pack-1', sealed: true, hash: 'abc123' };

    mocks.buildEvidencePackFromAction.mockResolvedValue(rawPack);
    mocks.processEvidencePack.mockResolvedValue(processed);

    const result = await buildUnionEvidencePack(action as unknown as Parameters<typeof buildUnionEvidencePack>[0]);

    expect(mocks.buildEvidencePackFromAction).toHaveBeenCalledWith(action);
    expect(mocks.processEvidencePack).toHaveBeenCalledWith(rawPack);
    expect(result).toEqual(processed);
  });

  it('propagates errors from buildEvidencePackFromAction', async () => {
    mocks.buildEvidencePackFromAction.mockRejectedValue(new Error('build failed'));

    await expect(
      buildUnionEvidencePack({ actionType: 'TEST', orgId: 'o', actorId: 'u', artifacts: [] } as unknown as Parameters<typeof buildUnionEvidencePack>[0]),
    ).rejects.toThrow('build failed');
  });
});
