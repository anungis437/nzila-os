'use client'

/**
 * @nzila/platform-auth — SignIn Component
 *
 * Drop-in replacement for Clerk's `<SignIn />`.
 * Renders a sign-in button that redirects to Microsoft Entra ID.
 */
import { signIn } from 'next-auth/react'

export interface SignInProps {
  /** URL to redirect after sign-in. Default: '/dashboard' */
  forceRedirectUrl?: string
  /** Alias for forceRedirectUrl (Clerk compat). */
  redirectUrl?: string
  /** Custom appearance (kept for API compatibility with Clerk). */
  appearance?: Record<string, unknown>
  /** Additional CSS class. */
  className?: string
}

/**
 * Sign-in component — replaces `<SignIn />` from `@clerk/nextjs`.
 *
 * Instead of rendering an embedded form (like Clerk), this redirects
 * to Microsoft's login page via the NextAuth flow.
 */
export function SignIn({
  forceRedirectUrl,
  redirectUrl,
  className = '',
}: SignInProps) {
  const callbackUrl = forceRedirectUrl ?? redirectUrl ?? '/dashboard'
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Sign in to your account
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Sign in with your Microsoft account to continue.
      </p>
      <button
        type="button"
        onClick={() => signIn('microsoft-entra-id', { redirectTo: callbackUrl })}
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
        Sign in with Microsoft
      </button>
    </div>
  )
}
