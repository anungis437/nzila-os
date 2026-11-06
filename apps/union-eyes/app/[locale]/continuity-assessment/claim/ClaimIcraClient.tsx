'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiErrorMessage } from '@/lib/client/api-envelope';

interface Props {
  assessmentId: string;
  token: string;
  locale: 'en-CA' | 'fr-CA';
}

/** Presents the e-mailed claim token to /api/icra/[assessmentId]/claim; success is only what that route confirms. */
export default function ClaimIcraClient({ assessmentId, token, locale }: Props) {
  const router = useRouter();
  const fr = locale === 'fr-CA';
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async () => {
    setStatus('submitting');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/icra/${assessmentId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimToken: token }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        setStatus('error');
        if (res.status === 410) {
          setErrorMessage(fr
            ? 'Ce lien de récupération est expiré. Contactez-nous pour qu’un nouveau soit émis.'
            : 'This claim link has expired. Contact us so a new one can be issued.');
        } else if (res.status === 409) {
          setErrorMessage(fr ? 'Ce rapport a déjà été récupéré.' : 'This report has already been claimed.');
        } else {
          setErrorMessage(apiErrorMessage(body, fr ? 'Récupération impossible.' : 'Claim failed.'));
        }
        return;
      }
      setStatus('success');
      router.push(`/${locale}/continuity-assessment/results/${assessmentId}`);
    } catch {
      setStatus('error');
      setErrorMessage(fr ? 'Erreur réseau. Réessayez.' : 'Network error. Please try again.');
    }
  };

  return (
    <div className="mt-8 space-y-5">
      <p className="text-base leading-relaxed text-stone-700">
        {fr
          ? 'Confirmez ci-dessous pour lier ce rapport à l’organisation que vous administrez. Seul le compte dont l’adresse courriel est celle de l’achat peut le récupérer.'
          : 'Confirm below to bind this report to the organization you administer. Only the account whose e-mail is the purchase e-mail can claim it.'}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={status === 'submitting' || status === 'success'}
        className="inline-flex items-center rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:opacity-60"
      >
        {status === 'submitting' ? (fr ? 'Liaison en cours…' : 'Binding…') : fr ? 'Récupérer le rapport' : 'Claim report'}
      </button>
      {errorMessage ? (
        <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
