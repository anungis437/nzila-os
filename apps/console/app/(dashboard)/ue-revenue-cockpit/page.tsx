import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Canonical route migration:
 * - /ue-revenue-cockpit now forwards to /revenue
 * - /revenue is the unified, database-backed command surface
 */
export default function UERevenueCockpitPage() {
  redirect('/revenue')
}
