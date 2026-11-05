import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boardPacketContentHash } from '@/lib/governance/board-packet-lifecycle';

const mocks = vi.hoisted(() => ({
  renderToBuffer: vi.fn(),
  getEmailService: vi.fn(),
  audit: vi.fn(),
  tx: {} as Record<string, unknown>,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mocks.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: { userId: 'm.user_id', organizationId: 'm.organization_id', name: 'm.name', email: 'm.email', status: 'm.status', deletedAt: 'm.deleted_at' },
}));
vi.mock('@/db/schema/board-packet-schema', () => ({
  boardPackets: { id: 'p.id', organizationId: 'p.organization_id', status: 'p.status', contentHash: 'p.content_hash' },
  boardPacketDistributions: { id: 'd.id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: (field: unknown, value: unknown) => ({ eq: [field, value] }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  inArray: (field: unknown, values: unknown) => ({ inArray: [field, values] }),
  isNull: (field: unknown) => ({ isNull: field }),
}));
vi.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  renderToBuffer: mocks.renderToBuffer,
}));
vi.mock('@/lib/services/messaging/email-service', () => ({ getEmailService: mocks.getEmailService }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { BoardPacketGenerator } from '../board-packet-generator';

const content = {
  title: 'Q1 <Board> & "Finance" packet',
  description: null,
  packetType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  fiscalYear: 2026,
  fiscalQuarter: 1,
  financialSummary: { summary: 'Dues revenue on plan', reservesCad: 125000 },
  membershipStats: { summary: 'Membership steady' },
  caseSummary: { summary: 'Twelve open grievances' },
  motionsAndVotes: null,
  auditExceptions: null,
  complianceStatus: { summary: 'Two filings outstanding' },
  actionItems: [{ item: 'File the T2 return', owner: 'Treasurer', deadline: '2026-04-30' }],
  recipientRoles: ['board_member'],
  attachments: null,
};

const finalized = (overrides: Record<string, unknown> = {}) => ({
  id: 'pkt-1',
  organizationId: 'org-1',
  status: 'finalized',
  ...content,
  finalizedAt: new Date('2026-04-02T10:00:00Z'),
  signedBy: 'admin-0',
  contentHash: boardPacketContentHash(content as never),
  ...overrides,
});

/** The text of every <Text> node in the element handed to the PDF renderer. */
function pdfTexts(node: unknown): string[] {
  const element = node as { type?: unknown; props?: { children?: unknown } } | string | null | undefined;
  if (typeof element === 'string') return [element];
  if (!element || typeof element !== 'object') return [];
  const children = element.props?.children;
  return (Array.isArray(children) ? children : [children]).flatMap(pdfTexts);
}

describe('BoardPacketGenerator.distributePacket', () => {
  const generator = new BoardPacketGenerator();
  const context = { organizationId: 'org-1', userId: 'admin-1' };
  const recipients = [{ recipientId: 'u1', recipientRole: 'board_member' }];
  let send: ReturnType<typeof vi.fn>;
  let packet: Record<string, unknown> | undefined;
  let members: Array<{ userId: string; name: string; email: string }>;
  let insertValues: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let updateSet: ReturnType<typeof vi.fn>;
  let updateReturning: ReturnType<typeof vi.fn>;
  let memberWhere: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    memberWhere = undefined;
    packet = finalized();
    members = [{ userId: 'u1', name: 'Alice <Admin>', email: 'alice@union.test' }];
    send = vi.fn().mockResolvedValue({ id: 'email-1' });
    mocks.getEmailService.mockReturnValue({ send });
    mocks.audit.mockResolvedValue(undefined);
    mocks.renderToBuffer.mockResolvedValue(Buffer.from('pdf'));

    insertValues = vi.fn((rows: Array<Record<string, unknown>>) => ({ returning: async () => rows.map((row, index) => ({ id: `d${index}`, ...row })) }));
    updateReturning = vi.fn(async () => [{ id: 'pkt-1' }]);
    updateWhere = vi.fn(() => ({ returning: updateReturning }));
    updateSet = vi.fn(() => ({ where: updateWhere }));
    // The packet is read with no column list; the members with one.
    mocks.tx.select = vi.fn((columns?: unknown) =>
      columns === undefined
        ? { from: () => ({ where: () => ({ limit: async () => (packet ? [packet] : []) }) }) }
        : {
            from: () => ({
              where: async (condition: unknown) => {
                memberWhere = condition;
                return members;
              },
            }),
          },
    );
    mocks.tx.insert = vi.fn(() => ({ values: insertValues }));
    mocks.tx.update = vi.fn(() => ({ set: updateSet }));
  });

  it('records the distribution, the status change and the audit on one transaction, then emails the address and name on the membership record', async () => {
    const result = await generator.distributePacket('pkt-1', recipients, context);

    expect(mocks.tx.insert).toHaveBeenCalledTimes(1);
    expect(mocks.tx.update).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ packetId: 'pkt-1', recipientId: 'u1', recipientName: 'Alice <Admin>', recipientEmail: 'alice@union.test', recipientRole: 'board_member' }),
    ]);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'distributed' }));
    expect(mocks.audit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'admin-1',
        action: 'board_packet.distribute',
        resourceId: 'pkt-1',
        details: expect.objectContaining({ recipientIds: ['u1'], contentHash: (packet as { contentHash: string }).contentHash }),
      }),
    );
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@union.test' }));
    expect(result).toMatchObject({ delivered: 1, failed: 0 });
  });

  it('writes the distribution only against the content that was certified and rendered', async () => {
    await generator.distributePacket('pkt-1', recipients, context);
    const predicate = JSON.stringify(updateWhere.mock.calls[0]);
    expect(predicate).toContain('"p.content_hash"');
    expect(predicate).toContain((packet as { contentHash: string }).contentHash);
    expect(predicate).toContain('"p.status"');
    expect(predicate).toContain('"p.organization_id"');
  });

  it('asks the membership lookup for active, undeleted members of the organization only', async () => {
    await generator.distributePacket('pkt-1', recipients, context);
    const filter = JSON.stringify(memberWhere);
    expect(filter).toContain('["m.organization_id","org-1"]');
    expect(filter).toContain('["m.status","active"]');
    expect(filter).toContain('"isNull":"m.deleted_at"');
    expect(filter).toContain('["m.user_id",["u1"]]');
  });

  it('escapes the packet title and the recipient name in the email, and sanitizes the attachment name', async () => {
    await generator.distributePacket('pkt-1', recipients, context);
    const email = send.mock.calls[0][0] as { html: string; subject: string; attachments: Array<{ filename: string }> };
    expect(email.html).toContain('Q1 &lt;Board&gt; &amp; &quot;Finance&quot; packet');
    expect(email.html).toContain('Hello Alice &lt;Admin&gt;,');
    expect(email.html).not.toContain('<Board>');
    expect(email.attachments[0].filename).toBe('Q1_Board_Finance_packet.pdf');
  });

  it('renders every section an officer wrote, its details and the certification, not only the summaries', async () => {
    await generator.distributePacket('pkt-1', recipients, context);
    const texts = pdfTexts(mocks.renderToBuffer.mock.calls[0][0]);
    expect(texts).toEqual(
      expect.arrayContaining([
        'Q1 <Board> & "Finance" packet',
        'Period: 2026-01-01 to 2026-03-31',
        'Financial Summary: Dues revenue on plan',
        '    reservesCad: 125000',
        'Membership Summary: Membership steady',
        'Case Summary: Twelve open grievances',
        'Compliance Summary: Two filings outstanding',
        'Action items:',
        '    - File the T2 return (owner Treasurer, due 2026-04-30)',
      ]),
    );
    expect(texts.some((line) => line.startsWith('Certified: 2026-04-02T10:00:00.000Z by admin-0 (SHA-256 '))).toBe(true);
    expect(texts.join('\n')).not.toMatch(/Motions and Votes|Audit Exceptions/);
    expect(texts.join('\n')).not.toMatch(/all compliance requirements met|pending integration|placeholder/i);
  });

  it('refuses a recipient who is not an active member of the organization, and distributes nothing', async () => {
    members = [];
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mocks.tx.insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a packet that is not finalized', async () => {
    packet = finalized({ status: 'draft' });
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a finalized packet whose content no longer matches its certification', async () => {
    packet = finalized({ title: 'Edited after it was certified' });
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.renderToBuffer).not.toHaveBeenCalled();
    expect(mocks.tx.insert).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a finalized packet that carries no certification at all', async () => {
    packet = finalized({ contentHash: null });
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.tx.insert).not.toHaveBeenCalled();
  });

  it('answers a conflict, sends nothing and writes no audit when the packet changed concurrently', async () => {
    updateReturning.mockResolvedValueOnce([]);
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing when the audit cannot be written', async () => {
    mocks.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toThrow('audit unavailable');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports and audits a failed delivery without undoing the recorded distribution', async () => {
    send.mockRejectedValueOnce(new Error('smtp down'));
    const result = await generator.distributePacket('pkt-1', recipients, context);
    expect(result).toMatchObject({ delivered: 0, failed: 1 });
    expect(mocks.audit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ action: 'board_packet.distribute.delivery_failed', details: { failedRecipientIds: ['u1'] } }),
    );
  });

  it('answers not found for a packet that does not exist or belongs to another organization', async () => {
    packet = undefined;
    await expect(generator.distributePacket('pkt-999', recipients, context)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.tx.insert).not.toHaveBeenCalled();
  });
});
