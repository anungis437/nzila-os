import messages from '../../../messages/en-CA.json';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BottomNav } from '../BottomNav';

const mockUsePilotMode = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en-CA/dashboard/workspace',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string) => messages.experienceNavigation[key as keyof typeof messages.experienceNavigation],
}));
vi.mock('@/contexts/pilot-mode-context', () => ({
  usePilotMode: () => mockUsePilotMode(),
}));

afterEach(() => {
  cleanup();
});

describe('BottomNav', () => {
  it('shows Operations Continuity for an executive outside pilot mode', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: false });
    render(<BottomNav userRole="president" />);
    expect(screen.getByText('Operations Continuity')).toBeInTheDocument();
  });

  it('hides Operations Continuity for an executive in pilot mode (it targets a pilot-excluded route)', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: true });
    render(<BottomNav userRole="president" />);
    expect(screen.queryByText('Operations Continuity')).not.toBeInTheDocument();
  });

  it('still shows the always-present More link regardless of pilot mode', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: true });
    render(<BottomNav userRole="president" />);
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('does not filter member navigation (no member entries are pilot-excluded)', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: true });
    render(<BottomNav userRole="member" />);
    expect(screen.getByText('My Cases')).toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
  });
});
