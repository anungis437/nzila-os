/**
 * @vitest-environment jsdom
 *
 * ARTIFACT TYPE: Vitest Component Suite — AdaptiveExplanationCard
 * MODULE: ICRA live flow — adaptive explanation surface
 * DOCTRINE_VERSION: 1.0.0
 *
 * Covers:
 *   - Renders the heading, bands, and counts
 *   - Heading auto-focuses on mount (a11y)
 *   - The continue button is keyboard-accessible and fires onAcknowledge
 *   - The safe-default note appears only when usedSafeDefault=true
 *   - The deferred-count line is hidden when zero questions are deferred
 *
 * This is a focused unit-of-UI test. The full multi-step flow is exercised
 * by Playwright (e2e/ocra-adaptive-flow.spec.ts).
 */

import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';

import { AdaptiveExplanationCard } from '../ICRAAssessmentFlow';
import type {
  InstitutionalAssessmentProfile,
  RoutedQuestionBank,
} from '@/lib/icra/adaptation';

afterEach(() => {
  cleanup();
});

function makeProfile(
  overrides: Partial<InstitutionalAssessmentProfile> = {},
): InstitutionalAssessmentProfile {
  return {
    doctrineVersion: '1.0.0',
    institutionalScale: 'micro',
    continuityComplexity: 'moderate',
    governanceComplexity: 'structured',
    continuityExposure: 'localized',
    respondentLens: 'inside_operator',
    declaredInputs: { hasFederationAffiliation: false },
    rationale: [],
    isComplete: true,
    usedConservativeDefault: false,
    ...overrides,
  } as InstitutionalAssessmentProfile;
}

function makeBank(
  overrides: Partial<RoutedQuestionBank> = {},
): RoutedQuestionBank {
  return {
    doctrineVersion: '1.0.0',
    routeVersion: '1.0.0',
    includedQuestions: Array.from({ length: 22 }, (_v, i) => ({
      id: `q${i}`,
      section: 's1',
      order: i,
    })),
    deferredQuestions: [],
    requiredQuestions: [],
    optionalContextQuestions: [],
    routingRationale: [],
    usedSafeDefault: false,
    selectionFingerprint: 'fp-1.0.0-22-0',
    ...overrides,
  };
}

const COPY = {
  adaptiveTitle: 'How this assessment will be adapted',
  adaptiveBody: 'Adaptive body copy here.',
  adaptiveBasisNote: 'Basis note here.',
  adaptiveIncludedLabel: 'Questions included',
  adaptiveDeferredLabel: 'Questions set aside as not applicable',
  adaptiveSafeDefaultNote: 'Full bank preserved.',
  adaptiveProfileScale: 'Organizational scale',
  adaptiveProfileGovernance: 'Governance model',
  adaptiveProfileExposure: 'Continuity exposure',
  adaptiveContinue: 'Continue →',
} as Record<string, string>;

describe('AdaptiveExplanationCard', () => {
  it('renders the heading and gives it focus on mount (a11y)', () => {
    render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank()}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    const heading = screen.getByRole('heading', {
      name: /how this assessment will be adapted/i,
      level: 2,
    });
    expect(heading).toBeDefined();
    expect(document.activeElement).toBe(heading);
  });

  it('exposes the routing engine version and organizational scale as data attributes', () => {
    const { container } = render(
      <AdaptiveExplanationCard
        profile={makeProfile({ institutionalScale: 'enterprise' })}
        routedBank={makeBank({ routeVersion: '1.0.0' })}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    const card = container.querySelector(
      '[data-testid="icra-adaptive-explanation-card"]',
    );
    expect(card).not.toBeNull();
    expect(card?.getAttribute('data-routing-engine-version')).toBe('1.0.0');
    expect(card?.getAttribute('data-institutional-scale')).toBe('enterprise');
  });

  it('renders the included count and hides the deferred line when none deferred', () => {
    render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank({
          includedQuestions: new Array(22).fill(0).map((_, i) => ({
            id: `q${i}`,
            section: 's1',
            order: i,
          })),
          deferredQuestions: [],
        })}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    expect(screen.getByText(/questions included/i)).toBeDefined();
    expect(screen.getByText('22')).toBeDefined();
    expect(screen.queryByText(/set aside as not applicable/i)).toBeNull();
  });

  it('renders the deferred-count line when there is at least one deferred question', () => {
    render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank({
          deferredQuestions: [{ id: 'qD', section: 's1', order: 99 }],
        })}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    expect(screen.getByText(/set aside as not applicable/i)).toBeDefined();
  });

  it('shows the safe-default note only when the routed bank used safe defaults', () => {
    const { rerender } = render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank({ usedSafeDefault: false })}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    expect(screen.queryByText(/full bank preserved/i)).toBeNull();

    rerender(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank({ usedSafeDefault: true })}
        copy={COPY as never}
        onAcknowledge={() => {}}
      />,
    );
    expect(screen.getByText(/full bank preserved/i)).toBeDefined();
  });

  it('invokes onAcknowledge when the continue button is clicked', async () => {
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank()}
        copy={COPY as never}
        onAcknowledge={onAcknowledge}
      />,
    );
    await user.click(screen.getByTestId('icra-adaptive-continue'));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('continue button is reachable via keyboard (Tab → Enter)', async () => {
    const onAcknowledge = vi.fn();
    const user = userEvent.setup();
    render(
      <AdaptiveExplanationCard
        profile={makeProfile()}
        routedBank={makeBank()}
        copy={COPY as never}
        onAcknowledge={onAcknowledge}
      />,
    );
    // Focus starts on the heading (autoFocus). One Tab should reach the button.
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByTestId('icra-adaptive-continue'),
    );
    await user.keyboard('{Enter}');
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});
