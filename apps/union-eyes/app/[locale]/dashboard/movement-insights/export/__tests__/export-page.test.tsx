// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createTranslator } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';

// The page reads its words through the server translator; here that is the real catalogs.
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({ locale, messages: locale.startsWith('fr') ? frCA : enCA, namespace }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock('@/db', () => {
  throw new Error('the retired export page must not read the database');
});

import LegislativeBriefExportPage, { generateMetadata } from '../page';

afterEach(cleanup);

const renderPage = async (locale: string) => render(await LegislativeBriefExportPage({ params: Promise.resolve({ locale }) }));

describe('the legislative brief export page', () => {
  it('says the export is not available and presents no brief: no figures, no export button, no filters', async () => {
    await renderPage('en-CA');

    expect(screen.getByRole('heading', { name: 'Legislative Brief' })).toBeInTheDocument();
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Not available in this release');
    expect(notice).toHaveTextContent('UE-MOVEMENT-INSIGHTS-LEGISLATIVE-BRIEF');
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined|Export PDF|Key Findings|Customize|Focus Area/);
  });

  it('links back to the insights it came from, under the viewer’s locale', async () => {
    await renderPage('fr-CA');

    expect(screen.getByRole('link', { name: 'Retour aux Aperçus' })).toHaveAttribute('href', '/fr-CA/dashboard/movement-insights');
  });

  it('says so in French in a French locale', async () => {
    await renderPage('fr-CA');

    expect(screen.getByRole('heading', { name: 'Résumé Législatif' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
  });

  it('describes itself truthfully in its metadata, in both languages', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'en-CA' }) })).toEqual({
      title: 'Legislative Brief Export',
      description: 'This export is not available in this release.',
    });
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'fr-CA' }) })).toMatchObject({
      description: 'Cette exportation n’est pas disponible dans cette version.',
    });
  });
});
