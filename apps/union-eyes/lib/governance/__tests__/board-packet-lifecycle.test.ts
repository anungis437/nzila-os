import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { BoardPacket } from '@/db/schema/board-packet-schema';
import {
  BOARD_PACKET_CONTENT_FIELDS,
  BoardPacketLifecycleError,
  boardPacketCertificationIntact,
  boardPacketContentHash,
  planBoardPacketUpdate,
  type BoardPacketContentField,
} from '../board-packet-lifecycle';

const NOW = new Date('2026-05-01T12:00:00Z');
const actor = { userId: 'admin-1', now: NOW };

const content = {
  title: 'Q1 packet',
  description: 'First quarter',
  packetType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  fiscalYear: 2026,
  fiscalQuarter: 1,
  financialSummary: { summary: 'On plan', reserves: 125000.5 },
  membershipStats: { summary: 'Steady' },
  caseSummary: { summary: 'Twelve open' },
  motionsAndVotes: null,
  auditExceptions: null,
  complianceStatus: { summary: 'Two outstanding' },
  actionItems: [{ item: 'File the return', owner: 'Treasurer' }],
  recipientRoles: ['board_member'],
  attachments: null,
};

const packet = (overrides: Partial<BoardPacket> = {}): BoardPacket =>
  ({
    id: 'pkt-1',
    organizationId: 'org-1',
    generatedBy: 'admin-0',
    generatedAt: new Date('2026-04-01T00:00:00Z'),
    status: 'draft',
    finalizedAt: null,
    distributedAt: null,
    distributionList: null,
    pdfUrl: null,
    contentHash: null,
    signedBy: null,
    signedAt: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    metadata: {},
    ...content,
    ...overrides,
  }) as BoardPacket;

const certified = (status: 'finalized' | 'distributed', overrides: Partial<BoardPacket> = {}) =>
  packet({
    status,
    finalizedAt: new Date('2026-04-10T00:00:00Z'),
    signedBy: 'admin-0',
    signedAt: new Date('2026-04-10T00:00:00Z'),
    contentHash: boardPacketContentHash(content as never),
    ...(status === 'distributed' ? { distributedAt: new Date('2026-04-11T00:00:00Z') } : {}),
    ...overrides,
  });

const refused = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BoardPacketLifecycleError);
    return error as BoardPacketLifecycleError;
  }
  throw new Error('expected the lifecycle to refuse');
};

describe('the content hash', () => {
  it('is the SHA-256 of the content as JSON with sorted keys and every unset field null, so a stored certification stays verifiable', () => {
    const canonical =
      '{"actionItems":[{"item":"File the return","owner":"Treasurer"}],"attachments":null,"auditExceptions":null,"caseSummary":{"summary":"Twelve open"},' +
      '"complianceStatus":{"summary":"Two outstanding"},"description":"First quarter","financialSummary":{"reserves":125000.5,"summary":"On plan"},' +
      '"fiscalQuarter":1,"fiscalYear":2026,"membershipStats":{"summary":"Steady"},"motionsAndVotes":null,"packetType":"quarterly","periodEnd":"2026-03-31",' +
      '"periodStart":"2026-01-01","recipientRoles":["board_member"],"title":"Q1 packet"}';
    expect(boardPacketContentHash(content as never)).toBe(createHash('sha256').update(canonical).digest('hex'));
  });

  it('does not depend on the order of keys inside a section', () => {
    const reordered = { ...content, financialSummary: { reserves: 125000.5, summary: 'On plan' } };
    expect(boardPacketContentHash(reordered as never)).toBe(boardPacketContentHash(content as never));
  });

  it('treats an unset field the same whether it is null or absent', () => {
    const { motionsAndVotes: _omitted, ...without } = content;
    expect(boardPacketContentHash(without as never)).toBe(boardPacketContentHash(content as never));
  });

  const alternatives: Record<BoardPacketContentField, unknown> = {
    title: 'Another title',
    description: 'Another description',
    packetType: 'annual',
    periodStart: '2026-01-02',
    periodEnd: '2026-04-01',
    fiscalYear: 2027,
    fiscalQuarter: 2,
    financialSummary: { summary: 'Off plan' },
    membershipStats: { summary: 'Falling' },
    caseSummary: { summary: 'Thirty open' },
    motionsAndVotes: { summary: 'One motion' },
    auditExceptions: { summary: 'One exception' },
    complianceStatus: { summary: 'All filed' },
    actionItems: [{ item: 'Something else' }],
    recipientRoles: ['auditor'],
    attachments: [{ name: 'minutes', url: 'https://example.test/minutes.pdf' }],
  };

  it.each(BOARD_PACKET_CONTENT_FIELDS)('changes when %s changes', (field) => {
    expect(boardPacketContentHash({ ...content, [field]: alternatives[field] } as never)).not.toBe(boardPacketContentHash(content as never));
  });

  it('is not affected by what the server records about the packet', () => {
    const recorded = { ...content, status: 'distributed', pdfUrl: 'data:application/pdf;base64,AA==', distributionList: [{ id: 'u1' }], updatedAt: NOW, signedBy: 'x' };
    expect(boardPacketContentHash(recorded as never)).toBe(boardPacketContentHash(content as never));
  });

  it('certifies only content that still matches', () => {
    expect(boardPacketCertificationIntact(certified('finalized'))).toBe(true);
    expect(boardPacketCertificationIntact(certified('finalized', { title: 'Edited later' }))).toBe(false);
    expect(boardPacketCertificationIntact(certified('finalized', { contentHash: null }))).toBe(false);
  });
});

describe('a draft', () => {
  it('is edited in place, with no certification', () => {
    const plan = planBoardPacketUpdate(packet(), { title: 'Renamed', fiscalYear: 2027 }, actor);
    expect(plan).toEqual({
      change: 'update',
      fromStatus: 'draft',
      set: { title: 'Renamed', fiscalYear: 2027, updatedAt: NOW },
      audit: { action: 'board_packet.update', details: { fields: ['title', 'fiscalYear'] } },
    });
  });

  it('changes nothing when the request changes nothing', () => {
    expect(planBoardPacketUpdate(packet(), {}, actor)).toEqual({ change: 'none' });
    expect(planBoardPacketUpdate(packet(), { status: 'draft' }, actor)).toEqual({ change: 'none' });
  });

  it('is finalized with the time, the person and the hash of the content it carries', () => {
    const plan = planBoardPacketUpdate(packet(), { status: 'finalized' }, actor);
    const hash = boardPacketContentHash(content as never);
    expect(plan).toEqual({
      change: 'update',
      fromStatus: 'draft',
      set: { status: 'finalized', finalizedAt: NOW, signedBy: 'admin-1', signedAt: NOW, contentHash: hash, updatedAt: NOW },
      audit: { action: 'board_packet.finalize', details: { fields: [], status: 'finalized', contentHash: hash } },
    });
  });

  it('is finalized over the content it has after the edits in the same request', () => {
    const plan = planBoardPacketUpdate(packet(), { status: 'finalized', title: 'Final title' }, actor);
    if (plan.change !== 'update') throw new Error('expected an update');
    expect(plan.set).toMatchObject({ title: 'Final title', contentHash: boardPacketContentHash({ ...content, title: 'Final title' } as never) });
    expect(plan.set.contentHash).not.toBe(boardPacketContentHash(content as never));
  });

  it('is archived by a request that does nothing else', () => {
    expect(planBoardPacketUpdate(packet(), { status: 'archived' }, actor)).toMatchObject({
      change: 'update',
      fromStatus: 'draft',
      set: { status: 'archived', updatedAt: NOW },
      audit: { action: 'board_packet.archive' },
    });
    expect(refused(() => planBoardPacketUpdate(packet(), { status: 'archived', title: 'x' }, actor)).code).toBe('ILLEGAL_TRANSITION');
  });

  it('refuses a period that ends before it starts, whether it is finalized or only edited', () => {
    expect(refused(() => planBoardPacketUpdate(packet(), { periodEnd: '2025-12-31' }, actor)).code).toBe('INVALID_PERIOD');
    expect(refused(() => planBoardPacketUpdate(packet(), { status: 'finalized', periodStart: '2026-04-01' }, actor)).code).toBe('INVALID_PERIOD');
  });
});

describe('a finalized packet', () => {
  it('locks its content, however the request is phrased', () => {
    expect(refused(() => planBoardPacketUpdate(certified('finalized'), { title: 'x' }, actor)).code).toBe('LOCKED');
    expect(refused(() => planBoardPacketUpdate(certified('finalized'), { status: 'finalized', title: 'x' }, actor)).code).toBe('LOCKED');
  });

  it('stays as it is when finalized again', () => {
    expect(planBoardPacketUpdate(certified('finalized'), { status: 'finalized' }, actor)).toEqual({ change: 'none' });
  });

  it('is reopened as a draft with its certification cleared, and the audit keeps the hash that was cleared', () => {
    const current = certified('finalized');
    expect(planBoardPacketUpdate(current, { status: 'draft' }, actor)).toEqual({
      change: 'update',
      fromStatus: 'finalized',
      set: { status: 'draft', finalizedAt: null, contentHash: null, signedBy: null, signedAt: null, updatedAt: NOW },
      audit: { action: 'board_packet.reopen', details: { status: 'draft', previousContentHash: current.contentHash } },
    });
  });

  it('is not reopened and edited in one request', () => {
    expect(refused(() => planBoardPacketUpdate(certified('finalized'), { status: 'draft', title: 'x' }, actor)).code).toBe('ILLEGAL_TRANSITION');
  });

  it('gets a new certification when it is reopened, edited and finalized again', () => {
    const first = certified('finalized');
    const reopened = packet({ title: 'Corrected title' });
    const plan = planBoardPacketUpdate(reopened, { status: 'finalized' }, actor);
    if (plan.change !== 'update') throw new Error('expected an update');
    expect(plan.set.contentHash).not.toBe(first.contentHash);
  });

  it('can be archived', () => {
    expect(planBoardPacketUpdate(certified('finalized'), { status: 'archived' }, actor)).toMatchObject({ change: 'update', fromStatus: 'finalized', set: { status: 'archived' } });
  });
});

describe('a distributed packet', () => {
  it('is the record of what was sent: it cannot be edited, reopened or finalized again', () => {
    const current = certified('distributed');
    expect(refused(() => planBoardPacketUpdate(current, { title: 'x' }, actor)).code).toBe('LOCKED');
    expect(refused(() => planBoardPacketUpdate(current, { status: 'draft' }, actor)).code).toBe('LOCKED');
    expect(refused(() => planBoardPacketUpdate(current, { status: 'finalized' }, actor)).code).toBe('LOCKED');
  });

  it('can only be archived', () => {
    expect(planBoardPacketUpdate(certified('distributed'), { status: 'archived' }, actor)).toMatchObject({ change: 'update', fromStatus: 'distributed', set: { status: 'archived' } });
  });
});

describe('an archived packet', () => {
  const archived = () => certified('distributed', { status: 'archived' });

  it('is closed', () => {
    expect(refused(() => planBoardPacketUpdate(archived(), { title: 'x' }, actor)).code).toBe('LOCKED');
    expect(refused(() => planBoardPacketUpdate(archived(), { status: 'draft' }, actor)).code).toBe('LOCKED');
  });

  it('is already archived when archived again, so there is nothing to record', () => {
    expect(planBoardPacketUpdate(archived(), { status: 'archived' }, actor)).toEqual({ change: 'none' });
  });
});

it('refuses a packet in a status it does not know', () => {
  expect(refused(() => planBoardPacketUpdate(packet({ status: 'approved' }), { title: 'x' }, actor)).code).toBe('ILLEGAL_TRANSITION');
});

it('does not touch the packet it plans from', () => {
  const current = packet();
  const before = JSON.stringify(current);
  planBoardPacketUpdate(current, { status: 'finalized', title: 'Final' }, actor);
  expect(JSON.stringify(current)).toBe(before);
});
