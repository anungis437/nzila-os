import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtCompactCurrency, fmtRelativeDays, fmtDate } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function VentureDetailPage({
  params,
}: {
  params: Promise<{ ventureSlug: string }>
}) {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:portfolio')

  const { ventureSlug } = await params
  const repo = getHqRepository()
  const v = repo.getVenture(ventureSlug)
  if (!v) notFound()

  const owner = repo.getUser(v.ownerUserId)
  const secondOwner = v.secondOwnerUserId ? repo.getUser(v.secondOwnerUserId) : null
  const opps = repo.opportunitiesForVenture(v.slug)
  const tasks = repo.tasksForVenture(v.slug).filter((t) => t.status !== 'done')
  const docs = repo.documentsForVenture(v.slug)
  const score = repo.dependencyScores().find((s) => s.ventureSlug === v.slug)

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Phase 2 · Venture · ${v.stage}`}
        title={v.name}
        description={v.mission}
        action={
          <Link
            href="/portfolio"
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to portfolio
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="MRR" value={fmtCompactCurrency(v.monthlyRecurringRevenueCents)} />
        <Stat label="Pipeline" value={fmtCompactCurrency(v.pipelineValueCents)} hint="unweighted" />
        <Stat label="Weighted pipe" value={fmtCompactCurrency(v.weightedPipelineCents)} />
        <Stat label="Pilots live" value={v.pilotsLive} />
        <Stat
          label="Founder dependency"
          value={score ? `${score.score}/100` : 'n/a'}
          tone={score?.signal ?? 'neutral'}
          hint={score?.signal.toUpperCase()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Mission & ICP" className="lg:col-span-2">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Mission</dt>
              <dd className="mt-0.5 text-slate-900">{v.mission}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">ICP</dt>
              <dd className="mt-0.5 text-slate-900">{v.icp}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Stage</dt>
              <dd className="mt-0.5">
                <Badge tone="slate">{v.stage}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Ownership">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Primary owner</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{owner?.fullName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Second owner</dt>
              <dd className="mt-0.5">
                {secondOwner ? (
                  <span className="font-medium text-slate-900">{secondOwner.fullName}</span>
                ) : (
                  <Badge tone="rose">none — dependency risk</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-slate-500">Confidence</dt>
              <dd className="mt-0.5">
                <Badge
                  tone={
                    v.confidence === 'high'
                      ? 'emerald'
                      : v.confidence === 'medium'
                        ? 'amber'
                        : 'rose'
                  }
                >
                  {v.confidence}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Blockers">
          {v.blockers.length === 0 ? (
            <EmptyState title="No active blockers" />
          ) : (
            <ul className="space-y-2 text-sm">
              {v.blockers.map((b, i) => (
                <li key={i} className="rounded-md bg-rose-50 px-3 py-2 text-rose-800">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Next 30 days">
          {v.next30Days.length === 0 ? (
            <EmptyState title="Plan not set" />
          ) : (
            <ul className="space-y-1.5 text-sm text-slate-700">
              {v.next30Days.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Active opportunities">
        {opps.length === 0 ? (
          <EmptyState title="No opportunities tracked" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {opps.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{o.name}</div>
                  <div className="text-xs text-slate-500">
                    {o.stage} · {fmtCompactCurrency(o.estimatedValueCents)} @{' '}
                    {Math.round(o.probability * 100)}% · stale {o.daysStale}d
                  </div>
                </div>
                <div className="shrink-0 text-xs text-slate-700">
                  {o.expectedCloseAt
                    ? `closes ${fmtRelativeDays(o.expectedCloseAt, new Date(repo.now))}`
                    : 'no close date'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Open tasks">
          {tasks.length === 0 ? (
            <EmptyState title="No open tasks" />
          ) : (
            <ul className="space-y-2 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={t.queue === 'founder-decisions' ? 'rose' : 'sky'}>
                      {t.queue.replace('-', ' ')}
                    </Badge>
                    <span className="font-medium text-slate-900">{t.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{t.context}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Documents">
          {docs.length === 0 ? (
            <EmptyState title="No documents linked" />
          ) : (
            <ul className="space-y-1.5 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={d.url}
                      className="truncate font-medium text-slate-900 hover:underline"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {d.title}
                    </a>
                    <div className="text-xs text-slate-500">
                      {d.category} · updated {fmtDate(d.updatedAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {score && score.reasons.length > 0 && (
        <Card
          title="Founder dependency reasons"
          description={`Computed ${fmtDate(score.computedAt)}`}
        >
          <ul className="space-y-1.5 text-sm text-slate-700">
            {score.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
