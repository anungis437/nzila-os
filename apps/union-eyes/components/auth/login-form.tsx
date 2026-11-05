'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signInWithEntra } from '@nzila/platform-auth/entra/client';
import { defaultLocale, locales } from '@/i18n/config';
import { getJson, localeOfPath, postJson, UNEXPECTED_MESSAGE } from './auth-client';

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

export function LoginForm({ postLoginPath: configuredPostLoginPath }: LoginFormProps) {
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

  // The latest request wins: a slow answer for an address that has since been edited is not applied.
  const refreshMethods = useCallback(async (currentEmail: string) => {
    const request = ++methodsRequest.current;
    if (!currentEmail || !currentEmail.includes('@')) {
      setMethods(DEFAULT_METHODS);
      setMethodsNote(null);
      return;
    }
    const answer = await getJson(`/api/auth/methods?email=${encodeURIComponent(currentEmail)}`, 'Sign-in options could not be checked');
    if (request !== methodsRequest.current) return;
    const available = answer.ok ? readMethods(answer.data) : null;
    if (available === null) {
      // The standard options stay on offer, and the person is told they are not the result of a check for this address.
      setMethods(DEFAULT_METHODS);
      setMethodsNote(`We could not check which sign-in options apply to this address, so the standard ones are shown. ${answer.ok ? UNEXPECTED_MESSAGE : answer.message}`);
      return;
    }
    setMethodsNote(null);
    setMethods(available);
    if (available.ssoRequired) setMode('sso');
    else if (!available.password && available.magicLink) setMode('magic-link');
  }, []);

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
      const answer = await postJson('/api/auth/login', { email, password }, 'Login failed');
      if (!answer.ok) {
        setError(answer.message);
        return;
      }
      const { data } = answer;
      if (data.requiresMfa === true && typeof data.mfaChallengeToken === 'string' && data.mfaChallengeToken) {
        setMfaChallengeToken(data.mfaChallengeToken);
        setInfo('Enter the 6-digit code from your authenticator app.');
        return;
      }
      // A signed-in answer names the user; one that does not is not a sign-in, whatever its status.
      if (typeof data.user !== 'object' || data.user === null) {
        setError(UNEXPECTED_MESSAGE);
        return;
      }
      router.push(postLoginPath);
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
      const answer = await postJson('/api/auth/mfa/challenge', body, 'Verification failed');
      if (!answer.ok) {
        setError(answer.message);
        return;
      }
      if (answer.data.ok !== true) {
        setError(UNEXPECTED_MESSAGE);
        return;
      }
      router.push(postLoginPath);
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
      const answer = await postJson('/api/auth/magic-link/request', { email }, 'Could not send sign-in link');
      if (!answer.ok) {
        setError(answer.message);
        return;
      }
      const { data } = answer;
      if (typeof data.token === 'string' && data.token) {
        const verifyUrl = `/magic-link/verify?token=${encodeURIComponent(data.token)}`;
        setInfo(`Sign-in link sent. (Dev mode) Continue at: ${verifyUrl}`);
      } else if (typeof data.message === 'string' && data.message) {
        setInfo(data.message);
      } else {
        setError(UNEXPECTED_MESSAGE);
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
      setError('Unable to start Microsoft sign-in. Please try again.');
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
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your account to continue
          </p>
        </div>
      </div>

      {!methods.ssoRequired && (methods.password || methods.magicLink) && (
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-sm"
          role="tablist"
          aria-label="Sign-in method"
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
              Password
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
              Email me a link
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {info && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 wrap-break-word">{info}</div>
      )}
      {methodsNote && (
        <div role="status" className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">{methodsNote}</div>
      )}

      {methods.ssoRequired ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Your organization requires single sign-on.</p>
          <button
            type="button"
            onClick={continueWithSso}
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-all"
          >
            Continue with Microsoft
          </button>
        </div>
      ) : mfaChallengeToken ? (
        <form onSubmit={submitMfaChallenge} className="space-y-4">
          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-1">
              {mfaUseRecovery ? 'Recovery code' : 'Authenticator code'}
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
            {loading ? 'Verifying…' : 'Verify'}
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
              {mfaUseRecovery ? 'Use authenticator code' : 'Use recovery code'}
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
              Cancel
            </button>
          </div>
        </form>
      ) : mode === 'password' ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              {methods.passwordReset && (
                <Link href="/forgot-password" className="text-sm text-electric hover:text-blue-700 transition-colors">Forgot password?</Link>
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitMagicLink} className="space-y-4">
          <div>
            <label htmlFor="ml-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
            <p className="mt-1 text-xs text-gray-500">We&apos;ll email a one-time sign-in link. Valid for 15 minutes.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}

      {!methods.ssoRequired && methods.sso && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={continueWithSso}
            disabled={loading}
            className="w-full border border-gray-200 hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            Continue with Microsoft
          </button>
        </>
      )}

      <p className="text-center text-sm text-gray-500">
        Access is provisioned by your organization administrator.
      </p>
    </div>
  );
}
