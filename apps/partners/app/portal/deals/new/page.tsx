import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

const verticals = [
  'Financial Services',
  'Healthcare',
  'Education',
  'Government',
  'Technology',
  'Energy',
  'Real Estate',
  'Retail',
  'Transportation',
  'Other',
]

export default function NewDealPage() {
  return (
    <div className="max-w-2xl">
      {/* Back */}
      <Link
        href="/portal/deals"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Deals
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Register a New Deal</h1>
      <p className="mt-1 text-sm text-slate-500 mb-8">
        Submit deal details for Nzila team review. Approved deals are protected for 90 days.
      </p>

      <form className="space-y-6">
        {/* Account Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Acme Corporation"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Contact Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Primary Contact</label>
          <input
            type="text"
            required
            placeholder="Full name"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Email</label>
          <input
            type="email"
            required
            placeholder="contact@company.com"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Vertical */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Vertical</label>
          <select
            required
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select a vertical…</option>
            {verticals.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Estimated ARR */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated Annual Revenue (ARR)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              type="number"
              required
              min={0}
              placeholder="0"
              className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Expected Close Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected Close Date</label>
          <input
            type="date"
            required
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            rows={4}
            placeholder="Additional context about this opportunity…"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
          >
            Submit for Review
          </button>
          <Link
            href="/portal/deals"
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
