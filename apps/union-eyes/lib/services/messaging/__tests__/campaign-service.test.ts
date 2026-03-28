import { describe, it, expect, vi, beforeEach } from 'vitest';

// === Hoisted mocks ===
const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOffset: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLeftJoin: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockDynamic: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema', () => ({
  campaigns: { id: 'id', organizationId: 'organizationId', status: 'status', channel: 'channel', createdAt: 'createdAt', segmentId: 'segmentId', segmentQuery: 'segmentQuery', stats: 'stats' },
  messageLog: { id: 'id' },
}));

vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', status: 'status', role: 'role', membershipNumber: 'membershipNumber' },
}));

vi.mock('@/db/schema/user-management-schema', () => ({
  users: { userId: 'userId', email: 'email', phone: 'phone', displayName: 'displayName', firstName: 'firstName', lastName: 'lastName' },
}));

vi.mock('@/db/schema/communication-analytics-schema', () => ({
  communicationPreferences: { userId: 'userId', organizationId: 'organizationId', emailEnabled: 'emailEnabled', smsEnabled: 'smsEnabled', pushEnabled: 'pushEnabled' },
}));

vi.mock('@/db/schema/domains/member/member-segments', () => ({
  memberSegments: { id: 'id', organizationId: 'organizationId', filters: 'filters' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  like: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CampaignService } from '../campaign-service';
import type { EmailService } from '../email-service';
import type { SMSService } from '../sms-service';

describe('CampaignService', () => {
  let service: CampaignService;
  let mockEmailService: EmailService;
  let mockSmsService: SMSService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEmailService = { send: vi.fn(), sendBatch: vi.fn(), verifyConnection: vi.fn() } as unknown as EmailService;
    mockSmsService = { send: vi.fn(), sendBatch: vi.fn(), verifyConnection: vi.fn() } as unknown as SMSService;
    service = new CampaignService(mockEmailService, mockSmsService);

    // Default chainable mocks
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere, leftJoin: mocks.mockLeftJoin, $dynamic: mocks.mockDynamic });
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit, orderBy: mocks.mockOrderBy, $dynamic: mocks.mockDynamic, where: mocks.mockWhere, then: (r: (v: unknown[]) => void) => r([]) });
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockLeftJoin.mockReturnValue({ where: mocks.mockWhere, $dynamic: mocks.mockDynamic });
    mocks.mockDynamic.mockReturnValue({ where: mocks.mockWhere, orderBy: mocks.mockOrderBy, limit: mocks.mockLimit, offset: mocks.mockOffset });
    mocks.mockOffset.mockResolvedValue([]);
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
    mocks.mockSet.mockReturnValue({ where: mocks.mockWhere });
  });

  describe('createCampaign', () => {
    it('inserts a new campaign with draft status', async () => {
      const fakeCampaign = { id: 'camp-1', name: 'Test', status: 'draft', organizationId: 'org-1' };
      mocks.mockReturning.mockResolvedValue([fakeCampaign]);

      const result = await service.createCampaign({ name: 'Test' } as never, 'org-1');

      expect(result).toEqual(fakeCampaign);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('sets organizationId from parameter', async () => {
      mocks.mockReturning.mockResolvedValue([{ id: 'c1' }]);
      await service.createCampaign({ name: 'X' } as never, 'org-99');
      expect(mocks.mockValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-99', status: 'draft' }));
    });

    it('returns the first campaign from the returning array', async () => {
      mocks.mockReturning.mockResolvedValue([{ id: 'first' }, { id: 'second' }]);
      const result = await service.createCampaign({} as never, 'org-1');
      expect(result.id).toBe('first');
    });
  });

  describe('getCampaign', () => {
    it('returns a campaign when found', async () => {
      const campaign = { id: 'camp-1', organizationId: 'org-1' };
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockLimit.mockResolvedValue([campaign]);

      const result = await service.getCampaign('camp-1', 'org-1');
      expect(result).toEqual(campaign);
    });

    it('returns null when campaign not found', async () => {
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockLimit.mockResolvedValue([]);

      const result = await service.getCampaign('nonexistent', 'org-1');
      expect(result).toBeNull();
    });

    it('filters by both campaignId and organizationId', async () => {
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockLimit.mockResolvedValue([]);

      await service.getCampaign('camp-1', 'org-1');
      expect(mocks.mockWhere).toHaveBeenCalled();
    });
  });

  describe('listCampaigns', () => {
    it('returns campaigns array and total count', async () => {
      const list = [{ id: 'c1' }, { id: 'c2' }];
      // First call - the dynamic query chain resolves to campaign list
      mocks.mockDynamic.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(list),
          }),
        }),
      });
      // Second call for count
      mocks.mockSelect
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ $dynamic: vi.fn().mockReturnValue({ where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue(list) }) }) }) }) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) });

      const result = await service.listCampaigns('org-1');
      expect(result).toHaveProperty('campaigns');
      expect(result).toHaveProperty('total');
    });

    it('applies pagination defaults', async () => {
      mocks.mockDynamic.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mocks.mockSelect.mockReturnValueOnce({ from: mocks.mockFrom }).mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }) });

      const result = await service.listCampaigns('org-1');
      expect(result.total).toBe(0);
    });
  });

  describe('sendCampaign', () => {
    it('throws when campaign is not found', async () => {
      // getCampaign returns null
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockLimit.mockResolvedValue([]);

      await expect(service.sendCampaign({ campaignId: 'x', userId: 'u1' }))
        .rejects.toThrow('Campaign not found');
    });

    it('throws when campaign status is invalid for sending', async () => {
      const campaign = { id: 'c1', status: 'sent', organizationId: 'org-1', channel: 'email' };
      mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
      mocks.mockLimit.mockResolvedValue([campaign]);

      await expect(service.sendCampaign({ campaignId: 'c1', userId: 'u1' }))
        .rejects.toThrow('Campaign cannot be sent');
    });
  });
});
