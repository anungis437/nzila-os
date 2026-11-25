'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { postJson } from './auth-client';
import { useRecoveryMessage } from './recovery-messages';

export function ForgotPasswordForm() {
  const t = useTranslations('passwordRecovery');
  const localize = useRecoveryMessage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const answer = await postJson('/api/auth/forgot-password', { email }, t('requestFailed'));
      if (!answer.ok) {
        setError(localize(answer.message));
        return;
      }
      // The route answers the same neutral { message } whether or not an account exists; an answer without it is not that.
      if (typeof answer.data.message !== 'string') {
        setError(t('unexpectedError'));
        return;
      }
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('checkEmailTitle')}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t.rich('checkEmailBody', { email, strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>

        <Link
          href="/login"
          className="inline-block text-sm text-electric hover:text-blue-700 font-medium transition-colors"
        >
          {t('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('forgotTitle')}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('forgotIntro')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-colors"
            placeholder={t('emailPlaceholder')}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-electric hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-electric/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('sending') : t('sendResetLink')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        {t('rememberPassword')}{' '}
        <Link href="/login" className="text-electric hover:text-blue-700 font-medium transition-colors">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
