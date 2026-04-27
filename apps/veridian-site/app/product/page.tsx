import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Product' }

const connectorTypes = [
  { name: 'FHIR R4', description: 'Full FHIR R4 resource support including Patient, Encounter, Observation, MedicationRequest, DiagnosticReport, and Referral.' },
  { name: 'HL7 v2', description: 'HL7 v2.x message parsing for ADT, ORU, ORM, MDM, and SIU message types.' },
  { name: 'CSV / Flat File', description: 'Structured CSV import with field mapping configuration for clinic exports.' },
  { name: 'REST API', description: 'Vendor-specific REST integrations with configurable auth, polling, and transformation.' },
]

const modules = [
  {
    name: 'Veridian Connect',
    badge: 'Integration Layer',
    description: 'Standards-aligned connector layer. Translates heterogeneous source formats into a normalized internal event model. All data is validated at ingestion, rejected events are logged for review, and schema drift is surfaced as alerts.',
    capabilities: ['FHIR R4 resource ingestion', 'HL7 v2 ADT / ORU / ORM parsing', 'CSV field mapping', 'REST connector with configurable polling', 'Schema validation and drift alerting', 'Tenant-scoped routing'],
  },
  {
    name: 'Veridian Timeline',
    badge: 'Clinical View',
    description: 'Unified patient chronology. Merges encounters, labs, medications, referrals, and imaging events from every connected source into a single, ordered timeline — filtered by consent scope and viewer role.',
    capabilities: ['Cross-source deduplication', 'Encounter merge and conflict resolution', 'Medication reconciliation view', 'Lab value trend display', 'Imaging event aggregation', 'Consent-filtered rendering'],
  },
  {
    name: 'Veridian Access',
    badge: 'Consent & Governance',
    description: 'Role-based consent enforcement. Access decisions are evaluated against patient consent, clinician role, and site scope before any record is surfaced. Break-glass access is available with mandatory reason capture and immediate audit.',
    capabilities: ['Patient consent registry', 'RBAC by role and site', 'Break-glass with audit trail', 'Access expiry and review scheduling', 'Consent scope: READ_TIMELINE, READ_LABS, READ_FULL', 'API-enforced policy decisions'],
  },
  {
    name: 'Veridian Flow',
    badge: 'Referral Management',
    description: 'Referral tracking and handoff continuity. Tracks the lifecycle of every referral from origination to specialist contact — surfacing overdue referrals, incomplete context packages, and handoff gaps.',
    capabilities: ['Referral status lifecycle', 'Context package attachment', 'Overdue referral alerting', 'Specialist acknowledgement tracking', 'Cross-facility routing', 'Referral analytics'],
  },
  {
    name: 'Veridian Insight',
    badge: 'Network Analytics',
    description: 'Network-level KPIs for clinical and operational governance. Surfaces duplicate test risk, referral delay distributions, incomplete history rates, and access review completion across the connected network.',
    capabilities: ['Duplicate test risk scoring', 'Referral delay analysis', 'History completeness metrics', 'Access review completion rates', 'Trend visualization', 'Exportable governance reports'],
  },
]

export default function ProductPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
            Platform architecture
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Veridian Care is a governed orchestration layer. It does not replace existing EMRs. It
            connects them — surfacing a unified clinical view with consent, audit, and access
            control.
          </p>
        </div>

        {/* Data flow diagram */}
        <div className="mb-20 p-8 bg-slate-900 rounded-2xl text-slate-300 font-mono text-sm overflow-x-auto">
          <div className="text-teal-400 font-bold mb-4 text-base">Data Architecture</div>
          <pre className="whitespace-pre leading-relaxed">{`
  ┌─────────────────────────────────────────────────────────────────┐
  │                     SOURCE SYSTEMS                              │
  │  [ EMR A ]   [ EMR B ]   [ Lab System ]   [ Imaging ]          │
  │  FHIR R4     HL7 v2       CSV Export       REST API             │
  └────────────────────────────┬────────────────────────────────────┘
                               │
                   ┌───────────▼───────────┐
                   │   VERIDIAN CONNECT    │
                   │   (Ingest + Normalize)│
                   └───────────┬───────────┘
                               │ Validated Events
              ┌────────────────▼────────────────┐
              │        VERIDIAN CORE             │
              │  ┌──────────────────────────┐   │
              │  │  VERIDIAN TIMELINE       │   │
              │  │  (Unified Patient View)  │   │
              │  └──────────────────────────┘   │
              │  ┌──────────────────────────┐   │
              │  │  VERIDIAN ACCESS         │   │
              │  │  (Consent + RBAC + Audit)│   │
              │  └──────────────────────────┘   │
              │  ┌──────────────────────────┐   │
              │  │  VERIDIAN FLOW           │   │
              │  │  (Referral Tracking)     │   │
              │  └──────────────────────────┘   │
              └────────────────┬────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │        CONSUMERS                │
              │  [ Clinician Portal ]           │
              │  [ Admin Dashboard ]            │
              │  [ Veridian Insight ]           │
              └─────────────────────────────────┘
`}</pre>
        </div>

        {/* Modules */}
        <div className="space-y-12 mb-16">
          {modules.map(({ name, badge, description, capabilities }) => (
            <div key={name} className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 mb-2">
                    {badge}
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900">{name}</h2>
                </div>
              </div>
              <p className="text-slate-600 mb-6 leading-relaxed">{description}</p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {capabilities.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-teal-500">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Connector types */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Supported connector types</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {connectorTypes.map(({ name, description }) => (
              <div key={name} className="p-6 rounded-xl border border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900 mb-2">{name}</h3>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/pilot"
            className="inline-flex px-8 py-4 rounded-xl font-bold text-lg text-white transition-colors"
            style={{ backgroundColor: '#0d9488' }}
          >
            Start pilot conversation →
          </Link>
        </div>
      </div>
    </div>
  )
}
