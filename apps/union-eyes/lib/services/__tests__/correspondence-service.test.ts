import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  createAuditLog: vi.fn(),
}));

function makeChain() {
  const c: Record<string, unknown> = {};
  for (const m of [
    'select', 'from', 'where', 'orderBy', 'limit', 'offset', 'insert', 'update', 'values', 'set', 'returning',
  ]) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? []);
  };
  return c;
}

const chain = makeChain();

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  desc: vi.fn(() => 'desc'),
  asc: vi.fn(() => 'asc'),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
}));

vi.mock('@/lib/services/audit-service', () => ({
  createAuditLog: h.createAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db/schema/domains/documents/correspondence', () => {
  const t = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    correspondence: t('correspondence'),
    correspondenceRecipients: t('correspondenceRecipients'),
    correspondenceAuditTrail: t('correspondenceAuditTrail'),
    userSignatures: t('userSignatures'),
  };
});

import {
  createCorrespondence,
  getCorrespondenceById,
  getCorrespondenceWithDetails,
  listCorrespondence,
  updateCorrespondence,
  submitForReview,
  approveCorrespondence,
  requestRevision,
  signCorrespondence,
  dispatchCorrespondence,
  confirmDelivery,
  cancelCorrespondence,
  saveUserSignature,
  getUserDefaultSignature,
  getUserSignatures,
  getCorrespondenceAuditTrail,
} from '../correspondence-service';

beforeEach(() => {
  h.queue = [];
  h.createAuditLog.mockReset();
});

describe('correspondence-service', () => {
  it('createCorrespondence creates draft with recipients and audit', async () => {
    h.queue = [
      [{ count: 2 }],
      [{ id: 'c1', organizationId: 'o1', referenceNumber: 'LTR-2026-0003', subject: 'S', status: 'draft' }],
      [],
      [],
      [],
    ];

    const row = await createCorrespondence({
      organizationId: 'o1',
      subject: 'S',
      body: 'B',
      draftedBy: 'u1',
      assignedSignerId: 'signer1',
      recipients: [{ name: 'Recipient', email: 'r@test.com' }],
    });

    expect(row.id).toBe('c1');
    expect(h.createAuditLog).toHaveBeenCalled();
  });

  it('getCorrespondenceById and getCorrespondenceWithDetails return expected shapes', async () => {
    h.queue = [[{ id: 'c1' }]];
    expect(await getCorrespondenceById('c1')).toEqual({ id: 'c1' });

    h.queue = [[{ id: 'c1' }], [{ id: 'r1' }], [{ id: 'a1' }]];
    const details = await getCorrespondenceWithDetails('c1');
    expect(details?.recipients).toEqual([{ id: 'r1' }]);
    expect(details?.auditTrail).toEqual([{ id: 'a1' }]);

    h.queue = [[]];
    expect(await getCorrespondenceWithDetails('missing')).toBeNull();
  });

  it('listCorrespondence returns rows with filters', async () => {
    h.queue = [[{ id: 'c1' }]];
    const rows = await listCorrespondence({
      organizationId: 'o1',
      status: 'draft',
      draftedBy: 'u1',
      assignedSignerId: 'u2',
      limit: 10,
      offset: 2,
    });
    expect(rows).toEqual([{ id: 'c1' }]);
  });

  it('updateCorrespondence enforces draft-only edits', async () => {
    h.queue = [[{ id: 'c1', status: 'draft' }], [{ id: 'c1', subject: 'N' }], [], []];
    const updated = await updateCorrespondence({ id: 'c1', subject: 'N', actorUserId: 'u1' });
    expect(updated.subject).toBe('N');

    h.queue = [[]];
    await expect(updateCorrespondence({ id: 'missing', subject: 'N', actorUserId: 'u1' })).rejects.toThrow(
      'Correspondence not found',
    );

    h.queue = [[{ id: 'c1', status: 'approved' }]];
    await expect(updateCorrespondence({ id: 'c1', subject: 'N', actorUserId: 'u1' })).rejects.toThrow(
      'must be in draft',
    );
  });

  it('submitForReview handles happy path and signer guard', async () => {
    h.queue = [[{ id: 'c1', status: 'draft', assignedSignerId: 'u2', organizationId: 'o1', referenceNumber: 'LTR-1' }], [{ id: 'c1', status: 'pending_review' }], [], []];
    const updated = await submitForReview('c1', { actorUserId: 'u1' });
    expect(updated.status).toBe('pending_review');

    h.queue = [[{ id: 'c1', status: 'draft', assignedSignerId: null }]];
    await expect(submitForReview('c1', { actorUserId: 'u1' })).rejects.toThrow('assigned signer');
  });

  it('approve/requestRevision/dispatch/confirmDelivery/cancel flow transitions', async () => {
    h.queue = [[{ id: 'c1', status: 'pending_review', organizationId: 'o1', referenceNumber: 'LTR-1' }], [{ id: 'c1', status: 'approved' }], [], []];
    expect((await approveCorrespondence('c1', { actorUserId: 'u1' })).status).toBe('approved');

    h.queue = [[{ id: 'c1', status: 'approved' }], [{ id: 'c1', status: 'draft' }], [], []];
    expect((await requestRevision('c1', 'fix wording', { actorUserId: 'u1' })).status).toBe('draft');

    h.queue = [[{ id: 'c1', status: 'signed', organizationId: 'o1', referenceNumber: 'LTR-1' }], [{ id: 'c1', status: 'dispatched' }], [], []];
    expect((await dispatchCorrespondence('c1', { actorUserId: 'u1', dispatchMethod: 'email' })).status).toBe('dispatched');

    h.queue = [[{ id: 'c1', status: 'dispatched' }], [{ id: 'c1', status: 'delivered' }], [], []];
    expect((await confirmDelivery('c1', { actorUserId: 'u1' })).status).toBe('delivered');

    h.queue = [[{ id: 'c1', status: 'draft' }], [{ id: 'c1', status: 'cancelled' }], [], []];
    expect((await cancelCorrespondence('c1', 'cancel', { actorUserId: 'u1' })).status).toBe('cancelled');
  });

  it('signCorrespondence enforces signer ownership and signature validity', async () => {
    h.queue = [[{ id: 'c1', status: 'approved', assignedSignerId: 'u2' }]];
    await expect(signCorrespondence('c1', { actorUserId: 'u1', signatureId: 's1' })).rejects.toThrow(
      'Only the assigned signer',
    );

    h.queue = [[{ id: 'c1', status: 'approved', assignedSignerId: 'u1' }], []];
    await expect(signCorrespondence('c1', { actorUserId: 'u1', signatureId: 's1' })).rejects.toThrow(
      'Signature not found',
    );

    h.queue = [[{ id: 'c1', status: 'approved', assignedSignerId: 'u1', organizationId: 'o1', referenceNumber: 'LTR-1' }], [{ id: 'sig1' }], [{ id: 'c1', status: 'signed' }], [], []];
    expect((await signCorrespondence('c1', { actorUserId: 'u1', signatureId: 'sig1' })).status).toBe('signed');
  });

  it('signature helpers and audit query return records', async () => {
    h.queue = [[], [{ id: 'sig1' }]];
    expect((await saveUserSignature({
      organizationId: 'o1', userId: 'u1', displayName: 'U', source: 'typed', imageUrl: 'u', imageHash: 'h',
    })).id).toBe('sig1');

    h.queue = [[{ id: 'sigDefault' }]];
    expect(await getUserDefaultSignature('u1', 'o1')).toEqual({ id: 'sigDefault' });

    h.queue = [[{ id: 'sig1' }, { id: 'sig2' }]];
    expect(await getUserSignatures('u1', 'o1')).toHaveLength(2);

    h.queue = [[{ id: 'a1' }]];
    expect(await getCorrespondenceAuditTrail('c1')).toEqual([{ id: 'a1' }]);
  });
});
