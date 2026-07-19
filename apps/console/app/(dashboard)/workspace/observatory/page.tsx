import { ChartBarSquareIcon } from '@heroicons/react/24/outline'
import { Card, CardBody, Badge, EmptyState } from '@/components/ui'
import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { bridgeFor } from '../_lib/legacy-map'
import { resolveSubTab } from '../_lib/nav'
import { requireWorkspaceUser } from '../_lib/workspace-auth'
import { loadObservatory, type ObservatorySummary } from '../_lib/observatory'

export const dynamic = 'force-dynamic'

// Schema vocabulary mirrors migrations/0031_institutional_intelligence_observatory_tables.sql
const SECTORS = ['labour', 'healthcare', 'municipal', 'association', 'smb', 'other']
const ROUTES = ['iia_first', 'ue_first', 'hybrid_iia_ue', 'trustcore_route', 'defer']
const MATURITY = ['level1', 'level2', 'level3', 'level4', 'level5']
const DIMENSIONS = [
  'memory_integrity',
  'continuity_capacity',
  'governance_maturity',
  'trust_operations',
  'accountability_architecture',
  'institutional_resilience',
]
const CONFIDENCE = ['low', 'medium', 'high']

interface PanelDef {
  title: string
  description: string
  chips: string[]
  emptyTitle: string
  emptyDescription: string
}

const PANELS: Record<string, PanelDef> = {
  cohorts: {
    title: 'Cohorts',
    description: 'De-identified organizations grouped by sector and size band.',
    chips: SECTORS,
    emptyTitle: 'Awaiting first cohort',
    emptyDescription: 'Cohorts populate as organizations are enrolled into the Observatory. The sector taxonomy above is the persistence schema (ii_observatory_organizations).',
  },
  assessments: {
    title: 'Assessments',
    description: 'Institutional maturity assessments across five levels.',
    chips: MATURITY,
    emptyTitle: 'No assessments recorded yet',
    emptyDescription: 'Maturity levels (level1–level5) are captured per engagement in ii_observatory_assessments. Results appear here once the first assessment is completed.',
  },
  'route-decisions': {
    title: 'Route Decisions',
    description: 'Recommended entry route generated from each engagement.',
    chips: ROUTES,
    emptyTitle: 'No route decisions yet',
    emptyDescription: 'Route entry types (ii_observatory_route) are generated downstream of assessment. This is the IIA → Route Decision → opportunity flow described in the Workspace Map.',
  },
  reassessments: {
    title: 'Reassessments',
    description: 'Repeat assessments tracking maturity movement over time.',
    chips: MATURITY,
    emptyTitle: 'No reassessments yet',
    emptyDescription: 'Reassessments are time-series rows over ii_observatory_assessments. Deltas surface here once an organization has been assessed more than once.',
  },
  'benchmark-readiness': {
    title: 'Benchmark Readiness',
    description: 'Dimension coverage and evidence confidence across the framework.',
    chips: DIMENSIONS,
    emptyTitle: 'Benchmark not yet ready',
    emptyDescription: 'Benchmark readiness requires dimension scores (ii_observatory_dimension_scores) with sufficient confidence across enough cohorts. The six dimensions above are the framework.',
  },
}

export default async function ObservatoryWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireWorkspaceUser()

  const { tab } = await searchParams
  const activeTab = resolveSubTab('observatory', tab)
  const panel = PANELS[activeTab] ?? PANELS.cohorts
  const observatory = await loadObservatory()
  const counts = panelCounts(activeTab, observatory)

  return (
    <WorkspaceShell workspace="observatory" activeTab={activeTab}>
      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-gray-900">{panel.title}</h3>
          <p className="mt-1.5 text-sm text-gray-500">{panel.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {panel.chips.map((c) => (
              <Badge key={c} tone="violet">
                {c.replace(/_/g, ' ')}
              </Badge>
            ))}
            {activeTab === 'benchmark-readiness' && (
              <span className="ml-2 text-xs text-gray-400">
                confidence: {CONFIDENCE.join(' · ')}
              </span>
            )}
          </div>

          <div className="mt-6">
            {counts && counts.total > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {counts.tiles.map((t) => (
                  <div key={t.label} className="rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-semibold tabular-nums text-gray-900">{t.value}</p>
                    <p className="mt-1 text-xs text-gray-500">{t.label.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ChartBarSquareIcon className="h-6 w-6" />}
                title={panel.emptyTitle}
                description={panel.emptyDescription}
              />
            )}
          </div>
        </CardBody>
      </Card>

      {(() => {
        const bridge = bridgeFor('observatory', activeTab)
        return bridge ? <LegacyBridge title={bridge.title} intro={bridge.intro} links={bridge.links} /> : null
      })()}
    </WorkspaceShell>
  )
}

interface PanelCounts {
  total: number
  tiles: { label: string; value: number }[]
}

function fromMap(map: Record<string, number>): { total: number; tiles: { label: string; value: number }[] } {
  const tiles = Object.entries(map).map(([label, value]) => ({ label, value }))
  const total = tiles.reduce((s, t) => s + t.value, 0)
  return { total, tiles }
}

function panelCounts(tab: string, o: ObservatorySummary): PanelCounts | null {
  if (!o.available) return null
  switch (tab) {
    case 'cohorts': {
      const m = fromMap(o.cohorts.bySector)
      return { total: o.cohorts.total, tiles: m.tiles }
    }
    case 'assessments': {
      const m = fromMap(o.assessments.byMaturity)
      return { total: o.assessments.total, tiles: m.tiles }
    }
    case 'route-decisions': {
      const m = fromMap(o.routes)
      return { total: m.total, tiles: m.tiles }
    }
    case 'reassessments':
      return { total: o.reassessments, tiles: [{ label: 'organizations reassessed', value: o.reassessments }] }
    case 'benchmark-readiness':
      return {
        total: o.dimensionsCovered,
        tiles: [{ label: 'dimensions covered', value: o.dimensionsCovered }],
      }
    default:
      return null
  }
}
