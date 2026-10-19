import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  dbLimit: vi.fn(),
  authorize: vi.fn(),
  resolveVisibility: vi.fn(),
  auditSensitive: vi.fn(),
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
vi.mock('@/lib/member-segments/authorize-segment-access', () => ({
  authorizeMemberSegmentAccess: mocks.authorize,
  resolveSegmentVisibility: mocks.resolveVisibility,
  recordSensitiveSegmentAccess: mocks.auditSensitive,
  segmentMutationAllowed: (actorUserId: string, segment: { createdBy: string }, canManageOthers: boolean) =>
    segment.createdBy === actorUserId || canManageOthers,
  MEMBER_SEGMENT_EXPORT_ENTITLEMENT: 'export_suite',
}));

import * as actions from '../member-segments-actions';

describe('member-segments-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
    mocks.authorize.mockImplementation(async (organizationId: string) => ({
      ok: true,
      userId: 'user-1',
      organizationId,
    }));
    mocks.resolveVisibility.mockImplementation(async (access: { userId: string }, intent: string) => ({
      ok: true,
      visibility: {
        actorUserId: access.userId,
        includeOthersPrivate: intent === 'record' ? false : intent === 'include-others-private',
      },
    }));
    mocks.currentUser.mockResolvedValue({ fullName: 'Jane Doe' });
    mocks.dbLimit.mockResolvedValue([{ name: 'Acme Union' }]);
    for (const fn of Object.values(mocks.q)) fn.mockResolvedValue('OK');
    mocks.q.getSegments.mockResolvedValue([]);
    mocks.q.searchMembersAdvanced.mockResolvedValue({ members: [{ id: 'm1' }], total: 1 });
    mocks.q.executeSegment.mockResolvedValue({ members: [{ id: 'm1' }], total: 1 });
    mocks.q.getSegmentById.mockResolvedValue({ id: 's1', createdBy: 'user-1', isPublic: true });
    mocks.auditSensitive.mockResolvedValue(true);
    mocks.q.logSegmentExport.mockResolvedValue({ id: 'export-1' });
    mocks.q.generateExportWatermark.mockReturnValue('WATERMARK');
    mocks.q.generateExportHash.mockReturnValue('HASH');
  });

  afterEach(() => vi.restoreAllMocks());

  describe('CRUD', () => {
    it('createMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.createMemberSegmentAction({ organizationId: 'org' } as never)).isSuccess).toBe(true);
      expect(mocks.q.createSegment).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org', createdBy: 'user-1' }),
      );

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.createMemberSegmentAction({ organizationId: 'org' } as never)).isSuccess).toBe(false);
      expect(mocks.q.createSegment).toHaveBeenCalledTimes(1);

      mocks.q.createSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.createMemberSegmentAction({ organizationId: 'org' } as never)).isSuccess).toBe(false);
    });

    it('getMemberSegmentsAction: success (private), unauth, error', async () => {
      expect((await actions.getMemberSegmentsAction('org', true)).isSuccess).toBe(true);
      expect(mocks.q.getSegments).toHaveBeenCalledWith('org', {
        actorUserId: 'user-1',
        includeOthersPrivate: true,
      });

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.getMemberSegmentsAction('org')).isSuccess).toBe(false);

      mocks.q.getSegments.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getMemberSegmentsAction('org')).isSuccess).toBe(false);
    });

    it('default list keeps other members private segments out of the query', async () => {
      const ORG_A = '11111111-1111-4111-8111-111111111111';
      const result = await actions.getMemberSegmentsAction(ORG_A, false);
      expect(result.isSuccess).toBe(true);
      expect(mocks.resolveVisibility).toHaveBeenCalledWith(
        { ok: true, userId: 'user-1', organizationId: ORG_A },
        'own-and-public',
      );
      expect(mocks.q.getSegments).toHaveBeenCalledWith(ORG_A, {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });
    });

    it('refuses another organization and another steward private list', async () => {
      const ORG_B = '22222222-2222-4222-8222-222222222222';
      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Forbidden' });
      const crossTenant = await actions.getMemberSegmentsAction(ORG_B, true);
      expect(crossTenant).toEqual({ isSuccess: false, message: 'Forbidden' });
      expect(mocks.q.getSegments).not.toHaveBeenCalled();

      mocks.resolveVisibility.mockResolvedValueOnce({ ok: false, message: 'Forbidden' });
      const otherPrivate = await actions.getMemberSegmentsAction('org', true);
      expect(otherPrivate).toEqual({ isSuccess: false, message: 'Forbidden' });
      expect(mocks.q.getSegments).not.toHaveBeenCalled();
    });

    it('getMemberSegmentByIdAction: found, not found, error', async () => {
      expect((await actions.getMemberSegmentByIdAction('s1', 'org')).isSuccess).toBe(true);
      expect(mocks.authorize).toHaveBeenCalledWith('org', undefined);
      expect(mocks.q.getSegmentById).toHaveBeenCalledWith('s1', 'org', {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });

      mocks.q.getSegmentById.mockResolvedValueOnce(null);
      const nf = await actions.getMemberSegmentByIdAction('s1', 'org');
      expect(nf).toEqual({ isSuccess: false, message: 'Segment not found' });

      mocks.q.getSegmentById.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getMemberSegmentByIdAction('s1', 'org')).isSuccess).toBe(false);
    });

    it('updateMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.updateMemberSegmentAction('s1', 'org', {})).isSuccess).toBe(true);
      expect(mocks.q.updateSegment).toHaveBeenCalledWith('s1', {}, 'org', {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.updateMemberSegmentAction('s1', 'org', {})).isSuccess).toBe(false);

      mocks.q.updateSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.updateMemberSegmentAction('s1', 'org', {})).isSuccess).toBe(false);
    });

    it('deleteMemberSegmentAction: success, unauth, error', async () => {
      expect((await actions.deleteMemberSegmentAction('s1', 'org')).isSuccess).toBe(true);
      expect(mocks.q.deleteSegment).toHaveBeenCalledWith('s1', 'org', {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.deleteMemberSegmentAction('s1', 'org')).isSuccess).toBe(false);

      mocks.q.deleteSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.deleteMemberSegmentAction('s1', 'org')).isSuccess).toBe(false);
    });

    it('lets the creator change a public or private segment and lets a steward read a public one', async () => {
      const ORG_A = '11111111-1111-4111-8111-111111111111';
      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's-public', createdBy: 'user-1', isPublic: true });
      expect((await actions.updateMemberSegmentAction('s-public', ORG_A, { name: 'Mine' })).isSuccess).toBe(true);
      expect(mocks.q.updateSegment).toHaveBeenCalledWith('s-public', { name: 'Mine' }, ORG_A, {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });
      expect(mocks.auditSensitive).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'update',
        segments: [{ segmentId: 's-public', ownerUserId: 'user-1', isPublic: true }],
      }));

      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's-public', createdBy: 'steward-b', isPublic: true });
      const read = await actions.getMemberSegmentByIdAction('s-public', ORG_A);
      expect(read.isSuccess).toBe(true);
      expect(mocks.q.executeSegment).not.toHaveBeenCalled();
    });

    it('denies a non-owner steward update or delete of another public or private segment', async () => {
      const ORG_A = '11111111-1111-4111-8111-111111111111';
      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's-public', createdBy: 'steward-b', isPublic: true });
      const publicUpdate = await actions.updateMemberSegmentAction('s-public', ORG_A, { name: 'Changed' });
      expect(publicUpdate).toEqual({ isSuccess: false, message: 'Segment not found' });

      mocks.q.getSegmentById.mockResolvedValueOnce(null);
      const privateUpdate = await actions.updateMemberSegmentAction('s-private', ORG_A, { name: 'Changed' });
      expect(privateUpdate).toEqual({ isSuccess: false, message: 'Segment not found' });

      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's-public', createdBy: 'steward-b', isPublic: true });
      const publicDelete = await actions.deleteMemberSegmentAction('s-public', ORG_A);
      expect(publicDelete).toEqual({ isSuccess: false, message: 'Segment not found' });

      expect(mocks.q.updateSegment).not.toHaveBeenCalled();
      expect(mocks.q.deleteSegment).not.toHaveBeenCalled();
      expect(mocks.auditSensitive).not.toHaveBeenCalled();
    });

    it('lets an organization administrator change another member segment and audits the cross-owner write', async () => {
      const ORG_A = '11111111-1111-4111-8111-111111111111';
      mocks.resolveVisibility.mockResolvedValue({
        ok: true,
        visibility: { actorUserId: 'user-1', includeOthersPrivate: true },
      });
      mocks.q.getSegmentById.mockResolvedValue({ id: 's-private', createdBy: 'steward-b', isPublic: false });

      expect((await actions.updateMemberSegmentAction('s-private', ORG_A, { name: 'Managed' })).isSuccess).toBe(true);
      expect(mocks.auditSensitive).toHaveBeenCalledWith(expect.objectContaining({
        actorUserId: 'user-1',
        organizationId: ORG_A,
        operation: 'update',
        segments: [{ segmentId: 's-private', ownerUserId: 'steward-b', isPublic: false }],
      }));
      expect(mocks.q.updateSegment).toHaveBeenCalledWith('s-private', { name: 'Managed' }, ORG_A, {
        actorUserId: 'user-1',
        includeOthersPrivate: true,
      });

      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's-public', createdBy: 'steward-b', isPublic: true });
      expect((await actions.deleteMemberSegmentAction('s-public', ORG_A)).isSuccess).toBe(true);
      expect(mocks.auditSensitive).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'delete',
        segments: [{ segmentId: 's-public', ownerUserId: 'steward-b', isPublic: true }],
      }));
    });

    it('stops a cross-owner change when the audit write fails and hides a segment in the wrong organization', async () => {
      const ORG_A = '11111111-1111-4111-8111-111111111111';
      const ORG_B = '22222222-2222-4222-8222-222222222222';
      mocks.resolveVisibility.mockResolvedValue({
        ok: true,
        visibility: { actorUserId: 'user-1', includeOthersPrivate: true },
      });
      mocks.q.getSegmentById.mockResolvedValue({ id: 's-private', createdBy: 'steward-b', isPublic: false });
      mocks.auditSensitive.mockResolvedValueOnce(false);

      const unaudited = await actions.updateMemberSegmentAction('s-private', ORG_A, { name: 'Managed' });
      expect(unaudited).toEqual({ isSuccess: false, message: 'Forbidden' });
      expect(mocks.q.updateSegment).not.toHaveBeenCalled();

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Forbidden' });
      const wrongOrg = await actions.deleteMemberSegmentAction('s-private', ORG_B);
      expect(wrongOrg).toEqual({ isSuccess: false, message: 'Forbidden' });
      expect(mocks.q.getSegmentById).not.toHaveBeenCalledWith('s-private', ORG_B, expect.anything());
    });
  });

  describe('search & execute', () => {
    it('searchMembersAdvancedAction: success, unauth, error', async () => {
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(true);

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(false);

      mocks.q.searchMembersAdvanced.mockRejectedValueOnce(new Error('x'));
      expect((await actions.searchMembersAdvancedAction('org', {} as never)).isSuccess).toBe(false);
    });

    it('executeSegmentAction: success, unauth, error', async () => {
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(true);
      expect(mocks.q.executeSegment).toHaveBeenCalledWith('s1', 'org', 'user-1', {
        includeOthersPrivate: false,
      });

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(false);

      mocks.q.executeSegment.mockRejectedValueOnce(new Error('x'));
      expect((await actions.executeSegmentAction('s1', 'org')).isSuccess).toBe(false);
    });

    it('getSegmentExecutionHistoryAction: success, missing segment, error', async () => {
      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's1' });
      expect((await actions.getSegmentExecutionHistoryAction('s1', 'org')).isSuccess).toBe(true);
      expect(mocks.q.getSegmentById).toHaveBeenCalledWith('s1', 'org', {
        actorUserId: 'user-1',
        includeOthersPrivate: false,
      });
      expect(mocks.q.getSegmentExecutions).toHaveBeenCalledWith('s1', 'org');

      mocks.q.getSegmentById.mockResolvedValueOnce(null);
      const missing = await actions.getSegmentExecutionHistoryAction('s1', 'org');
      expect(missing).toEqual({ isSuccess: false, message: 'Segment not found' });

      mocks.q.getSegmentById.mockResolvedValueOnce({ id: 's1' });
      mocks.q.getSegmentExecutions.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getSegmentExecutionHistoryAction('s1', 'org')).isSuccess).toBe(false);
    });
  });

  describe('exportMembersAction', () => {
    it('exports from a saved segment', async () => {
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(true);
      expect(r.data).toEqual({ exportId: 'export-1', watermark: 'WATERMARK' });
      expect(mocks.q.executeSegment).toHaveBeenCalledWith('s1', 'org', 'user-1', {
        limit: 10000,
        includeOthersPrivate: false,
      });
    });

    it('does not export another steward private segment', async () => {
      mocks.q.getSegmentById.mockResolvedValueOnce(null);
      const hidden = await actions.exportMembersAction('org', null, 's-private', 'csv', ['name']);
      expect(hidden).toEqual({ isSuccess: false, message: 'Segment not found' });
      expect(mocks.q.executeSegment).not.toHaveBeenCalled();
      expect(mocks.q.logSegmentExport).not.toHaveBeenCalled();
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
      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Unauthorized' });
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r).toEqual({ isSuccess: false, message: 'Unauthorized' });
      expect(mocks.q.executeSegment).not.toHaveBeenCalled();
    });

    it('requires the export entitlement before reading members', async () => {
      const r = await actions.exportMembersAction('org', null, 's1', 'csv', ['name']);
      expect(r.isSuccess).toBe(true);
      expect(mocks.authorize).toHaveBeenCalledWith('org', { entitlement: 'export_suite' });
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
      expect(mocks.authorize).toHaveBeenCalledWith('org', { entitlement: 'export_suite' });

      mocks.authorize.mockResolvedValueOnce({ ok: false, message: 'Forbidden' });
      const denied = await actions.getExportHistoryAction('org-b');
      expect(denied).toEqual({ isSuccess: false, message: 'Forbidden' });
      expect(mocks.q.getExportHistory).not.toHaveBeenCalledWith('org-b', undefined);

      mocks.q.getExportHistory.mockRejectedValueOnce(new Error('x'));
      expect((await actions.getExportHistoryAction('org')).isSuccess).toBe(false);
    });
  });
});
