'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience';

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

type LoginFormProps = {
  postLoginPath?: string;
};

export function LoginForm({ postLoginPath: configuredPostLoginPath }: LoginFormProps) {
  const router = useRouter();
  const postLoginPath =
    configuredPostLoginPath
    ?? (isCupe4373DemoRuntime() ? '/en-CA/dashboard' : '/en-CA/dashboard/priorities');
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState<MethodAvailability>(DEFAULT_METHODS);
  // MFA step-up state
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaUseRecovery, setMfaUseRecovery] = useState(false);

  const refreshMethods = useCallback(async (currentEmail: string) => {
    if (!currentEmail || !currentEmail.includes('@')) {
      setMethods(DEFAULT_METHODS);
      return;
    }
    try {
      const res = await fetch(
        `/api/auth/methods?email=${encodeURIComponent(currentEmail)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = (await res.json()) as MethodAvailability;
      setMethods(data);
      if (data.ssoRequired) setMode('sso');
      else if (!data.password && data.magicLink) setMode('magic-link');
    } catch {
      // ignore
    }
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (data.requiresMfa && data.mfaChallengeToken) {
        setMfaChallengeToken(data.mfaChallengeToken);
        setInfo('Enter the 6-digit code from your authenticator app.');
        return;
      }
      router.push(postLoginPath);
    } catch {
      setError('Something went wrong. Please try again.');
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
      const res = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }
      router.push(postLoginPath);
    } catch {
      setError('Something went wrong. Please try again.');
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
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send sign-in link');
        return;
      }
      const baseMessage =
        data.message ?? 'If that email is recognised, a sign-in link has been sent.';
      if (data.token) {
        const verifyUrl = `/magic-link/verify?token=${encodeURIComponent(data.token)}`;
        setInfo(`Sign-in link sent. (Dev mode) Continue at: ${verifyUrl}`);
      } else {
        setInfo(baseMessage);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function continueWithSso() {
    const cb = encodeURIComponent(postLoginPath);
    window.location.href = `/api/auth/signin/azure-ad?callbackUrl=${cb}`;
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

      {methods.ssoRequired ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Your organization requires single sign-on.</p>
          <button
            type="button"
            onClick={continueWithSso}
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
