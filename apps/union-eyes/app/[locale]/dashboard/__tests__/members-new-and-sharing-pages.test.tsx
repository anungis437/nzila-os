// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('next-intl', () => ({
  useLocale: () => intl.locale,
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import CreateMemberPage from '../members/new/page';
import SharingSettingsPage from '../settings/sharing/page';

const realFetch = globalThis.fetch;
const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

beforeEach(() => {
  intl.locale = 'en-CA';
  router.back.mockClear();
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

describe('members/new: direct member creation is not available', () => {
  it('says so, offers the invitation route that exists, and has no form to fill in', () => {
    render(<CreateMemberPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('UE-MEMBERS-DIRECT-CREATE');
    expect(screen.getByText(/Members cannot be created directly in this release/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Member Management' })).toHaveAttribute('href', '/dashboard/admin/members');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /create|save|submit/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still lets the user go back', () => {
    render(<CreateMemberPage />);
    fireEvent.click(screen.getByRole('button', { name: /backToMembers/ }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('is in French on a French locale', () => {
    intl.locale = 'fr-CA';
    render(<CreateMemberPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
    expect(screen.getByText(/Les membres ne peuvent pas être créés directement dans cette version/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la gestion des membres' })).toBeInTheDocument();
  });

  it('is not advertised by the members directory', () => {
    const directory = readFileSync('components/members/members-console.tsx', 'utf8');
    expect(directory).not.toContain('/dashboard/members/new');
  });
});

describe('settings/sharing: sharing settings and the access log are not available', () => {
  it('says so and asks for neither the settings nor the access log', () => {
    render(<SharingSettingsPage />);
    expect(screen.getByRole('heading', { name: 'sharingSettingsPage.title' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('UE-ORG-SHARING-SETTINGS');
    expect(screen.getByText(/cannot be viewed or changed in this release/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows no form, no switches and no tabs that would look like working settings', () => {
    render(<SharingSettingsPage />);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it('is in French on a French locale', () => {
    intl.locale = 'fr-CA';
    render(<SharingSettingsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
    expect(screen.getByText(/ne peuvent être ni consultés ni modifiés dans cette version/)).toBeInTheDocument();
  });
});
