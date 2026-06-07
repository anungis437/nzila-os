/**
 * Tests for Decision Outcome Store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionOutcomeStore, validateOutcome } from '../outcomes/store';
import type { DecisionOutcome } from '../contracts/index';

function makeOutcome(overrides: Partial<DecisionOutcome> = {}): DecisionOutcome {
  return {
    priorityId: 'P1',
    recommendedAction: 'escalate',
    actionTaken: 'escalated',
    outcome: 'success',
    successScore: 0.8,
    createdAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('validateOutcome', () => {
  it('returns no errors for a valid outcome', () => {
    const errors = validateOutcome(makeOutcome());
    expect(errors).toHaveLength(0);
  });

  it('flags missing priorityId', () => {
    const errors = validateOutcome(makeOutcome({ priorityId: '' }));
    expect(errors).toContainEqual(expect.objectContaining({ field: 'priorityId' }));
  });

  it('flags missing recommendedAction', () => {
    const errors = validateOutcome(makeOutcome({ recommendedAction: '' }));
    expect(errors).toContainEqual(expect.objectContaining({ field: 'recommendedAction' }));
  });

  it('flags missing actionTaken', () => {
    const errors = validateOutcome(makeOutcome({ actionTaken: '' }));
    expect(errors).toContainEqual(expect.objectContaining({ field: 'actionTaken' }));
  });

  it('flags invalid outcome result', () => {
    const errors = validateOutcome(makeOutcome({ outcome: 'invalid' as DecisionOutcome['outcome'] }));
    expect(errors).toContainEqual(expect.objectContaining({ field: 'outcome' }));
  });

  it('flags successScore out of range', () => {
    expect(validateOutcome(makeOutcome({ successScore: -0.1 }))).toContainEqual(
      expect.objectContaining({ field: 'successScore' }),
    );
    expect(validateOutcome(makeOutcome({ successScore: 1.1 }))).toContainEqual(
      expect.objectContaining({ field: 'successScore' }),
    );
  });

  it('flags missing createdAt', () => {
    const errors = validateOutcome(makeOutcome({ createdAt: '' }));
    expect(errors).toContainEqual(expect.objectContaining({ field: 'createdAt' }));
  });

  it('accumulates multiple errors', () => {
    const errors = validateOutcome(makeOutcome({
      priorityId: '',
      recommendedAction: '',
      actionTaken: '',
    }));
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DecisionOutcomeStore', () => {
  let store: DecisionOutcomeStore;

  beforeEach(() => {
    store = new DecisionOutcomeStore();
  });

  it('records and retrieves outcomes', () => {
    const recorded = store.recordOutcome(makeOutcome());
    expect(recorded.id).toBeTruthy();
    expect(store.getOutcomes()).toHaveLength(1);
  });

  it('assigns auto-incrementing IDs', () => {
    store.recordOutcome(makeOutcome());
    store.recordOutcome(makeOutcome({ priorityId: 'P2' }));
    const outcomes = store.getOutcomes();
    expect(outcomes[0]!.id).toBe('outcome-1');
    expect(outcomes[1]!.id).toBe('outcome-2');
  });

  it('preserves provided IDs', () => {
    const recorded = store.recordOutcome(makeOutcome({ id: 'custom-id' }));
    expect(recorded.id).toBe('custom-id');
  });

  it('throws on invalid outcome', () => {
    expect(() => store.recordOutcome(makeOutcome({ priorityId: '' }))).toThrow('Invalid outcome');
  });

  it('isolates outcomes by organization', () => {
    store.recordOutcome(makeOutcome(), 'org-A');
    store.recordOutcome(makeOutcome({ priorityId: 'P2' }), 'org-B');

    expect(store.getOutcomes('org-A')).toHaveLength(1);
    expect(store.getOutcomes('org-B')).toHaveLength(1);
    expect(store.getOutcomes('org-C')).toHaveLength(0);
  });

  it('filters by time window', () => {
    store.recordOutcome(makeOutcome({ createdAt: '2026-01-10T00:00:00Z' }));
    store.recordOutcome(makeOutcome({ createdAt: '2026-01-15T00:00:00Z' }));
    store.recordOutcome(makeOutcome({ createdAt: '2026-01-20T00:00:00Z' }));

    const windowed = store.getOutcomesInWindow('2026-01-12T00:00:00Z', '2026-01-18T00:00:00Z');
    expect(windowed).toHaveLength(1);
  });

  it('filters by priority ID', () => {
    store.recordOutcome(makeOutcome({ priorityId: 'P1' }));
    store.recordOutcome(makeOutcome({ priorityId: 'P2' }));
    store.recordOutcome(makeOutcome({ priorityId: 'P1' }));

    expect(store.getOutcomesByPriority('P1')).toHaveLength(2);
    expect(store.getOutcomesByPriority('P2')).toHaveLength(1);
  });

  it('filters by action type', () => {
    store.recordOutcome(makeOutcome({ recommendedAction: 'escalate' }));
    store.recordOutcome(makeOutcome({ recommendedAction: 'monitor' }));
    store.recordOutcome(makeOutcome({ recommendedAction: 'escalate' }));

    expect(store.getOutcomesByAction('escalate')).toHaveLength(2);
  });

  it('tracks total count across organizations', () => {
    store.recordOutcome(makeOutcome(), 'org-A');
    store.recordOutcome(makeOutcome(), 'org-B');
    store.recordOutcome(makeOutcome(), 'org-A');

    expect(store.getTotalCount()).toBe(3);
  });

  it('clears all data', () => {
    store.recordOutcome(makeOutcome(), 'org-A');
    store.recordOutcome(makeOutcome(), 'org-B');
    store.clear();

    expect(store.getTotalCount()).toBe(0);
    expect(store.getOutcomes('org-A')).toHaveLength(0);
  });

  it('returns copies to prevent mutation', () => {
    store.recordOutcome(makeOutcome());
    const outcomes = store.getOutcomes();
    outcomes.pop();
    expect(store.getOutcomes()).toHaveLength(1);
  });
});
