import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordObservabilityEvent,
  peekObservabilityLedger,
  flushObservabilityLedger,
  clearObservabilityLedger,
  getEventsByCategory,
  getEventsByCorrelationId,
  getLedgerSummary,
} from '../ledger';
import { createCorrelationContext } from '../correlation';
import type { GovernanceObservabilityEvent } from '../types';

function makeEvent(overrides?: Partial<GovernanceObservabilityEvent>): GovernanceObservabilityEvent {
  return {
    eventId: `gevt_test_${Math.random().toString(36).slice(2)}`,
    category: 'governance',
    sensitivity: 'internal',
    operationId: 'test.operation',
    correlation: createCorrelationContext(),
    timestamp: new Date().toISOString(),
    retentionClass: 'standard',
    governanceMode: 'shadow',
    ...overrides,
  };
}

beforeEach(() => {
  clearObservabilityLedger();
});

describe('recordObservabilityEvent', () => {
  it('appends an event to the ledger', () => {
    const event = makeEvent();
    recordObservabilityEvent(event);
    expect(peekObservabilityLedger()).toHaveLength(1);
  });

  it('appends multiple events in order', () => {
    recordObservabilityEvent(makeEvent({ operationId: 'op.1' }));
    recordObservabilityEvent(makeEvent({ operationId: 'op.2' }));
    const events = peekObservabilityLedger();
    expect(events).toHaveLength(2);
    expect(events[0].operationId).toBe('op.1');
    expect(events[1].operationId).toBe('op.2');
  });
});

describe('flushObservabilityLedger', () => {
  it('returns all events and clears the ledger', () => {
    recordObservabilityEvent(makeEvent());
    recordObservabilityEvent(makeEvent());
    const flushed = flushObservabilityLedger();
    expect(flushed).toHaveLength(2);
    expect(peekObservabilityLedger()).toHaveLength(0);
  });
});

describe('getEventsByCategory', () => {
  it('returns only events matching the category', () => {
    recordObservabilityEvent(makeEvent({ category: 'auth' }));
    recordObservabilityEvent(makeEvent({ category: 'governance' }));
    recordObservabilityEvent(makeEvent({ category: 'auth' }));
    expect(getEventsByCategory('auth')).toHaveLength(2);
    expect(getEventsByCategory('governance')).toHaveLength(1);
    expect(getEventsByCategory('federation')).toHaveLength(0);
  });
});

describe('getEventsByCorrelationId', () => {
  it('returns events sharing a correlation ID', () => {
    const ctx = createCorrelationContext();
    recordObservabilityEvent(makeEvent({ correlation: ctx }));
    recordObservabilityEvent(makeEvent({ correlation: ctx }));
    recordObservabilityEvent(makeEvent()); // different correlation
    expect(
      getEventsByCorrelationId(ctx.governanceCorrelationId),
    ).toHaveLength(2);
  });
});

describe('getLedgerSummary', () => {
  it('returns zero counts on empty ledger', () => {
    const summary = getLedgerSummary();
    expect(summary.total).toBe(0);
    expect(summary.byCategory).toEqual({});
  });

  it('counts events by category and sensitivity', () => {
    recordObservabilityEvent(makeEvent({ category: 'auth', sensitivity: 'confidential' }));
    recordObservabilityEvent(makeEvent({ category: 'auth', sensitivity: 'internal' }));
    recordObservabilityEvent(makeEvent({ category: 'governance', sensitivity: 'internal' }));
    const summary = getLedgerSummary();
    expect(summary.total).toBe(3);
    expect(summary.byCategory['auth']).toBe(2);
    expect(summary.byCategory['governance']).toBe(1);
    expect(summary.bySensitivity['internal']).toBe(2);
    expect(summary.bySensitivity['confidential']).toBe(1);
  });
});
