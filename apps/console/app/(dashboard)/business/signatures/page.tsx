'use client'

import Link from 'next/link'
import {
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'

export default function SignaturesHubPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / Signatures'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Digital Signatures</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sign and track digital signatures for resolutions, agreements, and filings.
        </p>
      </div>

      <div className="text-center py-16 text-gray-400">
        <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-3" />
        <p className="font-medium text-gray-600">Digital Signatures — Coming Soon</p>
        <p className="text-sm mt-2 max-w-md mx-auto">
          This module will enable cryptographic digital signing of resolutions,
          board minutes, and corporate filings with full audit trail.
        </p>
        <Link
          href="/business/governance"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to Governance
        </Link>
      </div>
    </div>
  )
}
