import { NextResponse } from 'next/server'
import { getBuildMetadata } from '@nzila/os-core/health'
import { getEnvironmentSnapshot } from '@/lib/runtime/environment'
import { hasDeploymentProbeCredential } from '@/lib/runtime/deployment-probe'

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

/**
 * GET /api/version — build identity for drift detection.
 *
 * Anonymous callers receive only the build identity (commit, build time, release and artifact ids). The deployment
 * topology (environment, host, deployment type, feature profile, image digests) is disclosed only to a caller that
 * presents the deployment-probe credential, and always with a no-store policy.
 */
export async function GET(request: Request) {
  const metadata = getBuildMetadata(APP)
  const headers = { 'Cache-Control': 'no-store' }

  if (!hasDeploymentProbeCredential(request.headers.get('authorization'))) {
    return NextResponse.json(
      {
        app: metadata.app,
        gitSha: metadata.gitSha,
        buildTimestamp: metadata.buildTimestamp,
        appVersion: metadata.appVersion,
        releaseId: metadata.releaseId,
        artifactId: metadata.artifactId,
      },
      { headers },
    )
  }

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
    // Operational package intentionally reports no demo profile. Any UE_DEMO_*
    // env var is rejected at boot by lib/config/env-validation.ts.
    demoProfile: null,
    requestHost: hostHeader || null,
    frontendImageDigest: process.env.UE_FRONTEND_IMAGE_DIGEST ?? null,
    backendImageDigest: process.env.UE_BACKEND_IMAGE_DIGEST ?? null,
  }, { headers })
}
