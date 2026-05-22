'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  workbookId: string;
  token: string;
  locale: 'en-CA' | 'fr-CA';
}

export default function ClaimWorkbookClient({ workbookId, token, locale }: Props) {
  const router = useRouter();
  const fr = locale === 'fr-CA';
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async () => {
    setStatus('submitting');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/workbook/${workbookId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimToken: token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus('error');
        if (res.status === 410) {
          setErrorMessage(
            fr
              ? 'Ce jeton de r\u00e9cup\u00e9ration est expir\u00e9. Contactez-nous pour qu\u2019un nouveau soit \u00e9mis.'
              : 'This claim token has expired. Contact us so a new one can be issued.',
          );
        } else if (res.status === 409) {
          setErrorMessage(
            fr
              ? 'Ce cahier a d\u00e9j\u00e0 \u00e9t\u00e9 r\u00e9cup\u00e9r\u00e9 par un autre compte.'
              : 'This workbook has already been claimed by another account.',
          );
        } else {
          setErrorMessage(body.error ?? (fr ? 'R\u00e9cup\u00e9ration impossible.' : 'Claim failed.'));
        }
        return;
      }
      setStatus('success');
      router.push(`/${locale}/workbook/${workbookId}`);
    } catch {
      setStatus('error');
      setErrorMessage(
        fr ? 'Erreur r\u00e9seau. R\u00e9essayez.' : 'Network error. Please try again.',
      );
    }
  };

  return (
    <div className="mt-8 space-y-5">
      <p className="text-base leading-relaxed text-stone-700">
        {fr
          ? 'Confirmez ci-dessous pour lier ce cahier \u00e0 votre compte. Une organisation sera r\u00e9solue automatiquement.'
          : 'Confirm below to bind this workbook to your account. An organization will be resolved automatically.'}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={status === 'submitting' || status === 'success'}
        className="inline-flex items-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:opacity-60"
      >
        {status === 'submitting'
          ? fr
            ? 'Liaison en cours\u2026'
            : 'Binding\u2026'
          : fr
            ? 'R\u00e9cup\u00e9rer le cahier'
            : 'Claim workbook'}
      </button>
      {errorMessage ? (
        <p className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
