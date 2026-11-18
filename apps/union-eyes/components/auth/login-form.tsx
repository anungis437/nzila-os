'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signInWithEntra } from '@nzila/platform-auth/entra/client';
import { defaultLocale, locales } from '@/i18n/config';
import { CANONICAL_ORGANIZATION_AUTHORITY } from '@/lib/auth/organization-authority';
import { getJson, localeOfPath, postJson, NETWORK_MESSAGE, UNEXPECTED_MESSAGE } from './auth-client';

type Mode = 'password' | 'magic-link' | 'sso';

interface MethodAvailability {
  password: boolean;
  magicLink: boolean;
  sso: boolean;
  passwordReset: boolean;
  ssoRequired: boolean;
  inviteRequired: boolean;
}

const DEFAULT_METHODS: MethodAvailability = {
  password: true,
  magicLink: true,
  sso: true,
  passwordReset: true,
  ssoRequired: false,
  inviteRequired: false,
};

const METHOD_KEYS = Object.keys(DEFAULT_METHODS) as (keyof MethodAvailability)[];

/** The method answer holds every flag as a yes/no; one that does not is not "all methods off" (or on), it is an answer to report. */
function readMethods(data: Record<string, unknown>): MethodAvailability | null {
  const flags: Partial<MethodAvailability> = {};
  for (const key of METHOD_KEYS) {
    const value = data[key];
    if (typeof value !== 'boolean') return null;
    flags[key] = value;
  }
  return flags as MethodAvailability;
}

type LoginFormProps = {
  postLoginPath?: string;
};
type OrganizationChoice = { id: string; name: string; slug: string };

function offeredOrganizations(data: Record<string, unknown>): OrganizationChoice[] | null {
  if (data.organizationAuthority !== CANONICAL_ORGANIZATION_AUTHORITY ||
      !Array.isArray(data.organizations) || !Array.isArray(data.memberships) ||
      !(data.activeOrganizationId === null || typeof data.activeOrganizationId === 'string')) return null;
  const membershipIds = new Set<string>();
  for (const membership of data.memberships) {
    if (!membership || typeof membership !== 'object' || typeof membership.organizationId !== 'string') return null;
    membershipIds.add(membership.organizationId);
  }
  const choices: OrganizationChoice[] = [];
  for (const organization of data.organizations) {
    if (!organization || typeof organization !== 'object' ||
        typeof organization.id !== 'string' || typeof organization.name !== 'string' || typeof organization.slug !== 'string' ||
        !membershipIds.has(organization.id) || choices.some((choice) => choice.id === organization.id)) return null;
    choices.push({ id: organization.id, name: organization.name, slug: organization.slug });
  }
  if (typeof data.activeOrganizationId === 'string' && !choices.some((choice) => choice.id === data.activeOrganizationId)) return null;
  return choices;
}

export function LoginForm({ postLoginPath: configuredPostLoginPath }: LoginFormProps) {
  const t = useTranslations('loginForm');
  const auth = useTranslations('auth');
  const router = useRouter();
  const pathname = usePathname();
  const postLoginPath = configuredPostLoginPath ?? `/${localeOfPath(pathname, locales, defaultLocale)}/dashboard`;
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState<MethodAvailability>(DEFAULT_METHODS);
  const [methodsNote, setMethodsNote] = useState<string | null>(null);
  const methodsRequest = useRef(0);
  // MFA step-up state
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUseRecovery, setMfaUseRecovery] = useState(false);
  const [authenticationComplete, setAuthenticationComplete] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationChoice[] | null>(null);
  const [organizationId, setOrganizationId] = useState('');

  const localizeMessage = useCallback((message: string) =>
    message === NETWORK_MESSAGE ? t('networkError') : message === UNEXPECTED_MESSAGE ? t('unexpectedError') :
      message === 'Invalid code' ? t('invalidCode') :
        message === 'Organization authority denied' ? t('organizationAccessChanged') : message, [t]);

  async function bindOrganization(id: string) {
    const answer = await postJson('/api/organizations/switch', { organizationId: id }, t('organizationSelectionFailed'));
    if (!answer.ok) { setError(localizeMessage(answer.message)); return; }
    const selected = answer.data.organization;
    if (answer.data.success !== true || answer.data.organizationAuthority !== CANONICAL_ORGANIZATION_AUTHORITY ||
        answer.data.activeOrganizationId !== id || !selected || typeof selected !== 'object' ||
        !('id' in selected) || selected.id !== id) { setError(t('unexpectedError')); return; }
    router.push(postLoginPath);
  }

  async function finishAuthentication() {
    setAuthenticationComplete(true); setMfaChallengeToken(null); setMfaCode(''); setInfo(null);
    setOrganizations(null); setOrganizationId('');
    const answer = await getJson('/api/users/me/organizations', t('organizationLookupFailed'));
    if (!answer.ok) { setError(localizeMessage(answer.message)); return; }
    const choices = offeredOrganizations(answer.data);
    if (!choices) { setError(t('unexpectedError')); return; }
    if (typeof answer.data.activeOrganizationId === 'string') { router.push(postLoginPath); return; }
    setOrganizations(choices);
    if (choices.length === 0) { setError(t('noOrganizationAccess')); return; }
    if (choices.length === 1) {
      setOrganizationId(choices[0].id);
      await bindOrganization(choices[0].id);
    }
  }

  async function submitOrganization(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    if (!organizations?.some((choice) => choice.id === organizationId)) {
      setError(t('organizationAccessChanged')); return;
    }
    setLoading(true);
    try { await bindOrganization(organizationId); } finally { setLoading(false); }
  }

  // The latest request wins: a slow answer for an address that has since been edited is not applied.
  const refreshMethods = useCallback(async (currentEmail: string) => {
    const request = ++methodsRequest.current;
    if (!currentEmail || !currentEmail.includes('@')) {
      setMethods(DEFAULT_METHODS);
      setMethodsNote(null);
      return;
    }
    const answer = await getJson(`/api/auth/methods?email=${encodeURIComponent(currentEmail)}`, t('methodsFailed'));
    if (request !== methodsRequest.current) return;
    const available = answer.ok ? readMethods(answer.data) : null;
    if (available === null) {
      // The standard options stay on offer, and the person is told they are not the result of a check for this address.
      setMethods(DEFAULT_METHODS);
      setMethodsNote(t('methodsFallback', { reason: answer.ok ? t('unexpectedError') : localizeMessage(answer.message) }));
      return;
    }
    setMethodsNote(null);
    setMethods(available);
    if (available.ssoRequired) setMode('sso');
    else if (!available.password && available.magicLink) setMode('magic-link');
  }, [t, localizeMessage]);

  useEffect(() => {
    const t = setTimeout(() => void refreshMethods(email), 350);
    return () => clearTimeout(t);
  }, [email, refreshMethods]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const answer = await postJson('/api/auth/login', { email, password }, t('loginFailed'));
      if (!answer.ok) {
        setError(localizeMessage(answer.message));
        return;
      }
      const { data } = answer;
      if (data.requiresMfa !== undefined && typeof data.requiresMfa !== 'boolean') {
        setError(t('unexpectedError')); return;
      }
      if (data.requiresMfa === true) {
        if (typeof data.mfaChallengeToken !== 'string' || !data.mfaChallengeToken) {
          setError(t('unexpectedError')); return;
        }
        setMfaChallengeToken(data.mfaChallengeToken);
        setInfo(t('mfaPrompt'));
        return;
      }
      // A signed-in answer names the user; one that does not is not a sign-in, whatever its status.
      if (typeof data.user !== 'object' || data.user === null) {
        setError(t('unexpectedError'));
        return;
      }
      await finishAuthentication();
    } finally {
      setLoading(false);
    }
  }

  async function submitMfaChallenge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const body = mfaUseRecovery
        ? { challengeToken: mfaChallengeToken, recoveryCode: mfaCode.trim() }
        : { challengeToken: mfaChallengeToken, code: mfaCode.trim() };
      const answer = await postJson('/api/auth/mfa/challenge', body, t('verificationFailed'));
      if (!answer.ok) {
        setError(localizeMessage(answer.message));
        return;
      }
      if (answer.data.ok !== true) {
        setError(t('unexpectedError'));
        return;
      }
      await finishAuthentication();
    } finally {
      setLoading(false);
    }
  }

  async function submitMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const answer = await postJson('/api/auth/magic-link/request', { email }, t('linkFailed'));
      if (!answer.ok) {
        setError(localizeMessage(answer.message));
        return;
      }
      const { data } = answer;
      if (typeof data.token === 'string' && data.token) {
        const verifyUrl = `/magic-link/verify?token=${encodeURIComponent(data.token)}`;
        setInfo(t('devLink', { url: verifyUrl }));
      } else if (typeof data.message === 'string' && data.message) {
        setInfo(data.message);
      } else {
        setError(t('unexpectedError'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function continueWithSso() {
    setError(null);
    setLoading(true);
    try {
      await signInWithEntra(postLoginPath);
    } catch {
      setError(t('ssoStartFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Image
          src="/UnionEyes-LO-FF.png"
          alt="UnionEyes logo"
          width={200}
          height={62}
          className="h-10 w-auto object-contain"
          priority
        />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('welcome')}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {!authenticationComplete && !methods.ssoRequired && (methods.password || methods.magicLink) && (
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-sm"
          role="tablist"
          aria-label={t('method')}
        >
          {methods.password && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              onClick={() => {
                setMode('password');
                setError(null);
                setInfo(null);
              }}
              className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                mode === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {auth('password')}
            </button>
          )}
          {methods.magicLink && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'magic-link'}
              onClick={() => {
                setMode('magic-link');
                setError(null);
                setInfo(null);
              }}
              className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                mode === 'magic-link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('emailLink')}
            </button>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {info && (
        <div role="status" className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 wrap-break-word">{info}</div>
      )}
      {methodsNote && (
        <div role="status" className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">{methodsNote}</div>
      )}

      {authenticationComplete ? (
        <div className="space-y-4">
          <h3 className="font-semibold">{t('chooseOrganizationTitle')}</h3>
          {loading && !organizations && <p role="status">{t('loadingOrganizations')}</p>}
          {organizations && organizations.length > 0 && <form onSubmit={submitOrganization} className="space-y-4">
            <label htmlFor="sign-in-organization" className="block text-sm font-medium">
              {t('organization')}
            </label>
            <select id="sign-in-organization" value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)} disabled={loading} required
              className="min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2">
              <option value="">{t('chooseOrganizationPlaceholder')}</option>
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>
                {organization.name} — {organization.slug}
              </option>)}
            </select>
            <button type="submit" disabled={loading || !organizationId}
              className="min-h-11 w-full whitespace-normal rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
              {t('continueOrganization')}
            </button>
          </form>}
          <button type="button" disabled={loading} className="min-h-11 w-full whitespace-normal rounded-lg border px-3 py-2"
            onClick={() => { setError(null); setLoading(true); void finishAuthentication().finally(() => setLoading(false)); }}>
            {t('refreshOrganizations')}
          </button>
          <button type="button" disabled={loading} className="min-h-11 w-full whitespace-normal rounded-lg border px-3 py-2"
            onClick={() => {
              setAuthenticationComplete(false); setOrganizations(null); setOrganizationId('');
              setPassword(''); setMfaChallengeToken(null); setMfaCode(''); setMfaUseRecovery(false); setInfo(null); setError(null);
            }}>
            {t('restartSignIn')}
          </button>
        </div>
      ) : methods.ssoRequired ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('ssoRequired')}</p>
          <button
            type="button"
            onClick={continueWithSso}
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-all"
          >
            {t('continueMicrosoft')}
          </button>
        </div>
      ) : mfaChallengeToken ? (
        <form onSubmit={submitMfaChallenge} className="space-y-4">
          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
              {mfaUseRecovery ? t('recoveryCode') : t('authenticatorCode')}
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode={mfaUseRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors tracking-widest"
              placeholder={mfaUseRecovery ? 'XXXX-XXXX-XX' : '123456'}
              maxLength={mfaUseRecovery ? 12 : 6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('verifying') : t('verify')}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setMfaUseRecovery(!mfaUseRecovery);
                setMfaCode('');
                setError(null);
              }}
              className="text-electric hover:text-blue-700"
            >
              {mfaUseRecovery ? t('useAuthenticator') : t('useRecovery')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaChallengeToken(null);
                setMfaCode('');
                setMfaUseRecovery(false);
                setError(null);
                setInfo(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : mode === 'password' ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{auth('email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">{auth('password')}</label>
              {methods.passwordReset && (
                <Link href="/forgot-password" className="text-sm text-electric hover:text-blue-700 transition-colors">{auth('forgotPassword')}</Link>
              )}
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>
      ) : (
        <form onSubmit={submitMagicLink} className="space-y-4">
          <div>
            <label htmlFor="ml-email" className="block text-sm font-medium text-gray-700 mb-1">{auth('email')}</label>
            <input
              id="ml-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
              placeholder="you@example.com"
            />
            <p className="mt-1 text-xs text-gray-500">{t('magicLinkNotice')}</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('sending') : t('sendLink')}
          </button>
        </form>
      )}

      {!authenticationComplete && !methods.ssoRequired && methods.sso && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">{t('or')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={continueWithSso}
            disabled={loading}
            className="w-full border border-gray-200 hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            {t('continueMicrosoft')}
          </button>
        </>
      )}

      <p className="text-center text-sm text-gray-500">
        {t('accessProvisioned')}
      </p>
    </div>
  );
}
