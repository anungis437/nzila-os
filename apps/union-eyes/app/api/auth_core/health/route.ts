import { NextRequest, NextResponse } from 'next/server'
import { GET as healthGet } from '../../health/route'

function isPilotMode(): boolean {
	const mode = (
		process.env.NZILA_MODE ??
		process.env.NEXT_PUBLIC_APP_ENV ??
		''
	).toLowerCase()
	return mode === 'pilot'
}

function djangoBaseUrl(): string {
	return (process.env.DJANGO_API_URL ?? process.env.NEXT_PUBLIC_DJANGO_API_URL ?? '').replace(/\/$/, '')
}

function degradedResponse(reason: string, upstreamStatus?: number): NextResponse {
	return NextResponse.json(
		{
			ok: false,
			status: 'degraded',
			message: 'governance service degraded - review queued',
			reason,
			...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
		},
		{ status: 503 },
	)
}

export async function GET(_req: NextRequest) {
	const base = djangoBaseUrl()

	if (!base) {
		if (isPilotMode()) {
			return degradedResponse('django_sidecar_not_configured')
		}
		return healthGet()
	}

	try {
		const upstream = await fetch(`${base}/api/auth_core/health/`, {
			cache: 'no-store',
			signal: AbortSignal.timeout(3000),
		})

		if (!upstream.ok) {
			return degradedResponse('django_sidecar_unhealthy', upstream.status)
		}

		const bodyText = await upstream.text()
		return new NextResponse(bodyText, {
			status: upstream.status,
			headers: {
				'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
				'cache-control': 'no-store',
			},
		})
	} catch {
		return degradedResponse('django_sidecar_unreachable')
	}
}
