import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { createScreenshotAsset } from '@/lib/maestria-persistence'

const captureTargets = [
  { name: 'Executive cockpit', route: '/en-CA/internal/executive-dashboard' },
  { name: 'Quote pipeline', route: '/en-CA/internal/quote-pipeline' },
  { name: 'Campaign command center', route: '/en-CA/internal/campaign-command-center' },
  { name: 'Client portal', route: '/en-CA/client/corporate-client-portal' },
  { name: 'Marketing landing', route: '/en-CA/marketing' },
]

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'module.internal.view', 'assets.screenshot.queue', 'assets:screenshot-pack')
  if (auth.response) return auth.response

  const locale = request.nextUrl.searchParams.get('locale') === 'fr-CA' ? 'fr-CA' : 'en-CA'
  const basePath = request.nextUrl.searchParams.get('outputPath') ?? 'artifacts/screenshots/maestria'

  const queued = captureTargets.map((target) => createScreenshotAsset({
    name: target.name,
    route: target.route.replace('/en-CA/', `/${locale}/`),
    locale,
    filePath: `${basePath}/${locale}/${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
    status: 'queued',
  }))

  return NextResponse.json({
    ok: true,
    queuedBy: auth.actor.displayName,
    locale,
    queueCount: queued.length,
    instructions: 'Use Playwright or CI browser capture to materialize queued assets to filePath targets.',
    queue: queued,
  }, { status: 202 })
}
