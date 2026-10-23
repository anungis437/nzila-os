// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CookieConsentBanner } from './cookie-consent-banner';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';

vi.mock('@nzila/platform-auth/entra/client', () => ({ useUser: () => ({ user: { id: 'owned-unit-user' } }) }));
vi.mock('@/contexts/organization-context', () => ({ useOrganization: () => ({ organization: { id: 'owned-unit-org' }, isLoading: false }) }));
vi.mock('@/lib/hooks/use-onboarding', () => ({ useOnboarding: () => ({ showOverlay: true, currentStep: 0, advanceStep: vi.fn(), completeOnboarding: vi.fn() }) }));
vi.mock('@/components/onboarding/onboarding-overlay', () => ({
  toOnboardingRole: () => 'member', OnboardingOverlay: () => <aside data-testid="optional-onboarding">Optional onboarding</aside>,
}));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('first-visit precedence', () => {
  it('holds onboarding until an explicit rejection, then preserves rejection and resumes guidance', async () => {
    render(<><CookieConsentBanner organizationId="owned-unit-org" /><OnboardingProvider userRole="member" /></>);
    expect(await screen.findByRole('dialog', { name: 'We value your privacy' })).toBeVisible();
    expect(screen.queryByTestId('optional-onboarding')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reject All' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByTestId('optional-onboarding')).toBeVisible();
    expect(JSON.parse(localStorage.getItem('cookie_consent')!).preferences)
      .toEqual({ essential: true, functional: false, analytics: false, marketing: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not resume onboarding merely because preferences were opened', async () => {
    render(<><CookieConsentBanner organizationId="owned-unit-org" /><OnboardingProvider userRole="member" /></>);
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }));
    expect(await screen.findByRole('dialog', { name: 'Cookie Preferences' })).toBeVisible();
    expect(screen.queryByTestId('optional-onboarding')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Essential Cookies' })).toBeDisabled();
    expect(localStorage.getItem('cookie_consent')).toBeNull();
  });
});
