// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handlers } from '@nzila/platform-auth/entra/config'
import { createLogger, withSpan } from '@nzila/os-core/telemetry'
import { isMutationApiRoute } from '@nzila/os-core/idempotency'

const logger = createLogger('weekone.auth')

const NextAuthRouteSchema = z.object({
	method: z.enum(['GET', 'POST']),
	pathname: z.string().min(1),
})

function validateRouteRequest(request: NextRequest) {
	NextAuthRouteSchema.parse({
		method: request.method,
		pathname: request.nextUrl.pathname,
	})
	void isMutationApiRoute(request.method, request.nextUrl.pathname)
}

export async function GET(request: NextRequest) {
	validateRouteRequest(request)

	return withSpan('api.weekone.auth.nextauth.get', { 'http.method': 'GET' }, async () => {
		const isSessionEndpoint = request.nextUrl.pathname.endsWith('/session')
		const isDev = process.env.NODE_ENV !== 'production'

		try {
			const response = await handlers.GET(request)

			if (isDev && isSessionEndpoint && response.status >= 500) {
				return NextResponse.json(null, { status: 200 })
			}

			return response
		} catch (error) {
			// In local dev, allow SessionProvider to degrade gracefully when auth env
			// is not configured yet, instead of spamming 500s on public pages.
			if (isDev && isSessionEndpoint) {
				return NextResponse.json(null, { status: 200 })
			}

			logger.error('nextauth.get.failed', {
				route: request.nextUrl.pathname,
				error: error instanceof Error ? error.message : 'unknown_error',
			})

			return NextResponse.json(
				{ message: 'There was a problem with the server configuration. Check the server logs for more information.' },
				{ status: 500 },
			)
		}
	})
}

export async function POST(request: NextRequest) {
	validateRouteRequest(request)

	return withSpan('api.weekone.auth.nextauth.post', { 'http.method': 'POST' }, async () => {
		try {
			return await handlers.POST(request)
		} catch (error) {
			logger.error('nextauth.post.failed', {
				route: request.nextUrl.pathname,
				error: error instanceof Error ? error.message : 'unknown_error',
			})

			return NextResponse.json(
				{ message: 'There was a problem with the server configuration. Check the server logs for more information.' },
				{ status: 500 },
			)
		}
	})
}
