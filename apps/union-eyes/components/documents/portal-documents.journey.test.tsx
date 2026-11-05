// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PortalDocuments } from './portal-documents';

const DOC = '11111111-1111-4111-8111-111111111111';
const SECRET = 'https://secret.example/raw.pdf';
const language = vi.hoisted(() => ({ locale: 'en' }));

vi.mock('next-intl', () => ({
  useLocale: () => language.locale,
  useTranslations: () => (key: string) => key,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  language.locale = 'en';
});

describe('portal document journey', () => {
  it('lists an authorized document and hides storage locations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: [{
        id: DOC,
        title: 'Member letter',
        documentType: 'correspondence',
        privacyLabel: 'case_restricted',
        fileUrl: SECRET,
        contentText: 'private body',
        storageKey: 'documents/org/letter.pdf',
      }],
    }), { status: 200 })));

    render(<PortalDocuments locale="en" />);

    expect(screen.getByRole('heading', { name: 'Portal documents' })).toBeInTheDocument();
    expect(await screen.findByText('Member letter')).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(screen.queryByText('private body')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('documents/org/letter.pdf');
  });

  it('shows a denial and an empty list when the repository refuses the caller', async () => {
    language.locale = 'fr';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 })));

    render(<PortalDocuments locale="fr" />);

    expect(screen.getByRole('heading', { name: 'Documents du portail' })).toBeInTheDocument();
    expect(await screen.findByText("Vous n'avez pas l'autorisation d'ouvrir ce document.")).toBeInTheDocument();
    expect(screen.queryByText('Member letter')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);
  });
});
