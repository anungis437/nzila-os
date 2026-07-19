import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@/db', () => ({ db: { execute: h.execute } }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sql: vi.fn(() => ({})),
}));

import {
  detectAnomalies,
  generateDuesAlignmentReport,
  getLocalDuesSnapshots,
  getOrgDuesSnapshot,
  type LocalDuesSnapshot,
  type OrgDuesSnapshot,
} from '../dues-alignment';

beforeEach(() => {
  h.execute.mockReset();
});

function makeOrgSnapshot(overrides: Partial<OrgDuesSnapshot> = {}): OrgDuesSnapshot {
  return {
    organizationId: 'o1',
    totalMembers: 100,
    activeMembers: 90,
    totalRemittancesCad: '10000.00',
    avgDuesPerMember: '100.00',
    employerCount: 2,
    arrearsCount: 0,
    arrearsAmountCad: '0',
    snapshotDate: new Date().toISOString(),
    ...overrides,
  };
}

describe('platform-economics/dues-alignment', () => {
  describe('getOrgDuesSnapshot', () => {
    it('aggregates member, remittance, and arrears data', async () => {
      h.execute
        .mockResolvedValueOnce([{ total_members: 100, active_members: 90 }])
        .mockResolvedValueOnce([{ total_remittances: '10000', employer_count: 3 }])
        .mockResolvedValueOnce([{ arrears_count: 5, arrears_amount: '250' }]);

      const snapshot = await getOrgDuesSnapshot('o1');

      expect(snapshot.totalMembers).toBe(100);
      expect(snapshot.activeMembers).toBe(90);
      expect(snapshot.totalRemittancesCad).toBe('10000');
      expect(snapshot.avgDuesPerMember).toBe('100.00');
      expect(snapshot.employerCount).toBe(3);
      expect(snapshot.arrearsCount).toBe(5);
    });

    it('returns a zero average when there are no members', async () => {
      h.execute
        .mockResolvedValueOnce([{ total_members: 0, active_members: 0 }])
        .mockResolvedValueOnce([{ total_remittances: '0', employer_count: 0 }])
        .mockResolvedValueOnce([{ arrears_count: 0, arrears_amount: '0' }]);

      const snapshot = await getOrgDuesSnapshot('o1');
      expect(snapshot.avgDuesPerMember).toBe('0.00');
    });

    it('falls back to defaults when query rows are missing', async () => {
      h.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      const snapshot = await getOrgDuesSnapshot('o1');
      expect(snapshot.totalMembers).toBe(0);
      expect(snapshot.employerCount).toBe(0);
    });
  });

  describe('getLocalDuesSnapshots', () => {
    it('maps rows to local snapshots', async () => {
      h.execute.mockResolvedValueOnce([
        { local_id: 'l1', member_count: 50, active_members: 45, remittance_total: '5000', arrears_count: 2 },
        { local_id: 'l2', member_count: 50, active_members: 50, remittance_total: null, arrears_count: 0 },
      ]);

      const snapshots = await getLocalDuesSnapshots('o1');
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]!.localId).toBe('l1');
      expect(snapshots[1]!.remittanceTotalCad).toBe('0');
    });
  });

  describe('detectAnomalies', () => {
    it('flags a member count mismatch', () => {
      const locals: LocalDuesSnapshot[] = [
        { localId: 'l1', memberCount: 40, activeMembers: 40, remittanceTotalCad: '4000', arrearsCount: 0 },
      ];
      const anomalies = detectAnomalies(makeOrgSnapshot({ totalMembers: 100 }), locals);
      expect(anomalies.some((a) => a.type === 'member_count_mismatch')).toBe(true);
    });

    it('flags an arrears spike with critical severity above 25%', () => {
      const anomalies = detectAnomalies(
        makeOrgSnapshot({ totalMembers: 100, arrearsCount: 30 }),
        [{ localId: 'o1', memberCount: 100, activeMembers: 90, remittanceTotalCad: '10000', arrearsCount: 30 }],
      );
      const spike = anomalies.find((a) => a.type === 'arrears_spike');
      expect(spike?.severity).toBe('critical');
    });

    it('flags a warning-level arrears spike between 10% and 25%', () => {
      const anomalies = detectAnomalies(
        makeOrgSnapshot({ totalMembers: 100, arrearsCount: 15 }),
        [{ localId: 'o1', memberCount: 100, activeMembers: 90, remittanceTotalCad: '10000', arrearsCount: 15 }],
      );
      const spike = anomalies.find((a) => a.type === 'arrears_spike');
      expect(spike?.severity).toBe('warning');
    });

    it('flags missing employers when membership is large', () => {
      const anomalies = detectAnomalies(
        makeOrgSnapshot({ totalMembers: 100, employerCount: 0 }),
        [{ localId: 'o1', memberCount: 100, activeMembers: 90, remittanceTotalCad: '10000', arrearsCount: 0 }],
      );
      expect(anomalies.some((a) => a.type === 'employer_missing')).toBe(true);
    });

    it('flags per-local remittance gaps', () => {
      const anomalies = detectAnomalies(makeOrgSnapshot({ totalMembers: 50 }), [
        { localId: 'l1', memberCount: 50, activeMembers: 50, remittanceTotalCad: '0', arrearsCount: 0 },
      ]);
      expect(anomalies.some((a) => a.type === 'remittance_gap')).toBe(true);
    });

    it('returns no anomalies for a healthy snapshot', () => {
      const anomalies = detectAnomalies(makeOrgSnapshot({ totalMembers: 100, arrearsCount: 0, employerCount: 2 }), [
        { localId: 'o1', memberCount: 100, activeMembers: 90, remittanceTotalCad: '10000', arrearsCount: 0 },
      ]);
      expect(anomalies).toEqual([]);
    });
  });

  describe('generateDuesAlignmentReport', () => {
    it('composes the org snapshot, local snapshots, and anomalies', async () => {
      // getOrgDuesSnapshot: 3 execute calls
      h.execute
        .mockResolvedValueOnce([{ total_members: 100, active_members: 90 }])
        .mockResolvedValueOnce([{ total_remittances: '10000', employer_count: 2 }])
        .mockResolvedValueOnce([{ arrears_count: 0, arrears_amount: '0' }])
        // getLocalDuesSnapshots: 1 execute call
        .mockResolvedValueOnce([
          { local_id: 'o1', member_count: 100, active_members: 90, remittance_total: '10000', arrears_count: 0 },
        ]);

      const report = await generateDuesAlignmentReport('o1', '2025-01');
      expect(report.organizationId).toBe('o1');
      expect(report.period).toBe('2025-01');
      expect(report.orgSnapshot.totalMembers).toBe(100);
      expect(report.localSnapshots).toHaveLength(1);
      expect(Array.isArray(report.anomalies)).toBe(true);
    });
  });
});
