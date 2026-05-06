/**
 * TrustCore - Marketing Landing Page
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
import { Badge, Card, Container } from '@nzila/ui'
import { TrackedCtaLink } from '@/components/shared/TrackedCtaLink'

const STEPS = [
  {
    number: '01',
    title: 'Answer a few questions',
    description:
      'Tell us about your org, the data you collect, and the tools you use. Takes 5-8 minutes.',
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

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: 'Compliance score - real-time',
    description: 'Know your exact Law 25 posture at a glance. Updated automatically as you resolve risks.',
  },
  {
    icon: ExclamationTriangleIcon,
    title: 'Risk detection - actionable',
    description: 'Every risk comes with a clear description, severity rating, and a specific remediation step.',
  },
  {
    icon: DocumentTextIcon,
    title: 'Audit-ready report - PDF',
    description: 'Download a structured compliance report you can hand to auditors, customers, or counsel.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: ArchiveBoxIcon,
    title: 'Evidence log - immutable',
    description: 'Every action is logged with timestamps and actor attribution. Evidence is always ready.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: GlobeAltIcon,
    title: 'Trust Center - shareable',
    description: 'One link that shows your compliance status to customers and procurement teams.',
    locked: true,
    lockedLabel: 'Pro',
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'Compliance history - continuous',
    description: 'Track your score over time. See exactly when you improved and what changed.',
  },
]

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

const TRUST_ITEMS = [
  {
    icon: ShieldCheckIcon,
    title: 'Built for Quebec Law 25',
    description:
      'Every check, every policy, every risk maps directly to Law 25 obligations - not a generic GDPR template.',
  },
  {
    icon: ArchiveBoxIcon,
    title: 'Evidence-based compliance',
    description:
      "Every action is recorded in an immutable audit log. Show regulators and customers exactly what you've done.",
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'Continuous - not a one-off',
    description:
      "Compliance is not a checkbox. TrustCore tracks your posture over time and alerts you when things slip.",
  },
]

function PricingCell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircleIcon className="h-5 w-5 text-teal-600 mx-auto" />
  if (value === false) return <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
  return <span className="text-xs text-gray-600 text-center block font-medium">{value}</span>
}

function ModernComplianceVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-teal-200/40 via-cyan-100/30 to-blue-200/40 blur-2xl" />
      <Card variant="elevated" className="relative rounded-3xl border-white/70 bg-white/85 backdrop-blur p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Compliance cockpit</p>
            <p className="text-sm font-semibold text-gray-900">TrustCore dashboard snapshot</p>
          </div>
          <Badge variant="ok" dot>
            Synced
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <Card variant="bordered" className="col-span-1 p-3 bg-teal-50/80">
            <p className="text-[11px] uppercase font-semibold tracking-wide text-teal-700">Score</p>
            <p className="mt-1 text-2xl font-black text-gray-900">73</p>
            <p className="text-[11px] text-gray-500">Partially compliant</p>
          </Card>
          <Card variant="bordered" className="col-span-2 p-3">
            <p className="text-[11px] uppercase font-semibold tracking-wide text-gray-500">Risk pipeline</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-red-50 px-2.5 py-1.5">
                <span className="text-xs text-red-800">No PIA for cross-border transfers</span>
                <Badge variant="critical">High</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5">
                <span className="text-xs text-amber-900">Retention policy not defined</span>
                <Badge variant="warning">Medium</Badge>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="bordered" className="mt-3 p-3 bg-slate-50/70">
          <p className="text-[11px] uppercase font-semibold tracking-wide text-gray-500">Public Trust Center</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-700">Ready to share with enterprise buyers</p>
            <Badge variant="info">Live</Badge>
          </div>
        </Card>
      </Card>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden pt-20 pb-28 sm:pt-24 sm:pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(20,184,166,0.14),transparent_40%),radial-gradient(circle_at_90%_18%,rgba(14,116,144,0.14),transparent_35%),linear-gradient(120deg,#f6fffe_0%,#ffffff_40%,#f8fbff_100%)]" />

        <Container size="lg">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="accent" className="mb-5">Quebec Law 25 compliance</Badge>
              <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
                Get Law 25 compliant
                <span className="block text-teal-600">in 15 minutes.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
                Set up, assess, and prove your privacy compliance without legal complexity. Built for Quebec SMBs,
                procurement reviews, and modern trust expectations.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrackedCtaLink
                  href="/start"
                  event="landing_cta_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
                >
                  <ShieldCheckIcon className="h-5 w-5" />
                  Start Free
                </TrackedCtaLink>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 transition hover:border-gray-300"
                >
                  Sign in to dashboard
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs text-gray-400">Free to start. No credit card required.</p>
                <span className="text-gray-200">|</span>
                <TrackedCtaLink
                  href="/trust-center/sample"
                  event="landing_sample_trust_center_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 transition hover:text-teal-700"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  View sample Trust Center
                </TrackedCtaLink>
              </div>
            </div>

            <div className="lg:pl-4">
              <ModernComplianceVisual />
            </div>
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="bg-gray-50 py-20 scroll-mt-24">
        <Container size="lg">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900">How it works</h2>
            <p className="mx-auto max-w-xl text-base text-gray-500">
              Three steps from "I do not know my compliance status" to "here is my audit report".
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <Card key={step.number} variant="bordered" className="p-5 bg-white">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-4xl font-black text-teal-100">{step.number}</span>
                  <div className="h-px flex-1 bg-teal-100" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{step.description}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10 text-center">
            <TrackedCtaLink
              href="/start"
              event="landing_cta_click"
              payload={{ location: 'how_it_works' }}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              <BoltIcon className="h-4 w-4" />
              Start your setup now
            </TrackedCtaLink>
          </div>
        </Container>
      </section>

      <section id="features" className="bg-white py-20 scroll-mt-24">
        <Container size="lg">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900">What you get</h2>
            <p className="mx-auto max-w-xl text-base text-gray-500">
              Everything needed to comply with Law 25, tracked over time and provable on demand.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title} variant="bordered" className="relative p-6 bg-white transition hover:shadow-sm">
                  {f.locked ? (
                    <Badge variant="warning" className="absolute right-4 top-4 inline-flex items-center gap-1">
                      <LockClosedIcon className="h-3 w-3" />
                      {f.lockedLabel}
                    </Badge>
                  ) : null}
                  <Icon className="mb-3 h-6 w-6 text-teal-600" />
                  <h3 className="mb-1 text-sm font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-500">{f.description}</p>
                  {f.title === 'Trust Center - shareable' ? (
                    <TrackedCtaLink
                      href="/trust-center/sample"
                      event="landing_sample_trust_center_click"
                      payload={{ location: 'what_you_get' }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-600 transition hover:text-teal-700"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View sample
                    </TrackedCtaLink>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </Container>
      </section>

      <section id="pricing" className="bg-gray-50 py-20 scroll-mt-24">
        <Container size="md">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900">Simple pricing</h2>
            <p className="text-base text-gray-500">Start free. Upgrade when you need audit exports and your public Trust Center.</p>
            <p className="mt-2 text-xs text-gray-400">No contracts. Cancel anytime.</p>
          </div>

          <div className="mb-10 grid gap-6 sm:grid-cols-3">
            <Card variant="bordered" className="p-6 bg-white">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Free</p>
              <p className="mb-1 text-3xl font-black text-gray-900">$0</p>
              <p className="mb-5 text-xs text-gray-400">Forever</p>
              <TrackedCtaLink
                href="/start"
                event="landing_cta_click"
                payload={{ location: 'pricing_free' }}
                className="mb-5 block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Start Free
              </TrackedCtaLink>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Compliance dashboard</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Risk detection</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Up to 10 reminders</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-teal-500 shrink-0" />Generated policies</li>
              </ul>
            </Card>

            <Card variant="elevated" className="relative border-teal-500/30 bg-teal-600 p-6 text-white shadow-lg shadow-teal-100">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="info" className="bg-teal-500 text-white">Most popular</Badge>
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-200">Pro</p>
              <p className="mb-1 text-3xl font-black">$49</p>
              <p className="mb-5 text-xs text-teal-200">per month</p>
              <TrackedCtaLink
                href="/start"
                event="landing_cta_click"
                payload={{ location: 'pricing_pro' }}
                className="mb-5 block w-full rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
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
            </Card>

            <Card variant="bordered" className="p-6 bg-white opacity-90">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Premium</p>
              <p className="mb-1 text-3xl font-black text-gray-900">-</p>
              <p className="mb-5 text-xs text-gray-400">Coming soon</p>
              <div className="mb-5 w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-center text-sm font-medium text-gray-400">
                Notify me
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Everything in Pro</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Advanced automation</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Integrations</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-gray-300 shrink-0" />Priority support</li>
              </ul>
            </Card>
          </div>

          <Card variant="bordered" className="overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-1/2 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Feature</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">Free</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-teal-700">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((f, i) => (
                  <tr key={f.label} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="px-5 py-3 text-gray-700">{f.label}</td>
                    <td className="px-4 py-3"><PricingCell value={f.free} /></td>
                    <td className="px-4 py-3"><PricingCell value={f.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Container>
      </section>

      <section id="trust" className="bg-white py-20 scroll-mt-24">
        <Container size="lg">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-gray-900">Built for serious compliance</h2>
            <p className="mx-auto max-w-xl text-base text-gray-500">
              TrustCore is not a checkbox tool. It is a living compliance system.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} variant="bordered" className="p-6 text-center bg-white">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50">
                      <Icon className="h-6 w-6 text-teal-600" />
                    </div>
                  </div>
                  <h3 className="mb-2 font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{item.description}</p>
                </Card>
              )
            })}
          </div>
        </Container>
      </section>

      <section className="border-y border-cyan-100 bg-cyan-50 py-16">
        <Container size="sm" className="text-center">
          <ChatBubbleLeftEllipsisIcon className="mx-auto mb-4 h-8 w-8 text-cyan-500" />
          <blockquote className="mb-4 text-xl font-semibold leading-relaxed text-cyan-900">
            "We had no idea where to start with Law 25. TrustCore gave us a score, a policy, and a to-do list in under 20 minutes."
          </blockquote>
          <p className="text-sm font-medium text-cyan-700">SMB founder, Quebec City</p>
        </Container>
      </section>

      <section className="bg-gray-900 py-24">
        <Container size="sm" className="text-center">
          <ShieldCheckIcon className="mx-auto mb-5 h-12 w-12 text-teal-400" />
          <h2 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">Start your compliance setup</h2>
          <p className="mx-auto mb-8 max-w-lg text-base text-gray-400">
            Answer 6 questions. Get your compliance score, risks, and policies automatically. Free to start, no credit card required.
          </p>
          <TrackedCtaLink
            href="/start"
            event="landing_cta_click"
            payload={{ location: 'cta_footer' }}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-400"
          >
            <ShieldCheckIcon className="h-6 w-6" />
            Get compliant in 15 minutes
          </TrackedCtaLink>
          <p className="mt-4 text-xs text-gray-500">Free plan available. No credit card. Works for any Quebec SMB.</p>
        </Container>
      </section>
    </div>
  )
}
