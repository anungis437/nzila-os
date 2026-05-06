'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TrustcoreLoginCopy {
  heading: string
  subtitle: string
  emailLabel: string
  emailPlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  signIn: string
  signingIn: string
  divider: string
  microsoft: string
  startPrompt: string
  startLink: string
  loginErrorDefault: string
  loginErrorNetwork: string
}

export function TrustcoreLoginForm({ copy }: { copy: TrustcoreLoginCopy }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? copy.loginErrorDefault)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError(copy.loginErrorNetwork)
    } finally {
      setLoading(false)
    }
  }

  function continueWithMicrosoft() {
    const callbackUrl = encodeURIComponent('/dashboard')
    window.location.href = `/api/auth/signin/azure-ad?callbackUrl=${callbackUrl}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">{copy.heading}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {copy.subtitle}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={submitPassword} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            {copy.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            placeholder={copy.emailPlaceholder}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            {copy.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            placeholder={copy.passwordPlaceholder}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? copy.signingIn : copy.signIn}
        </button>
      </form>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-slate-400">
          <span className="bg-white px-2">{copy.divider}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={continueWithMicrosoft}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
      >
        {copy.microsoft}
      </button>

      <p className="text-center text-sm text-slate-500">
        {copy.startPrompt}{' '}
        <Link href="/start" className="font-medium text-teal-700 hover:text-teal-800">
          {copy.startLink}
        </Link>
      </p>
    </div>
  )
}
