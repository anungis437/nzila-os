'use client'

/**
 * @nzila/platform-auth — SignUp Component
 *
 * Drop-in replacement for Clerk's `<SignUp />`.
 * With Entra External ID, sign-up is handled by the identity provider —
 * this component renders a polished card and redirects to the Entra flow.
 * Supports Clerk-compatible `appearance.elements` for per-app styling.
 */
import { useState } from 'react'
import { signIn } from 'next-auth/react'

export interface SignUpAppearance {
  elements?: {
    rootBox?: string
    card?: string
    headerTitle?: string
    headerSubtitle?: string
    socialButtonsBlockButton?: string
    formButtonPrimary?: string
    footerActionLink?: string
    dividerLine?: string
    dividerText?: string
    [key: string]: string | undefined
  }
}

export interface SignUpProps {
  /** URL to redirect after sign-up. Default: '/dashboard' */
  forceRedirectUrl?: string
  /** Alias for forceRedirectUrl (Clerk compat). */
  redirectUrl?: string
  /** Clerk compat — treated as alias for forceRedirectUrl. */
  fallbackRedirectUrl?: string
  /** Appearance config — supports Clerk-compatible `elements` overrides. */
  appearance?: SignUpAppearance
  /** Additional CSS class. */
  className?: string
}

/**
 * Sign-up component — replaces `<SignUp />` from `@clerk/nextjs`.
 *
 * Entra External ID handles user registration in the identity provider.
 * This renders a card and redirects to the Entra sign-up flow.
 */
export function SignUp({
  forceRedirectUrl,
  redirectUrl,
  fallbackRedirectUrl,
  appearance,
  className = '',
}: SignUpProps) {
  const [loading, setLoading] = useState(false)
  const callbackUrl = forceRedirectUrl ?? redirectUrl ?? fallbackRedirectUrl ?? '/dashboard'
  const el = appearance?.elements ?? {}

  return (
    <div className={`${el.rootBox ?? 'w-full max-w-md mx-auto'} ${className}`}>
      <div
        className={
          el.card ??
          'rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-900'
        }
      >
        {/* ── Header ── */}
        <div className="mb-6 text-center">
          <h2 className={el.headerTitle ?? 'text-2xl font-bold text-gray-900 dark:text-white'}>
            Create your account
          </h2>
          <p className={el.headerSubtitle ?? 'mt-2 text-sm text-gray-500 dark:text-gray-400'}>
            Get started in seconds with your existing account
          </p>
        </div>

        {/* ── Microsoft Button ── */}
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true)
            signIn('microsoft-entra-id', { redirectTo: callbackUrl })
          }}
          className={
            el.socialButtonsBlockButton ??
            'flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
          }
        >
          {loading ? (
            <svg className="h-5 w-5 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="h-5 w-5">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          {loading ? 'Redirecting…' : 'Sign up with Microsoft'}
        </button>

        {/* ── Info ── */}
        <div className="mt-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            You can use your <strong className="text-gray-700 dark:text-gray-300">work or school account</strong>,{' '}
            <strong className="text-gray-700 dark:text-gray-300">personal Microsoft account</strong>, or sign up via{' '}
            <strong className="text-gray-700 dark:text-gray-300">email invitation</strong>.
            No separate password needed.
          </p>
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Already have an account?{' '}
          <a
            href="/sign-in"
            className={el.footerActionLink ?? 'font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400'}
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
