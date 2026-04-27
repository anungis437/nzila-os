import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Integrations' }

type IntegrationStatus = 'ok' | 'degraded' | 'fail'

interface Integration {
  name: string
  source: string
  type: string
  status: IntegrationStatus
  lastChecked: string
  detail: string
}

const integrations: Integration[] = [
  {
    name: 'FHIR Gateway',
    source: 'Hospital A',
    type: 'FHIR R4',
    status: 'ok',
    lastChecked: new Date().toISOString(),
    detail: 'FHIR R4 endpoint reachable. Last ingest: 847 resources.',
  },
  {
    name: 'HL7 v2 Feed',
    source: 'Lab Network',
    type: 'HL7 v2',
    status: 'degraded',
    lastChecked: new Date().toISOString(),
    detail: 'HL7 feed intermittently timing out. 3 failed messages in last hour.',
  },
  {
    name: 'CSV Import',
    source: 'Clinic Group',
    type: 'CSV',
    status: 'ok',
    lastChecked: new Date().toISOString(),
    detail: 'CSV import pipeline healthy. Last batch: 124 records at 06:00 UTC.',
  },
  {
    name: 'Legacy API',
    source: 'Imaging Center',
    type: 'REST API',
    status: 'fail',
    lastChecked: new Date().toISOString(),
    detail: 'Legacy API returning 503. Escalated to integration team.',
  },
]

const statusConfig: Record<IntegrationStatus, { color: string; label: string; dot: string }> = {
  ok: { color: 'border-emerald-200 bg-emerald-50', label: 'Operational', dot: 'bg-emerald-500' },
  degraded: { color: 'border-amber-200 bg-amber-50', label: 'Degraded', dot: 'bg-amber-500' },
  fail: { color: 'border-rose-200 bg-rose-50', label: 'Failing', dot: 'bg-rose-500' },
}

export default function IntegrationsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Integration Health</h1>
        <p className="text-slate-500 mt-1">
          Synthetic integration status — wire to real connector data for production.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        {integrations.map((integration) => {
          const config = statusConfig[integration.status]
          return (
            <div
              key={integration.name}
              className={`p-6 rounded-2xl border ${config.color}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{integration.name}</h2>
                  <p className="text-sm text-slate-500">
                    {integration.source} · {integration.type}
                  </p>
                </div>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border text-sm font-semibold">
                  <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-3">{integration.detail}</p>
              <p className="text-xs text-slate-400">
                Last checked: {integration.lastChecked}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
