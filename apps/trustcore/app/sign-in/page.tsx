/**
 * TrustCore — Sign-In Page
 */

import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getMessages } from 'next-intl/server'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { TrustcoreLoginForm } from '@/components/auth/TrustcoreLoginForm'
import { TRUSTCORE_DEFAULT_LOCALE, type TrustcoreLocale } from '@/i18n'

function resolveLocale(rawLocale: string | undefined): TrustcoreLocale {
  if (rawLocale === 'en' || rawLocale === 'en-CA') return 'en-CA'
  if (rawLocale === 'fr' || rawLocale === 'fr-CA') return 'fr-CA'
  return TRUSTCORE_DEFAULT_LOCALE
}

export default async function SignInPage() {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value)
  const messages = await getMessages({ locale })
  const auth = messages.auth as Record<string, string>

  return (
    <div className="flex min-h-screen bg-white text-slate-950">
      <div className="hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-between lg:overflow-hidden lg:border-r lg:border-slate-200">
        <div className="relative h-full">
          <Image
            src="/images/marketing/home-montreal-downtown.jpg"
            alt="Montreal business district skyline"
            fill
            priority
            className="object-cover"
            sizes="52vw"
          />
          <div className="absolute inset-0 bg-linear-to-br from-slate-950/86 via-slate-900/72 to-teal-900/60" />

          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.16em] uppercase text-teal-200">
                <ShieldCheckIcon className="h-4 w-4" />
                TrustCore
              </Link>
            </div>

            <div className="max-w-lg">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">Law 25 system</p>
              <h1 className="text-4xl font-extrabold leading-tight">Privacy compliance that stands up in buyer diligence.</h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-200">
                Keep posture, evidence, and governance in one operating surface built for Quebec legal requirements.
              </p>
            </div>

            <div className="grid max-w-md grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-3">
                <p className="text-xl font-black">15m</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-200">Setup</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-3">
                <p className="text-xl font-black">73</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-200">Live score</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-3">
                <p className="text-xl font-black">24/7</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-200">Evidence</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-lg shadow-slate-200/40 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{auth.signInEyebrow}</p>
            <p className="mt-2 text-sm text-slate-500">{auth.signInDeck}</p>
          </div>
          <TrustcoreLoginForm
            copy={{
              heading: auth.heading,
              subtitle: auth.subtitle,
              emailLabel: auth.emailLabel,
              emailPlaceholder: auth.emailPlaceholder,
              passwordLabel: auth.passwordLabel,
              passwordPlaceholder: auth.passwordPlaceholder,
              signIn: auth.signInButton,
              signingIn: auth.signingIn,
              divider: auth.divider,
              microsoft: auth.microsoft,
              startPrompt: auth.startPrompt,
              startLink: auth.startLink,
              loginErrorDefault: auth.loginErrorDefault,
              loginErrorNetwork: auth.loginErrorNetwork,
            }}
          />
        </div>
      </div>
    </div>
  )
}
