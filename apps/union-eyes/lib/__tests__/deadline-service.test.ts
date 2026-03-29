import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAutoCreate: vi.fn(),
  mockGetClaimDeadlines: vi.fn(),
  mockGetCritical: vi.fn(),
  mockMarkOverdue: vi.fn(),
  mockGetMemberSummary: vi.fn(),
  mockGetDashboard: vi.fn(),
  mockCompleteDeadline: vi.fn(),
  mockGenerateAlerts: vi.fn(),
  mockGetUnreadAlerts: vi.fn(),
  mockMarkAlertViewed: vi.fn(),
  mockRecordAlertAction: vi.fn(),
  mockGetComplianceMetrics: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('@/db/queries/deadline-queries', () => ({
  autoCreateClaimDeadlines: mocks.mockAutoCreate,
  getClaimDeadlines: mocks.mockGetClaimDeadlines,
  getPendingClaimDeadlines: vi.fn(),
  getCriticalDeadlines: mocks.mockGetCritical,
  getOverdueDeadlines: vi.fn(),
  completeDeadline: mocks.mockCompleteDeadline,
  markOverdueDeadlines: mocks.mockMarkOverdue,
  requestDeadlineExtension: vi.fn(),
  approveDeadlineExtension: vi.fn(),
  denyDeadlineExtension: vi.fn(),
  getPendingExtensionRequests: vi.fn(),
  generateUpcomingDeadlineAlerts: mocks.mockGenerateAlerts,
  getUnreadAlerts: mocks.mockGetUnreadAlerts,
  markAlertViewed: mocks.mockMarkAlertViewed,
  recordAlertAction: mocks.mockRecordAlertAction,
  getDeadlineComplianceMetrics: mocks.mockGetComplianceMetrics,
  getMemberDeadlineSummary: mocks.mockGetMemberSummary,
  getDeadlineDashboardSummary: mocks.mockGetDashboard,
  addBusinessDays: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.mockInfo,
    warn: mocks.mockWarn,
    error: mocks.mockError,
    debug: mocks.mockDebug,
  },
}));

describe('deadline-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializeClaimDeadlines calls autoCreateClaimDeadlines', async () => {
    mocks.mockAutoCreate.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);

    const { initializeClaimDeadlines } = await import('../deadline-service');
    const result = await initializeClaimDeadlines(
      'claim1', 'org1', 'grievance', 'high', new Date(), 'user1'
    );

    expect(result).toHaveLength(2);
    expect(mocks.mockAutoCreate).toHaveBeenCalledWith(
      'claim1', 'org1', 'grievance', 'high', expect.any(Date), 'user1'
    );
  });

  it('initializeClaimDeadlines throws on error', async () => {
    mocks.mockAutoCreate.mockRejectedValue(new Error('DB error'));

    const { initializeClaimDeadlines } = await import('../deadline-service');
    await expect(
      initializeClaimDeadlines('c1', 'o1', 'g', 'h', new Date(), 'u1')
    ).rejects.toThrow('DB error');
  });

  it('updateDeadlineStatuses marks overdue', async () => {
    mocks.mockMarkOverdue.mockResolvedValue(3);

    const { updateDeadlineStatuses } = await import('../deadline-service');
    const result = await updateDeadlineStatuses();

    expect(result.markedOverdue).toBe(3);
    expect(result.alertsGenerated).toBe(0);
  });

  it('getUpcomingDeadlines returns critical deadlines', async () => {
    mocks.mockGetCritical.mockResolvedValue([{ id: 'd1' }]);

    const { getUpcomingDeadlines } = await import('../deadline-service');
    const result = await getUpcomingDeadlines('org1');

    expect(result).toHaveLength(1);
    expect(mocks.mockGetCritical).toHaveBeenCalledWith('org1');
  });

  it('getMemberUpcomingDeadlines returns summary', async () => {
    mocks.mockGetMemberSummary.mockResolvedValue({ total: 5 });

    const { getMemberUpcomingDeadlines } = await import('../deadline-service');
    const result = await getMemberUpcomingDeadlines('member1', 'org1');

    expect(result).toEqual({ total: 5 });
  });
});
