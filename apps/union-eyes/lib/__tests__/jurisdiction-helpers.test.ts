import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/db/db', () => ({
  db: { execute: mocks.mockExecute },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  relations: vi.fn(() => ({})),
}));

vi.mock('../jurisdiction-helpers-client', () => ({
  mapJurisdictionValue: vi.fn((v: string) => {
    if (v === 'ON') return 'CA-ON';
    if (v === 'QC') return 'CA-QC';
    return 'CA-FED';
  }),
  getJurisdictionName: vi.fn(() => 'Ontario'),
  requiresBilingualSupport: vi.fn(() => false),
  getDeadlineUrgency: vi.fn(() => ({ level: 'low', color: 'green', label: 'On Track' })),
}));

import {
  getOrganizationJurisdiction,
  getOrgJurisdiction,
  getJurisdictionDeadline,
} from '../jurisdiction-helpers';

describe('jurisdiction-helpers (server)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrganizationJurisdiction', () => {
    it('returns mapped jurisdiction from DB', async () => {
      mocks.mockExecute.mockResolvedValue([{ jurisdiction: 'ON' }]);
      const result = await getOrganizationJurisdiction('org-1');
      expect(result).toBe('CA-ON');
    });

    it('returns null when no rows', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const result = await getOrganizationJurisdiction('org-1');
      expect(result).toBeNull();
    });

    it('returns null on DB error', async () => {
      mocks.mockExecute.mockRejectedValue(new Error('db down'));
      const result = await getOrganizationJurisdiction('org-1');
      expect(result).toBeNull();
    });
  });

  describe('getOrgJurisdiction', () => {
    it('returns mapped jurisdiction', async () => {
      mocks.mockExecute.mockResolvedValue([{ jurisdiction: 'QC' }]);
      const result = await getOrgJurisdiction('org-2');
      expect(result).toBe('CA-QC');
    });

    it('returns null for missing jurisdiction field', async () => {
      mocks.mockExecute.mockResolvedValue([{ jurisdiction: null }]);
      const result = await getOrgJurisdiction('org-2');
      expect(result).toBeNull();
    });
  });

  describe('getJurisdictionDeadline', () => {
    it('returns days and legal reference', async () => {
      mocks.mockExecute.mockResolvedValue([{ days: 30, legal_reference: 'Ontario Labour Relations Act s.48' }]);
      const result = await getJurisdictionDeadline('CA-ON', 'arbitration');
      expect(result).toEqual({ days: 30, legalReference: 'Ontario Labour Relations Act s.48' });
    });

    it('returns null when no matching rule', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      const result = await getJurisdictionDeadline('CA-ON', 'unknown');
      expect(result).toBeNull();
    });
  });
});
