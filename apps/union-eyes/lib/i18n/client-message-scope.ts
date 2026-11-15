import type { AbstractIntlMessages } from 'next-intl';
import { locales } from '../locales';

export const CLIENT_MESSAGE_SCOPE_HEADER = 'x-ue-page-message-scope';
const PUBLIC_LANDING = 'public-landing';

export function clientMessageScope(pathname: string): 'public-landing' | 'application' {
  return locales.some(locale => pathname === `/${locale}` || pathname === `/${locale}/`) ? PUBLIC_LANDING : 'application';
}

/** The proxy derives this presentation hint from the requested path, replacing
 * any caller-supplied value. It is never used to decide identity or access. */
export function clientMessageRequestHeaders(pathname: string, original: Headers): Headers {
  const headers = new Headers(original);
  headers.set(CLIENT_MESSAGE_SCOPE_HEADER, clientMessageScope(pathname));
  return headers;
}

/** The home page renders its copy on the server. Only its navigation and footer
 * need a browser catalog. Other routes retain every application namespace. */
export function clientMessagesForScope(messages: AbstractIntlMessages, scope: string | null): AbstractIntlMessages {
  if (scope !== PUBLIC_LANDING) return messages;
  const marketing = messages.marketing;
  if (!marketing || typeof marketing === 'string' || !marketing.nav || !marketing.footer) return messages;
  return { marketing: { nav: marketing.nav, footer: marketing.footer } };
}
