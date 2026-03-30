import {
  DocumentDuplicateIcon,
  UserGroupIcon,
  BookOpenIcon,
  PaperAirplaneIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const playbooks = [
  {
    id: 'smb-quick-start',
    title: 'SMB Quick-Start Playbook',
    description: "A 30-day partner-led motion for landing SMB accounts with Nzila's core platform.",
    modules: ['Discovery call script', 'Demo flow', 'Proposal template', 'Follow-up cadence'],
    tier: 'All tiers',
  },
  {
    id: 'enterprise-co-sell',
    title: 'Enterprise Co-Sell Playbook',
    description: 'Joint selling methodology for large enterprise accounts — executive alignment, multi-thread engagement.',
    modules: ['Account mapping', 'Exec sponsor brief', 'Joint value prop', 'POC plan'],
    tier: 'Premier+',
  },
  {
    id: 'vertical-finance',
    title: 'Financial Services GTM',
    description: 'Compliance-first positioning, regulatory talking points, and fintech-specific ROI frameworks.',
    modules: ['Compliance checklist', 'ROI calculator', 'Reference architecture', 'Objection handler'],
    tier: 'Select+',
  },
]

const campaignTemplates = [
  { id: 'email-sequence', label: 'Email Outreach Sequence', type: 'Email', steps: 5 },
  { id: 'linkedin-cadence', label: 'LinkedIn Engagement Cadence', type: 'Social', steps: 8 },
  { id: 'webinar-kit', label: 'Joint Webinar Kit', type: 'Event', steps: 12 },
  { id: 'case-study-builder', label: 'Case Study Builder', type: 'Content', steps: 6 },
]

export default function GtmPage() {
  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GTM Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Joint go-to-market playbooks, campaign templates, and co-sell request forms.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          <PaperAirplaneIcon className="w-4 h-4" />
          Request Co-Sell Support
        </button>
      </div>

      {/* Playbooks */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <BookOpenIcon className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-900">GTM Playbooks</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {playbooks.map((pb) => (
            <div key={pb.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{pb.tier}</span>
                <BookOpenIcon className="w-4 h-4 text-slate-300" />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900 text-sm">{pb.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pb.description}</p>

              <div className="mt-4 space-y-1.5">
                {pb.modules.map((mod) => (
                  <div key={mod} className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                    {mod}
                  </div>
                ))}
              </div>

              <button className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition">
                Open playbook
                <ArrowRightIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign templates */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <DocumentDuplicateIcon className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Campaign Templates</h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Template</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Steps</th>
                <th className="text-right px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaignTemplates.map((ct) => (
                <tr key={ct.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="px-6 py-3.5 font-medium text-slate-900">{ct.label}</td>
                  <td className="px-6 py-3.5 text-slate-500">{ct.type}</td>
                  <td className="px-6 py-3.5 text-slate-500">{ct.steps} steps</td>
                  <td className="px-6 py-3.5 text-right">
                    <button className="text-xs font-medium text-blue-600 hover:text-blue-700 transition">
                      Use template
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Co-Sell Signal Engine */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <UserGroupIcon className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Co-Sell Request</h2>
        </div>

        <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <SparklesIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Co-Sell Signal Engine</h3>
              <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                When you register a deal, our matching engine automatically surfaces the right Nzila
                Account Executive, relevant playbook, and vertical-specific assets. Request co-sell
                support to get a dedicated Nzila rep assigned to your opportunity.
              </p>
              <button className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                Submit Co-Sell Request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Joint Business Plan */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900">Joint Business Plan</h3>
        <p className="text-sm text-slate-500 mt-1">
          Build a collaborative annual plan with your Nzila partner manager. Define targets,
          marketing activities, and enablement milestones together.
        </p>
        <button className="mt-4 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
          Start Business Plan
        </button>
      </div>
    </div>
  )
}
