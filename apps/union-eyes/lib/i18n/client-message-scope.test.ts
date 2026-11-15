import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { locales } from '../locales';
import { loadMessages } from './messages';
import { loadBrowserMessages } from './browser-messages';
import { CLIENT_MESSAGE_SCOPE_HEADER, clientMessageRequestHeaders, clientMessagesForScope } from './client-message-scope';

describe('browser message scope', () => {
  it('replaces caller hints from the actual route and preserves session and routing headers', () => {
    const incoming = new Headers({
      [CLIENT_MESSAGE_SCOPE_HEADER]: 'public-landing',
      cookie: 'session=unchanged',
      authorization: 'Bearer unchanged',
      'next-router-state-tree': 'unchanged',
    });
    for (const path of ['/en-CA/dashboard', '/fr-CA/dashboard/claims', '/en-CA/login', '/en-CA/pricing', '/unknown', '/en-CA/extra/..']) {
      const forwarded = clientMessageRequestHeaders(path, incoming);
      expect(forwarded.get(CLIENT_MESSAGE_SCOPE_HEADER)).toBe('application');
      for (const key of ['cookie', 'authorization', 'next-router-state-tree']) expect(forwarded.get(key)).toBe(incoming.get(key));
    }
    expect(incoming.get(CLIENT_MESSAGE_SCOPE_HEADER)).toBe('public-landing');
    incoming.set(CLIENT_MESSAGE_SCOPE_HEADER, 'application');
    for (const locale of locales) {
      for (const path of [`/${locale}`, `/${locale}/`]) {
        expect(clientMessageRequestHeaders(path, incoming).get(CLIENT_MESSAGE_SCOPE_HEADER)).toBe('public-landing');
      }
    }
  });

  for (const locale of locales) {
    it(`loads the exact server fallback catalog on browser navigation for ${locale}`, async () => {
      const server = await loadMessages(locale, async catalog => (await import(`../../messages/${catalog}.json`)).default);
      const pending = loadBrowserMessages(locale);
      expect(loadBrowserMessages(locale)).toBe(pending);
      expect(await pending).toEqual(server);
    });

    it(`keeps every navigation/footer translation and omits application payload for ${locale}`, async () => {
      const full = await loadMessages(locale, async catalog => (await import(`../../messages/${catalog}.json`)).default) as AbstractIntlMessages;
      const reduced = clientMessagesForScope(full, 'public-landing');
      const marketing = full.marketing as AbstractIntlMessages;
      const errors: Error[] = [];
      function checkGroup(namespace: string, group: AbstractIntlMessages) {
        const t = createTranslator({ locale, messages: reduced, namespace, onError: error => errors.push(error) });
        function walk(value: AbstractIntlMessages, prefix = '') {
          for (const [key, entry] of Object.entries(value)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (typeof entry === 'string') expect(t(path)).toBeTruthy();
            else walk(entry, path);
          }
        }
        walk(group);
      }
      checkGroup('marketing.nav', marketing.nav as AbstractIntlMessages);
      checkGroup('marketing.footer', marketing.footer as AbstractIntlMessages);
      expect(errors).toEqual([]);
      expect(Object.keys(reduced)).toEqual(['marketing']);
      expect(Object.keys(reduced.marketing)).toEqual(['nav', 'footer']);
      expect(JSON.stringify(reduced).length).toBeLessThan(JSON.stringify(full).length / 10);
      for (const scope of ['application', null, '', 'unrecognized']) expect(clientMessagesForScope(full, scope)).toBe(full);
    });
  }

  it('refuses an unsupported browser catalog instead of choosing another language', () => {
    expect(() => loadBrowserMessages('not-a-locale')).toThrow('Unsupported message locale');
  });

  it('retains the full catalog when the expected public groups are unavailable', () => {
    const incomplete: AbstractIntlMessages[] = [{}, { marketing: 'text' }, { marketing: { nav: { title: 'Navigation' } } }];
    for (const catalog of incomplete) {
      expect(clientMessagesForScope(catalog, 'public-landing')).toBe(catalog);
    }
  });
});
