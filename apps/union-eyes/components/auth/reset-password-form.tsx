'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { postJson } from './auth-client';
import { useRecoveryMessage } from './recovery-messages';

export function ResetPasswordForm() {
  const t = useTranslations('passwordRecovery');
  const localize = useRecoveryMessage();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    if (!token) {
      setError(t('missingToken'));
      return;
    }

    setLoading(true);

    try {
      const answer = await postJson('/api/auth/reset-password', { token, newPassword: password }, t('resetFailed'));
      if (!answer.ok) {
        setError(localize(answer.message));
        return;
      }
      // The route confirms with { message: "Password has been reset..." }; an answer without it is not a reset.
      if (typeof answer.data.message !== 'string') {
        setError(t('unexpectedError'));
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('resetDoneTitle')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('resetDoneBody')}
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex w-full justify-center bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all"
        >
          {t('signIn')}
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('invalidLinkTitle')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t('invalidLinkBody')}
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-electric hover:text-blue-700 font-medium transition-colors"
        >
          {t('requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('newPasswordTitle')}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('newPasswordIntro')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t('newPassword')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-400">
            {t('passwordRule')}
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('resetting') : t('resetPassword')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-electric hover:text-blue-700 font-medium transition-colors">
          {t('backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
