import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ queue: [] as unknown[] }));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'groupBy', 'orderBy', 'limit', 'innerJoin']) {
    c[m] = () => c;
  }
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift() ?? []);
  return c;
}

vi.mock('@/db/db', () => ({ db: chain() }));
vi.mock('@/db/schema', () => {
  const col = (name: string) => new Proxy({}, { get: () => name });
  return {
    sharedClauseLibrary: col('sharedClauseLibrary'),
    arbitrationPrecedents: col('arbitrationPrecedents'),
    crossOrgAccessLog: col('crossOrgAccessLog'),
    organizations: col('organizations'),
    organizationSharingSettings: col('organizationSharingSettings'),
  };
});
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
  desc: () => ({}), and: (...a: unknown[]) => a, inArray: () => ({}), ne: () => ({}),
  gte: () => ({}), lte: () => ({}),
}));

import {
  deriveStrategicSignals,
  queryAffiliateTrends,
  queryGovernanceSummary,
  querySectorSignals,
  querySectorTimeSeries,
  querySharedKnowledgeIndex,
  type SectorSignal,
} from '../data-products';

function sector(overrides: Partial<SectorSignal> = {}): SectorSignal {
  return {
    sector: 'health', clauseCount: 1, precedentCount: 0, totalCitations: 0,
    totalViews: 0, uniqueOrgs: 1, topClauseTypes: [], ...overrides,
  };
}

beforeEach(() => {
  h.queue.length = 0;
});

describe('lib/clc/data-products', () => {
  describe('deriveStrategicSignals', () => {
    it('returns empty for no sectors', () => {
      expect(deriveStrategicSignals([])).toEqual([]);
    });

    it('detects concentration, anomaly, gap and emerging-trend signals', () => {
      const sectors = [
        sector({
          sector: 'health', clauseCount: 20, precedentCount: 2, totalViews: 5,
          topClauseTypes: [{ clauseType: 'wages', count: 15 }],
        }),
        sector({
          sector: 'transit', clauseCount: 2, precedentCount: 10, totalViews: 40,
          topClauseTypes: [{ clauseType: 'safety', count: 1 }],
        }),
      ];
      const signals = deriveStrategicSignals(sectors);
      const types = signals.map((s) => s.signalType);
      expect(types).toContain('concentration');
      expect(types).toContain('anomaly');
      expect(types).toContain('gap');
      expect(types).toContain('emerging-trend');
      for (const s of signals) {
        expect(s.confidence).toBeGreaterThan(0);
        expect(s.detail).toBeTruthy();
      }
    });

    it('produces no signals for a balanced, unremarkable distribution', () => {
      const sectors = [
        sector({ sector: 'a', clauseCount: 10, precedentCount: 1, totalViews: 5, topClauseTypes: [{ clauseType: 'x', count: 2 }] }),
        sector({ sector: 'b', clauseCount: 10, precedentCount: 1, totalViews: 5, topClauseTypes: [{ clauseType: 'y', count: 2 }] }),
      ];
      expect(deriveStrategicSignals(sectors)).toEqual([]);
    });
  });

  describe('DB query early-return guards', () => {
    it('querySectorSignals returns [] for no consented orgs', async () => {
      expect(await querySectorSignals([])).toEqual([]);
    });
    it('queryAffiliateTrends returns [] for no consented orgs', async () => {
      expect(await queryAffiliateTrends([])).toEqual([]);
    });
    it('querySectorTimeSeries returns [] for no consented orgs', async () => {
      expect(await querySectorTimeSeries([])).toEqual([]);
    });
    it('querySharedKnowledgeIndex returns zeroed index for no consented orgs', async () => {
      const idx = await querySharedKnowledgeIndex([]);
      expect(idx.totalClauses).toBe(0);
      expect(idx.topCited).toEqual([]);
    });
  });

  it('queryGovernanceSummary computes cohort health from consent cohorts', async () => {
    h.queue.push([{
      totalOrgs: 12, clauseSharingEnabled: 8, precedentSharingEnabled: 6, federationSharingEnabled: 3,
    }]);
    const summary = await queryGovernanceSummary(
      Array.from({ length: 10 }, (_, i) => `o${i}`), // >= minCohort*2 → healthy
      ['s1', 's2'],
      ['n1'],
    );
    expect(summary.totalAffiliates).toBe(12);
    expect(summary.cohortHealth).toBe('healthy');
    expect(summary.consentedCrossUnion).toBe(10);
    expect(summary.sharingAdoption.clauseSharingEnabled).toBe(8);
  });

  it('queryGovernanceSummary marks marginal and insufficient cohorts', async () => {
    h.queue.push([{ totalOrgs: 5, clauseSharingEnabled: 0, precedentSharingEnabled: 0, federationSharingEnabled: 0 }]);
    const marginal = await queryGovernanceSummary(['a', 'b', 'c', 'd', 'e'], [], []);
    expect(marginal.cohortHealth).toBe('marginal');

    h.queue.push([{ totalOrgs: 1, clauseSharingEnabled: 0, precedentSharingEnabled: 0, federationSharingEnabled: 0 }]);
    const insufficient = await queryGovernanceSummary(['a'], [], []);
    expect(insufficient.cohortHealth).toBe('insufficient');
  });

  it('querySectorSignals aggregates clause/precedent/type data', async () => {
    h.queue.push(
      [{ sector: 'health', clauseCount: 5, totalCitations: 2, totalViews: 3, uniqueOrgs: 1 }],
      [{ sector: 'health', precedentCount: 2 }],
      [
        { sector: 'health', clauseType: 'wages', count: 3 },
        { sector: null, clauseType: null, count: 1 },
      ],
    );
    const signals = await querySectorSignals(['o1']);
    expect(signals[0].sector).toBe('health');
    expect(signals[0].precedentCount).toBe(2);
    expect(signals[0].topClauseTypes[0].clauseType).toBe('wages');
  });

  it('querySectorTimeSeries groups monthly counts by sector', async () => {
    h.queue.push([
      { sector: 'health', period: '2025-01', count: 4 },
      { sector: 'health', period: '2025-02', count: 6 },
      { sector: null, period: '2025-01', count: 1 },
    ]);
    const series = await querySectorTimeSeries(['o1']);
    const health = series.find((s) => s.sector === 'health');
    expect(health?.series).toHaveLength(2);
    expect(series.some((s) => s.sector === 'unknown')).toBe(true);
  });

  it('querySharedKnowledgeIndex builds top-cited and distributions', async () => {
    h.queue.push(
      [{ total: 10, citations: 20, views: 30, orgs: 3 }], // clauseStats (.then r[0])
      [{ total: 5, citations: 8, views: 12 }], // precStats (.then r[0])
      [{ id: 'c1', title: 'Clause One', citationCount: 9, sector: 'health' }, { id: 'c2', title: null, citationCount: null, sector: null }], // topClauses
      [{ id: 'p1', title: 'Precedent One', citationCount: 12, sector: 'transit' }], // topPrecedents
      [{ name: 'wages', value: 4 }, { name: null, value: 1 }], // clauseTypeDist
      [{ name: 'upheld', value: 2 }, { name: null, value: 1 }], // outcomeDist
    );
    const idx = await querySharedKnowledgeIndex(['o1']);
    expect(idx.totalClauses).toBe(10);
    expect(idx.totalCitations).toBe(28);
    expect(idx.topCited[0].citationCount).toBe(12); // precedent sorted first
    expect(idx.clauseTypeDistribution.some((d) => d.name === 'unknown')).toBe(true);
    expect(idx.outcomeDistribution.some((d) => d.name === 'unknown')).toBe(true);
  });

  it('queryAffiliateTrends merges activity by org type', async () => {
    h.queue.push(
      [{ organizationType: 'local', affiliateCount: 3 }, { organizationType: null, affiliateCount: 1 }], // orgTypeCounts
      [{ organizationType: 'local', total: 7 }], // clauseByType
      [{ organizationType: 'local', total: 4 }], // precByType
      [{ organizationType: 'local', initiated: 9, accessed: 5 }], // accessByType
      [{ organizationType: 'local', clauseEnabled: 2, precedentEnabled: 1 }], // sharingByType
    );
    const trends = await queryAffiliateTrends(['o1'], { fromDate: '2025-01-01', toDate: '2025-12-31' });
    const local = trends.find((t) => t.organizationType === 'local');
    expect(local?.clausesShared).toBe(7);
    expect(local?.accessesInitiated).toBe(9);
    expect(trends.some((t) => t.organizationType === 'local')).toBe(true);
  });
});
