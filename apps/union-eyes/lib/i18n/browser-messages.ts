import type { AbstractIntlMessages } from 'next-intl';
import { locales } from '../locales';
import { loadMessages } from './messages';

const catalogs = {
  en: () => import('../../messages/en.json'),
  'en-CA': () => import('../../messages/en-CA.json'),
  fr: () => import('../../messages/fr.json'),
  'fr-CA': () => import('../../messages/fr-CA.json'),
  it: () => import('../../messages/it.json'),
  pt: () => import('../../messages/pt.json'),
};
// ga-check:exempt -- immutable translation-import promises for React Suspense; no business records, sessions or authorization results.
const pending = new Map<string, Promise<AbstractIntlMessages>>();

/** These are immutable build assets, not session or catalog-authority results.
 * A home-page visit downloads the full application catalog only when navigating
 * into another route. Keep the promise stable while React suspends. */
export function loadBrowserMessages(locale: string): Promise<AbstractIntlMessages> {
  if (!locales.some(supported => supported === locale)) throw new Error('Unsupported message locale');
  let messages = pending.get(locale);
  if (!messages) {
    messages = loadMessages(locale, async catalog => {
      const read = catalogs[catalog as keyof typeof catalogs];
      if (!read) throw new Error('Unknown message catalog');
      return (await read()).default;
    }).then(value => value as AbstractIntlMessages);
    pending.set(locale, messages);
  }
  return messages;
}
