import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAutoCreate: vi.fn(),
  mockCreateClaimDeadline: vi.fn(),
  mockGetClaimDeadlines: vi.fn(),
  mockGetPending: vi.fn(),
  mockGetCritical: vi.fn(),
  mockGetOverdue: vi.fn(),
  mockMarkOverdue: vi.fn(),
  mockGetMemberSummary: vi.fn(),
  mockGetDashboard: vi.fn(),
  mockCompleteDeadline: vi.fn(),
  mockGenerateAlerts: vi.fn(),
  mockGetUnreadAlerts: vi.fn(),
  mockMarkAlertViewed: vi.fn(),
  mockRecordAlertAction: vi.fn(),
  mockGetComplianceMetrics: vi.fn(),
  mockRequestExtension: vi.fn(),
  mockApproveExtension: vi.fn(),
  mockDenyExtension: vi.fn(),
  mockGetPendingExtensions: vi.fn(),
  mockAddBusinessDays: vi.fn(),
}));

vi.mock('@/db/queries/deadline-queries', () => ({
  autoCreateClaimDeadlines: mocks.mockAutoCreate,
  createClaimDeadline: mocks.mockCreateClaimDeadline,
  getClaimDeadlines: mocks.mockGetClaimDeadlines,
  getPendingClaimDeadlines: mocks.mockGetPending,
  getCriticalDeadlines: mocks.mockGetCritical,
  getOverdueDeadlines: mocks.mockGetOverdue,
  completeDeadline: mocks.mockCompleteDeadline,
  markOverdueDeadlines: mocks.mockMarkOverdue,
  requestDeadlineExtension: mocks.mockRequestExtension,
  approveDeadlineExtension: mocks.mockApproveExtension,
  denyDeadlineExtension: mocks.mockDenyExtension,
  getPendingExtensionRequests: mocks.mockGetPendingExtensions,
  generateUpcomingDeadlineAlerts: mocks.mockGenerateAlerts,
  getUnreadAlerts: mocks.mockGetUnreadAlerts,
  markAlertViewed: mocks.mockMarkAlertViewed,
  recordAlertAction: mocks.mockRecordAlertAction,
  getDeadlineComplianceMetrics: mocks.mockGetComplianceMetrics,
  getMemberDeadlineSummary: mocks.mockGetMemberSummary,
  getDeadlineDashboardSummary: mocks.mockGetDashboard,
  addBusinessDays: mocks.mockAddBusinessDays,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  initializeClaimDeadlines,
  addClaimDeadline,
  updateDeadlineStatuses,
  getUpcomingDeadlines,
  getMemberUpcomingDeadlines,
  generateDeadlineAlerts,
  sendDailyDeadlineDigest,
  getMemberAlerts,
  acknowledgeAlert,
  takeAlertAction,
  requestExtension,
  approveExtension,
  denyExtension,
  getPendingExtensions,
  escalateOverdueDeadlines,
  markDeadlineComplete,
  autoCompleteClaimDeadlines,
  getComplianceReport,
  getDashboardSummary,
  getMemberPerformance,
  calculateDeadlineDate,
  getDeadlineStatus,
  runDeadlineMonitoringJob,
  runEscalationJob,
  runDailyDigestJob,
} from '../deadline-service';

describe('deadline-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── initializeClaimDeadlines ───────────────────────────────────────────────
  describe('initializeClaimDeadlines', () => {
    it('creates deadlines', async () => {
      mocks.mockAutoCreate.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
      const result = await initializeClaimDeadlines('c1', 'o1', 'grievance', 'high', new Date(), 'u1');
      expect(result).toHaveLength(2);
    });

    it('throws on error', async () => {
      mocks.mockAutoCreate.mockRejectedValue(new Error('DB error'));
      await expect(initializeClaimDeadlines('c1', 'o1', 'g', 'h', new Date(), 'u1')).rejects.toThrow('DB error');
    });
  });

  // ── addClaimDeadline ───────────────────────────────────────────────────────
  describe('addClaimDeadline', () => {
    it('creates a custom deadline via createClaimDeadline', async () => {
      mocks.mockCreateClaimDeadline.mockResolvedValue({ id: 'dl1', claimId: 'c1' });
      const result = await addClaimDeadline('c1', 'o1', 'Follow-up', 5, 'medium', 'u1');
      expect(result).toEqual({ id: 'dl1', claimId: 'c1' });
      expect(mocks.mockCreateClaimDeadline).toHaveBeenCalledWith(
        'c1', 'o1', 'Follow-up', 'custom',
        expect.any(Date), 5, 'u1',
        { priority: 'medium', businessDaysOnly: false },
      );
    });

    it('throws on error', async () => {
      mocks.mockCreateClaimDeadline.mockRejectedValue(new Error('DB error'));
      await expect(addClaimDeadline('c1', 'o1', 'Follow-up', 5, 'medium', 'u1')).rejects.toThrow('DB error');
    });
  });

  // ── updateDeadlineStatuses ─────────────────────────────────────────────────
  describe('updateDeadlineStatuses', () => {
    it('marks overdue and returns counts', async () => {
      mocks.mockMarkOverdue.mockResolvedValue(3);
      const result = await updateDeadlineStatuses();
      expect(result.markedOverdue).toBe(3);
      expect(result.alertsGenerated).toBe(0);
    });

    it('throws on error', async () => {
      mocks.mockMarkOverdue.mockRejectedValue(new Error('fail'));
      await expect(updateDeadlineStatuses()).rejects.toThrow('fail');
    });
  });

  // ── getUpcomingDeadlines ───────────────────────────────────────────────────
  it('getUpcomingDeadlines returns critical deadlines', async () => {
    mocks.mockGetCritical.mockResolvedValue([{ id: 'd1' }]);
    const result = await getUpcomingDeadlines('org1');
    expect(result).toHaveLength(1);
  });

  // ── getMemberUpcomingDeadlines ─────────────────────────────────────────────
  it('getMemberUpcomingDeadlines returns summary', async () => {
    mocks.mockGetMemberSummary.mockResolvedValue({ total: 5 });
    const result = await getMemberUpcomingDeadlines('m1', 'o1');
    expect(result).toEqual({ total: 5 });
  });

  // ── generateDeadlineAlerts ─────────────────────────────────────────────────
  describe('generateDeadlineAlerts', () => {
    it('generates alerts and returns count', async () => {
      mocks.mockGenerateAlerts.mockResolvedValue(4);
      const count = await generateDeadlineAlerts('org1');
      expect(count).toBe(4);
    });

    it('throws on error', async () => {
      mocks.mockGenerateAlerts.mockRejectedValue(new Error('fail'));
      await expect(generateDeadlineAlerts('org1')).rejects.toThrow();
    });
  });

  // ── sendDailyDeadlineDigest ────────────────────────────────────────────────
  describe('sendDailyDeadlineDigest', () => {
    it('processes when overdue items exist', async () => {
      mocks.mockGetMemberSummary.mockResolvedValue({ overdue_count: 2, due_soon_count: 1 });
      await expect(sendDailyDeadlineDigest('m1', 'o1')).resolves.toBeUndefined();
    });

    it('skips when nothing pending', async () => {
      mocks.mockGetMemberSummary.mockResolvedValue({ overdue_count: 0, due_soon_count: 0 });
      await expect(sendDailyDeadlineDigest('m1', 'o1')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      mocks.mockGetMemberSummary.mockRejectedValue(new Error('fail'));
      await expect(sendDailyDeadlineDigest('m1', 'o1')).rejects.toThrow();
    });
  });

  // ── Alert management ──────────────────────────────────────────────────────
  it('getMemberAlerts returns unread alerts', async () => {
    mocks.mockGetUnreadAlerts.mockResolvedValue([{ id: 'a1' }]);
    const result = await getMemberAlerts('m1', 'o1');
    expect(result).toHaveLength(1);
  });

  it('acknowledgeAlert marks alert viewed', async () => {
    mocks.mockMarkAlertViewed.mockResolvedValue(undefined);
    await expect(acknowledgeAlert('a1')).resolves.toBeUndefined();
    expect(mocks.mockMarkAlertViewed).toHaveBeenCalledWith('a1');
  });

  it('takeAlertAction records action', async () => {
    mocks.mockRecordAlertAction.mockResolvedValue(undefined);
    await expect(takeAlertAction('a1', 'dismiss')).resolves.toBeUndefined();
    expect(mocks.mockRecordAlertAction).toHaveBeenCalledWith('a1', 'dismiss');
  });

  // ── Extension management ──────────────────────────────────────────────────
  describe('requestExtension', () => {
    it('creates extension request', async () => {
      mocks.mockGetClaimDeadlines.mockResolvedValue([{ id: 'd1' }]);
      mocks.mockRequestExtension.mockResolvedValue({ id: 'ext-1' });
      const result = await requestExtension('d1', 'o1', 'u1', 5, 'Need more time');
      expect(result).toEqual({ id: 'ext-1' });
    });
  });

  it('approveExtension calls approve', async () => {
    mocks.mockApproveExtension.mockResolvedValue(undefined);
    await expect(approveExtension('ext-1', 'admin-1', 3, 'OK')).resolves.toBeUndefined();
  });

  it('denyExtension calls deny', async () => {
    mocks.mockDenyExtension.mockResolvedValue(undefined);
    await expect(denyExtension('ext-1', 'admin-1', 'Too late')).resolves.toBeUndefined();
  });

  it('getPendingExtensions returns pending', async () => {
    mocks.mockGetPendingExtensions.mockResolvedValue([{ id: 'ext-1' }]);
    const result = await getPendingExtensions('o1');
    expect(result).toHaveLength(1);
  });

  // ── Escalation ────────────────────────────────────────────────────────────
  describe('escalateOverdueDeadlines', () => {
    it('escalates overdue deadlines', async () => {
      mocks.mockGetOverdue.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
      const count = await escalateOverdueDeadlines('o1');
      expect(count).toBe(2);
    });

    it('throws on error', async () => {
      mocks.mockGetOverdue.mockRejectedValue(new Error('fail'));
      await expect(escalateOverdueDeadlines('o1')).rejects.toThrow();
    });
  });

  // ── Completion ────────────────────────────────────────────────────────────
  it('markDeadlineComplete completes deadline', async () => {
    mocks.mockCompleteDeadline.mockResolvedValue(undefined);
    await expect(markDeadlineComplete('d1', 'u1', 'Done')).resolves.toBeUndefined();
  });

  it('autoCompleteClaimDeadlines completes on resolve', async () => {
    mocks.mockGetPending.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
    mocks.mockCompleteDeadline.mockResolvedValue(undefined);
    await autoCompleteClaimDeadlines('c1', 'u1', 'resolved');
    expect(mocks.mockCompleteDeadline).toHaveBeenCalledTimes(2);
  });

  it('autoCompleteClaimDeadlines skips non-terminal status', async () => {
    mocks.mockGetPending.mockResolvedValue([{ id: 'd1' }]);
    await autoCompleteClaimDeadlines('c1', 'u1', 'under_review');
    expect(mocks.mockCompleteDeadline).not.toHaveBeenCalled();
  });

  // ── Reporting ─────────────────────────────────────────────────────────────
  it('getComplianceReport returns metrics', async () => {
    mocks.mockGetComplianceMetrics.mockResolvedValue({ total: 10 });
    const result = await getComplianceReport('o1');
    expect(result).toEqual({ total: 10 });
  });

  it('getDashboardSummary returns dashboard', async () => {
    mocks.mockGetDashboard.mockResolvedValue({ pending: 5 });
    const result = await getDashboardSummary('o1');
    expect(result).toEqual({ pending: 5 });
  });

  it('getMemberPerformance returns summary', async () => {
    mocks.mockGetMemberSummary.mockResolvedValue({ completed: 3 });
    const result = await getMemberPerformance('m1', 'o1');
    expect(result).toEqual({ completed: 3 });
  });

  // ── calculateDeadlineDate ──────────────────────────────────────────────────
  describe('calculateDeadlineDate', () => {
    it('uses business days when requested', async () => {
      const future = new Date('2026-04-10');
      mocks.mockAddBusinessDays.mockResolvedValue(future);
      const result = await calculateDeadlineDate(new Date('2026-04-01'), 7, true);
      expect(result).toBe(future);
    });

    it('uses calendar days when not business days', async () => {
      const start = new Date('2026-04-01T12:00:00Z');
      const result = await calculateDeadlineDate(start, 5, false);
      const diffDays = (result.getTime() - start.getTime()) / 86400000;
      expect(diffDays).toBe(5);
    });
  });

  // ── getDeadlineStatus ──────────────────────────────────────────────────────
  describe('getDeadlineStatus', () => {
    it('returns green for completed deadline', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'completed' } as any);
      expect(result.color).toBe('green');
      expect(result.severity).toBe('safe');
    });

    it('returns black for overdue deadline', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'pending', isOverdue: true, daysOverdue: 3 } as any);
      expect(result.color).toBe('black');
      expect(result.severity).toBe('overdue');
    });

    it('returns red for due today', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'pending', isOverdue: false, daysUntilDue: 0 } as any);
      expect(result.color).toBe('red');
      expect(result.severity).toBe('urgent');
    });

    it('returns red for due tomorrow', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'pending', isOverdue: false, daysUntilDue: 1 } as any);
      expect(result.color).toBe('red');
    });

    it('returns yellow for due in 2-3 days', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'pending', isOverdue: false, daysUntilDue: 3 } as any);
      expect(result.color).toBe('yellow');
      expect(result.severity).toBe('warning');
    });

    it('returns green for due in >3 days', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = getDeadlineStatus({ status: 'pending', isOverdue: false, daysUntilDue: 7 } as any);
      expect(result.color).toBe('green');
      expect(result.severity).toBe('safe');
    });
  });

  // ── Scheduled jobs ────────────────────────────────────────────────────────
  it('runDeadlineMonitoringJob runs without error', async () => {
    mocks.mockMarkOverdue.mockResolvedValue(0);
    mocks.mockGenerateAlerts.mockResolvedValue(0);
    await expect(runDeadlineMonitoringJob('o1')).resolves.toBeUndefined();
  });

  it('runEscalationJob runs without error', async () => {
    mocks.mockGetOverdue.mockResolvedValue([]);
    await expect(runEscalationJob('o1')).resolves.toBeUndefined();
  });

  it('runDailyDigestJob runs without error', async () => {
    await expect(runDailyDigestJob('o1')).resolves.toBeUndefined();
  });

  // ── Batch 35: branch gap-fill — non-Error catch fallbacks ────────────────
  describe('Batch 35: non-Error catch branches', () => {
    it('initializeClaimDeadlines wraps non-Error throw (L69)', async () => {
      mocks.mockAutoCreate.mockRejectedValue('raw string error');
      await expect(initializeClaimDeadlines('c1', 'o1', 'g', 'h', new Date(), 'u1')).rejects.toBe('raw string error');
    });

    it('updateDeadlineStatuses wraps non-Error throw (L120)', async () => {
      mocks.mockMarkOverdue.mockRejectedValue(42);
      await expect(updateDeadlineStatuses()).rejects.toBe(42);
    });

    it('generateDeadlineAlerts wraps non-Error throw (L163)', async () => {
      mocks.mockGenerateAlerts.mockRejectedValue({ code: 'ERR' });
      await expect(generateDeadlineAlerts('org1')).rejects.toEqual({ code: 'ERR' });
    });

    it('sendDailyDeadlineDigest wraps non-Error throw (L187)', async () => {
      mocks.mockGetMemberSummary.mockRejectedValue('digest fail');
      await expect(sendDailyDeadlineDigest('m1', 'o1')).rejects.toBe('digest fail');
    });

    it('escalateOverdueDeadlines wraps non-Error throw (L316)', async () => {
      mocks.mockGetOverdue.mockRejectedValue(null);
      await expect(escalateOverdueDeadlines('o1')).rejects.toBeNull();
    });
  });
});
