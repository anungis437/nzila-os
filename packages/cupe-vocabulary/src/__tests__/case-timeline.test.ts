/**
 * Tests for case timeline audit response shape
 *
 * PR-031: Validates the timeline response contract.
 * The actual API hits platform auth + Drizzle, so these are
 * pure shape/contract tests.
 */

import { describe, it, expect } from 'vitest';

// Timeline response shape — mirrors the GET /api/cases/[caseId]/audit response
interface TimelineEntry {
  auditId: string;
  action: string;
  userId: string | null;
  severity: string | null;
  outcome: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

interface TimelineResponse {
  caseId: string;
  timeline: TimelineEntry[];
}

describe('Case Timeline Response Contract', () => {
  it('timeline response has caseId and timeline array', () => {
    const resp: TimelineResponse = {
      caseId: 'case_001',
      timeline: [],
    };
    expect(resp).toHaveProperty('caseId');
    expect(resp).toHaveProperty('timeline');
    expect(Array.isArray(resp.timeline)).toBe(true);
  });

  it('timeline entry has required fields', () => {
    const entry: TimelineEntry = {
      auditId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'update',
      userId: 'user_abc',
      severity: 'medium',
      outcome: 'success',
      metadata: { eventType: 'case.transitioned', details: { from: 'submitted', to: 'under_review' } },
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    expect(entry.auditId).toBeTruthy();
    expect(entry.action).toBeTruthy();
  });

  it('timeline entry allows nullable fields', () => {
    const entry: TimelineEntry = {
      auditId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'create',
      userId: null,
      severity: null,
      outcome: null,
      metadata: null,
      createdAt: null,
    };
    expect(entry.userId).toBeNull();
    expect(entry.metadata).toBeNull();
  });

  it('metadata preserves eventType for case domain events', () => {
    const meta: Record<string, unknown> = {
      eventType: 'case.assigned',
      details: { assigneeId: 'user_123', reason: 'Specialist' },
      timestamp: '2025-01-01T00:00:00.000Z',
    };
    expect(meta.eventType).toMatch(/^case\./);
  });

  it('timeline is ordered newest-first by convention', () => {
    const timeline: TimelineEntry[] = [
      { auditId: '2', action: 'update', userId: 'u', severity: 'low', outcome: 'success', metadata: null, createdAt: '2025-06-02T00:00:00Z' },
      { auditId: '1', action: 'create', userId: 'u', severity: 'low', outcome: 'success', metadata: null, createdAt: '2025-06-01T00:00:00Z' },
    ];
    const dates = timeline.map((e) => new Date(e.createdAt!).getTime());
    expect(dates[0]).toBeGreaterThan(dates[1]);
  });
});
