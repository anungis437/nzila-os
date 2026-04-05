'use client'

/**
 * @nzila/platform-auth — SignIn Component
 *
 * Drop-in replacement for Clerk's `<SignIn />`.
 * Renders a polished sign-in card with Microsoft identity button.
 * Supports Clerk-compatible `appearance.elements` for per-app styling.
 */
import { useState } from 'react'
import { signIn } from 'next-auth/react'

export interface SignInAppearance {
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

export interface SignInProps {
  /** URL to redirect after sign-in. Default: '/dashboard' */
  forceRedirectUrl?: string
  /** Alias for forceRedirectUrl (Clerk compat). */
  redirectUrl?: string
  /** Clerk compat — treated as alias for forceRedirectUrl. */
  fallbackRedirectUrl?: string
  /** Appearance config — supports Clerk-compatible `elements` overrides. */
  appearance?: SignInAppearance
  /** Additional CSS class. */
  className?: string
}

/**
 * Sign-in component — replaces `<SignIn />` from `@clerk/nextjs`.
 *
 * Renders a card with Microsoft sign-in button. When embedded in a
 * premium `AuthPageLayout`, pass `appearance.elements.card = 'shadow-none border-0'`
 * to remove the card chrome.
 */
export function SignIn({
  forceRedirectUrl,
  redirectUrl,
  fallbackRedirectUrl,
  appearance,
  className = '',
}: SignInProps) {
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
            Welcome back
          </h2>
          <p className={el.headerSubtitle ?? 'mt-2 text-sm text-gray-500 dark:text-gray-400'}>
            Sign in to continue to your account
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
          {loading ? 'Redirecting…' : 'Continue with Microsoft'}
        </button>

        {/* ── Divider ── */}
        <div className="my-6 flex items-center gap-3">
          <div className={`flex-1 border-t ${el.dividerLine ?? 'border-gray-200 dark:border-gray-700'}`} />
          <span className={el.dividerText ?? 'text-xs text-gray-400 dark:text-gray-500'}>
            Supported accounts
          </span>
          <div className={`flex-1 border-t ${el.dividerLine ?? 'border-gray-200 dark:border-gray-700'}`} />
        </div>

        {/* ── Account Types ── */}
        <div className="space-y-3">
          <AccountType
            icon={<OrgIcon />}
            title="Work or school"
            description="Microsoft 365, Azure AD"
          />
          <AccountType
            icon={<PersonalIcon />}
            title="Personal Microsoft"
            description="Outlook.com, Hotmail, Xbox"
          />
          <AccountType
            icon={<GuestIcon />}
            title="Guest access"
            description="Email invitation or one-time passcode"
          />
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Don&apos;t have an account?{' '}
          <a
            href="/sign-up"
            className={el.footerActionLink ?? 'font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400'}
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────────────────────

function AccountType({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-left">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
      </div>
    </div>
  )
}

function OrgIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function PersonalIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function GuestIcon() {
  return (
    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}
