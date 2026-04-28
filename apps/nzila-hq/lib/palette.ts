/**
 * Build the command-palette item list for the current user (Phase 12 V2).
 *
 * V2 adds:
 *   - "Go to venture …" entries — one per active venture (`stage !== 'sunset'`).
 *   - Quick actions — capability-gated jumps to the most-used cockpit moves
 *     (open weekly brief, open allocation, run today's cadence ritual, …).
 *
 * Server-only because both RBAC and the repo are server resources.
 */
import 'server-only'
import type { HqRole, Venture } from '@nzila/hq-domain'
import type { PaletteItem } from '@/components/shell/CommandPalette'
import { NAV, NAV_GROUP_LABELS } from './nav'
import { hasCapability, type HqCapability } from './rbac'

interface RepoLike {
  listVentures(): readonly Venture[]
  readonly now: string
}

interface QuickAction {
  id: string
  label: string
  href: string
  capability: HqCapability
  hint?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa:weekly-ceo',
    label: 'Open weekly CEO brief',
    href: '/reports#weekly-ceo',
    capability: 'export:report',
    hint: 'Reports',
  },
  {
    id: 'qa:allocation',
    label: 'Review capital allocation',
    href: '/allocation',
    capability: 'view:allocation',
    hint: 'Phase 5',
  },
  {
    id: 'qa:cadence-monday',
    label: 'Run Monday pipeline review',
    href: '/cadence/monday',
    capability: 'view:cadence',
    hint: '20 min',
  },
  {
    id: 'qa:cadence-wednesday',
    label: 'Run Wednesday product & blockers',
    href: '/cadence/wednesday',
    capability: 'view:cadence',
    hint: '25 min',
  },
  {
    id: 'qa:cadence-friday',
    label: 'Run Friday cash & priorities',
    href: '/cadence/friday',
    capability: 'view:cadence',
    hint: '15 min',
  },
  {
    id: 'qa:cadence-monthly',
    label: 'Run monthly portfolio allocation',
    href: '/cadence/monthly',
    capability: 'view:cadence',
    hint: '45 min',
  },
  {
    id: 'qa:dependency',
    label: 'View founder dependency scores',
    href: '/dependency',
    capability: 'view:dependency',
  },
]

export function buildPaletteItems(role: HqRole, repo?: RepoLike): PaletteItem[] {
  const navItems: PaletteItem[] = NAV.filter((n) => hasCapability(role, n.capability)).map((n) => ({
    id: n.href,
    label: n.label,
    href: n.href,
    group: NAV_GROUP_LABELS[n.group],
    hint: n.href,
  }))

  const quickItems: PaletteItem[] = QUICK_ACTIONS.filter((q) =>
    hasCapability(role, q.capability),
  ).map((q) => ({
    id: q.id,
    label: q.label,
    href: q.href,
    group: 'Quick actions',
    hint: q.hint,
  }))

  const ventureItems: PaletteItem[] =
    repo && hasCapability(role, 'view:portfolio')
      ? repo
          .listVentures()
          .filter((v) => v.stage !== 'sunset')
          .map((v) => ({
            id: `v:${v.slug}`,
            label: v.name,
            href: `/portfolio/${v.slug}`,
            group: 'Ventures',
            hint: v.stage,
          }))
      : []

  return [...quickItems, ...ventureItems, ...navItems]
}
