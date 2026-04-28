/**
 * Mobile Executive — Phase 11 final.
 *
 * Single-screen, thumb-first cockpit for when the founder is in transit.
 * Five blocks, all live: KPI glance, top-3 actions for today, top deals
 * needing decision, urgent risks, founder queue. No nav, no scroll noise —
 * the desktop layout's `MobileShell` already provides drawer access.
 *
 * Capability: `view:executive-home` (every role).
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { Stat } from '@/components/primitives/Stat'
import { Badge } from '@/components/primitives/Badge'
import { fmtCompactCurrency } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export default async function MobilePage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:executive-home')

  const repo = getHqRepository()
  const snap = repo.portfolioSnapshot()
  const finance = repo.financeSnapshot()
  const top5 = repo.todayTopFive()
  const risks = repo.urgentRiskDigest()
  const founderTouchOpps = repo
    .listOpportunities()
    .filter((o) => o.founderTouchRequired && o.stage !== 'won' && o.stage !== 'lost')
    .sort((a, b) => b.estimatedValueCents * b.probability - a.estimatedValueCents * a.probability)
    .slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="MRR" value={fmtCompactCurrency(snap.totalMrrCents)} tone="green" />
        <Stat
          label="Pipeline"
          value={fmtCompactCurrency(snap.weightedPipelineCents)}
          hint="weighted"
        />
        <Stat
          label="Runway"
          value={
            finance.cashRunwayMonths == null
              ? '∞'
              : `${finance.cashRunwayMonths} mo`
          }
          tone={
            finance.cashRunwayMonths == null
              ? 'green'
              : finance.cashRunwayMonths < 6
                ? 'red'
                : finance.cashRunwayMonths < 12
                  ? 'amber'
                  : undefined
          }
        />
        <Stat
          label="Founder load"
          value={`${snap.founderBottleneckScore}`}
          tone={
            snap.founderBottleneckScore > 70
              ? 'red'
              : snap.founderBottleneckScore > 40
                ? 'amber'
                : 'green'
          }
        />
      </div>

      <Card title="Today · top 3" description="Ranked by impact. Tap to act.">
        {top5.bullets.length === 0 ? (
          <p className="text-sm text-slate-500">No urgent items. Use the morning to think.</p>
        ) : (
          <ul className="space-y-2">
            {top5.bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-slate-900" />
                <span dangerouslySetInnerHTML={{ __html: bulletInline(b) }} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-right">
          <Link href="/chief-of-staff" className="text-xs font-semibold text-slate-900 underline">
            Open Chief of Staff →
          </Link>
        </div>
      </Card>

      <Card title="Deals needing you">
        {founderTouchOpps.length === 0 ? (
          <p className="text-sm text-slate-500">No founder-touch deals open.</p>
        ) : (
          <ul className="space-y-2">
            {founderTouchOpps.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{o.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {o.ventureSlug} · {o.stage} · {Math.round(o.probability * 100)}%
                  </div>
                </div>
                <Badge tone="amber">{fmtCompactCurrency(o.estimatedValueCents)}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-right">
          <Link href="/pipeline" className="text-xs font-semibold text-slate-900 underline">
            Open pipeline →
          </Link>
        </div>
      </Card>

      <Card title="Urgent risks">
        {risks.bullets.length === 0 ? (
          <p className="text-sm text-slate-500">No critical risks right now.</p>
        ) : (
          <ul className="space-y-2">
            {risks.bullets.slice(0, 4).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span dangerouslySetInnerHTML={{ __html: bulletInline(b) }} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/allocation"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          Allocation
        </Link>
        <Link
          href="/finance/cfo"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          CFO
        </Link>
        <Link
          href="/dependency/trend"
          className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
        >
          Delegate
        </Link>
        <Link
          href="/reports/board-pack"
          className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
        >
          Board pack
        </Link>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function bulletInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}
