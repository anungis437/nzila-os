import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  dbLimit: vi.fn(),
  q: {
    createSegment: vi.fn(),
    getSegments: vi.fn(),
    getSegmentById: vi.fn(),
    updateSegment: vi.fn(),
    deleteSegment: vi.fn(),
    searchMembersAdvanced: vi.fn(),
    executeSegment: vi.fn(),
    getSegmentExecutions: vi.fn(),
    logSegmentExport: vi.fn(),
    getExportHistory: vi.fn(),
    generateExportWatermark: vi.fn(),
    generateExportHash: vi.fn(),
  },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock('@/db', () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: mocks.dbLimit,
  };
  return { db: chain };
});

vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name', slug: 'slug' } }));
vi.mock('@/db/queries/member-segments-queries', () => mocks.q);
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import * as actions from '../member-segments-actions';

describe('member-segments-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
    mocks.currentUser.mockResolvedValue({ fullName: 'Jane Doe' });
    mocks.dbLimit.mockResolvedValue([{ name: 'Acme Union' }]);
    for (const fn of Object.values(mocks.q)) fn.mockResolvedValue('OK');
    mocks.q.searchMembersAdvanced.mockResolvedValue({ members: [{ id: 'm1' }], total: 1 });
    mocks.q.executeSegment.mockResolvedValue({ members: [{ id: 'm1' }], total: 1 });
    mocks.q.getSegmentById.mockResolvedValue({ id: 's1' });
    mocks.q.logSegmentExport.mockResolvedValue({ id: 'export-1' });
    mocks.q.generateExportWatermark.mockReturnValue('WATERMARK');
    mocks.q.generateExportHash.mockReturnValue('HASH');
  });

  afterEach(() => vi.restoreAllMocks());

  describe('CRUD', () => {
    it('createMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.createMemberSegmentAction({} as never)).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.createMemberSegmentAction({} as never)).isSuccess).toBe(false);

      mocks.q.createSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.createMemberSegmentAction({} as never)).isSuccess).toBe(false);
    });

    it('getMemberSegmentsAction: success (private), unauth, error', async () => {
      expect((await actions.getMemberSegmentsAction('org', true)).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.getMemberSegmentsAction('org')).isSuccess).toBe(false);

      mocks.q.getSegments.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getMemberSegmentsAction('org')).isSuccess).toBe(false);
    });

    it('getMemberSegmentByIdAction: found, not found, error', async () => {
      expect((await actions.getMemberSegmentByIdAction('s1', 'org')).isSuccess).toBe(true);

      mocks.q.getSegmentById.mockResolvedValueOnce(null);
      const nf = await actions.getMemberSegmentByIdAction('s1', 'org');
      expect(nf).toEqual({ isSuccess: false, message: 'Segment not found' });

      mocks.q.getSegmentById.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getMemberSegmentByIdAction('s1', 'org')).isSuccess).toBe(false);
    });

    it('updateMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.updateMemberSegmentAction('s1', {})).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.updateMemberSegmentAction('s1', {})).isSuccess).toBe(false);

      mocks.q.updateSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.updateMemberSegmentAction('s1', {})).isSuccess).toBe(false);
    });

    it('deleteMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.deleteMemberSegmentAction('s1')).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.deleteMemberSegmentAction('s1')).isSuccess).toBe(false);

      mocks.q.deleteSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.deleteMemberSegmentAction('s1')).isSuccess).toBe(false);
    });
  });

  describe('search & execute', () => {
    it('searchMembersAdvancedAction: success, unauth, error', async () => {
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(false);

      mocks.q.searchMembersAdvanced.mockRejectedValueOnce(new Error('x'));
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(false);
    });

    it('executeSegmentAction: success, unauth, error', async () => {
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(false);

      mocks.q.executeSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(false);
    });

    it('getSegmentExecutionHistoryAction: success, error', async () => {
      expect((await actions.getSegmentExecutionHistoryAction('s1')).isSuccess).toBe(true);

      mocks.q.getSegmentExecutions.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getSegmentExecutionHistoryAction('s1')).isSuccess).toBe(false);
    });
  });

  describe('exportMembersAction', () => {
    it('exports from a saved segment', async () => {
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(true);
      expect(r.data).toEqual({ exportId: 'export-1', watermark: 'WATERMARK' });
    });

    it('exports from ad-hoc filters', async () => {
      const r = await actions.exportMembersAction('org', {} as never, null, 'excel', ['name']);
      expect(r.isSuccess).toBe(true);
    });

    it('requires segmentId or filters', async () => {
      const r = await actions.exportMembersAction('org', null, null, 'csv', ['name']);
      expect(r).toEqual({ isSuccess: false, message: 'Must provide either segmentId or filters' });
    });

    it('rejects when unauthenticated', async () => {
      mocks.auth.mockResolvedValueOnce({ userId: null });
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(false);
    });

    it('falls back to assembled name when fullName is missing', async () => {
      mocks.currentUser.mockResolvedValueOnce({ firstName: 'Jane', lastName: 'Doe' });
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(true);
    });

    it('falls back to email then userId when names absent', async () => {
      mocks.currentUser.mockResolvedValueOnce({ primaryEmailAddress: { emailAddress: 'j@d.com' } });
      expect((await actions.exportMembersAction('org', null, 's1', 'csv', ['name'])).isSuccess).toBe(true);

      mocks.currentUser.mockResolvedValueOnce(null);
      expect((await actions.exportMembersAction('org', null, 's1', 'csv', ['name'])).isSuccess).toBe(true);
    });

    it('uses organizationId when org lookup returns nothing', async () => {
      mocks.dbLimit.mockResolvedValueOnce([]);
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(true);
    });

    it('handles export errors', async () => {
      mocks.q.logSegmentExport.mockRejectedValueOnce(new Error('x'));
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(false);
    });
  });

  describe('getExportHistoryAction', () => {
    it('success, unauth, error', async () => {
      expect((await actions.getExportHistoryAction('org', 10)).isSuccess).toBe(true);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.getExportHistoryAction('org')).isSuccess).toBe(false);

      mocks.q.getExportHistory.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getExportHistoryAction('org')).isSuccess).toBe(false);
    });
  });
});
