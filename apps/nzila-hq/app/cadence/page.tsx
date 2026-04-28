/**
 * Operating Cadence — Phase 10.
 *
 * Built-in executive rituals. Each ritual is a tightly curated slice of the
 * existing repository that answers exactly one question. The cadence index
 * surfaces all four with timing guidance.
 */
import Link from 'next/link'
import { Card } from '@/components/primitives/Card'
import { SectionHeader } from '@/components/primitives/SectionHeader'
import { Badge } from '@/components/primitives/Badge'
import { resolveOrgContext } from '@/lib/resolve-org'
import { assertCapability } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

interface Ritual {
  href: string
  cadence: string
  title: string
  question: string
  duration: string
}

const RITUALS: Ritual[] = [
  {
    href: '/cadence/monday',
    cadence: 'Monday',
    title: 'Pipeline Review',
    question: 'Where is revenue going to come from this week?',
    duration: '20 min',
  },
  {
    href: '/cadence/wednesday',
    cadence: 'Wednesday',
    title: 'Product & Blockers',
    question: 'What is stuck, and who can unblock it?',
    duration: '25 min',
  },
  {
    href: '/cadence/friday',
    cadence: 'Friday',
    title: 'Cash & Priorities',
    question: 'Are we burning faster than we can compound?',
    duration: '15 min',
  },
  {
    href: '/cadence/monthly',
    cadence: 'Monthly',
    title: 'Portfolio Allocation',
    question: 'Where should the next dollar / hour / hire go?',
    duration: '45 min',
  },
]

export default async function CadenceIndexPage() {
  const ctx = await resolveOrgContext()
  assertCapability(ctx.role, 'view:cadence')

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Phase 10 · Operating Cadence"
        title="The discipline that turns a studio into a holding company."
        description="Four rituals, each pointed at a single executive question. Run them and the founder bottleneck shrinks every quarter."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {RITUALS.map((r) => (
          <Card key={r.href} title={r.title} description={r.question} action={<Badge>{r.cadence}</Badge>}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Suggested duration · {r.duration}</span>
              <Link
                href={r.href}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open ritual →
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Why rituals beat dashboards">
        <p className="text-sm text-slate-700">
          Dashboards reward grazing. Rituals reward decision. Each ritual page below is a single
          screen with a forced point of view — no infinite scroll, no twenty tabs. You walk in with
          a question, walk out with a decision and zero open tasks for the founder that an operator
          could have done.
        </p>
      </Card>
    </div>
  )
}
