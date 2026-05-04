import { NextResponse } from 'next/server'

const APP = 'agrimo'

function resolveAuthorityHealthUrl(): string | null {
  if (process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL) {
    return process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL
  }

  const base = process.env.AGRIMO_DJANGO_BASE_URL
  if (base) {
    return `${base.replace(/\/$/, '')}/api/auth/health/`
  }

  return null
}

async function checkAuthority(): Promise<{ ok: boolean; reason?: string }> {
  const authorityUrl = resolveAuthorityHealthUrl()
  if (!authorityUrl) {
    return { ok: false, reason: 'authority_probe_unconfigured' }
  }

  try {
    const response = await fetch(authorityUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'x-nzila-readiness-probe': 'agrimo-frontdoor' },
    })

    if (!response.ok) {
      return { ok: false, reason: `authority_http_${response.status}` }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: 'authority_unreachable' }
  }
}

export async function GET() {
  const authority = await checkAuthority()

  const checks = {
    process: { status: 'ok' },
    database: { status: 'unknown' },
    queue: { status: 'unknown' },
    storage: { status: 'unknown' },
    thirdParty: { status: authority.ok ? 'ok' : 'unavailable', reason: authority.reason },
  }

  const ready = authority.ok

  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      app: APP,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}