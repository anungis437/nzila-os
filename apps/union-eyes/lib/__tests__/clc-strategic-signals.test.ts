/**
 * Unit Tests — CLC Strategic Signal Derivation
 *
 * Tests the `deriveStrategicSignals` function that detects
 * concentration, anomaly, gap, and emerging-trend patterns.
 */
import { describe, it, expect } from 'vitest';
import { deriveStrategicSignals, type SectorSignal } from '@/lib/clc/data-products';

function makeSectorSignal(overrides: Partial<SectorSignal> = {}): SectorSignal {
  return {
    sector: 'Healthcare',
    clauseCount: 20,
    precedentCount: 5,
    totalCitations: 30,
    totalViews: 100,
    uniqueOrgs: 4,
    topClauseTypes: [{ clauseType: 'wages', count: 8 }],
    ...overrides,
  };
}

describe('deriveStrategicSignals', () => {
  it('returns empty for no sectors', () => {
    expect(deriveStrategicSignals([])).toEqual([]);
  });

  it('detects concentration when one sector holds >50% of clauses', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'Healthcare', clauseCount: 60 }),
      makeSectorSignal({ sector: 'Education', clauseCount: 10 }),
    ]);
    const concentration = signals.find((s) => s.signalType === 'concentration');
    expect(concentration).toBeDefined();
    expect(concentration!.dimension).toBe('Healthcare');
    expect(concentration!.confidence).toBeGreaterThan(0);
  });

  it('does NOT flag concentration for balanced sectors', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'A', clauseCount: 30 }),
      makeSectorSignal({ sector: 'B', clauseCount: 30 }),
      makeSectorSignal({ sector: 'C', clauseCount: 30 }),
    ]);
    const concentration = signals.find((s) => s.signalType === 'concentration');
    expect(concentration).toBeUndefined();
  });

  it('detects anomaly for high precedent-to-clause ratio', () => {
    // Global avg ratio = 35/70 = 0.5; Mining has 20/5 = 4.0x (>3x avg AND >2)
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'Healthcare', clauseCount: 50, precedentCount: 10 }),
      makeSectorSignal({ sector: 'Education', clauseCount: 15, precedentCount: 5 }),
      makeSectorSignal({ sector: 'Mining', clauseCount: 5, precedentCount: 20 }),
    ]);
    const anomaly = signals.find((s) => s.signalType === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly!.dimension).toBe('Mining');
  });

  it('detects gap when views are high but clauses are low', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'Retail', clauseCount: 3, totalViews: 200 }),
    ]);
    const gap = signals.find((s) => s.signalType === 'gap');
    expect(gap).toBeDefined();
    expect(gap!.dimension).toBe('Retail');
  });

  it('does NOT flag gap for adequate supply', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'Retail', clauseCount: 50, totalViews: 200 }),
    ]);
    const gap = signals.find((s) => s.signalType === 'gap');
    expect(gap).toBeUndefined();
  });

  it('detects emerging trend when top clause type >60%', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({
        sector: 'Healthcare',
        clauseCount: 10,
        topClauseTypes: [{ clauseType: 'wages', count: 8 }],
      }),
    ]);
    const trend = signals.find((s) => s.signalType === 'emerging-trend');
    expect(trend).toBeDefined();
    expect(trend!.detail).toContain('wages');
  });

  it('does NOT flag emerging trend when top type is < 60%', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({
        sector: 'Healthcare',
        clauseCount: 20,
        topClauseTypes: [{ clauseType: 'wages', count: 8 }],
      }),
    ]);
    const trend = signals.find((s) => s.signalType === 'emerging-trend');
    expect(trend).toBeUndefined();
  });

  it('can detect multiple signal types simultaneously', () => {
    const signals = deriveStrategicSignals([
      // Concentration: 80/100 = 80%
      makeSectorSignal({ sector: 'Healthcare', clauseCount: 80, precedentCount: 5, totalViews: 100, topClauseTypes: [{ clauseType: 'wages', count: 60 }] }),
      // Gap: high views/clause, low supply
      makeSectorSignal({ sector: 'Retail', clauseCount: 3, precedentCount: 1, totalViews: 200, topClauseTypes: [] }),
    ]);
    const types = signals.map((s) => s.signalType);
    expect(types).toContain('concentration');
    expect(types).toContain('gap');
    expect(types).toContain('emerging-trend');
  });

  it('all signals have valid confidence scores', () => {
    const signals = deriveStrategicSignals([
      makeSectorSignal({ sector: 'Healthcare', clauseCount: 80 }),
      makeSectorSignal({ sector: 'Retail', clauseCount: 3, totalViews: 200 }),
    ]);
    for (const s of signals) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});
