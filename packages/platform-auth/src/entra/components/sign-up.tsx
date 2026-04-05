'use client'

/**
 * @nzila/platform-auth — SignUp Component
 *
 * Drop-in replacement for Clerk's `<SignUp />`.
 * With Entra External ID, sign-up is handled by the identity provider —
 * this component redirects to the Entra sign-up user flow.
 */
import { signIn } from 'next-auth/react'

export interface SignUpProps {
  /** URL to redirect after sign-up. Default: '/dashboard' */
  forceRedirectUrl?: string
  /** Alias for forceRedirectUrl (Clerk compat). */
  redirectUrl?: string
  /** Clerk compat — treated as alias for forceRedirectUrl. */
  fallbackRedirectUrl?: string
  /** Custom appearance (API compat with Clerk). */
  appearance?: Record<string, unknown>
  /** Additional CSS class. */
  className?: string
}

/**
 * Sign-up component — replaces `<SignUp />` from `@clerk/nextjs`.
 *
 * Entra External ID handles user registration in the identity provider.
 * This redirects to the Entra sign-up flow.
 */
export function SignUp({
  forceRedirectUrl,
  redirectUrl,
  fallbackRedirectUrl,
  className = '',
}: SignUpProps) {
  const callbackUrl = forceRedirectUrl ?? redirectUrl ?? fallbackRedirectUrl ?? '/dashboard'
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Create your account
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Use your work, school, or personal account to get started.
      </p>
      <button
        type="button"
        onClick={() =>
          signIn('microsoft-entra-id', {
            redirectTo: callbackUrl,
          })
        }
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 23 23"
          className="h-5 w-5"
        >
          <path fill="#f35325" d="M1 1h10v10H1z" />
          <path fill="#81bc06" d="M12 1h10v10H12z" />
          <path fill="#05a6f0" d="M1 12h10v10H1z" />
          <path fill="#ffba08" d="M12 12h10v10H12z" />
        </svg>
        Create account with Microsoft
      </button>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        No Microsoft account? You can sign up with email or a personal account.
      </p>
    </div>
  )
}
