/**
 * Board pack — one-click download of every executive report.
 *
 * No new generators. Bundles existing reports + chief-of-staff outputs into a
 * single markdown file the founder can email to the board.
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { BoardPackExport } from '@/components/reports/BoardPackExport'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function BoardPackPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'export:report')

  const repo = getHqRepository()
  const sections = [
    { title: 'Weekly CEO Brief', markdown: repo.weeklyCeoBrief().markdown },
    { title: 'Monthly Portfolio Review', markdown: repo.monthlyPortfolioReview().markdown },
    { title: 'Pipeline Review', markdown: repo.pipelineReview().markdown },
    { title: 'Dependency Trend', markdown: repo.dependencyTrend().markdown },
    { title: 'Capital Direction Memo', markdown: repo.capitalDirectionMemo().markdown },
    { title: 'Urgent Risk Digest', markdown: repo.urgentRiskDigest().markdown },
  ]

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 12 · Board Pack"
        title="One file. Every executive report."
        description="Bundles weekly, monthly, pipeline, dependency, capital direction, and risk into a single markdown for offline review or board distribution."
      />

      <Card
        title="Download bundle"
        description={`${sections.length} reports · markdown · ${repo.now.slice(0, 10)}`}
        action={
          <BoardPackExport
            sections={sections}
            filename={`nzila-board-pack-${repo.now.slice(0, 10)}.md`}
            title={`Nzila HQ — Board Pack (${repo.now.slice(0, 10)})`}
          />
        }
      >
        <ul className="space-y-1 text-sm text-slate-700">
          {sections.map((s) => (
            <li key={s.title} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
              {s.title}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
