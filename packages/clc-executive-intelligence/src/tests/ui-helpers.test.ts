/**
 * UI Helpers — Unit Tests
 *
 * Tests: TopOneBanner, SequenceTimeline, SignalInteractionIndicators,
 * StrategicOutlookDisplay.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTopOneBanner,
  buildSequenceTimeline,
  buildSignalInteractionIndicators,
  buildStrategicOutlookDisplay,
} from '../ui/index';
import type { TopOnePriority, ActionSequence, MultiSignalAnalysis, StrategicNarrative } from '../contracts/index';

// ── TopOneBanner ────────────────────────────────────────────────────────────

describe('buildTopOneBanner', () => {
  const baseTop: TopOnePriority = {
    id: 'P1',
    title: 'Wage pressure in Mining',
    whyThisIsTheOne: 'Cross-sector cascade risk',
    immediateAction: 'Convene bargaining committee',
    timeframe: 'now',
    confidence: 0.87,
  };

  it('returns null for null input', () => {
    expect(buildTopOneBanner(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildTopOneBanner(undefined)).toBeNull();
  });

  it('maps fields correctly', () => {
    const banner = buildTopOneBanner(baseTop);
    expect(banner).not.toBeNull();
    expect(banner!.title).toBe('Wage pressure in Mining');
    expect(banner!.why).toBe('Cross-sector cascade risk');
    expect(banner!.action).toBe('Convene bargaining committee');
    expect(banner!.urgencyLabel).toBe('IMMEDIATE');
    expect(banner!.confidencePercent).toBe(87);
  });

  it('maps 7_days timeframe', () => {
    const banner = buildTopOneBanner({ ...baseTop, timeframe: '7_days' });
    expect(banner!.urgencyLabel).toBe('THIS WEEK');
  });

  it('maps 30_days timeframe', () => {
    const banner = buildTopOneBanner({ ...baseTop, timeframe: '30_days' });
    expect(banner!.urgencyLabel).toBe('THIS MONTH');
  });

  it('maps this_quarter timeframe', () => {
    const banner = buildTopOneBanner({ ...baseTop, timeframe: 'this_quarter' });
    expect(banner!.urgencyLabel).toBe('THIS QUARTER');
  });

  it('maps unknown timeframe to ACTIVE', () => {
    const banner = buildTopOneBanner({ ...baseTop, timeframe: 'pre_bargaining' as never });
    expect(banner!.urgencyLabel).toBe('PRE-BARGAINING');
  });

  it('rounds confidence to integer', () => {
    const banner = buildTopOneBanner({ ...baseTop, confidence: 0.835 });
    expect(banner!.confidencePercent).toBe(84);
  });
});

// ── SequenceTimeline ────────────────────────────────────────────────────────

describe('buildSequenceTimeline', () => {
  const actions = [
    { step: 1, action: 'Convene committee', rationale: 'Reason 1', priorityId: 'P1', urgency: 'intervene' as const, confidence: 0.9 },
    { step: 2, action: 'Review data', rationale: 'Reason 2', priorityId: 'P2', urgency: 'escalate' as const, confidence: 0.8 },
    { step: 3, action: 'Draft proposal', rationale: 'Reason 3', priorityId: 'P3', urgency: 'prepare' as const, confidence: 0.7 },
    { step: 4, action: 'Finalize', rationale: 'Reason 4', priorityId: 'P4', urgency: 'monitor' as const, confidence: 0.6 },
  ];
  const sequence: ActionSequence = {
    orderedActions: actions,
    primaryAction: actions[0]!,
    secondaryActions: actions.slice(1),
  };

  it('returns empty array for null input', () => {
    expect(buildSequenceTimeline(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(buildSequenceTimeline(undefined)).toEqual([]);
  });

  it('returns empty array for empty orderedActions', () => {
    expect(buildSequenceTimeline({ orderedActions: [], primaryAction: null, secondaryActions: [] })).toEqual([]);
  });

  it('maps step numbers correctly', () => {
    const timeline = buildSequenceTimeline(sequence);
    expect(timeline).toHaveLength(4);
    expect(timeline[0]!.step).toBe(1);
    expect(timeline[3]!.step).toBe(4);
  });

  it('assigns primary to step 1', () => {
    const timeline = buildSequenceTimeline(sequence);
    expect(timeline[0]!.status).toBe('primary');
  });

  it('assigns secondary to steps 2-3', () => {
    const timeline = buildSequenceTimeline(sequence);
    expect(timeline[1]!.status).toBe('secondary');
    expect(timeline[2]!.status).toBe('secondary');
  });

  it('assigns pending to step 4+', () => {
    const timeline = buildSequenceTimeline(sequence);
    expect(timeline[3]!.status).toBe('pending');
  });

  it('maps labels and rationale', () => {
    const timeline = buildSequenceTimeline(sequence);
    expect(timeline[0]!.label).toBe('Convene committee');
    expect(timeline[0]!.rationale).toBe('Reason 1');
  });
});

// ── SignalInteractionIndicators ─────────────────────────────────────────────

describe('buildSignalInteractionIndicators', () => {
  const analysis: MultiSignalAnalysis = {
    combinedImpactScore: 0.65,
    interactionType: 'reinforcing',
    adjustmentFactor: 0.05,
    signalPairs: [
      { signalA: 'S1', signalB: 'S2', interaction: 'reinforcing' },
      { signalA: 'S1', signalB: 'S3', interaction: 'conflicting' },
      { signalA: 'S2', signalB: 'S3', interaction: 'independent' },
    ],
    summary: 'Test summary',
  };

  it('returns empty array for null', () => {
    expect(buildSignalInteractionIndicators(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(buildSignalInteractionIndicators(undefined)).toEqual([]);
  });

  it('maps all signal pairs', () => {
    const indicators = buildSignalInteractionIndicators(analysis);
    expect(indicators).toHaveLength(3);
  });

  it('labels reinforcing correctly', () => {
    const indicators = buildSignalInteractionIndicators(analysis);
    expect(indicators[0]!.label).toContain('reinforce');
  });

  it('labels conflicting correctly', () => {
    const indicators = buildSignalInteractionIndicators(analysis);
    expect(indicators[1]!.label).toContain('conflict');
  });

  it('labels independent correctly', () => {
    const indicators = buildSignalInteractionIndicators(analysis);
    expect(indicators[2]!.label).toContain('independent');
  });

  it('preserves signal identifiers', () => {
    const indicators = buildSignalInteractionIndicators(analysis);
    expect(indicators[0]!.signalA).toBe('S1');
    expect(indicators[0]!.signalB).toBe('S2');
  });
});

// ── StrategicOutlookDisplay ─────────────────────────────────────────────────

describe('buildStrategicOutlookDisplay', () => {
  it('returns null for null', () => {
    expect(buildStrategicOutlookDisplay(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(buildStrategicOutlookDisplay(undefined)).toBeNull();
  });

  it('maps improving outlook', () => {
    const narrative: StrategicNarrative = {
      outlook: 'improving',
      strategicImplication: 'Conditions improving',
      nextWindow: 'short_term',
    };
    const display = buildStrategicOutlookDisplay(narrative);
    expect(display!.label).toBe('Improving');
    expect(display!.icon).toBe('arrow-up');
    expect(display!.severity).toBe('success');
    expect(display!.windowLabel).toBe('This Week');
  });

  it('maps stable outlook', () => {
    const narrative: StrategicNarrative = {
      outlook: 'stable',
      strategicImplication: 'All steady',
      nextWindow: 'short_term',
    };
    const display = buildStrategicOutlookDisplay(narrative);
    expect(display!.label).toBe('Stable');
    expect(display!.icon).toBe('minus');
    expect(display!.severity).toBe('warning');
  });

  it('maps worsening outlook', () => {
    const narrative: StrategicNarrative = {
      outlook: 'worsening',
      strategicImplication: 'Deteriorating',
      nextWindow: 'immediate',
    };
    const display = buildStrategicOutlookDisplay(narrative);
    expect(display!.label).toBe('Worsening');
    expect(display!.icon).toBe('arrow-down');
    expect(display!.severity).toBe('danger');
    expect(display!.windowLabel).toBe('Act Now');
  });

  it('maps bargaining_cycle window', () => {
    const narrative: StrategicNarrative = {
      outlook: 'stable',
      strategicImplication: 'Holding pattern',
      nextWindow: 'bargaining_cycle',
    };
    const display = buildStrategicOutlookDisplay(narrative);
    expect(display!.windowLabel).toBe('Before Bargaining');
  });

  it('includes strategic implication text', () => {
    const narrative: StrategicNarrative = {
      outlook: 'stable',
      strategicImplication: 'Custom implication text',
      nextWindow: 'short_term',
    };
    const display = buildStrategicOutlookDisplay(narrative);
    expect(display!.implication).toBe('Custom implication text');
  });
});
