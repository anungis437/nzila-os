import {
  CommandLineIcon,
  KeyIcon,
  LinkIcon,
  ChartBarIcon,
  PlusIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const environments = [
  { id: 'sandbox', label: 'Sandbox', active: true, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'production', label: 'Production', active: false, color: 'bg-green-50 text-green-700 border-green-200' },
]

export default function ApiHubPage() {
  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage API credentials, webhooks, and monitor your integration health.
          </p>
        </div>
        <a
          href="#"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          <LinkIcon className="w-4 h-4" />
          API Documentation
        </a>
      </div>

      {/* Environment selector */}
      <div className="flex gap-3 mt-8">
        {environments.map((env) => (
          <button
            key={env.id}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              env.active ? env.color : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {env.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* API Keys */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyIcon className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">API Keys</h2>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">
              <PlusIcon className="w-3.5 h-3.5" />
              Generate Key
            </button>
          </div>

          <div className="px-6 py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
              <KeyIcon className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">No API keys generated</p>
            <p className="text-xs text-slate-400 mt-1">
              Generate your first sandbox API key to start integrating with Nzila.
            </p>
          </div>
        </div>

        {/* Usage metrics */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Usage</h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: 'API Calls (24h)', value: '0', limit: '10,000' },
              { label: 'Error Rate', value: '0%', limit: '< 1%' },
              { label: 'Avg Latency', value: '—', limit: '< 200ms' },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">{metric.label}</p>
                  <p className="text-xs text-slate-400">Target: {metric.limit}</p>
                </div>
                <span className="text-lg font-bold text-slate-900">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Webhooks */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Webhook Endpoints</h2>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
            <PlusIcon className="w-3.5 h-3.5" />
            Add Endpoint
          </button>
        </div>
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No webhook endpoints configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Register a URL to receive real-time event notifications from Nzila.
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div className="mt-6 flex gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <ShieldCheckIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-800 font-medium">Security Best Practices</p>
          <ul className="mt-1 text-xs text-amber-700 space-y-1">
            <li>• Never expose API keys in client-side code or public repositories</li>
            <li>• Rotate production keys quarterly and revoke unused keys promptly</li>
            <li>• Validate webhook signatures using your endpoint signing secret</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
