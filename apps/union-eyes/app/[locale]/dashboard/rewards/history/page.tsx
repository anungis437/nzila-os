export const dynamic = 'force-dynamic'

import { RewardsUnavailablePage } from '@/lib/rewards/unavailable-page'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  return RewardsUnavailablePage({ params })
}
