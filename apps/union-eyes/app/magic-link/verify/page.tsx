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

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function MagicLinkVerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState<string | null>(token ? null : 'Missing token');
  const [status, setStatus] = useState<'verifying' | 'error'>(
    token ? 'verifying' : 'error',
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/magic-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Could not verify sign-in link');
          setStatus('error');
          return;
        }
        router.replace('/en-CA/dashboard/priorities');
      } catch {
        if (cancelled) return;
        setError('Could not verify sign-in link');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Signing you in…</h1>
        {status === 'verifying' && (
          <p className="text-sm text-gray-500">
            Please wait while we verify your sign-in link.
          </p>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm text-red-700">{error}</p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-electric hover:text-blue-700"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
