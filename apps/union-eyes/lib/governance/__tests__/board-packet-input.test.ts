import { describe, expect, it } from 'vitest';
import { createBoardPacketSchema, parseBoardPacketId, updateBoardPacketSchema } from '../board-packet-input';

const valid = {
  title: 'Q1 packet',
  packetType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  fiscalYear: 2026,
  fiscalQuarter: 1,
  financialSummary: { summary: 'On plan', reservesCad: 125000 },
  membershipStats: { summary: 'Steady' },
  caseSummary: { summary: 'Twelve open' },
  complianceStatus: { summary: 'Two outstanding' },
  recipientRoles: ['board_member'],
};

const rejects = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) => expect(schema.safeParse(value).success).toBe(false);

describe('creating a board packet', () => {
  it('accepts a packet with its four sections, and any detail a section carries', () => {
    const parsed = createBoardPacketSchema.parse({
      ...valid,
      motionsAndVotes: { summary: 'One motion' },
      actionItems: [{ item: 'File the return', owner: 'Treasurer', deadline: '2026-04-30', status: 'open' }],
      attachments: [{ name: 'Minutes', type: 'application/pdf', url: 'https://files.example.test/minutes.pdf' }],
    });
    expect(parsed.financialSummary).toEqual({ summary: 'On plan', reservesCad: 125000 });
  });

  it('accepts an empty audience', () => {
    expect(createBoardPacketSchema.safeParse({ ...valid, recipientRoles: [] }).success).toBe(true);
  });

  it.each(['generatedBy', 'status', 'organizationId', 'pdfUrl', 'distributionList', 'contentHash', 'signedBy', 'signedAt', 'finalizedAt', 'distributedAt'])(
    'refuses %s: the server records it',
    (field) => {
      rejects(createBoardPacketSchema, { ...valid, [field]: field === 'status' ? 'finalized' : 'client-supplied' });
    },
  );

  it.each(['financialSummary', 'membershipStats', 'caseSummary', 'complianceStatus'] as const)('requires %s, with a summary', (section) => {
    const { [section]: _removed, ...without } = valid;
    rejects(createBoardPacketSchema, without);
    rejects(createBoardPacketSchema, { ...valid, [section]: {} });
    rejects(createBoardPacketSchema, { ...valid, [section]: { summary: '   ' } });
    rejects(createBoardPacketSchema, { ...valid, [section]: [] });
  });

  it('refuses a packet type that is not monthly, quarterly, annual or special', () => {
    rejects(createBoardPacketSchema, { ...valid, packetType: 'weekly' });
  });

  it('refuses dates that are not real calendar dates, and a period that ends before it starts', () => {
    rejects(createBoardPacketSchema, { ...valid, periodStart: '2026-02-30' });
    rejects(createBoardPacketSchema, { ...valid, periodStart: '01/01/2026' });
    rejects(createBoardPacketSchema, { ...valid, periodStart: '2026-04-01', periodEnd: '2026-03-31' });
    expect(createBoardPacketSchema.safeParse({ ...valid, periodStart: '2026-03-31', periodEnd: '2026-03-31' }).success).toBe(true);
  });

  it('refuses a fiscal quarter outside 1 to 4 and a fiscal year that is not a year', () => {
    rejects(createBoardPacketSchema, { ...valid, fiscalQuarter: 5 });
    rejects(createBoardPacketSchema, { ...valid, fiscalQuarter: 0 });
    rejects(createBoardPacketSchema, { ...valid, fiscalYear: 20260 });
  });

  it('refuses the NUL character anywhere a section holds text, because jsonb cannot store it', () => {
    const nul = String.fromCharCode(0);
    rejects(createBoardPacketSchema, { ...valid, title: `a${nul}b` });
    rejects(createBoardPacketSchema, { ...valid, financialSummary: { summary: 'ok', detail: { deep: [`x${nul}`] } } });
    rejects(createBoardPacketSchema, { ...valid, financialSummary: { summary: 'ok', [`k${nul}`]: 1 } });
  });

  it('refuses an attachment that is not an http(s) link, an action item with an unknown field, and an action item with a bad deadline', () => {
    rejects(createBoardPacketSchema, { ...valid, attachments: [{ name: 'x', url: 'javascript:alert(1)' }] });
    rejects(createBoardPacketSchema, { ...valid, attachments: [{ name: 'x', url: 'https://example.test/x', extra: true }] });
    rejects(createBoardPacketSchema, { ...valid, actionItems: [{ item: 'x', priority: 'high' }] });
    rejects(createBoardPacketSchema, { ...valid, actionItems: [{ item: 'x', deadline: 'soon' }] });
    rejects(createBoardPacketSchema, { ...valid, actionItems: { item: 'not an array' } });
  });
});

describe('updating a board packet', () => {
  it('accepts edits to any part of the content, and one move of the status', () => {
    expect(updateBoardPacketSchema.safeParse({ title: 'Renamed' }).success).toBe(true);
    expect(updateBoardPacketSchema.safeParse({ financialSummary: { summary: 'Revised' } }).success).toBe(true);
    for (const status of ['draft', 'finalized', 'archived']) expect(updateBoardPacketSchema.safeParse({ status }).success).toBe(true);
  });

  it('refuses an update that changes nothing', () => {
    rejects(updateBoardPacketSchema, {});
  });

  it('refuses the distributed status: distribution records its recipients and has its own route', () => {
    rejects(updateBoardPacketSchema, { status: 'distributed' });
  });

  it.each(['generatedBy', 'contentHash', 'signedBy', 'finalizedAt', 'pdfUrl', 'distributionList', 'organizationId'])('refuses %s: the server records it', (field) => {
    rejects(updateBoardPacketSchema, { [field]: 'client-supplied' });
  });

  it('checks the period when the request names both ends', () => {
    rejects(updateBoardPacketSchema, { periodStart: '2026-04-01', periodEnd: '2026-03-31' });
    expect(updateBoardPacketSchema.safeParse({ periodEnd: '2026-03-31' }).success).toBe(true);
  });

  it('holds a section to the same shape as at creation', () => {
    rejects(updateBoardPacketSchema, { caseSummary: { detail: 'no summary' } });
  });
});

describe('the packet id in a path', () => {
  it('is a uuid, and anything else names no packet', () => {
    expect(parseBoardPacketId('3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69')).toBe('3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69');
    for (const id of ['', 'bp_1', 'not-a-uuid', undefined, null, 42, "x'; DROP TABLE board_packets;--"]) expect(parseBoardPacketId(id)).toBeNull();
  });
});
