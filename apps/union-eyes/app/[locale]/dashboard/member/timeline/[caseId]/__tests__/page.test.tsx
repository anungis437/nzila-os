// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const translations = vi.hoisted(() => vi.fn());
vi.mock('next-intl/server', () => ({
  getTranslations: async (options: { locale: string; namespace: string }) => {
    translations(options);
    return (key: string) => `${options.namespace}.${key}`;
  },
}));

import CaseTimelinePage, { generateMetadata } from '../page';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  translations.mockClear();
});

const params = (locale: string) => ({ params: Promise.resolve({ locale, caseId: 'claim-1' }) });

describe('member case timeline page', () => {
  it('says it is not available, naming the capability, instead of a case that was not found', async () => {
    render(await CaseTimelinePage(params('en-CA')));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Not available in this release');
    expect(alert).toHaveTextContent('UE-MEMBER-CASE-TIMELINE');
  });

  it('says so in French on a French locale', async () => {
    render(await CaseTimelinePage(params('fr-CA')));
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
  });

  it('asks the server for nothing and offers no link or action', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(await CaseTimelinePage(params('en-CA')));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps its metadata', async () => {
    expect(await generateMetadata(params('fr-CA'))).toEqual({
      title: 'memberTimelinePage.metadata.title',
      description: 'memberTimelinePage.metadata.description',
    });
    expect(translations).toHaveBeenCalledWith({ locale: 'fr-CA', namespace: 'memberTimelinePage.metadata' });
  });
});
