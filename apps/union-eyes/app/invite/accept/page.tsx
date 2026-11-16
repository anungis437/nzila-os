/**
 * Invite acceptance landing page.
 *
 * Recipients click /invite/accept?token=… in their invitation email. We let
 * them confirm or supply their name, then POST to /api/auth/invite/accept
 * which establishes the org membership + session cookie in one step.
 */
'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiErrorMessage, isRecord } from '@/lib/client/api-envelope';
import { invitationCopy, invitationLocale, frenchInvitationErrors, type InvitationLocale } from './invitation-copy';

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const rootLocale = useLocale();
  const explicitLocale = invitationLocale(params.get('locale'));
  const [locale, setLocale] = useState<InvitationLocale>(explicitLocale ?? invitationLocale(rootLocale) ?? 'en-CA');
  const t = invitationCopy[locale];

  useEffect(() => {
    const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    setLocale(explicitLocale ?? invitationLocale(cookie) ?? (rootLocale.startsWith('fr') ? 'fr-CA' : invitationLocale(navigator.language.split('-')[0])) ?? 'en-CA');
  }, [explicitLocale, rootLocale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  function changeLanguage(value: InvitationLocale) {
    setLocale(value);
    setError(null);
    document.cookie = `NEXT_LOCALE=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  }

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(challengeToken ? '/api/auth/mfa/challenge' : '/api/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeToken
          ? { challengeToken, ...(useRecovery ? { recoveryCode: code.trim() } : { code: code.trim() }) }
          : { token, firstName, lastName }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const message = apiErrorMessage(data, t.failed);
        setError(locale === 'fr-CA' ? frenchInvitationErrors[message] ?? t.failed : message);
        return;
      }
      if (!isRecord(data)) { setError(t.unconfirmed); return; }
      if (!challengeToken && data.requiresMfa === true) {
        if (typeof data.challengeToken !== 'string' || !data.challengeToken) {
          setError(t.verificationFailed);
          return;
        }
        setChallengeToken(data.challengeToken);
        return;
      }
      if (challengeToken ? data.ok !== true : !(isRecord(data.user) && typeof data.user.id === 'string' && data.user.id)) {
        setError(t.unconfirmed);
        return;
      }
      router.replace(`/${locale}/dashboard`);
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 space-y-6">
        <label className="block text-sm text-gray-700">{t.language}
          <select className="ml-2 rounded border p-2" value={locale} disabled={loading} onChange={event => changeLanguage(event.target.value as InvitationLocale)}>
            <option value="en-CA">English</option><option value="fr-CA">Français</option>
          </select>
        </label>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {challengeToken ? t.verifyDescription : t.description}
          </p>
        </div>

        {!token && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {t.missing}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {challengeToken ? <div className="space-y-3">
            <label className="block" htmlFor="invite-mfa-code">{useRecovery ? t.recovery : t.authenticator}</label>
            <input id="invite-mfa-code" value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required className="w-full rounded border p-2" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={useRecovery} onChange={event => { setUseRecovery(event.target.checked); setCode(''); }} />{t.useRecovery}</label>
          </div> : <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.firstName}
              </label>
              <input
                id="firstName"
                maxLength={100}
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t.lastName}
              </label>
              <input
                id="lastName"
                maxLength={100}
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
              />
            </div>
          </div>}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t.working : challengeToken ? t.verify : t.accept}
          </button>
        </form>
      </div>
    </main>
  );
}
