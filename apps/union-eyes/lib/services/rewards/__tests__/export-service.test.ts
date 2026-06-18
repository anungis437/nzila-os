import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── hoisted mocks ───
const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  sql: Object.assign(vi.fn((...args: any[]) => args), {
    join: vi.fn((...args: any[]) => args),
  }),
  asc: vi.fn(),
  gt: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  between: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  not: vi.fn(),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.mockExecute,
  },
}));

vi.mock('@/db/schema/recognition-rewards-schema', () => ({
  recognitionAwards: 'recognition_awards',
  rewardWalletLedger: 'reward_wallet_ledger',
  rewardBudgetEnvelopes: 'reward_budget_envelopes',
  rewardRedemptions: 'reward_redemptions',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  exportAwardsToCSV,
  exportLedgerToCSV,
  exportBudgetsToCSV,
  exportRedemptionsToCSV,
  exportAnalyticsToCSV,
} from '../export-service';

describe('export-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExecute.mockResolvedValue([]);
  });

  // ──────────────── exportAwardsToCSV ────────────────
  describe('exportAwardsToCSV', () => {
    it('returns CSV with headers when no data', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const csv = await exportAwardsToCSV('org-1');
      expect(csv).toContain('id,created_at,status');
      expect(csv.split('\n').length).toBe(1); // headers only
    });

    it('returns CSV with data rows', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a1',
          created_at: '2026-03-01T00:00:00Z',
          status: 'issued',
          award_type: 'Team Player',
          program: 'Q1',
          recipient_name: 'Alice',
          recipient_email: 'a@b.com',
          issuer_name: 'Bob',
          issuer_email: 'b@c.com',
          message: 'Good job',
          credits_awarded: 100,
          approved_at: null,
          approver_name: null,
          issued_at: '2026-03-01T00:00:00Z',
          revoked_at: null,
          rejected_at: null,
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      const lines = csv.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('a1');
      expect(lines[1]).toContain('Alice');
    });

    it('applies date filters', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportAwardsToCSV('org-1', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
      });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('applies status filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportAwardsToCSV('org-1', { status: ['issued', 'pending'] });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('throws on db error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('db fail'));
      await expect(exportAwardsToCSV('org-1')).rejects.toThrow('db fail');
    });
  });

  // ──────────────── exportLedgerToCSV ────────────────
  describe('exportLedgerToCSV', () => {
    it('returns CSV with headers when empty', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const csv = await exportLedgerToCSV('org-1');
      expect(csv).toContain('id,created_at,event_type');
      expect(csv.split('\n').length).toBe(1);
    });

    it('returns CSV with ledger entries', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'l1',
          created_at: '2026-03-01T00:00:00Z',
          event_type: 'earn',
          amount: 100,
          balance_after: 100,
          user_name: 'Alice',
          email: 'a@b.com',
          source_type: 'award',
          source_id: 'a1',
          description: null,
        },
      ]);

      const csv = await exportLedgerToCSV('org-1');
      expect(csv.split('\n').length).toBe(2);
      expect(csv).toContain('earn');
    });

    it('applies userId filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportLedgerToCSV('org-1', { userId: 'u1' });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('fail'));
      await expect(exportLedgerToCSV('org-1')).rejects.toThrow();
    });
  });

  // ──────────────── exportBudgetsToCSV ────────────────
  describe('exportBudgetsToCSV', () => {
    it('returns CSV with headers when empty', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const csv = await exportBudgetsToCSV('org-1');
      expect(csv).toContain('id,budget_name');
      expect(csv.split('\n').length).toBe(1);
    });

    it('returns CSV with budget rows', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'b1',
          budget_name: 'Q1',
          program_name: 'Rewards',
          scope_type: 'org',
          total_credits: 1000,
          used_credits: 250,
          starts_at: '2026-01-01T00:00:00Z',
          ends_at: '2026-03-31T00:00:00Z',
          created_at: '2025-12-15T00:00:00Z',
        },
      ]);

      const csv = await exportBudgetsToCSV('org-1');
      expect(csv.split('\n').length).toBe(2);
      expect(csv).toContain('Q1');
    });

    it('applies programId filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportBudgetsToCSV('org-1', { programId: 'prog-1' });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('err'));
      await expect(exportBudgetsToCSV('org-1')).rejects.toThrow();
    });
  });

  // ──────────────── exportRedemptionsToCSV ────────────────
  describe('exportRedemptionsToCSV', () => {
    it('returns CSV with headers when empty', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const csv = await exportRedemptionsToCSV('org-1');
      expect(csv).toContain('id,created_at,status');
      expect(csv.split('\n').length).toBe(1);
    });

    it('returns CSV with redemption rows', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'r1',
          created_at: '2026-03-01T00:00:00Z',
          status: 'completed',
          user_name: 'Bob',
          email: 'b@c.com',
          credits_redeemed: 50,
          cancelled_at: null,
          cancellation_reason: null,
          provider: 'shopify',
        },
      ]);

      const csv = await exportRedemptionsToCSV('org-1');
      expect(csv.split('\n').length).toBe(2);
      expect(csv).toContain('Bob');
    });

    it('applies date and status filters', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportRedemptionsToCSV('org-1', {
        startDate: new Date('2026-01-01'),
        status: ['completed'],
      });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('fail'));
      await expect(exportRedemptionsToCSV('org-1')).rejects.toThrow();
    });
  });

  // ──────────────── exportAnalyticsToCSV ────────────────
  describe('exportAnalyticsToCSV', () => {
    it('returns CSV with headers when empty', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const csv = await exportAnalyticsToCSV('org-1', new Date('2026-01-01'), new Date('2026-03-31'));
      expect(csv).toContain('date,awards_issued');
      expect(csv.split('\n').length).toBe(1);
    });

    it('returns CSV with daily analytics', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          date: '2026-03-01T00:00:00Z',
          awards_issued: 5,
          unique_recipients: 3,
          unique_issuers: 2,
          total_credits: 500,
        },
        {
          date: '2026-03-02T00:00:00Z',
          awards_issued: 3,
          unique_recipients: 2,
          unique_issuers: 1,
          total_credits: 300,
        },
      ]);

      const csv = await exportAnalyticsToCSV('org-1', new Date('2026-03-01'), new Date('2026-03-02'));
      expect(csv.split('\n').length).toBe(3); // header + 2 rows
    });

    it('throws on error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('analytics error'));
      await expect(
        exportAnalyticsToCSV('org-1', new Date(), new Date())
      ).rejects.toThrow('analytics error');
    });
  });

  // ──────────────── arrayToCSV branch coverage ────────────────
  describe('arrayToCSV edge cases (via exportAwardsToCSV)', () => {
    it('handles null and undefined values as empty strings', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a1',
          created_at: '2026-03-01T00:00:00Z',
          status: null,
          award_type: undefined,
          program: null,
          recipient_name: null,
          recipient_email: null,
          issuer_name: null,
          issuer_email: null,
          message: null,
          credits_awarded: null,
          approved_at: null,
          approver_name: null,
          issued_at: null,
          revoked_at: null,
          rejected_at: null,
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      const lines = csv.split('\n');
      expect(lines.length).toBe(2);
      // null/undefined are converted to empty strings in CSV
      expect(lines[1]).toContain('a1');
    });

    it('escapes values containing commas', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a2',
          created_at: '2026-03-01T00:00:00Z',
          status: 'issued',
          award_type: 'Team, Player',
          program: 'Q1',
          recipient_name: 'Alice',
          recipient_email: 'a@b.com',
          issuer_name: 'Bob',
          issuer_email: 'b@c.com',
          message: 'Great, work!',
          credits_awarded: 100,
          approved_at: null,
          approver_name: null,
          issued_at: '2026-03-01T00:00:00Z',
          revoked_at: null,
          rejected_at: null,
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      // Values with commas should be double-quoted
      expect(csv).toContain('"Team, Player"');
      expect(csv).toContain('"Great, work!"');
    });

    it('escapes values containing double quotes', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a3',
          created_at: '2026-03-01T00:00:00Z',
          status: 'issued',
          award_type: 'Test',
          program: 'Q1',
          recipient_name: 'Alice "Al" Smith',
          recipient_email: 'a@b.com',
          issuer_name: 'Bob',
          issuer_email: 'b@c.com',
          message: 'She said "hello"',
          credits_awarded: 50,
          approved_at: null,
          approver_name: null,
          issued_at: null,
          revoked_at: null,
          rejected_at: null,
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      // Quotes should be escaped as ""
      expect(csv).toContain('"Alice ""Al"" Smith"');
      expect(csv).toContain('"She said ""hello"""');
    });

    it('escapes values containing newlines', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a4',
          created_at: '2026-03-01T00:00:00Z',
          status: 'issued',
          award_type: 'Test',
          program: 'Q1',
          recipient_name: 'Alice',
          recipient_email: 'a@b.com',
          issuer_name: 'Bob',
          issuer_email: 'b@c.com',
          message: 'Line 1\nLine 2',
          credits_awarded: 10,
          approved_at: null,
          approver_name: null,
          issued_at: null,
          revoked_at: null,
          rejected_at: null,
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      expect(csv).toContain('"Line 1\nLine 2"');
    });
  });

  // ──────────────── filter branch coverage ────────────────
  describe('filter branches', () => {
    it('exportAwardsToCSV applies programId filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportAwardsToCSV('org-1', { programId: 'prog-1' });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('exportLedgerToCSV applies all filters together', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportLedgerToCSV('org-1', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        userId: 'u1',
        eventType: ['earn', 'spend'],
      });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('exportBudgetsToCSV applies activeOnly filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportBudgetsToCSV('org-1', { activeOnly: true });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('exportRedemptionsToCSV applies endDate filter', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportRedemptionsToCSV('org-1', {
        endDate: new Date('2026-12-31'),
      });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });

    it('exportRedemptionsToCSV applies all filters', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      await exportRedemptionsToCSV('org-1', {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        status: ['completed', 'pending'],
      });
      expect(mocks.mockExecute).toHaveBeenCalled();
    });
  });

  // ──────────────── date ternary branch coverage ────────────────
  describe('optional date field branches', () => {
    it('awards with all date fields populated', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'a5',
          created_at: '2026-03-01T00:00:00Z',
          status: 'issued',
          award_type: 'Test',
          program: 'Q1',
          recipient_name: 'Alice',
          recipient_email: 'a@b.com',
          issuer_name: 'Bob',
          issuer_email: 'b@c.com',
          message: 'Done',
          credits_awarded: 100,
          approved_at: '2026-03-02T00:00:00Z',
          approver_name: 'Carol',
          issued_at: '2026-03-03T00:00:00Z',
          revoked_at: '2026-03-04T00:00:00Z',
          rejected_at: '2026-03-05T00:00:00Z',
        },
      ]);

      const csv = await exportAwardsToCSV('org-1');
      const lines = csv.split('\n');
      expect(lines.length).toBe(2);
      // All date fields should be ISO strings, not empty
      expect(lines[1]).toContain('2026-03-02');
      expect(lines[1]).toContain('2026-03-03');
    });

    it('redemptions with cancelled_at populated', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'r2',
          created_at: '2026-03-01T00:00:00Z',
          status: 'cancelled',
          user_name: 'Alice',
          email: 'a@b.com',
          credits_redeemed: 25,
          cancelled_at: '2026-03-15T00:00:00Z',
          cancellation_reason: 'Changed mind',
          provider: 'shopify',
        },
      ]);

      const csv = await exportRedemptionsToCSV('org-1');
      expect(csv).toContain('2026-03-15');
      expect(csv).toContain('Changed mind');
    });

    it('ledger with description populated', async () => {
      mocks.mockExecute.mockResolvedValue([
        {
          id: 'l2',
          created_at: '2026-03-01T00:00:00Z',
          event_type: 'earn',
          amount: 50,
          balance_after: 150,
          user_name: 'Bob',
          email: 'b@c.com',
          source_type: 'award',
          source_id: 'a1',
          description: 'Quarterly bonus',
        },
      ]);

      const csv = await exportLedgerToCSV('org-1');
      expect(csv).toContain('Quarterly bonus');
    });
  });
});
