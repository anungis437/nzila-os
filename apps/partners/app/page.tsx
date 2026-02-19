import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import {
  RocketLaunchIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  FolderOpenIcon,
  CommandLineIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'

const features = [
  {
    title: 'Deal Registration',
    description: 'Register and track deals through every pipeline stage with built-in protection.',
    icon: RocketLaunchIcon,
  },
  {
    title: 'Commission Dashboard',
    description: 'Real-time visibility into earnings, payouts, and tier multipliers.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Certifications',
    description: 'Role-based learning tracks with digital badges that unlock tier advancement.',
    icon: AcademicCapIcon,
  },
  {
    title: 'Asset Library',
    description: 'Co-branded marketing collateral ready to download and deploy.',
    icon: FolderOpenIcon,
  },
  {
    title: 'API Hub',
    description: 'Manage credentials, webhooks, and monitor integration health in one place.',
    icon: CommandLineIcon,
  },
  {
    title: 'GTM Center',
    description: 'Joint go-to-market playbooks, campaign templates, and co-sell request forms.',
    icon: MegaphoneIcon,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg" />
          <span className="text-xl font-bold tracking-tight">Nzila Partners</span>
        </div>
        <div className="flex items-center gap-4">
          <SignedOut>
            <Link href="/sign-in" className="text-sm text-slate-600 hover:text-slate-900 transition">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Become a Partner
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/portal"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Go to Portal
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto px-8 pt-20 pb-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Grow with <span className="text-blue-600">Nzila</span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Your single pane of glass for deal registration, commissions, certifications,
          co-marketing, and API integrations. Built for channel partners, technology integrators,
          and enterprise clients alike.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <SignedOut>
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
            >
              Apply for Partnership
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/portal"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
            >
              Enter Portal
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition"
            >
              <f.icon className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-lg text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Nzila Ventures. All rights reserved.
      </footer>
    </div>
  )
}
