/**
 * TrustCore — Sample Trust Center
 *
 * /trust-center/sample
 *
 * A static, mock Trust Center that demonstrates what a real org's
 * public Trust Center looks like. Uses sanitized/fictional org data.
 *
 * No authentication required, no DB queries.
 * Linked from the marketing landing page as proof of output.
 */

import type { Metadata } from 'next'
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingOffice2Icon,
  UserIcon,
  InformationCircleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sample Trust Center — Acme Solutions Inc. | TrustCore',
  description:
    'See what a real Law 25 Trust Center looks like. Powered by TrustCore — the compliance platform for Quebec SMBs.',
}

// ── Mock data — sanitized fictional org ──────────────────────────────────

const MOCK_ORG = {
  name: 'Acme Solutions Inc.',
  industry: 'Technology',
  province: 'Quebec',
  score: 78,
  status: 'at-risk' as const,
  confidence: 82,
  privacyOfficerName: 'Marie Tremblay',
  privacyOfficerRole: 'Chief Privacy Officer',
  privacyOfficerEmail: 'privacy@acme-solutions.example.com',
  lastEvaluated: 'May 2, 2026',
}

const MOCK_CONTROLS = [
  { label: 'Privacy Program Established', passing: true },
  { label: 'Incident Response Capability', passing: true },
  { label: 'Data Subject Rights Handling', passing: true },
  { label: 'Vendor Risk Management', passing: false },
  { label: 'Privacy Impact Assessment Process', passing: false },
  { label: 'Data Inventory Maintained', passing: true },
]

const STATUS_STYLES = {
  compliant: 'bg-green-100 text-green-700 border-green-200',
  'at-risk': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'non-compliant': 'bg-red-100 text-red-700 border-red-200',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SampleTrustCenterPage() {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-5 print:border-gray-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ShieldCheckIcon className="h-8 w-8 text-teal-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">Trust Center</h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700">
                  <GlobeAltIcon className="h-3.5 w-3.5" />
                  Public Trust Page
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
                  Sample
                </span>
              </div>
              <p className="text-sm text-gray-500">Law 25 (Quebec) Compliance Status — powered by TrustCore</p>
            </div>
          </div>

          {/* Share actions */}
          <div className="flex items-center gap-2 print:hidden">
            <a
              href="/trust-center/sample"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
            >
              Open in new tab ↗
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8 print:py-6">

        {/* Sample notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 print:hidden">
          <InformationCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-0.5">This is a sample page</p>
            <p className="text-sm text-amber-700">
              Acme Solutions Inc. is fictional. This demonstrates what your Trust Center looks like to
              customers and procurement teams after you set up TrustCore.{' '}
              <Link href="/onboarding" className="font-semibold underline hover:text-amber-900">
                Set up yours free →
              </Link>
            </p>
          </div>
        </div>

        {/* Org identity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-4">
            <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Organisation</h2>
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">{MOCK_ORG.name}</p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Industry:</span> {MOCK_ORG.industry} ·{' '}
            <span className="font-medium">Province:</span> {MOCK_ORG.province}
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            This organisation&apos;s privacy compliance is assessed against the requirements of
            Quebec&apos;s <strong>Law 25</strong> (<em>An Act to modernize legislative provisions as
            regards the protection of personal information</em>). This page is published
            voluntarily for transparency with customers, partners, and procurement teams.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Last evaluated: <span className="font-medium text-gray-500">{MOCK_ORG.lastEvaluated}</span>
          </p>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Law 25 Compliance Status</h2>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-yellow-200 bg-yellow-50 shrink-0">
              <span className="text-3xl font-black text-gray-900">{MOCK_ORG.score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
            <div className="flex-1">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${STATUS_STYLES[MOCK_ORG.status]}`}>
                At Risk
              </span>
              <p className="text-xs text-gray-500 mt-2">
                Assessment confidence: {MOCK_ORG.confidence}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Score reflects active risk deductions across governance, data, PIAs, incidents, DSR, and vendors.
              </p>
            </div>
          </div>
        </div>

        {/* Key Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-5">
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Security &amp; Privacy Controls</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {MOCK_CONTROLS.map((ctrl) => (
              <div key={ctrl.label} className="flex items-center gap-3">
                {ctrl.passing ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <span className="text-sm text-gray-700">{ctrl.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Practices */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Practices</h2>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <span className="font-medium">Regulatory Framework:</span>{' '}
              Quebec Law 25 (An Act to modernize legislative provisions as regards the protection of personal information)
            </p>
            <p>
              <span className="font-medium">Incident Response:</span>{' '}
              This organisation maintains a formal incident response procedure. All privacy incidents are logged, triaged, and reported to the Commission d&apos;accès à l&apos;information (CAI) where required by law.
            </p>
            <p>
              <span className="font-medium">Data Subject Rights:</span>{' '}
              Requests for access, rectification, deletion, and portability are accepted and processed within the 30-day statutory window under Law 25.
            </p>
            <p>
              <span className="font-medium">Vendor Management:</span>{' '}
              Third-party processors are assessed for risk. Vendor contracts are currently under review to ensure full data protection alignment.
            </p>
            <p>
              <span className="font-medium">Data Retention:</span>{' '}
              Personal information is retained only as long as necessary for the stated purpose and then securely destroyed or anonymized.
            </p>
          </div>
        </div>

        {/* Audit Statement */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 print:border-teal-300">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800 mb-1">Immutable Audit Log</p>
              <p className="text-sm text-teal-700 leading-relaxed">
                This organisation maintains an immutable audit log of all compliance-related actions.
                Every change is recorded with a timestamp, actor attribution, and action summary.
                Evidence is available upon request to verified auditors or regulatory bodies.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Officer */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-4">
            <UserIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Officer Contact</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            For privacy inquiries, data subject rights requests, or questions about this organisation&apos;s
            compliance program, please contact the designated Privacy Officer:
          </p>
          <p className="text-sm font-medium text-gray-900">{MOCK_ORG.privacyOfficerName}</p>
          <p className="text-xs text-gray-500 mb-1">{MOCK_ORG.privacyOfficerRole}</p>
          <p className="text-sm text-teal-600 font-medium">{MOCK_ORG.privacyOfficerEmail}</p>
        </div>

        {/* CTA — visible on landing, hidden when printing */}
        <div className="bg-gray-900 rounded-2xl p-8 text-center print:hidden">
          <p className="text-white font-bold text-lg mb-2">
            Ready to publish your own Trust Center?
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Set up TrustCore in 15 minutes. Get your compliance score, fix risks, and share your page.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition"
          >
            <ShieldCheckIcon className="h-5 w-5" />
            Start free — no credit card
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 print:pt-4">
          <p className="text-xs text-gray-400">
            This Trust Center page is auto-generated by TrustCore and reflects the compliance posture
            as of the last evaluation. It is provided for transparency purposes and does not constitute
            a legal compliance certification. Last assessed: {MOCK_ORG.lastEvaluated}.
          </p>
        </div>
      </main>
    </div>
  )
}
