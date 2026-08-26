/**
 * @vitest-environment jsdom
 *
 * RiskPanel — server component rendering harm-signal flags for a CourtLens matter.
 *
 * Proves:
 *  - Renders the current urgency badge.
 *  - Lists every active (`true`) risk flag with a localized label.
 *  - Omits inactive flags.
 *  - Shows the empty state when `riskFlags` has no active entries or is `null`.
 *  - Applies the "critical" styling tier to shelter/safety-related flags.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => (await import('@/lib/test/next-intl-mock')).clientMock);

import type { CourtLensRiskFlags } from '@/modules/incidents/courtlens';
import { defaultRiskFlags } from '@/modules/incidents/courtlens';

import { RiskPanel } from '../RiskPanel';

afterEach(() => {
  cleanup();
});

function withFlags(overrides: Partial<CourtLensRiskFlags>): CourtLensRiskFlags {
  return { ...defaultRiskFlags(), ...overrides };
}

describe('RiskPanel', () => {
  it('renders the urgency badge for the matter', () => {
    render(
      <RiskPanel
        urgencyLabel="High"
        urgencyLevel="high"
        riskFlags={defaultRiskFlags()}
      />,
    );
    expect(screen.getByTestId('urgency-badge-high')).toBeTruthy();
  });

  it('lists each active risk flag and skips inactive ones', () => {
    render(
      <RiskPanel
        urgencyLabel="High"
        urgencyLevel="high"
        riskFlags={withFlags({
          risk_eviction: true,
          risk_income_loss: true,
          risk_harassment: true,
        })}
      />,
    );
    const list = screen.getByTestId('risk-panel-flags');
    expect(within(list).getByTestId('risk-panel-flag-risk_eviction')).toBeTruthy();
    expect(within(list).getByTestId('risk-panel-flag-risk_income_loss')).toBeTruthy();
    expect(within(list).getByTestId('risk-panel-flag-risk_harassment')).toBeTruthy();
    expect(screen.queryByTestId('risk-panel-flag-risk_lockout')).toBeNull();
    expect(screen.queryByTestId('risk-panel-flag-risk_safety')).toBeNull();
  });

  it('renders the empty state when no flags are active', () => {
    render(
      <RiskPanel
        urgencyLabel="Standard"
        urgencyLevel="low"
        riskFlags={defaultRiskFlags()}
      />,
    );
    expect(screen.getByTestId('risk-panel-empty')).toBeTruthy();
    expect(screen.queryByTestId('risk-panel-flags')).toBeNull();
  });

  it('handles a `null` riskFlags prop as empty', () => {
    render(
      <RiskPanel urgencyLabel="Standard" urgencyLevel="low" riskFlags={null} />,
    );
    expect(screen.getByTestId('risk-panel-empty')).toBeTruthy();
  });

  it('applies critical styling to shelter / safety flags', () => {
    render(
      <RiskPanel
        urgencyLabel="Critical"
        urgencyLevel="critical"
        riskFlags={withFlags({
          risk_lockout: true,
          risk_income_loss: true,
        })}
      />,
    );
    const critical = screen.getByTestId('risk-panel-flag-risk_lockout');
    const nonCritical = screen.getByTestId('risk-panel-flag-risk_income_loss');
    expect(critical.className).toContain('bg-red-50');
    expect(nonCritical.className).toContain('bg-amber-50');
  });
});
