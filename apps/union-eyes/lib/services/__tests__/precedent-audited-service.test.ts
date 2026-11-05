import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const tx = { insert };
  const audit = vi.fn().mockResolvedValue(undefined);
  return { returning, values, insert, tx, audit };
});

vi.mock('@/db/schema', () => ({ arbitrationDecisions: { _: 'arbitration_decisions' } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_scope: unknown, fn: (tx: typeof mocks.tx) => Promise<unknown>) => fn(mocks.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));

import { withRLSContext } from '@/lib/db/with-rls-context';
import { createPrecedentAudited } from '../precedent-audited-service';

describe('shared precedent creation must never self-publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.returning.mockResolvedValue([{
      id: 'new-decision-id',
      caseNumber: 'ARB-2026-01',
      tribunal: 'OLRB',
      isPublic: false,
      accessRestrictions: 'pending_review',
    }]);
  });

  it('forces a non-public pending-review draft despite public-by-default schema', async () => {
    const result = await createPrecedentAudited(
      { organizationId: 'owner-org', userId: 'content-manager' },
      { caseNumber: 'ARB-2026-01', caseTitle: 'Review required' } as never,
    );
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      isPublic: false,
      accessRestrictions: 'pending_review',
    }));
    expect(withRLSContext).toHaveBeenCalledWith(
      { organizationId: 'owner-org', userId: 'content-manager' },
      expect.any(Function),
    );
    expect(result).toMatchObject({ isPublic: false, accessRestrictions: 'pending_review' });
  });

  it('cannot be promoted by a forged publication field in the supplied data', async () => {
    await createPrecedentAudited(
      { organizationId: 'owner-org', userId: 'content-manager' },
      { caseNumber: 'ARB-2026-01', isPublic: true, accessRestrictions: null } as never,
    );
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      isPublic: false,
      accessRestrictions: 'pending_review',
    }));
  });

  it('writes owner and actor provenance to the atomic audit in the same transaction', async () => {
    await createPrecedentAudited(
      { organizationId: 'owner-org', userId: 'content-manager' },
      { caseNumber: 'ARB-2026-01' } as never,
    );
    expect(mocks.audit).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      organizationId: 'owner-org',
      userId: 'content-manager',
      action: 'precedent.create',
      details: expect.objectContaining({
        publicationStatus: 'pending_review',
        sourceOrganizationId: 'owner-org',
      }),
    }));
  });

  it('fails the creation transaction if durable audit persistence fails', async () => {
    mocks.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(createPrecedentAudited(
      { organizationId: 'owner-org', userId: 'content-manager' },
      { caseNumber: 'ARB-2026-01' } as never,
    )).rejects.toThrow('audit unavailable');
  });
});
