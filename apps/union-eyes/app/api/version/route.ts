import { NextResponse } from 'next/server'
import { getBuildMetadata } from '@nzila/os-core/health'

const APP = 'union-eyes'

function inferSurfaceEnvironment(host: string): 'staging' | 'production' | 'unknown' {
  const normalized = host.toLowerCase()

  if (
    normalized.includes('staging.unioneyes.app')
    || normalized.includes('staging-app.unioneyes.app')
    || normalized.includes('union-eyes-staging')
  ) {
    return 'staging'
  }

  if (
    normalized.includes('unioneyes.app')
    || normalized.includes('app.unioneyes.app')
    || normalized.includes('nzila-os-union-eyes.')
  ) {
    return 'production'
  }

  return 'unknown'
}

export async function GET(request: Request) {
  const metadata = getBuildMetadata(APP)
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const surfaceEnvironment = inferSurfaceEnvironment(hostHeader)

  return NextResponse.json({
    ...metadata,
    configuredEnvironment: metadata.environment,
    surfaceEnvironment,
    requestHost: hostHeader || null,
  })
}