import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { EmptyState } from '@/components/primitives/EmptyState'
import { fmtRelativeDays } from '@/lib/format'
import { getHqRepository } from '@/server/repository'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'
import type { TaskQueue } from '@nzila/hq-domain'

export const dynamic = 'force-dynamic'

const QUEUES: {
  key: TaskQueue
  label: string
  description: string
  tone: 'rose' | 'sky' | 'emerald' | 'amber' | 'violet'
}[] = [
  {
    key: 'founder-decisions',
    label: 'Founder decisions',
    description: 'Only the founder can decide. Keep this queue ruthlessly small.',
    tone: 'rose',
  },
  {
    key: 'operator-actions',
    label: 'Operator actions',
    description: 'Already delegated. Ship now.',
    tone: 'sky',
  },
  {
    key: 'partner-followups',
    label: 'Partner follow-ups',
    description: 'External cadence — partnerships, investors, advisors.',
    tone: 'emerald',
  },
  {
    key: 'finance-review',
    label: 'Finance review',
    description: 'Reconciliations, MRR adjustments, board-deck prep.',
    tone: 'amber',
  },
  {
    key: 'product-escalations',
    label: 'Product escalations',
    description: 'Routed from Console — surface here, resolve there.',
    tone: 'violet',
  },
]

export default async function DelegationPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:delegation')

  const repo = getHqRepository()
  const tasks = repo.listTasks().filter((t) => t.status !== 'done')
  const usersById = new Map(repo.listUsers().map((u) => [u.id, u]))

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Phase 6 · Delegation Operating System"
        title="Delegation"
        description="Every task lives in exactly one queue. Every item has an owner, due date, and context. No ambiguous work."
      />

      {QUEUES.map((q) => {
        const items = tasks.filter((t) => t.queue === q.key)
        return (
          <Card
            key={q.key}
            title={`${q.label} (${items.length})`}
            description={q.description}
            action={<Badge tone={q.tone}>{q.key}</Badge>}
          >
            {items.length === 0 ? (
              <EmptyState title="Queue is empty" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{t.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{t.context}</div>
                      <div className="mt-1 text-xs text-slate-700">
                        Owner: {usersById.get(t.ownerUserId)?.fullName ?? t.ownerUserId}
                        {t.ventureSlug ? ` · venture: ${t.ventureSlug}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-slate-700">
                      due {fmtRelativeDays(t.dueAt, new Date(repo.now))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}
