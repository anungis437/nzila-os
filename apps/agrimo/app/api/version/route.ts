import { NextResponse } from 'next/server'

const APP = 'agrimo'

export async function GET() {
  return NextResponse.json({
    app: APP,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    buildTime: process.env.BUILD_TIME ?? 'unknown',
    artifactId: process.env.ARTIFACT_ID ?? 'unknown',
    appVersion: process.env.npm_package_version ?? '0.0.0',
    timestamp: new Date().toISOString(),
  })
}