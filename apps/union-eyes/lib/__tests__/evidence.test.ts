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
      orgId: '11111111-1111-4111-8111-111111111111',
      actorId: 'user-1',
      artifacts: [{ type: 'resolution', data: { outcome: 'favorable' } }],
    };
    const rawPack = { id: 'pack-1', artifacts: action.artifacts };
    const processed = { id: 'pack-1', sealed: true, hash: 'abc123' };

    mocks.buildEvidencePackFromAction.mockReturnValue(rawPack);
    mocks.processEvidencePack.mockResolvedValue(processed);

    const result = await buildUnionEvidencePack(action);

    expect(mocks.buildEvidencePackFromAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'GRIEVANCE_RESOLVED',
        orgId: '11111111-1111-4111-8111-111111111111',
        executedBy: 'user-1',
      }),
    );
    const ctx = mocks.buildEvidencePackFromAction.mock.calls[0]![0];
    expect(ctx.additionalArtifacts).toHaveLength(1);
    expect(ctx.additionalArtifacts[0]).toMatchObject({
      artifactType: 'resolution',
      filename: 'ue-1-resolution.json',
      contentType: 'application/json',
      retentionClass: '7_YEARS',
      classification: 'CONFIDENTIAL',
    });
    expect(JSON.parse(ctx.additionalArtifacts[0].buffer.toString('utf8'))).toEqual({ outcome: 'favorable' });
    expect(mocks.processEvidencePack).toHaveBeenCalledWith(rawPack);
    expect(result).toEqual(processed);
  });

  it('propagates errors from buildEvidencePackFromAction', async () => {
    mocks.buildEvidencePackFromAction.mockImplementation(() => { throw new Error('build failed') });

    await expect(
      buildUnionEvidencePack({ actionType: 'TEST', orgId: '11111111-1111-4111-8111-111111111111', actorId: 'u', artifacts: [{ type: 'record', data: { id: 1 } }] }),
    ).rejects.toThrow('build failed');
  });
  it('fails closed on empty, invalid-tenant and missing-actor evidence before invoking the builder', async () => {
    const valid = { actionType: 'TEST', orgId: '11111111-1111-4111-8111-111111111111', actorId: 'actor', artifacts: [{ type: 'record', data: { id: 1 } }] };
    await expect(buildUnionEvidencePack({ ...valid, artifacts: [] })).rejects.toThrow('actual artifacts');
    await expect(buildUnionEvidencePack({ ...valid, orgId: 'global' })).rejects.toThrow('organization UUID');
    await expect(buildUnionEvidencePack({ ...valid, actorId: 'unknown' })).rejects.toThrow('identified actor');
    await expect(buildUnionEvidencePack({ ...valid, artifacts: [{ type: '../escape', data: {} }] })).rejects.toThrow('type is invalid');
    await expect(buildUnionEvidencePack({ ...valid, artifacts: [{ type: 'record', data: undefined }] })).rejects.toThrow('JSON-serializable');
    await expect(buildUnionEvidencePack({ ...valid, artifacts: [{ type: 'record', data: { text: 'x'.repeat(1_048_577) } }] })).rejects.toThrow('1 MiB');
    expect(mocks.buildEvidencePackFromAction).not.toHaveBeenCalled();
    expect(mocks.processEvidencePack).not.toHaveBeenCalled();
  });

  it('refuses to process a pack if the builder discards an artifact', async () => {
    mocks.buildEvidencePackFromAction.mockReturnValue({ artifacts: [] });
    await expect(buildUnionEvidencePack({
      actionType: 'TEST', orgId: '11111111-1111-4111-8111-111111111111', actorId: 'actor',
      artifacts: [{ type: 'record', data: { id: 1 } }],
    })).rejects.toThrow('artifact count mismatch');
    expect(mocks.processEvidencePack).not.toHaveBeenCalled();
  });
});
