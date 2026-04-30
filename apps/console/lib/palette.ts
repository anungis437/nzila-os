/**
 * Builds the Command Palette item set from `lib/nav-config`.
 *
 * Pure function — safe to call from server components and serialize the
 * result down to the client palette. Keeps the palette in lockstep with
 * the actual nav surface so dead routes are impossible.
 */
import { navGroups, appLinks } from './nav-config'
import type { PaletteItem } from '@/components/command-palette'

const QUICK_ACTIONS: PaletteItem[] = [
  {
    id: 'qa:executive-mode',
    label: 'Toggle Executive Mode',
    group: 'Quick Actions',
    hint: 'Hide the sidebar for boardroom view',
    href: '?mode=executive',
    searchText: 'toggle executive mode boardroom view sidebar hide',
  },
]

export function buildPaletteItems(): PaletteItem[] {
  const items: PaletteItem[] = []

  for (const group of navGroups) {
    for (const item of group.items) {
      items.push({
        id: `nav:${item.href}`,
        label: item.name,
        group: group.label,
        hint: item.description ?? item.href,
        href: item.href,
        searchText: `${item.name} ${group.label} ${item.description ?? ''} ${item.href}`.toLowerCase(),
      })
    }
  }

  for (const app of appLinks) {
    if (!app.href) continue
    items.push({
      id: `app:${app.name}`,
      label: app.name,
      group: 'Launch App',
      hint: app.href,
      href: app.href,
      external: true,
      searchText: `${app.name} ${app.href} launch app external`.toLowerCase(),
    })
  }

  items.push(...QUICK_ACTIONS)

  return items
}
