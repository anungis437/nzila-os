import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Proxy-based chain mock ────────────────────────────────────────────── */
function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

/* ── Hoisted mocks ─────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
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
  messageLog: { id: 'id', status: 'status', createdAt: 'createdAt', retryCount: 'retryCount' },
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
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  like: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CampaignService, getCampaignService } from '../campaign-service';
import type { EmailService } from '../email-service';
import type { SMSService } from '../sms-service';

describe('CampaignService', () => {
  let service: CampaignService;
  let mockEmailService: EmailService;
  let mockSmsService: SMSService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReset();
    mocks.mockInsert.mockReset();
    mocks.mockUpdate.mockReset();

    mockEmailService = { send: vi.fn().mockResolvedValue('msg-123') } as any as EmailService;
    mockSmsService = { send: vi.fn().mockResolvedValue('sms-456') } as any as SMSService;
    service = new CampaignService(mockEmailService, mockSmsService);
  });

  // ── createCampaign ────────────────────────────────────────────────────
  describe('createCampaign', () => {
    it('inserts a new campaign with draft status', async () => {
      const fakeCampaign = { id: 'camp-1', name: 'Test', status: 'draft', organizationId: 'org-1' };
      mocks.mockInsert.mockReturnValue(chain([fakeCampaign]));

      const result = await service.createCampaign({ name: 'Test' } as never, 'org-1');
      expect(result).toEqual(fakeCampaign);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('returns the first campaign from the returning array', async () => {
      mocks.mockInsert.mockReturnValue(chain([{ id: 'first' }, { id: 'second' }]));
      const result = await service.createCampaign({} as never, 'org-1');
      expect(result.id).toBe('first');
    });
  });

  // ── getCampaign ───────────────────────────────────────────────────────
  describe('getCampaign', () => {
    it('returns a campaign when found', async () => {
      const campaign = { id: 'camp-1', organizationId: 'org-1' };
      mocks.mockSelect.mockReturnValue(chain([campaign]));

      const result = await service.getCampaign('camp-1', 'org-1');
      expect(result).toEqual(campaign);
    });

    it('returns null when campaign not found', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));

      const result = await service.getCampaign('nonexistent', 'org-1');
      expect(result).toBeNull();
    });
  });

  // ── listCampaigns ────────────────────────────────────────────────────
  describe('listCampaigns', () => {
    it('returns campaigns array and total count', async () => {
      const list = [{ id: 'c1' }, { id: 'c2' }];
      mocks.mockSelect
        .mockReturnValueOnce(chain(list))   // campaigns list
        .mockReturnValueOnce(chain([{ count: 2 }])); // count query

      const result = await service.listCampaigns('org-1');
      expect(result.campaigns).toEqual(list);
      expect(result.total).toBe(2);
    });

    it('returns empty when no campaigns', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ count: 0 }]));

      const result = await service.listCampaigns('org-1');
      expect(result.campaigns).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── sendCampaign ──────────────────────────────────────────────────────
  describe('sendCampaign', () => {
    it('throws when campaign is not found', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));

      await expect(service.sendCampaign({ campaignId: 'x', userId: 'u1' }))
        .rejects.toThrow('Campaign not found');
    });

    it('throws when campaign status is invalid for sending', async () => {
      const campaign = { id: 'c1', status: 'sent', organizationId: 'org-1', channel: 'email' };
      mocks.mockSelect.mockReturnValue(chain([campaign]));

      await expect(service.sendCampaign({ campaignId: 'c1', userId: 'u1' }))
        .rejects.toThrow('Campaign cannot be sent');
    });

    it('returns preview stats when dryRun=true', async () => {
      const campaign = { id: 'c1', status: 'draft', organizationId: 'org-1', channel: 'email', segmentId: null, segmentQuery: null };
      // getCampaign (called twice: sendCampaign + resolveAudience)
      mocks.mockSelect.mockReturnValue(chain([campaign]));
      // resolveAudience sub-selects: empty audience, empty prefs
      vi.spyOn(service, 'resolveAudience').mockResolvedValue({
        recipients: [{ userId: 'u1', email: 'a@b.com' }],
        totalCount: 1,
        eligibleCount: 1,
        skippedCount: 0,
        skippedReasons: {},
      });

      const result = await service.sendCampaign({ campaignId: 'c1', userId: 'u1', dryRun: true });
      expect(result.success).toBe(true);
      expect(result.queued).toBe(1);
      expect(result.totalAudience).toBe(1);
      expect(result.estimatedCompletionMinutes).toBeDefined();
    });

    it('queues recipients and marks campaign as sent in non-dry mode', async () => {
      const campaign = {
        id: 'c1',
        status: 'draft',
        organizationId: 'org-1',
        channel: 'email',
        subject: 'Hello',
        body: 'Body',
        stats: {},
      };
      mocks.mockSelect.mockReturnValue(chain([campaign]));
      vi.spyOn(service, 'resolveAudience').mockResolvedValue({
        recipients: [{ userId: 'u1', email: 'a@b.com', name: 'Alice' }],
        totalCount: 1,
        eligibleCount: 1,
        skippedCount: 0,
        skippedReasons: {},
      });
      mocks.mockUpdate.mockReturnValue(chain([]));
      mocks.mockInsert.mockReturnValue(chain([{ id: 'm1' }]));

      const result = await service.sendCampaign({ campaignId: 'c1', userId: 'u1', dryRun: false });
      expect(result.success).toBe(true);
      expect(result.queued).toBe(1);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── resolveAudience ───────────────────────────────────────────────────
  describe('resolveAudience', () => {
    it('resolves recipients, dedupes, and tracks skipped reasons', async () => {
      const campaign = {
        id: 'c1',
        organizationId: 'org-1',
        channel: 'email',
        segmentId: null,
        segmentQuery: {
          status: ['active'],
          role: ['member'],
          searchQuery: 'ali',
        },
      } as any;

      const rawAudience = [
        { userId: 'u1', email: 'u1@test.com', phone: '111', name: 'U1', firstName: 'U', lastName: 'One' },
        { userId: 'u1', email: 'u1@test.com', phone: '111', name: 'U1', firstName: 'U', lastName: 'One' },
        { userId: 'u2', email: null, phone: '222', name: 'U2', firstName: 'U', lastName: 'Two' },
      ];

      const preferences = [
        { userId: 'u1', emailEnabled: true, smsEnabled: true, pushEnabled: true },
        { userId: 'u2', emailEnabled: true, smsEnabled: true, pushEnabled: true },
      ];

      mocks.mockSelect
        .mockReturnValueOnce(chain([campaign]))
        .mockReturnValueOnce(chain(rawAudience))
        .mockReturnValueOnce(chain(preferences));

      const result = await service.resolveAudience('c1', 'org-1');
      expect(result.recipients).toHaveLength(1);
      expect(result.eligibleCount).toBe(1);
      expect(result.skippedReasons.no_consent).toBe(1);
    });
  });

  // ── cancelCampaign ────────────────────────────────────────────────────
  describe('cancelCampaign', () => {
    it('marks campaign as cancelled and returns it', async () => {
      const updated = { id: 'c1', status: 'cancelled' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));

      const result = await service.cancelCampaign('c1', 'u1');
      expect(result).toEqual(updated);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  // ── getCampaignAnalytics ──────────────────────────────────────────────
  describe('getCampaignAnalytics', () => {
    it('calculates delivery rates', async () => {
      const campaign = {
        id: 'c1',
        organizationId: 'org-1',
        stats: { sent: 100, delivered: 90, opened: 50, clicked: 20, unsubscribed: 1 },
      };
      mocks.mockSelect.mockReturnValue(chain([campaign]));

      const result = await service.getCampaignAnalytics('c1', 'org-1');
      expect(result.deliveryRate).toBe(90);
      expect(result.openRate).toBe(50);
      expect(result.clickRate).toBe(20);
      expect(result.unsubscribeRate).toBe(1);
    });

    it('returns zero rates when no messages sent', async () => {
      const campaign = { id: 'c1', organizationId: 'org-1', stats: { sent: 0 } };
      mocks.mockSelect.mockReturnValue(chain([campaign]));

      const result = await service.getCampaignAnalytics('c1', 'org-1');
      expect(result.deliveryRate).toBe(0);
      expect(result.openRate).toBe(0);
    });

    it('throws when campaign not found', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      await expect(service.getCampaignAnalytics('nonexistent', 'org-1'))
        .rejects.toThrow('Campaign not found');
    });
  });

  // ── processMessageQueue ───────────────────────────────────────────────
  describe('processMessageQueue', () => {
    it('processes queued messages via email', async () => {
      const msg = { id: 'msg-1', channelType: 'email', recipientEmail: 'a@b.com', subject: 'Hi', bodySnippet: 'body', campaignId: 'c1', retryCount: 0 };
      // First select: queued messages
      mocks.mockSelect.mockReturnValueOnce(chain([msg]));
      // Update after send
      mocks.mockUpdate.mockReturnValue(chain([{ id: 'msg-1' }]));

      await service.processMessageQueue(10);
      expect((mockEmailService.send as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    });

    it('marks message as failed on send error', async () => {
      const msg = { id: 'msg-2', channelType: 'sms', recipientPhone: null, bodySnippet: 'text', campaignId: 'c1', retryCount: 0 };
      mocks.mockSelect.mockReturnValueOnce(chain([msg]));
      mocks.mockUpdate.mockReturnValue(chain([{ id: 'msg-2' }]));

      // Should not throw — errors are caught per-message
      await service.processMessageQueue();
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('handles empty queue', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([]));

      await service.processMessageQueue();
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ── private helpers + singleton ───────────────────────────────────────
  describe('internal helpers', () => {
    it('hasConsent handles channel matrix safely', () => {
      const s = service as any;
      expect(s.hasConsent(undefined, 'email')).toBe(false);
      expect(s.hasConsent({ globallyUnsubscribed: true, emailEnabled: true }, 'email')).toBe(false);
      expect(s.hasConsent({ globallyUnsubscribed: false, emailEnabled: true }, 'email')).toBe(true);
      expect(s.hasConsent({ globallyUnsubscribed: false, smsEnabled: true }, 'sms')).toBe(true);
      expect(s.hasConsent({ globallyUnsubscribed: false, pushEnabled: true }, 'push')).toBe(true);
      expect(s.hasConsent({ globallyUnsubscribed: false }, 'fax')).toBe(false);
    });

    it('getCampaignService returns singleton instance', () => {
      const emailA = { send: vi.fn() } as any;
      const smsA = { send: vi.fn() } as any;
      const emailB = { send: vi.fn() } as any;
      const smsB = { send: vi.fn() } as any;

      const first = getCampaignService(emailA, smsA);
      const second = getCampaignService(emailB, smsB);
      expect(second).toBe(first);
    });
  });
});
