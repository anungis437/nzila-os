'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        return;
      }

      router.push('/portal');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Welcome back</h3>
        <p className="mt-1 text-sm text-gray-500">Sign in to continue managing your partner operations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-electric focus:ring-2 focus:ring-electric/20"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-electric focus:ring-2 focus:ring-electric/20"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-electric px-4 py-2.5 font-semibold text-white shadow-lg shadow-electric/25 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      </form>

      <p className="text-center text-sm text-gray-500">
        Need access?{' '}
        <Link href="/sign-up" className="font-medium text-electric transition-colors hover:text-blue-700">
          Create an account
        </Link>
      </p>
    </div>
  );
}
