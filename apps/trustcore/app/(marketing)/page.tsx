/**
 * TrustCore — Marketing Landing Page
 *
 * /
 *
 * Conversion-focused public landing page.
 * Static — no auth, no DB queries. Loads in < 1s.
 *
 * Sections:
 *   1. Hero
 *   2. How It Works
 *   3. What You Get
 *   4. Pricing
 *   5. Trust Section
 *   6. CTA Footer
 */

import Link from 'next/link'
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  GlobeAltIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ChatBubbleLeftEllipsisIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { TrackedCtaLink } from '@/components/shared/TrackedCtaLink'

// ── How It Works ─────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    title: 'Answer a few questions',
    description:
      'Tell us about your org, the data you collect, and the tools you use. Takes 5–8 minutes.',
  },
  {
    number: '02',
    title: 'We generate your compliance setup',
    description:
      'TrustCore builds your privacy program, data inventory, policies, and initial risk assessment automatically.',
  },
  {
    number: '03',
    title: 'Fix risks and share your proof',
    description:
      'Get a prioritized action list. Download your audit report. Share your Trust Center with customers.',
  },
]

// ── What You Get ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: 'Compliance score — real-time',
    description: 'Know your exact Law 25 posture at a glance. Updated automatically as you resolve risks.',
  },
  {
    icon: ExclamationTriangleIcon,
    title: 'Risk detection — actionable',
    description: 'Every risk comes with a clear description, severity rating, and a specific remediation step.',
  },
  {
    icon: DocumentTextIcon,
    title: 'Audit-ready report — PDF',
    description: 'Download a structured compliance report you can hand to auditors, customers, or counsel.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: ArchiveBoxIcon,
    title: 'Evidence log — immutable',
    description: 'Every action is logged with timestamps and actor attribution. Evidence is always ready.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: GlobeAltIcon,
    title: 'Trust Center — shareable',
    description: 'One link that shows your compliance status to customers and procurement teams.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'Compliance history — continuous',
    description: 'Track your score over time. See exactly when you improved and what changed.',
  },
]

// ── Pricing ───────────────────────────────────────────────────────────────

interface PricingFeature {
  label: string
  free: boolean | string
  pro: boolean | string
}

const PRICING_FEATURES: PricingFeature[] = [
  { label: 'Compliance dashboard', free: true, pro: true },
  { label: 'Onboarding wizard', free: true, pro: true },
  { label: 'Risk detection', free: true, pro: true },
  { label: 'Compliance history', free: true, pro: true },
  { label: 'Active reminders', free: 'Up to 10', pro: 'Unlimited' },
  { label: 'Audit export (JSON + PDF)', free: false, pro: true },
  { label: 'Evidence bundle export', free: false, pro: true },
  { label: 'Public Trust Center', free: false, pro: true },
  { label: 'Privacy policies (generated)', free: true, pro: true },
]

function PricingCell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircleIcon className="h-5 w-5 text-teal-600 mx-auto" />
  if (value === false) return <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
  return <span className="text-xs text-gray-600 text-center block font-medium">{value}</span>
}

// ── Trust Signals ─────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    icon: ShieldCheckIcon,
    title: 'Built for Quebec Law 25',
    description:
      'Every check, every policy, every risk maps directly to Law 25 obligations — not a generic GDPR template.',
  },
  {
    icon: ArchiveBoxIcon,
    title: 'Evidence-based compliance',
    description:
      'Every action is recorded in an immutable audit log. Show regulators and customers exactly what you\'ve done.',
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'Continuous — not a one-off',
    description:
      'Compliance isn\'t a checkbox. TrustCore tracks your posture over time and alerts you when things slip.',
  },
]

// ── Mock dashboard preview (ASCII-art style stats card) ──────────────────

function DashboardMockup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden select-none">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-gray-400 font-mono">TrustCore Dashboard</span>
      </div>
      <div className="p-5 space-y-4">
        {/* Score card */}
        <div className="flex items-center gap-4 bg-teal-50 rounded-xl p-4 border border-teal-100">
          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-teal-300 shrink-0">
            <span className="text-2xl font-black text-gray-900">73</span>
            <span className="text-xs text-gray-400">/100</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Compliance Score</p>
            <p className="text-sm text-gray-700 font-medium mt-0.5">Partially compliant</p>
            <p className="text-xs text-gray-400 mt-0.5">3 risks to resolve</p>
          </div>
        </div>
        {/* Risk rows */}
        <div className="space-y-2">
          {[
            { label: 'No PIA for cross-border transfers', severity: 'high', color: 'bg-red-100 text-red-700' },
            { label: 'Data retention policy not defined', severity: 'medium', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'DSR response procedure missing', severity: 'medium', color: 'bg-yellow-100 text-yellow-700' },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.color}`}>{r.severity}</span>
              <span className="text-xs text-gray-700">{r.label}</span>
            </div>
          ))}
        </div>
        {/* Reminder */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <BoltIcon className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800 font-medium">Action: Review consent collection method</span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-white">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-28 sm:pt-28 sm:pb-36">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-indigo-50 -z-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />

        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
                <ShieldCheckIcon className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-teal-700">Quebec Law 25 compliance</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
                Get Law 25 compliant{' '}
                <span className="text-teal-600">in 15 minutes.</span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Set up, assess, and prove your privacy compliance — without legal complexity.
                Built for Quebec SMBs.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <TrackedCtaLink
                  href="/onboarding"
                  event="landing_cta_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold rounded-xl transition shadow-sm shadow-teal-200"
                >
                  <ShieldCheckIcon className="h-5 w-5" />
                  Start Free
                </TrackedCtaLink>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-base font-semibold rounded-xl transition"
                >
                  Sign in to dashboard
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs text-gray-400">Free to start. No credit card required.</p>
                <span className="text-gray-200">·</span>
                <TrackedCtaLink
                  href="/trust-center/sample"
                  event="landing_sample_trust_center_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium transition"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  View sample Trust Center →
                </TrackedCtaLink>
              </div>
            </div>

            {/* Mock dashboard */}
            <div className="hidden lg:block">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Three steps from &ldquo;I don&apos;t know my compliance status&rdquo; to
              &ldquo;here&apos;s my audit report&rdquo;.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-black text-teal-100">{step.number}</span>
                  <div className="h-px flex-1 bg-teal-100" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <TrackedCtaLink
              href="/onboarding"
              event="landing_cta_click"
              payload={{ location: 'how_it_works' }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition text-sm"
            >
              <BoltIcon className="h-4 w-4" />
              Start your setup now
            </TrackedCtaLink>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU GET ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">What you get</h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Everything you need to comply with Law 25 — built, tracked, and provable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition"
                >
                  {f.locked && (
                    <span className="absolute top-4 right-4 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <LockClosedIcon className="h-3 w-3" />
                      {f.lockedLabel}
                    </span>
                  )}
                  <Icon className="h-6 w-6 text-teal-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                  {f.title === 'Trust Center — shareable' && (
                    <TrackedCtaLink
                      href="/trust-center/sample"
                      event="landing_sample_trust_center_click"
                      payload={{ location: 'what_you_get' }}
                      className="inline-flex items-center gap-1 mt-3 text-xs text-teal-600 hover:text-teal-700 font-medium transition"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View sample →
                    </TrackedCtaLink>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50" id="pricing">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple pricing</h2>
            <p className="text-gray-500 text-base">
              Start free. Upgrade when you need audit reports and your Trust Center.
            </p>
            <p className="text-xs text-gray-400 mt-2">No contracts. Cancel anytime. Upgrade or downgrade whenever you need.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {/* Free */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Free</p>
              <p className="text-3xl font-black text-gray-900 mb-1">$0</p>
              <p className="text-xs text-gray-400 mb-5">Forever</p>
              <TrackedCtaLink
                href="/onboarding"
                event="landing_cta_click"
                payload={{ location: 'pricing_free' }}
                className="block text-center w-full py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm mb-5"
              >
                Start Free
              </TrackedCtaLink>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Compliance dashboard</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Risk detection</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Up to 10 reminders</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Generated policies</li>
                <li className="flex items-center gap-2 text-gray-300"><XCircleIcon className="h-4 w-4 shrink-0" />Audit export</li>
                <li className="flex items-center gap-2 text-gray-300"><XCircleIcon className="h-4 w-4 shrink-0" />Trust Center</li>
              </ul>
            </div>

            {/* Pro — highlighted */}
            <div className="bg-teal-600 rounded-2xl p-6 text-white relative ring-2 ring-teal-400 shadow-lg shadow-teal-100">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-teal-500 border border-teal-400 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-200 mb-2">Pro</p>
              <p className="text-3xl font-black mb-1">$49</p>
              <p className="text-xs text-teal-200 mb-5">per month · Cancel anytime</p>
              <TrackedCtaLink
                href="/onboarding"
                event="landing_cta_click"
                payload={{ location: 'pricing_pro' }}
                className="block text-center w-full py-2.5 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition text-sm mb-5"
              >
                Start Free, Upgrade Anytime
              </TrackedCtaLink>
              <ul className="space-y-2 text-sm text-teal-100">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-300 shrink-0" />Everything in Free</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-300 shrink-0" />Unlimited reminders</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-300 shrink-0" />Audit export (JSON + PDF)</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-300 shrink-0" />Evidence bundle export</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-300 shrink-0" />Public Trust Center</li>
              </ul>
            </div>

            {/* Premium */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 opacity-80">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Premium</p>
              <p className="text-3xl font-black text-gray-900 mb-1">—</p>
              <p className="text-xs text-gray-400 mb-5">Coming soon</p>
              <div className="w-full py-2.5 border border-dashed border-gray-300 text-center text-gray-400 font-medium rounded-xl text-sm mb-5">
                Notify me
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Everything in Pro</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Advanced automation</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Integrations</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Priority support</li>
              </ul>
            </div>
          </div>

          {/* Feature comparison table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">Feature</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">Free</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-teal-700">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((f, i) => (
                  <tr
                    key={f.label}
                    className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                  >
                    <td className="px-5 py-3 text-gray-700">{f.label}</td>
                    <td className="px-4 py-3"><PricingCell value={f.free} /></td>
                    <td className="px-4 py-3"><PricingCell value={f.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Built for serious compliance</h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              TrustCore isn&apos;t a checkbox tool. It&apos;s a living compliance system.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-teal-600" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── QUOTE / SOCIAL PROOF ──────────────────────────────────────── */}
      <section className="py-16 bg-teal-50 border-y border-teal-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ChatBubbleLeftEllipsisIcon className="h-8 w-8 text-teal-400 mx-auto mb-4" />
          <blockquote className="text-xl font-semibold text-teal-900 leading-relaxed mb-4">
            &ldquo;We had no idea where to start with Law 25. TrustCore gave us a score,
            a policy, and a to-do list in under 20 minutes.&rdquo;
          </blockquote>
          <p className="text-sm text-teal-600 font-medium">— SMB founder, Quebec City</p>
        </div>
      </section>

      {/* ── CTA FOOTER ────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <ShieldCheckIcon className="h-12 w-12 text-teal-400 mx-auto mb-5" />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Start your compliance setup
          </h2>
          <p className="text-gray-400 text-base mb-8 max-w-lg mx-auto">
            Answer 6 questions. Get your compliance score, risks, and policies — automatically.
            Free to start, no credit card required.
          </p>
          <TrackedCtaLink
            href="/onboarding"
            event="landing_cta_click"
            payload={{ location: 'cta_footer' }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white text-lg font-bold rounded-2xl transition shadow-lg shadow-teal-900/30"
          >
            <ShieldCheckIcon className="h-6 w-6" />
            Get compliant in 15 minutes
          </TrackedCtaLink>
          <p className="mt-4 text-xs text-gray-500">
            Free plan available. No credit card. Works for any Quebec SMB.
          </p>
        </div>
      </section>

    </div>
  )
}
