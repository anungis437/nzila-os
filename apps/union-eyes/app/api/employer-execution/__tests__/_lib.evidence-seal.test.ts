/**
 * DEF-0B6-EMP-EVIDENCE-SEAL-UNKEYED-HASH: proves the evidence chain's seal and link id are now a keyed HMAC
 * (EVIDENCE_SEAL_KEY), not a plain, publicly-recomputable sha256 of the entity type, run id and manifest hash.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEvidenceChainLink, createEvidencePack, sha256, verifyEvidenceSeal } from '../_lib';

const ORIGINAL_ENV = { ...process.env };

describe('employer-execution evidence seal (keyed HMAC)', () => {
  beforeEach(() => {
    process.env.EVIDENCE_SEAL_KEY = 'a'.repeat(32);
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('the seal is not the plain sha256 of the entity type, run id and manifest hash', () => {
    const { manifest, manifestHash, seal } = createEvidencePack({
      entityType: 'payroll_run',
      runRefId: 'run-1',
      organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }],
      metadata: {},
    });
    const unkeyedSeal = sha256(`${manifest.entityType}:${manifest.runRefId}:${manifestHash}`);
    expect(seal).not.toBe(unkeyedSeal);
  });

  it('verifyEvidenceSeal confirms a genuine seal and rejects a forged one computed without the key', () => {
    const { manifest, manifestHash, seal } = createEvidencePack({
      entityType: 'payroll_run',
      runRefId: 'run-1',
      organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }],
      metadata: {},
    });
    expect(verifyEvidenceSeal({ entityType: manifest.entityType, runRefId: manifest.runRefId, manifestHash, seal })).toBe(true);

    // An attacker who can write artifact rows but does not have EVIDENCE_SEAL_KEY can still compute a plain sha256:
    // that forged value must not verify.
    const forged = sha256(`${manifest.entityType}:${manifest.runRefId}:${manifestHash}`);
    expect(verifyEvidenceSeal({ entityType: manifest.entityType, runRefId: manifest.runRefId, manifestHash, seal: forged })).toBe(false);
  });

  it('two different manifest hashes under the same key produce different seals (no fixed/degenerate output)', () => {
    const a = createEvidencePack({
      entityType: 'payroll_run', runRefId: 'run-1', organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }], metadata: {},
    });
    const b = createEvidencePack({
      entityType: 'payroll_run', runRefId: 'run-1', organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 2 } }], metadata: {},
    });
    expect(a.seal).not.toBe(b.seal);
  });

  it('a different EVIDENCE_SEAL_KEY produces a different seal for the same content', () => {
    const first = createEvidencePack({
      entityType: 'payroll_run', runRefId: 'run-1', organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }], metadata: {},
    });
    process.env.EVIDENCE_SEAL_KEY = 'b'.repeat(32);
    const second = createEvidencePack({
      entityType: 'payroll_run', runRefId: 'run-1', organizationId: 'org-1',
      artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }], metadata: {},
    });
    expect(first.seal).not.toBe(second.seal);
  });

  it('the evidence chain link id is also keyed, not a plain sha256', () => {
    const link = createEvidenceChainLink({
      organizationId: 'org-1',
      entityType: 'payroll_run',
      targetEntityId: 'run-1',
      manifestHash: 'deadbeef',
      sealHash: 'seal-1',
    });
    const unkeyed = sha256('payroll_run:run-1:deadbeef');
    expect(link.linkId).not.toBe(unkeyed);
  });

  it('throws in production when EVIDENCE_SEAL_KEY is unset, rather than silently sealing with an unkeyed hash', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.EVIDENCE_SEAL_KEY;
    expect(() =>
      createEvidencePack({
        entityType: 'payroll_run', runRefId: 'run-1', organizationId: 'org-1',
        artifacts: [{ artifactType: 'summary', artifactName: 's.json', payload: { a: 1 } }], metadata: {},
      }),
    ).toThrow(/EVIDENCE_SEAL_KEY/);
  });
});
