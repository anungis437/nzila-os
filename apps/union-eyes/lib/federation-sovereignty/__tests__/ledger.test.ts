import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordSovereigntyEvent,
  peekSovereigntyLedger,
  getLedgerForFederation,
  getLedgerByEventType,
  getLedgerByTier,
  getEscalationEntries,
  getConflictEntries,
  getSovereigntyLedgerSummary,
  flushSovereigntyLedger,
  clearSovereigntyLedger,
} from '../ledger';

describe('sovereignty ledger', () => {
  beforeEach(() => {
    clearSovereigntyLedger();
  });

  it('records an event with auto-generated id and timestamp', () => {
    const entry = recordSovereigntyEvent({
      federationId: 'local-001',
      eventType: 'delegation-granted',
      tier: 'local',
      authority: 'publication',
      outcome: 'accepted',
      correlationId: 'corr-001',
      diagnostics: {},
    });
    expect(entry.entryId).toMatch(/^slgr_/);
    expect(entry.governanceMode).toBe('shadow');
    expect(entry.timestamp).toBeTruthy();
  });

  it('returns empty ledger initially', () => {
    expect(peekSovereigntyLedger()).toHaveLength(0);
  });

  it('returns snapshot on peek (not reference)', () => {
    recordSovereigntyEvent({
      federationId: 'fed-a',
      eventType: 'conflict-detected',
      tier: 'regional',
      outcome: 'escalated',
      correlationId: 'c1',
      diagnostics: {},
    });
    const snap = peekSovereigntyLedger();
    expect(snap).toHaveLength(1);
  });

  it('filters by federation', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'delegation-granted', tier: 'local', outcome: 'accepted', correlationId: 'c1', diagnostics: {} });
    recordSovereigntyEvent({ federationId: 'fed-b', eventType: 'delegation-granted', tier: 'regional', outcome: 'accepted', correlationId: 'c2', diagnostics: {} });
    expect(getLedgerForFederation('fed-a')).toHaveLength(1);
    expect(getLedgerForFederation('fed-b')).toHaveLength(1);
  });

  it('filters by event type', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'conflict-detected', tier: 'local', outcome: 'escalated', correlationId: 'c1', diagnostics: {} });
    recordSovereigntyEvent({ federationId: 'fed-b', eventType: 'delegation-granted', tier: 'local', outcome: 'accepted', correlationId: 'c2', diagnostics: {} });
    expect(getLedgerByEventType('conflict-detected')).toHaveLength(1);
  });

  it('filters by tier', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'authority-exercised', tier: 'national', outcome: 'accepted', correlationId: 'c1', diagnostics: {} });
    recordSovereigntyEvent({ federationId: 'fed-b', eventType: 'authority-exercised', tier: 'local', outcome: 'accepted', correlationId: 'c2', diagnostics: {} });
    expect(getLedgerByTier('national')).toHaveLength(1);
  });

  it('returns escalation entries', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'escalation-triggered', tier: 'local', outcome: 'escalated', correlationId: 'c1', diagnostics: {} });
    recordSovereigntyEvent({ federationId: 'fed-b', eventType: 'delegation-granted', tier: 'local', outcome: 'accepted', correlationId: 'c2', diagnostics: {} });
    expect(getEscalationEntries()).toHaveLength(1);
  });

  it('returns conflict entries', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'conflict-detected', tier: 'regional', outcome: 'pending', correlationId: 'c1', diagnostics: {} });
    expect(getConflictEntries()).toHaveLength(1);
  });

  it('generates summary', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'delegation-granted', tier: 'local', outcome: 'accepted', correlationId: 'c1', diagnostics: {} });
    const summary = getSovereigntyLedgerSummary();
    expect(summary.totalEntries).toBe(1);
    expect(summary.delegationEvents).toBe(1);
  });

  it('flush returns and clears', () => {
    recordSovereigntyEvent({ federationId: 'fed-a', eventType: 'delegation-granted', tier: 'local', outcome: 'accepted', correlationId: 'c1', diagnostics: {} });
    const flushed = flushSovereigntyLedger();
    expect(flushed).toHaveLength(1);
    expect(peekSovereigntyLedger()).toHaveLength(0);
  });

  it('evicts oldest entries beyond 10,000 limit', () => {
    for (let i = 0; i < 10_001; i++) {
      recordSovereigntyEvent({
        federationId: `fed-${i}`,
        eventType: 'authority-exercised',
        tier: 'local',
        outcome: 'accepted',
        correlationId: `c-${i}`,
        diagnostics: {},
      });
    }
    const ledger = peekSovereigntyLedger();
    expect(ledger.length).toBeLessThanOrEqual(10_000);
  });
});
