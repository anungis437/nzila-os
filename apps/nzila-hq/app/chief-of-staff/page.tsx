/**
 * Chief of Staff — Phase 4.
 *
 * Three deterministic outputs in one screen:
 *   - Today's top five (what to do now).
 *   - Urgent risk digest (what could blow up this week).
 *   - Capital direction memo (where to lean in / restructure / pause).
 *
 * No LLM. Every bullet is sourced from the same engines (alerts, dependency,
 * allocation, finance) that the rest of HQ trusts. If/when an LLM is wired in,
 * it will only paraphrase these — never replace them as source of truth.
 */
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { ReportExportButton } from '@/components/reports/ReportExportButton'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function ChiefOfStaffPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:chief-of-staff')

  const repo = getHqRepository()
  const top5 = repo.todayTopFive()
  const risk = repo.urgentRiskDigest()
  const capital = repo.capitalDirectionMemo()

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 4 · Chief of Staff"
        title="The deterministic chief of staff."
        description="No LLM. Every recommendation is computed from the same engines as the rest of HQ — alerts, dependency, allocation, finance. If you disagree with a bullet, change the underlying signal."
      />

      <CosCard title={top5.title} summary={top5.summary} bullets={top5.bullets} markdown={top5.markdown} />
      <CosCard title={risk.title} summary={risk.summary} bullets={risk.bullets} markdown={risk.markdown} />
      <CosCard
        title={capital.title}
        summary={capital.summary}
        bullets={capital.bullets}
        markdown={capital.markdown}
      />
    </div>
  )
}

function CosCard({
  title,
  summary,
  bullets,
  markdown,
}: {
  title: string
  summary: string
  bullets: string[]
  markdown: string
}) {
  return (
    <Card
      title={title}
      description={summary}
      action={
        <ReportExportButton
          markdown={markdown}
          filename={`${slug(title)}.md`}
          label="Download .md"
        />
      }
    >
      {bullets.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing to show.</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="rounded-md bg-slate-50 px-3 py-1.5 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: bulletToHtml(b) }}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Render `**bold**` and `_italic_` from generator output. We intentionally
 * keep this minimal — no full markdown parser; the generators emit a small,
 * known subset.
 */
function bulletToHtml(b: string): string {
  // Escape angle brackets first.
  const escaped = b.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}
