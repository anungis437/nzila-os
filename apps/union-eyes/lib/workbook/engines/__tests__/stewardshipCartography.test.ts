import { describe, expect, it } from 'vitest';
import {
  runStewardshipCartography,
  ENGINE_VERSION,
} from '@/lib/workbook/engines/stewardshipCartography';

const holder = (overrides: Partial<{
  id: string;
  role: string;
  criticality: 'routine' | 'important' | 'load_bearing' | 'institution_critical' | null;
  tenureBand: '0_3y' | '3_7y' | '7_15y' | '15y_plus' | null;
  successorIdentified: boolean;
}> = {}) => ({
  id: overrides.id ?? 'h1',
  role: overrides.role ?? 'Test role',
  criticality: overrides.criticality ?? 'routine',
  tenureBand: overrides.tenureBand ?? '3_7y',
  successorIdentified: overrides.successorIdentified ?? false,
});

describe('stewardshipCartography', () => {
  it('exposes a stable engine version', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });

  it('returns zero density and no signals for an empty workbook', () => {
    const out = runStewardshipCartography([]);
    expect(out.density.totalCarriers).toBe(0);
    expect(out.density.index).toBe(0);
    expect(out.signals).toEqual([]);
  });

  it('emits a critical signal when an institution-critical role has no successor', () => {
    const out = runStewardshipCartography([
      holder({
        id: 'h1',
        criticality: 'institution_critical',
        tenureBand: '15y_plus',
        successorIdentified: false,
      }),
    ]);
    const sig = out.signals.find((s) => s.signalId === 'unsuccessed_institution_critical');
    expect(sig).toBeDefined();
    expect(sig?.severity).toBe('critical');
    expect(out.density.unsuccessedInstitutionCriticalCount).toBe(1);
  });

  it('lowers exposure when a successor is identified for the same role', () => {
    const unsuccessed = runStewardshipCartography([
      holder({ criticality: 'institution_critical', successorIdentified: false }),
    ]);
    const successed = runStewardshipCartography([
      holder({ criticality: 'institution_critical', successorIdentified: true }),
    ]);
    expect(successed.density.index).toBeLessThan(unsuccessed.density.index);
  });

  it('is deterministic across repeated invocations with the same input', () => {
    const input = [
      holder({ id: 'a', criticality: 'load_bearing', successorIdentified: false }),
      holder({ id: 'b', criticality: 'important', successorIdentified: true }),
    ];
    const a = runStewardshipCartography(input);
    const b = runStewardshipCartography(input);
    expect(a).toEqual(b);
  });
});
