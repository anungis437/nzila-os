// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { RootLocalePresentation } from './root-locale-presentation';

const route = vi.hoisted(() => ({ params: {} as Record<string, string | string[]> }));
vi.mock('next/navigation', () => ({ useParams: () => route.params }));

afterEach(() => { cleanup(); route.params = {}; document.documentElement.lang = 'en-CA'; });

describe('root locale presentation', () => {
  it('updates the document and notice while the original English root props persist', () => {
    route.params = { locale: 'en-CA' };
    const props = { initialLocale: 'en-CA', staging: true };
    const page = render(<RootLocalePresentation {...props} />);
    expect(document.documentElement.lang).toBe('en-CA');
    expect(screen.getByText(/^Staging environment/)).toBeDefined();

    route.params = { locale: 'fr-CA', caseId: 'owned-case' };
    page.rerender(<RootLocalePresentation {...props} />);
    expect(document.documentElement.lang).toBe('fr-CA');
    expect(screen.getByText(/^Environnement de préproduction/)).toBeDefined();
    expect(screen.queryByText(/^Staging environment/)).toBeNull();

    route.params = { locale: 'en-CA' };
    page.rerender(<RootLocalePresentation {...props} />);
    expect(document.documentElement.lang).toBe('en-CA');
    expect(screen.getByText(/^Staging environment/)).toBeDefined();
    expect(screen.queryByText(/^Environnement de préproduction/)).toBeNull();
  });

  it('preserves the server locale before route params are available and on invalid routes', () => {
    expect(renderToString(<RootLocalePresentation initialLocale="fr-CA" staging />)).toContain('Environnement de préproduction');
    route.params = { locale: ['fr-CA', 'unexpected'] };
    const page = render(<RootLocalePresentation initialLocale="fr-CA" staging />);
    expect(document.documentElement.lang).toBe('fr-CA');
    route.params = { locale: 'unsupported-locale' };
    page.rerender(<RootLocalePresentation initialLocale="fr-CA" staging />);
    expect(document.documentElement.lang).toBe('fr-CA');
  });

  it('keeps the document language current without displaying a staging notice outside staging', () => {
    route.params = { locale: 'fr-CA' };
    const page = render(<RootLocalePresentation initialLocale="en-CA" staging={false} />);
    expect(document.documentElement.lang).toBe('fr-CA');
    expect(page.container.innerHTML).toBe('');
    route.params = { locale: 'pt' };
    page.rerender(<RootLocalePresentation initialLocale="en-CA" staging={false} />);
    expect(document.documentElement.lang).toBe('pt');
    expect(page.container.innerHTML).toBe('');
  });
});
