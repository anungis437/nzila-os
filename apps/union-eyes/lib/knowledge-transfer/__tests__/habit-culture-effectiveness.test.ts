/**
 * Knowledge-Transfer analytics — habit-tracker, effectiveness-tracker, culture-engine.
 *
 * All three modules read organizational history from loadCognitionMemory and
 * listReasoningSessions. We mock both and drive each single async entrypoint
 * with rich data (covering every inline scorer/closure) plus an empty-history
 * call (covering early-return branches).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: { entries: [] as unknown[], resilienceTimeline: [] as unknown[] },
  sessions: [] as unknown[],
}));

vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({
  loadCognitionMemory: vi.fn(async () => mocks.store),
}));
vi.mock('@/lib/knowledge-transfer/reasoning-sessions/session-manager', () => ({
  listReasoningSessions: vi.fn(async () => mocks.sessions),
}));

import { trackResilienceHabits } from '@/lib/knowledge-transfer/resilience-habits/habit-tracker';
import { trackMitigationEffectiveness } from '@/lib/knowledge-transfer/mitigation-effectiveness/effectiveness-tracker';
import { analyzeGovernanceCulture } from '@/lib/knowledge-transfer/governance-culture/culture-engine';

function richStore() {
  return {
    entries: [
      { id: 'e1', title: 'Mit 1', createdAt: '2026-01-01T00:00:00Z', memoryType: 'mitigation_comparison', resilienceScoreAtCapture: 50, tags: ['infrastructure', 'approved'] },
      { id: 'e2', title: 'Assess 1', createdAt: '2026-01-05T00:00:00Z', memoryType: 'continuity_assessment', resilienceScoreAtCapture: 55, tags: ['staffing'] },
      { id: 'e3', title: 'Gov 1', createdAt: '2026-01-10T00:00:00Z', memoryType: 'governance_reasoning', resilienceScoreAtCapture: null, tags: [] },
      { id: 'e4', title: 'Brief 1', createdAt: '2026-01-15T00:00:00Z', memoryType: 'decision_brief', resilienceScoreAtCapture: 60, tags: ['approved'] },
      { id: 'e5', title: 'Base 1', createdAt: '2026-01-20T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 65, tags: [] },
      { id: 'e6', title: 'Mit 2', createdAt: '2026-01-25T00:00:00Z', memoryType: 'mitigation_comparison', resilienceScoreAtCapture: 58, tags: ['process'] },
      { id: 'e7', title: 'Mit 3', createdAt: '2026-02-01T00:00:00Z', memoryType: 'mitigation_comparison', resilienceScoreAtCapture: 70, tags: ['security'] },
      { id: 'e8', title: 'Base 2', createdAt: '2026-02-05T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 60, tags: [] },
      { id: 'e9', title: 'Assess 2', createdAt: '2026-02-10T00:00:00Z', memoryType: 'continuity_assessment', resilienceScoreAtCapture: 60, tags: ['training'] },
      { id: 'e10', title: 'Base 3', createdAt: '2026-02-15T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 62, tags: [] },
      { id: 'e11', title: 'Mit 4', createdAt: '2026-02-20T00:00:00Z', memoryType: 'mitigation_comparison', resilienceScoreAtCapture: 50, tags: ['infrastructure'] },
      { id: 'e12', title: 'Base 4', createdAt: '2026-02-25T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 65, tags: [] },
    ],
    resilienceTimeline: [
      { resilienceScore: 50, changeFromPrevious: null, capturedAt: '2026-01-01T00:00:00Z' },
      { resilienceScore: 45, changeFromPrevious: -5, capturedAt: '2026-01-05T00:00:00Z' },
      { resilienceScore: 52, changeFromPrevious: 7, capturedAt: '2026-01-10T00:00:00Z' },
      { resilienceScore: 46, changeFromPrevious: -6, capturedAt: '2026-01-15T00:00:00Z' },
      { resilienceScore: 44, changeFromPrevious: -2, capturedAt: '2026-01-20T00:00:00Z' },
      { resilienceScore: 60, changeFromPrevious: 16, capturedAt: '2026-01-25T00:00:00Z' },
    ],
  };
}
const richSessions = () => [
  { createdAt: '2026-01-02T00:00:00Z' },
  { createdAt: '2026-01-12T00:00:00Z' },
  { createdAt: '2026-01-22T00:00:00Z' },
];

function setEmpty() {
  mocks.store = { entries: [], resilienceTimeline: [] };
  mocks.sessions = [];
}
function setRich() {
  mocks.store = richStore() as never;
  mocks.sessions = richSessions() as never;
}

describe('knowledge-transfer analytics', () => {
  beforeEach(() => {
    setEmpty();
    vi.clearAllMocks();
  });

  // ── habit-tracker ─────────────────────────────────────────────────────
  it('trackResilienceHabits produces a full profile from rich history', async () => {
    setRich();
    const profile = await trackResilienceHabits('org1');
    expect(profile.organizationId).toBe('org1');
    expect(profile.dimensions).toHaveLength(6);
    expect(profile.overallHabitScore).toBeGreaterThan(0);
    expect(profile.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(['strong', 'developing', 'emerging', 'absent']).toContain(profile.overallTier);
  });

  it('trackResilienceHabits handles empty history (early-return branches)', async () => {
    const profile = await trackResilienceHabits('org-empty');
    expect(profile.entriesAnalyzed).toBe(0);
    expect(profile.overallTier).toBe('absent');
    expect(profile.strongestHabit).toBeNull();
  });

  it('trackResilienceHabits handles volatile/declining timeline', async () => {
    mocks.store = {
      entries: [
        { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z', memoryType: 'continuity_assessment', resilienceScoreAtCapture: 80, tags: [] },
        { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 20, tags: [] },
      ],
      resilienceTimeline: [
        { resilienceScore: 80, changeFromPrevious: null, capturedAt: '2026-01-01T00:00:00Z' },
        { resilienceScore: 20, changeFromPrevious: -60, capturedAt: '2026-01-02T00:00:00Z' },
        { resilienceScore: 70, changeFromPrevious: 50, capturedAt: '2026-01-03T00:00:00Z' },
      ],
    } as never;
    mocks.sessions = [];
    const profile = await trackResilienceHabits('org-volatile');
    expect(profile.dimensions).toHaveLength(6);
  });

  // ── effectiveness-tracker ─────────────────────────────────────────────
  it('trackMitigationEffectiveness measures verified + unverified interventions', async () => {
    setRich();
    const report = await trackMitigationEffectiveness('org1');
    expect(report.organizationId).toBe('org1');
    expect(report.outcomes.length).toBeGreaterThan(0);
    expect(report.dimensionBreakdown.length).toBeGreaterThan(0);
    expect(typeof report.averageResilienceGain).toBe('number');
    expect(report.overallEffectivenessRating).toBeTruthy();
    // Mixed outcomes: some effective, some counterproductive
    const ratings = report.outcomes.map((o) => o.effectivenessRating);
    expect(ratings).toContain('counterproductive');
  });

  it('trackMitigationEffectiveness handles empty history (unverified overall)', async () => {
    const report = await trackMitigationEffectiveness('org-empty');
    expect(report.outcomes).toHaveLength(0);
    expect(report.overallEffectivenessRating).toBe('unverified');
    expect(report.mostEffectiveIntervention).toBeNull();
  });

  // ── culture-engine ─────────────────────────────────────────────────────
  it('analyzeGovernanceCulture builds a culture profile from rich history', async () => {
    setRich();
    const profile = await analyzeGovernanceCulture('org1');
    expect(profile.organizationId).toBe('org1');
    expect(profile.indicators.length).toBeGreaterThan(0);
    expect(profile.evolutionPhases.length).toBeGreaterThan(0);
    expect(profile.cultureScore).toBeGreaterThan(0);
    expect(profile.disciplineProfile.totalInteractions).toBeGreaterThan(0);
  });

  it('analyzeGovernanceCulture handles empty history (nascent + insufficient)', async () => {
    const profile = await analyzeGovernanceCulture('org-empty');
    expect(profile.dominantPosture).toBe('nascent_governance');
    expect(profile.cultureHealth).toBe('insufficient_history');
    expect(profile.evolutionPhases).toHaveLength(0);
  });

  it('analyzeGovernanceCulture handles declining timeline (weakening signal)', async () => {
    mocks.store = {
      entries: [
        { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z', memoryType: 'continuity_assessment', resilienceScoreAtCapture: 80, tags: [] },
        { id: 'b', title: 'B', createdAt: '2026-03-01T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 50, tags: [] },
        { id: 'c', title: 'C', createdAt: '2026-05-01T00:00:00Z', memoryType: 'resilience_baseline', resilienceScoreAtCapture: 40, tags: [] },
      ],
      resilienceTimeline: [
        { resilienceScore: 80, changeFromPrevious: null, capturedAt: '2026-01-01T00:00:00Z' },
        { resilienceScore: 74, changeFromPrevious: -6, capturedAt: '2026-03-01T00:00:00Z' },
        { resilienceScore: 68, changeFromPrevious: -6, capturedAt: '2026-05-01T00:00:00Z' },
      ],
    } as never;
    mocks.sessions = [];
    const profile = await analyzeGovernanceCulture('org-declining');
    expect(profile.cultureHealth).toBe('weakening');
  });
});
