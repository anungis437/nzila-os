/**
 * Platform Admin version probe (Post-Deploy smoke /api/version).
 * Public, no auth.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP = 'platform-admin'

export async function GET() {
  return NextResponse.json({
    app: `@nzila/${APP}`,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? process.env.COMMIT_SHA ?? 'local',
    buildTime: process.env.BUILD_TIME ?? 'unknown',
    artifactId: process.env.ARTIFACT_ID ?? 'unknown',
    appVersion: process.env.npm_package_version ?? '0.0.0',
    timestamp: new Date().toISOString(),
  })
}
