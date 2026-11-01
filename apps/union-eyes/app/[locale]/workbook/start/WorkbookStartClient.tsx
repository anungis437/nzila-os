'use client';

/**
 * Starts a pseudonymous workbook through the guarded start API, so the browser receives the workbook's capability cookie, and then opens
 * the first module. The page itself creates nothing: a GET that inserted rows was reachable by crawlers and prefetchers, bypassed the
 * intake limits and the bot challenge, and could not issue a capability.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TurnstileWidget } from '@/components/icra/TurnstileWidget';

interface Props {
  locale: string;
  utm: { source: string | null; medium: string | null; campaign: string | null };
}

export default function WorkbookStartClient({ locale, utm }: Props) {
  const router = useRouter();
  const fr = locale.toLowerCase().startsWith('fr');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function begin() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch('/api/workbook/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          locale: fr ? 'fr-CA' : 'en-CA',
          utm: { source: utm.source, medium: utm.medium, campaign: utm.campaign },
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { workbookId } = (await response.json()) as { workbookId: string };
      router.push(`/${locale}/workbook/${workbookId}/memory-holders`);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-3xl font-light text-stone-900">{fr ? 'Votre cahier de cartographie' : 'Your mapping workbook'}</h1>
        <p className="mt-6 text-base leading-relaxed text-stone-600">
          {fr
            ? 'Le cahier est pseudonyme : il n’exige aucun compte. Ce navigateur en garde l’accès ; ouvrez-le depuis le même navigateur.'
            : 'The workbook is pseudonymous: it needs no account. This browser holds the access to it, so open it again from the same browser.'}
        </p>
        <div className="mt-8">
          <TurnstileWidget onVerified={setTurnstileToken} locale={locale} />
        </div>
        <button
          type="button"
          onClick={begin}
          disabled={busy || turnstileToken === null}
          className="mt-8 inline-flex items-center rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:opacity-50"
        >
          {fr ? 'Commencer' : 'Begin'}
        </button>
        {failed ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {fr ? 'Le cahier n’a pas pu être créé. Réessayez dans un instant.' : 'The workbook could not be created. Try again in a moment.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
