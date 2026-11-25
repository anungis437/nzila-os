/**
 * Magic-link verification landing page.
 *
 * Hit by users clicking the link in their email: /magic-link/verify?token=…
 * The handler is server-side: we POST the token to the verify endpoint
 * (which sets the session cookie) and then redirect into the dashboard.
 *
 * We deliberately do this from a small client component so the cookie can be
 * set via the API route's response headers (server-component fetches don't
 * receive Set-Cookie reliably across Next 15 RSC boundaries).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { NETWORK_MESSAGE, UNEXPECTED_MESSAGE, postJson } from '@/components/auth/auth-client';
import { readChallengeAnswer, readSignInAnswer } from '@/lib/client/sign-in-answer';
import { frenchInvitationErrors, invitationCopy, invitationLocale, type InvitationLocale } from '@/app/invite/accept/invitation-copy';

const copy = {
  'en-CA': {
    title: 'Signing you in…',
    wait: 'Please wait while we verify your sign-in link.',
    missing: 'This sign-in link is incomplete. Request a new one.',
    failed: 'This sign-in link could not be verified. Request a new one.',
    back: 'Back to sign in',
  },
  'fr-CA': {
    title: 'Connexion en cours…',
    wait: 'Veuillez patienter pendant la vérification de votre lien de connexion.',
    missing: 'Ce lien de connexion est incomplet. Demandez-en un nouveau.',
    failed: 'Ce lien de connexion n’a pas pu être vérifié. Demandez-en un nouveau.',
    back: 'Retour à la connexion',
  },
} as const;

type Step = { kind: 'verifying' } | { kind: 'failed'; message: string | null } | { kind: 'mfa'; challengeToken: string };

export default function MagicLinkVerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const explicitLocale = invitationLocale(params.get('locale'));
  // This public route sits outside the locale layout and its NextIntl provider.
  const [locale, setLocale] = useState<InvitationLocale>(explicitLocale ?? 'en-CA');
  const t = copy[locale];
  const m = invitationCopy[locale];
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [step, setStep] = useState<Step>(token ? { kind: 'verifying' } : { kind: 'failed', message: null });
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    setLocale(explicitLocale ?? invitationLocale(cookie) ?? invitationLocale(navigator.language.split('-')[0]) ?? 'en-CA');
  }, [explicitLocale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // The single-use token is spent by this request, so it must not be repeated when the language is detected.
    (async () => {
      const answer = await postJson('/api/auth/magic-link/verify', { token }, copy[localeRef.current].failed);
      if (cancelled) return;
      const spoken = copy[localeRef.current].failed;
      if (!answer.ok) {
        setStep({ kind: 'failed', message: answer.message === NETWORK_MESSAGE || answer.message === UNEXPECTED_MESSAGE ? invitationCopy[localeRef.current].network : spoken });
        return;
      }
      const signIn = readSignInAnswer(answer.data);
      if (signIn.kind === 'second-factor') setStep({ kind: 'mfa', challengeToken: signIn.challengeToken });
      else if (signIn.kind === 'unconfirmed') setStep({ kind: 'failed', message: spoken });
      else router.replace(`/${localeRef.current}/dashboard`);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (step.kind !== 'mfa' || busy) return;
    setBusy(true);
    setMfaError(null);
    const answer = await postJson(
      '/api/auth/mfa/challenge',
      { challengeToken: step.challengeToken, ...(useRecovery ? { recoveryCode: code.trim() } : { code: code.trim() }) },
      m.failed,
    );
    setBusy(false);
    if (!answer.ok) {
      if (answer.message === NETWORK_MESSAGE || answer.message === UNEXPECTED_MESSAGE) setMfaError(m.network);
      else setMfaError(locale === 'fr-CA' ? frenchInvitationErrors[answer.message] ?? m.failed : answer.message);
      return;
    }
    if (!readChallengeAnswer(answer.data)) {
      setMfaError(m.unconfirmed);
      return;
    }
    router.replace(`/${locale}/dashboard`);
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">{step.kind === 'mfa' ? m.verify : t.title}</h1>
        {step.kind === 'verifying' && (
          <p role="status" className="text-sm text-gray-500">
            {t.wait}
          </p>
        )}
        {step.kind === 'mfa' && (
          <form onSubmit={verifyCode} className="space-y-3 text-left">
            <p className="text-sm text-gray-500">{m.verifyDescription}</p>
            {mfaError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {mfaError}
              </p>
            )}
            <label htmlFor="magic-mfa-code" className="block text-sm font-medium text-gray-700">
              {useRecovery ? m.recovery : m.authenticator}
            </label>
            <input
              id="magic-mfa-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode={useRecovery ? 'text' : 'numeric'}
              required
              autoFocus
              className="min-h-11 w-full rounded border p-2"
            />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useRecovery}
                onChange={(event) => {
                  setUseRecovery(event.target.checked);
                  setCode('');
                }}
              />
              {m.useRecovery}
            </label>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-xl bg-electric px-4 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? m.working : m.verify}
            </button>
          </form>
        )}
        {step.kind === 'failed' && (
          <>
            <p role="alert" className="text-sm text-red-700">
              {step.message ?? t.missing}
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-sm font-medium text-electric hover:text-blue-700"
            >
              {t.back}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
