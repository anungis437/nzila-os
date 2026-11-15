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

function ResolvedLocaleProvider({ locale, initialScope, children }: Props) {
  const pathname = usePathname();
  const initialMessages = useMessages();
  const scope = clientMessageScope(pathname ?? '');
  // Layout props persist across client navigation. Resolve the actual next
  // route's catalog before rendering its translated children.
  const messages = scope === 'public-landing'
    ? clientMessagesForScope(initialMessages, scope)
    : initialScope === 'public-landing' ? use(loadBrowserMessages(locale)) : initialMessages;
  // The outer server provider supplies formats, request time, time zone and
  // error handling. The inner provider inherits them and changes messages only.
  return <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>;
}

export default function LocaleClientProvider(props: Props) {
  const loading = props.locale === 'fr-CA' ? 'Chargement…'
    : props.locale === 'it' ? 'Caricamento…'
      : props.locale === 'pt' ? 'Carregando…' : 'Loading…';
  return (
    <Suspense fallback={<div role="status" className="p-6 text-center">{loading}</div>}>
      <ResolvedLocaleProvider {...props} />
    </Suspense>
  );
}
