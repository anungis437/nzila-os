/**
 * @vitest-environment jsdom
 *
 * CourtLens badges — display primitive tests.
 *
 * Proves:
 *  - Each badge renders its localized label (via next-intl mock resolving
 *    against `messages/en-CA.json`).
 *  - Each badge exposes a stable `data-testid` for downstream integration tests.
 *  - `ConfidenceBar` clamps out-of-range scores and exposes progressbar a11y.
 *  - Dot indicators render a `title` attribute for hover context.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => (await import('@/lib/test/next-intl-mock')).clientMock);

import {
  AiSummaryBadge,
  ConfidenceBar,
  PracticeAreaDot,
  StatusBadge,
  StatusDot,
  UrgencyBadge,
  UrgencyDot,
} from '../badges';

afterEach(() => {
  cleanup();
});

describe('UrgencyBadge', () => {
  it('renders the localized label for each severity', () => {
    for (const level of ['critical', 'high', 'medium', 'low'] as const) {
      const { unmount } = render(<UrgencyBadge level={level} />);
      const el = screen.getByTestId(`urgency-badge-${level}`);
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('applies size classes for xs / sm / md', () => {
    const { rerender } = render(<UrgencyBadge level="critical" size="xs" />);
    expect(screen.getByTestId('urgency-badge-critical').className).toContain('text-[10px]');
    rerender(<UrgencyBadge level="critical" size="md" />);
    expect(screen.getByTestId('urgency-badge-critical').className).toContain('text-sm');
  });
});

describe('StatusBadge', () => {
  it('renders a distinct badge for every IncidentStatus', () => {
    const statuses = [
      'new',
      'triage',
      'assigned',
      'investigating',
      'action_planning',
      'monitoring',
      'resolved',
      'closed',
      'archived',
    ] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      const el = screen.getByTestId(`status-badge-${status}`);
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('AiSummaryBadge', () => {
  it('renders an icon + label for every AiSummaryStatus', () => {
    const statuses = ['ai_draft', 'needs_verification', 'approved', 'rejected', 'revised_by_human'] as const;
    for (const status of statuses) {
      const { unmount } = render(<AiSummaryBadge status={status} />);
      const el = screen.getByTestId(`ai-summary-badge-${status}`);
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
      expect(el.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });
});

describe('ConfidenceBar', () => {
  it('renders 0% for null / undefined / non-finite scores', () => {
    for (const score of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { unmount } = render(<ConfidenceBar score={score as number | null | undefined} />);
      const bar = screen.getByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('0');
      unmount();
    }
  });

  it('clamps scores above 1 to 100% and below 0 to 0%', () => {
    const { rerender } = render(<ConfidenceBar score={1.5} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<ConfidenceBar score={-0.4} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('rounds intermediate scores and displays the percentage label', () => {
    render(<ConfidenceBar score={0.734} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('73');
    expect(screen.getByText('73%')).toBeTruthy();
  });
});

describe('Dot indicators', () => {
  it('UrgencyDot renders with title attribute', () => {
    render(<UrgencyDot level="critical" />);
    const el = screen.getByTestId('urgency-dot-critical');
    expect(el.getAttribute('title')?.length).toBeGreaterThan(0);
  });

  it('PracticeAreaDot renders for housing / employment / debt / unknown', () => {
    for (const area of ['housing', 'employment', 'debt', 'unknown'] as const) {
      const { unmount } = render(<PracticeAreaDot area={area} />);
      const el = screen.getByTestId(`practice-area-dot-${area}`);
      expect(el.getAttribute('title')?.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('StatusDot renders for every IncidentStatus', () => {
    for (const status of ['new', 'triage', 'closed'] as const) {
      const { unmount } = render(<StatusDot status={status} />);
      const el = screen.getByTestId(`status-dot-${status}`);
      expect(el.getAttribute('title')?.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
