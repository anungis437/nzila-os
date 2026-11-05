/**
 * Gate 0B.1 dispositions for every operation the ownership register derives as NO_AUTHENTICATION_DECLARED.
 * Each disposition cites the code that was read. No endpoint is called public merely because it lacks a guard.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const APP = 'apps/union-eyes/app/api/'
const ALLOWLIST = 'apps/union-eyes/lib/public-routes.ts'
const GUARD = 'apps/union-eyes/lib/public-intake/guard.ts'
const COGNITION = 'apps/union-eyes/lib/api/cognition-route.ts'
const TOKEN = 'apps/union-eyes/lib/communications/tracking-token.ts'
const STAGING_AUTH = 'apps/union-eyes/lib/staging-proof/deadline-engine-auth.ts'

const ev = (ref, quote) => ({ ref, quote })
const r = (route, quote) => ev(`${APP}${route}`, quote)

const intakeControls = (bucket) => [
  `guardPublicIntake bucket '${bucket}': per-client rate limit that refuses when the limiter is unavailable in production`,
  'Hard 16 KiB body cap and strict JSON parsing',
  'Zod body schema validation',
]

export function unauthenticatedFacts(route, method, source) {
  const id = `${route}|${method}`
  const base = { id, route, method, defects: [] }

  if (route.startsWith('exit-interviews/') && /cognitionRoute\(/.test(source)) {
    return {
      ...base,
      disposition: 'AUTHENTICATED_BY_UNDETECTED_GUARD',
      actualGuard: "cognitionRoute wraps withApi({ auth: { required: true, minRole: 'officer' }, entitlement: 'union_knowledge_suite' }).",
      evidence: [r(route, 'cognitionRoute('), ev(COGNITION, "auth: { required: true, minRole: 'officer' },"), ev(COGNITION, "entitlement: 'union_knowledge_suite',")],
      securityContract: 'Stay behind withApi authentication at officer role with the union_knowledge_suite entitlement. The route-coverage scanner must detect cognitionRoute so the route stops reading as unauthenticated.',
      defects: ['DEF-0B1-MANIFEST-DETECTOR'],
    }
  }
  if (route.startsWith('exit-interviews/')) {
    const target = source.match(/url\.pathname = '(\/api\/exit-interviews\/[a-z-]+)'/)?.[1]
    const targetFile = `${APP}${target.replace('/api/', '')}/route.ts`
    const targetGuard = readFileSync(join(ROOT, targetFile), 'utf8').includes('cognitionRoute(') ? 'cognitionRoute(' : "minRole: 'officer'"
    return {
      ...base,
      disposition: 'INTENTIONALLY_PUBLIC',
      allowlist: 'NOT_LISTED',
      exposureContract: {
        dataExposed: `None: a 308 redirect to ${target}; the handler reads no data and returns no body.`,
        controls: [`The redirect target is the route ${target}, which enforces authentication at officer role`, 'No database access and no request data echoed into the response'],
      },
      evidence: [r(route, 'return NextResponse.redirect(url, 308);'), ev(targetFile, targetGuard)],
      securityContract: 'Remain a pure redirect that returns no data and reads no tenant state. Retire when external integrations move to the new slug.',
      defects: ['DEF-0B1-ALLOWLIST-DRIFT', 'DEF-0B1-MANIFEST-DETECTOR'],
    }
  }

  switch (route) {
    case 'governance/telemetry/route.ts':
      return {
        ...base,
        disposition: 'AUTHENTICATED_BY_UNDETECTED_GUARD',
        actualGuard: 'authenticateUser() from lib/api-guards refuses an unauthenticated caller; cross-organization aggregates additionally require isSystemAdmin().',
        evidence: [r(route, 'const auth = await authenticateUser()'), r(route, 'if (await isSystemAdmin()) {')],
        securityContract: 'Keep authenticateUser as the first statement and keep cross-organization aggregates behind platform-staff authority. The scanner must detect authenticateUser.',
        defects: ['DEF-0B1-MANIFEST-DETECTOR'],
      }
    case 'auth/forgot-password/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'LISTED',
        exposureContract: {
          dataExposed: 'A neutral message that does not reveal whether an account exists. Development builds echo the reset token.',
          controls: ['Service-level request rate limit (checkAuthRequestRateLimit) inside forgotPassword', 'Uniform neutral response so accounts cannot be enumerated', 'Zod body schema; token echo only when NODE_ENV is development'],
        },
        evidence: [r(route, "'If an account exists with that email, a password reset link will be sent.'"), r(route, "process.env.NODE_ENV === 'development'"), ev('packages/platform-auth/src/password/auth-service.ts', 'checkAuthRequestRateLimit'), ev(ALLOWLIST, "'/api/auth/forgot-password',")],
        securityContract: 'Stay on the public allowlist with a uniform response, a request rate limit that fails closed, and no token in non-development responses.',
      }
    case 'auth/magic-link/request/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'LISTED',
        exposureContract: {
          dataExposed: 'A neutral message that does not reveal whether the email is recognised. Development builds echo the token.',
          controls: ['Per-email request rate limit inside requestMagicLink (checkAuthRequestRateLimit)', 'Uniform neutral response so accounts cannot be enumerated', 'Zod body schema; token echo only when NODE_ENV is development'],
        },
        evidence: [r(route, "'If that email is recognised, a sign-in link has been sent. Please check your inbox.'"), r(route, "process.env.NODE_ENV === 'development'"), ev('packages/platform-auth/src/magic-link/service.ts', 'checkAuthRequestRateLimit'), ev(ALLOWLIST, "'/api/auth/magic-link/request'")],
        securityContract: 'Stay on the public allowlist with a uniform response, a request rate limit, and no token in non-development responses.',
      }
    case 'contact/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'An acknowledgement only. The submitted form creates a CRM contact and deal; nothing about any member or tenant is returned.', controls: intakeControls('write') },
        evidence: [r(route, "guardPublicIntake(request, { bucket: 'write' })"), r(route, 'const body = contactSchema.parse(raw);'), ev(GUARD, 'export const PUBLIC_INTAKE_MAX_BODY_BYTES = 16 * 1024')],
        securityContract: 'Keep guardPublicIntake first, add the route to the public-route allowlist, and keep downstream authority minimal (no tenant data written or read).',
        defects: ['DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'icra/telemetry/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'NOT_LISTED',
        exposureContract: {
          dataExposed: 'Always HTTP 204 with no body. Accepted events carry an allowed kind, a bounded section id and bounded metadata; the client address is stored only as a hash.',
          controls: ['rateLimit of 60 requests per 60 seconds per client (process-local)', 'ALLOWED_KINDS allowlist and bounded section id and metadata', 'IP address hashed before storage; no authentication or tenant data involved'],
        },
        evidence: [r(route, 'const rl = rateLimit(req, { maxRequests: 60, windowSeconds: 60 })'), r(route, 'ipHash: hashIp(ip),'), ev('apps/union-eyes/lib/rate-limit.ts', '// Simple in-memory rate limiter for API routes')],
        securityContract: 'Keep the event allowlist, the size bounds and the IP hash, move the limiter to a shared store, and list the route on the public allowlist.',
        defects: ['DEF-0B1-ICRA-TELEMETRY-PROCESS-LOCAL-LIMIT', 'DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'workbook/start/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'A new pseudonymous workbook identifier. The workbook holds no tenant data and grants no access to any.', controls: intakeControls('write') },
        evidence: [r(route, "guardPublicIntake(request, { bucket: 'write' })"), r(route, 'it is a bearer-id record until claimed by an authenticated user.')],
        securityContract: 'Keep guardPublicIntake first, never attach tenant data to an unclaimed workbook, and list the route on the public allowlist.',
        defects: ['DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'workbook/checkout/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'A payment session URL for an existing workbook. The workbook id is a bearer identifier and the route confirms the workbook exists.', controls: [...intakeControls('checkout'), 'Existing workbook required (Verify the workbook exists); only the Self-Guided tier is purchasable'] },
        evidence: [r(route, "guardPublicIntake(request, { bucket: 'checkout' })"), r(route, '// Verify the workbook exists (prevent arbitrary UUID injection)')],
        securityContract: 'Keep the checkout bucket first, keep the workbook-exists check, and list the route on the public allowlist.',
        defects: ['DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'whop/unauthenticated-checkout/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'LISTED',
        exposureContract: { dataExposed: 'A checkout session for a plan and email supplied by the caller. No member or tenant data is returned.', controls: [...intakeControls('checkout'), 'Email format validation with a length guard against ReDoS'] },
        evidence: [r(route, "guardPublicIntake(req, { bucket: 'checkout' })"), ev(ALLOWLIST, "'/api/whop/unauthenticated-checkout'")],
        securityContract: 'Stay on the public allowlist behind the checkout bucket; create no account or access grant until payment is confirmed by the signed webhook.',
      }
    case 'communications/track/click/route.ts':
      return commsTrust(base, route, 'A redirect only for a token bound to the exact destination; a forged or unsigned link is refused with 400 and records nothing.', 'verifyTrackingToken(token, tokenCandidates)', 'click')
    case 'communications/track/open/[campaignId]/[recipientId]/route.ts':
      return commsTrust(base, route, 'A neutral tracking pixel; an invalid token serves the pixel without recording an open.', 'verifyTrackingToken(token, tokenCandidates)', 'open')
    case 'communications/unsubscribe/[recipientId]/route.ts':
      return commsTrust(base, route, 'A page for a token bound to the unsubscribe action; an invalid token is refused with 401 and mutates nothing.', 'verifyTrackingToken(token, tokenCandidates)', 'unsubscribe')
    case 'staging-proof/deadline-engine/scenario/route.ts':
      return {
        ...base,
        disposition: 'INTERNAL_MACHINE_TO_MACHINE',
        exposureContract: {
          trustMechanism: 'HMAC proof signature over version, timestamp, nonce and scenario; single-use nonce; build, target, runtime and secret environment gates that exist only in the staging image.',
          dataExposed: 'Evidence of a synthetic proof tenant run, only for a signed request in the staging environment; every failure is an empty HTTP 404.',
        },
        evidence: [r(route, 'if (!isAuthorizedStagingProofEnvironment(env)) return new NextResponse(null, { status: 404 });'), r(route, 'const authorization = verifyProofAuthorization({'), ev(STAGING_AUTH, 'timingSafeEqual'), ev(STAGING_AUTH, "return env.BUILD_APP_ENV === 'staging'")],
        securityContract: 'Stay unreachable outside the staging build, require the timestamped HMAC and single-use nonce, and answer every failure with an empty 404.',
      }
    case 'health/route.ts':
      return health(base, route, 'Database, auth, cache, backend and catalog check states with latencies and fixed error strings.', 'export async function GET() {', '// Basic health check for uptime monitoring')
    case 'health/liveness/route.ts':
      return health(base, route, 'A constant liveness response with no-store caching; no dependency or tenant data.', "'Cache-Control': 'no-cache, no-store, must-revalidate'", '// Kubernetes liveness probe')
    case 'auth_core/health/route.ts':
      return health(base, route, 'Auth-core sidecar reachability and environment mode; no tenant or credential data.', 'export async function GET(_req: NextRequest) {', '// Auth-core sidecar health probe (fails closed in pilot)')
    case 'status/route.ts':
      return health(base, route, 'The system status document (component states); returns 503 when the system is down.', 'const status = await getSystemStatus();', '// System status endpoint for ops dashboards')
    case 'docs/openapi.json/route.ts':
      return {
        ...base,
        disposition: 'INTENTIONALLY_PUBLIC',
        allowlist: 'LISTED',
        exposureContract: { dataExposed: 'The OpenAPI document for public endpoints, as the allowlist describes it.', controls: ['Listed on the public allowlist with the stated scope "describes public endpoints only"', 'Read-only static document; no database access'] },
        evidence: [r(route, 'return NextResponse.json(openApiConfig);'), ev(ALLOWLIST, '// Public API documentation (describes public endpoints only)')],
        securityContract: 'The document must describe public endpoints only. If it grows to cover authenticated surfaces it must move behind authentication.',
      }
    case 'docs/route.ts':
      return {
        ...base,
        disposition: 'UNJUSTIFIED_EXPOSURE',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'The generated OpenAPI specification of the whole application, embedded in a documentation page, served without authentication.' },
        evidence: [r(route, 'const spec = generateOpenAPISpec();'), r(route, "'Cache-Control': 'public, max-age=3600',")],
        securityContract: 'Currently unauthenticated and public-cacheable. It is not on the public allowlist and the allowlisted spec is a separate route.',
        requiredSecurityContract: 'Require authentication (organization administrator or platform operator), or reduce the response to the allowlisted public-endpoint specification, and stop public caching.',
        ownerGate: 14,
        defects: ['DEF-0B1-DOCS-UNAUTH-API-SURFACE', 'DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'docs/openapi/route.ts':
      return {
        ...base,
        disposition: 'UNJUSTIFIED_EXPOSURE',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'The complete OpenAPI 3.0 specification (docs/api/openapi-complete.yaml) served without authentication.' },
        evidence: [r(route, "const yamlContent = fs.readFileSync(openApiPath, 'utf-8');"), r(route, "'Cache-Control': 'public, max-age=3600'")],
        securityContract: 'Currently unauthenticated and public-cacheable. It is not on the public allowlist; only /api/docs/openapi.json is.',
        requiredSecurityContract: 'Require authentication (organization administrator or platform operator), or remove the route in favour of the allowlisted public-endpoint specification, and stop public caching.',
        ownerGate: 14,
        defects: ['DEF-0B1-DOCS-UNAUTH-API-SURFACE', 'DEF-0B1-ALLOWLIST-DRIFT'],
      }
    case 'version/route.ts':
      return {
        ...base,
        disposition: 'UNJUSTIFIED_EXPOSURE',
        allowlist: 'NOT_LISTED',
        exposureContract: { dataExposed: 'Build metadata, configured, surface and runtime environment, deployment type, feature profile, request host and frontend and backend image digests.' },
        evidence: [r(route, 'requestHost: hostHeader || null,'), r(route, 'frontendImageDigest: process.env.UE_FRONTEND_IMAGE_DIGEST ?? null,')],
        securityContract: 'Currently unauthenticated. It is not on the public allowlist, yet it reports deployment topology.',
        requiredSecurityContract: 'Restrict to platform operators or an internal network, or reduce the response to a non-sensitive build identifier with no host, environment or image digests.',
        ownerGate: 14,
        defects: ['DEF-0B1-VERSION-UNAUTH-TOPOLOGY', 'DEF-0B1-ALLOWLIST-DRIFT'],
      }
    default:
      throw new Error(`no Gate 0B.1 disposition for unauthenticated operation ${id}`)
  }
}

function commsTrust(base, route, dataExposed, quote, action) {
  return {
    ...base,
    disposition: 'EXTERNAL_TRUST_MECHANISM',
    allowlist: 'LISTED',
    exposureContract: {
      trustMechanism: 'HMAC-SHA256 tracking token bound to the recipient and action (and destination for a click), compared with timingSafeEqual; a missing signing secret fails closed.',
      dataExposed,
    },
    evidence: [r(route, quote), ev(TOKEN, 'timingSafeEqual'), ev(ALLOWLIST, '/api/communications/')],
    securityContract: `Verify the ${action} token before any mutation or redirect. Never mutate on a non-valid result. The state change on GET is a separate defect: link scanners can trigger it.`,
    defects: ['DEF-0B1-COMMS-TRACKING-GET-MUTATES', 'DEF-0B1-MANIFEST-DETECTOR'],
  }
}

function health(base, route, dataExposed, routeQuote, allowQuote) {
  return {
    ...base,
    disposition: 'HEALTH_OR_OPERATIONAL',
    allowlist: 'LISTED',
    exposureContract: {
      dataExposed,
      boundary: 'Load balancers and monitors must reach it without a session, so it is on the public allowlist; it carries component states only, no credentials, customer data or topology.',
    },
    evidence: [r(route, routeQuote), ev(ALLOWLIST, allowQuote)],
    securityContract: 'Stay limited to component state. Do not add environment names, hosts, image digests or per-tenant data to the response.',
  }
}
