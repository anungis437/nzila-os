'use client';

/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * EmailResultsCard — small post-submission affordance that lets the
 * respondent email themselves the results URL so the report is
 * recoverable beyond the current browser tab. Privacy-preserving: the
 * email is sent to the server, used to dispatch a single message via
 * Resend, and never persisted (only a SHA-256 hash is logged with the
 * results_emailed event).
 */

import { useState, useId } from 'react';

interface EmailResultsCardProps {
  assessmentId: string;
  locale?: string;
}

const COPY = {
  'en-CA': {
    heading: 'Save your results link',
    body: 'This page is the only way back to your assessment. Send yourself the link so you can revisit it later.',
    label: 'Email address',
    placeholder: 'you@organization.org',
    submit: 'Email me my results link',
    sending: 'Sending…',
    success: 'Link sent. Check your inbox (and spam folder, just in case).',
    privacy:
      'We never store your email address. Only a one-way hash is logged with the send event.',
    invalid: 'Please enter a valid email address.',
    error: 'Could not send the email. Please try again or copy the URL above.',
  },
  'fr-CA': {
    heading: 'Conservez le lien vers vos résultats',
    body: "Cette page est le seul moyen de revenir à votre évaluation. Envoyez-vous le lien pour le retrouver plus tard.",
    label: 'Adresse courriel',
    placeholder: 'vous@organisation.org',
    submit: "Envoyez-moi le lien par courriel",
    sending: 'Envoi…',
    success: 'Lien envoyé. Vérifiez votre boîte de réception (et les pourriels, au cas où).',
    privacy:
      "Nous ne conservons jamais votre adresse courriel. Seule une empreinte unidirectionnelle est enregistrée avec l'événement d'envoi.",
    invalid: 'Veuillez entrer une adresse courriel valide.',
    error: "Impossible d'envoyer le courriel. Veuillez réessayer ou copier l'URL ci-dessus.",
  },
} as const;

export function EmailResultsCard({ assessmentId, locale = 'en-CA' }: EmailResultsCardProps) {
  const inputId = useId();
  const copy = COPY[locale as keyof typeof COPY] ?? COPY['en-CA'];
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function isValid(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid(email)) {
      setStatus('error');
      setErrorMsg(copy.invalid);
      return;
    }
    setStatus('sending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/icra/email-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, email, locale }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(data.error ?? copy.error);
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg(copy.error);
      setStatus('error');
    }
  }

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="rounded-lg border border-stone-200 bg-white p-5 print:hidden"
    >
      <h2
        id={`${inputId}-heading`}
        className="text-sm font-semibold tracking-tight text-stone-900"
      >
        {copy.heading}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{copy.body}</p>

      {status === 'sent' ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {copy.success}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-2" noValidate>
          <label htmlFor={inputId} className="sr-only">
            {copy.label}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={inputId}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === 'error') {
                  setStatus('idle');
                  setErrorMsg(null);
                }
              }}
              placeholder={copy.placeholder}
              aria-invalid={status === 'error'}
              aria-describedby={status === 'error' && errorMsg ? `${inputId}-err` : undefined}
              className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="inline-flex items-center justify-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? copy.sending : copy.submit}
            </button>
          </div>
          {status === 'error' && errorMsg && (
            <p id={`${inputId}-err`} role="alert" className="text-xs text-red-700">
              {errorMsg}
            </p>
          )}
        </form>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">{copy.privacy}</p>
    </section>
  );
}
