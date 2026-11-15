// @vitest-environment jsdom
import { Component, Suspense, use, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider, useFormatter, useMessages, useNow, useTimeZone, useTranslations, type AbstractIntlMessages } from 'next-intl';
import { loadMessages } from '../../lib/i18n/messages';
import { clientMessagesForScope } from '../../lib/i18n/client-message-scope';
import * as browserMessages from '../../lib/i18n/browser-messages';
import LocaleClientProvider from './locale-client-provider';

const route = vi.hoisted(() => ({ pathname: '/en-CA' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
const instant = new Date('2026-01-01T01:00:00Z');

function Page({ home }: { home: boolean }) {
  const t = useTranslations(home ? 'marketing.nav' : 'common');
  const formatter = useFormatter();
  return <main data-testid="page" data-common={String('common' in useMessages())}
    data-time-zone={useTimeZone()} data-now={useNow().toISOString()}
    data-date={formatter.dateTime(instant, { year: 'numeric', month: '2-digit', day: '2-digit' })}
    data-money={formatter.number(12.3, 'money')}>
    <h1>{t(home ? 'pricing' : 'save')}</h1>
  </main>;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('persistent locale layout browser navigation', () => {
  for (const initialScope of ['application', 'public-landing']) {
    it(`keeps awaited server work outside a new loading boundary on a direct ${initialScope} visit`, async () => {
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      function AwaitedServerWork() { use(pending); return <p>Server guard settled</p>; }
      route.pathname = initialScope === 'application' ? '/en-CA/dashboard' : '/en-CA';
      await act(async () => {
        render(<Suspense fallback={<p role="status">Existing server boundary</p>}>
          <NextIntlClientProvider locale="en-CA" messages={{ marketing: { nav: { pricing: 'Pricing' } } }}>
            <LocaleClientProvider locale="en-CA" initialScope={initialScope}><AwaitedServerWork /></LocaleClientProvider>
          </NextIntlClientProvider>
        </Suspense>);
      });
      expect(screen.getByRole('status').textContent).toBe('Existing server boundary');
      await act(async () => { release(); });
      expect(screen.getByText('Server guard settled')).toBeTruthy();
    });
  }

  for (const locale of ['en-CA', 'fr-CA']) {
    it(`restores application copy and retains request formatting on navigation from ${locale} home`, async () => {
      const full = await loadMessages(locale, async catalog => (await import(`../../messages/${catalog}.json`)).default) as AbstractIntlMessages;
      const initialMessages = clientMessagesForScope(full, 'public-landing');
      const formats = { number: { money: { style: 'currency' as const, currency: 'CAD' } } };
      const tree = (home: boolean) => <NextIntlClientProvider locale={locale} messages={initialMessages}
        timeZone="America/Toronto" now={instant} formats={formats}>
        <LocaleClientProvider locale={locale} initialScope="public-landing"><Page home={home} /></LocaleClientProvider>
      </NextIntlClientProvider>;
      route.pathname = `/${locale}`;
      const view = render(tree(true));
      expect(screen.getByTestId('page').dataset.common).toBe('false');

      // Keep the original server provider props; Next layouts retain them.
      route.pathname = `/${locale}/dashboard/claims`;
      await act(async () => { view.rerender(tree(false)); });
      await waitFor(() => expect(screen.getByRole('heading').textContent).toBe(locale === 'fr-CA' ? 'Enregistrer' : 'Save'));
      expect(screen.getByTestId('page').dataset.common).toBe('true');

      route.pathname = `/${locale}`;
      await act(async () => { view.rerender(tree(true)); });
      await waitFor(() => expect(screen.getByTestId('page').dataset.common).toBe('false'));
      const page = screen.getByTestId('page');
      expect(page.dataset.timeZone).toBe('America/Toronto');
      expect(page.dataset.now).toBe(instant.toISOString());
      expect(page.dataset.date).toBe(new Intl.DateTimeFormat(locale, {
        timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(instant));
      expect(page.dataset.money).toBe(new Intl.NumberFormat(locale, formats.number.money).format(12.3));
    });
  }

  it('surfaces a failed translation import instead of rendering app labels from the home catalog', async () => {
    const failure = Promise.reject(new Error('Translation import failed'));
    void failure.catch(() => undefined);
    vi.spyOn(browserMessages, 'loadBrowserMessages').mockReturnValue(failure);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() { return { failed: true }; }
      render() { return this.state.failed ? <p role="alert">Translation import failed</p> : this.props.children; }
    }
    route.pathname = '/en-CA/dashboard/claims';
    await act(async () => {
      render(<Boundary><NextIntlClientProvider locale="en-CA" messages={{ marketing: { nav: { pricing: 'Pricing' } } }}>
        <LocaleClientProvider locale="en-CA" initialScope="public-landing"><Page home={false} /></LocaleClientProvider>
      </NextIntlClientProvider></Boundary>);
    });
    expect((await screen.findByRole('alert')).textContent).toBe('Translation import failed');
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
