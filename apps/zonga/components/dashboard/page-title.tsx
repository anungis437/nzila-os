'use client'

import { usePathname } from 'next/navigation'

/**
 * Route-segment → display title mapping.
 * Matches the sidebar nav labels so header and nav stay aligned.
 */
const SEGMENT_TITLES: Record<string, string> = {
  browse: 'Browse',
  search: 'Search',
  catalog: 'Catalog',
  releases: 'Releases',
  playlists: 'Playlists',
  events: 'Events',
  revenue: 'Revenue',
  payouts: 'Payouts',
  creators: 'Creators',
  analytics: 'Analytics',
  notifications: 'Notifications',
  integrity: 'Integrity',
  listener: 'My Music',
  moderation: 'Moderation',
  settings: 'Settings',
  profile: 'Profile',
  operations: 'Operations',
  compliance: 'Compliance',
  subscription: 'Subscription',
  tracks: 'Tracks',
  artists: 'Artists',
  rights: 'Rights',
  podcasts: 'Podcasts',
}

export function PageTitle() {
  const pathname = usePathname()

  // pathname is e.g. "/en/dashboard/catalog" or "/fr/dashboard"
  const segments = pathname?.split('/').filter(Boolean) ?? []
  // After locale + "dashboard", the next segment is the page
  const pageSegment = segments.length > 2 ? segments[2] : null
  const title = pageSegment ? SEGMENT_TITLES[pageSegment] ?? capitalize(pageSegment) : 'Home'

  return (
    <h2 className="text-lg font-semibold text-foreground pl-12 md:pl-0">{title}</h2>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
