import { NextResponse } from 'next/server'
import { getBuildMetadata } from '@nzila/os-core/health'
import { getEnvironmentSnapshot } from '@/lib/runtime/environment'

const APP = 'union-eyes'

function inferSurfaceEnvironment(host: string): 'demo' | 'staging' | 'production' | 'unknown' {
  const normalized = host.toLowerCase()

  if (
    normalized.includes('demo.unioneyes.app')
    || normalized.includes('nzila-os-union-eyes-demo')
  ) {
    return 'demo'
  }

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
  const environmentSnapshot = getEnvironmentSnapshot()
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const surfaceEnvironment = inferSurfaceEnvironment(hostHeader)

  return NextResponse.json({
    ...metadata,
    configuredEnvironment: metadata.environment,
    surfaceEnvironment,
    runtimeEnvironment: environmentSnapshot.environment,
    deploymentType: environmentSnapshot.deploymentType,
    featureProfile: environmentSnapshot.featureProfile,
    demoProfile: process.env.UE_DEMO_PROFILE ?? process.env.NEXT_PUBLIC_UE_DEMO_PROFILE ?? null,
    requestHost: hostHeader || null,
  })
}
