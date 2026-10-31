import { describe, expect, it } from 'vitest';
import { slaClockStart } from '../sla-clock';

const NOW = new Date('2026-06-01T12:00:00Z');

describe('slaClockStart', () => {
  it('starts at the last status change', () => {
    const statusChangedAt = new Date('2026-05-30T00:00:00Z');
    expect(slaClockStart({ statusChangedAt, createdAt: new Date('2026-05-01T00:00:00Z') }, NOW)).toEqual({ startedAt: statusChangedAt, basis: 'status_change' });
  });

  it('falls back to creation, and says the status history is unknown, for a claim that predates the column', () => {
    const createdAt = new Date('2026-05-01T00:00:00Z');
    expect(slaClockStart({ statusChangedAt: null, createdAt }, NOW)).toEqual({ startedAt: createdAt, basis: 'creation_unknown_history' });
  });

  it('reports no clock rather than inventing one when neither date is known', () => {
    expect(slaClockStart({ statusChangedAt: null, createdAt: null }, NOW)).toEqual({ startedAt: NOW, basis: 'unavailable' });
  });

  it('never reads an edit timestamp: a later edit cannot restart or hide the clock', () => {
    const createdAt = new Date('2026-05-01T00:00:00Z');
    const edited = { statusChangedAt: null, createdAt, updatedAt: NOW } as Parameters<typeof slaClockStart>[0] & { updatedAt: Date };
    expect(slaClockStart(edited, NOW).startedAt).toBe(createdAt);
  });
});
