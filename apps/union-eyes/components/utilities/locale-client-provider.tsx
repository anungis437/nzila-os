'use client';

import { Suspense, use } from 'react';
import { usePathname } from 'next/navigation';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { clientMessageScope, clientMessagesForScope } from '@/lib/i18n/client-message-scope';
import { loadBrowserMessages } from '@/lib/i18n/browser-messages';

type Props = {
  locale: string;
  initialScope: string | null;
  children: React.ReactNode;
};

function ImportedLocaleProvider({ locale, children }: Pick<Props, 'locale' | 'children'>) {
  const messages = use(loadBrowserMessages(locale));
  // The outer server provider supplies formats, request time, time zone and
  // error handling. The inner provider inherits them and changes messages only.
  return <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>;
}

export default function LocaleClientProvider(props: Props) {
  const pathname = usePathname();
  const initialMessages = useMessages();
  const scope = clientMessageScope(pathname ?? '');
  // Direct visits keep their existing server redirect boundary. A new Suspense
  // boundary would turn an awaited access redirect into a streamed HTTP 200.
  if (scope === 'public-landing' || props.initialScope !== 'public-landing') {
    return <NextIntlClientProvider locale={props.locale} messages={clientMessagesForScope(initialMessages, scope)}>
      {props.children}
    </NextIntlClientProvider>;
  }
  // Only client navigation from the small home catalog needs an asset load.
  const loading = props.locale === 'fr-CA' ? 'Chargement…'
    : props.locale === 'it' ? 'Caricamento…'
      : props.locale === 'pt' ? 'Carregando…' : 'Loading…';
  return (
    <Suspense fallback={<div role="status" className="p-6 text-center">{loading}</div>}>
      <ImportedLocaleProvider locale={props.locale}>{props.children}</ImportedLocaleProvider>
    </Suspense>
  );
}
