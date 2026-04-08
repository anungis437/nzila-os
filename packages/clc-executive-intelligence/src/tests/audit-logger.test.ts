/**
 * Tests for FeedbackAuditLogger
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeedbackAuditLogger,
  resetAuditLogCounter,
} from '../audit/logger';
import type { FeedbackAuditEntry } from '../contracts/index';

describe('FeedbackAuditLogger', () => {
  let logger: FeedbackAuditLogger;

  beforeEach(() => {
    logger = new FeedbackAuditLogger();
    resetAuditLogCounter();
  });

  it('starts empty', () => {
    expect(logger.getAll()).toHaveLength(0);
    expect(logger.getCount()).toBe(0);
  });

  it('logs a pre-built entry', () => {
    const entry: FeedbackAuditEntry = {
      id: 'ext-1',
      timestamp: '2026-03-01T00:00:00Z',
      eventType: 'outcome_recorded',
      payload: { test: true },
    };
    logger.log(entry);
    expect(logger.getCount()).toBe(1);
    expect(logger.getAll()[0]!.id).toBe('ext-1');
  });

  it('records an entry with auto-generated fields', () => {
    const entry = logger.record('outcome_recorded', { key: 'val' }, {
      organizationId: 'org-1',
      userId: 'user-1',
      correlationId: 'corr-1',
    });
    expect(entry.id).toBe('audit-1');
    expect(entry.eventType).toBe('outcome_recorded');
    expect(entry.organizationId).toBe('org-1');
    expect(entry.userId).toBe('user-1');
    expect(entry.correlationId).toBe('corr-1');
    expect(entry.timestamp).toBeTruthy();
    expect(logger.getCount()).toBe(1);
  });

  it('assigns sequential IDs', () => {
    logger.record('outcome_recorded', {});
    logger.record('quality_metrics_generated', {});
    const all = logger.getAll();
    expect(all[0]!.id).toBe('audit-1');
    expect(all[1]!.id).toBe('audit-2');
  });

  it('filters by event type', () => {
    logger.record('outcome_recorded', {});
    logger.record('quality_metrics_generated', {});
    logger.record('outcome_recorded', {});

    const outcomes = logger.getByEventType('outcome_recorded');
    expect(outcomes).toHaveLength(2);

    const metrics = logger.getByEventType('quality_metrics_generated');
    expect(metrics).toHaveLength(1);
  });

  it('filters by organization', () => {
    logger.record('outcome_recorded', {}, { organizationId: 'org-A' });
    logger.record('outcome_recorded', {}, { organizationId: 'org-B' });
    logger.record('outcome_recorded', {}, { organizationId: 'org-A' });

    expect(logger.getByOrganization('org-A')).toHaveLength(2);
    expect(logger.getByOrganization('org-B')).toHaveLength(1);
    expect(logger.getByOrganization('org-C')).toHaveLength(0);
  });

  it('filters by time window', () => {
    logger.log({
      id: 'a1',
      timestamp: '2026-01-01T00:00:00Z',
      eventType: 'outcome_recorded',
      payload: {},
    });
    logger.log({
      id: 'a2',
      timestamp: '2026-02-15T00:00:00Z',
      eventType: 'outcome_recorded',
      payload: {},
    });
    logger.log({
      id: 'a3',
      timestamp: '2026-03-15T00:00:00Z',
      eventType: 'outcome_recorded',
      payload: {},
    });

    const inWindow = logger.getInWindow('2026-02-01T00:00:00Z', '2026-03-01T00:00:00Z');
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0]!.id).toBe('a2');
  });

  it('filters by correlation ID', () => {
    logger.record('outcome_recorded', {}, { correlationId: 'corr-X' });
    logger.record('quality_metrics_generated', {}, { correlationId: 'corr-X' });
    logger.record('outcome_recorded', {}, { correlationId: 'corr-Y' });

    expect(logger.getByCorrelationId('corr-X')).toHaveLength(2);
    expect(logger.getByCorrelationId('corr-Y')).toHaveLength(1);
    expect(logger.getByCorrelationId('corr-Z')).toHaveLength(0);
  });

  it('returns copies (immutability)', () => {
    logger.record('outcome_recorded', { original: true });
    const all1 = logger.getAll();
    const all2 = logger.getAll();
    expect(all1).not.toBe(all2);
    expect(all1).toEqual(all2);
  });

  it('clears all entries and resets counter', () => {
    logger.record('outcome_recorded', {});
    logger.record('outcome_recorded', {});
    expect(logger.getCount()).toBe(2);

    logger.clear();
    expect(logger.getCount()).toBe(0);
    expect(logger.getAll()).toHaveLength(0);

    // Counter reset too — next entry starts from 1 again
    const entry = logger.record('outcome_recorded', {});
    expect(entry.id).toBe('audit-1');
  });

  it('does not mutate logged entries', () => {
    const original: FeedbackAuditEntry = {
      id: 'orig',
      timestamp: '2026-01-01T00:00:00Z',
      eventType: 'outcome_recorded',
      payload: { x: 1 },
    };
    logger.log(original);

    // Mutate the original object
    original.id = 'MUTATED';
    const retrieved = logger.getAll()[0]!;
    expect(retrieved.id).toBe('orig');
  });
});
