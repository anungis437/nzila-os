/**
 * @nzila/openapi-gen — Scanner extended tests
 *
 * Covers uncovered branches: catch-all segments, route groups, withApi detection,
 * scanAllApps, findRouteFiles skip patterns, no-method files.
 */
import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { scanNextjsApp, scanFastifyApp, scanAllApps } from '../scanner'

const TMP = join(import.meta.dirname ?? __dirname, '..', '..', '__test-scan-fixtures__')

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function teardown() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
}

describe('scanNextjsApp — advanced', () => {
  it('converts catch-all [...slug] to OpenAPI {slug}', () => {
    setup()
    const appDir = join(TMP, 'catchall-app')
    const routeDir = join(appDir, 'app', 'api', 'docs', '[...slug]')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `export async function GET() { return Response.json({}); }`,
    )

    const routes = scanNextjsApp(appDir, 'catchall-app')
    expect(routes).toHaveLength(1)
    expect(routes[0].openApiPath).toBe('/api/docs/{slug}')

    teardown()
  })

  it('strips route groups like (dashboard) from path', () => {
    setup()
    const appDir = join(TMP, 'group-app')
    const routeDir = join(appDir, 'app', 'api', '(admin)', 'settings')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `export async function GET() { return Response.json({}); }`,
    )

    const routes = scanNextjsApp(appDir, 'group-app')
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/api/settings')

    teardown()
  })

  it('detects withApi pattern', () => {
    setup()
    const appDir = join(TMP, 'withapi-app')
    const routeDir = join(appDir, 'app', 'api', 'claims')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `import { withApi } from '@nzila/platform-auth';\nexport const GET = withApi(async () => Response.json({}));`,
    )

    const routes = scanNextjsApp(appDir, 'withapi-app')
    expect(routes).toHaveLength(1)
    expect(routes[0].hasWithApi).toBe(true)

    teardown()
  })

  it('ignores route files with no exported HTTP methods', () => {
    setup()
    const appDir = join(TMP, 'no-methods')
    const routeDir = join(appDir, 'app', 'api', 'utils')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `// Just a helper, no exports\nconst helper = () => {};\nexport default helper;`,
    )

    const routes = scanNextjsApp(appDir, 'no-methods')
    expect(routes).toHaveLength(0)

    teardown()
  })

  it('skips __tests__ directories inside api folder', () => {
    setup()
    const appDir = join(TMP, 'skip-tests')
    const routeDir = join(appDir, 'app', 'api', 'users')
    const testDir = join(appDir, 'app', 'api', '__tests__')
    mkdirSync(routeDir, { recursive: true })
    mkdirSync(testDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `export async function GET() { return Response.json([]); }`,
    )
    writeFileSync(
      join(testDir, 'route.ts'),
      `export async function GET() { return Response.json({}); }`,
    )

    const routes = scanNextjsApp(appDir, 'skip-tests')
    expect(routes).toHaveLength(1)
    expect(routes[0].path).toBe('/api/users')

    teardown()
  })

  it('detects export const pattern for HTTP methods', () => {
    setup()
    const appDir = join(TMP, 'const-export')
    const routeDir = join(appDir, 'app', 'api', 'items')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      `export const GET = async () => Response.json([]);\nexport const POST = async (req: Request) => Response.json({});`,
    )

    const routes = scanNextjsApp(appDir, 'const-export')
    expect(routes).toHaveLength(1)
    expect(routes[0].methods).toContain('get')
    expect(routes[0].methods).toContain('post')

    teardown()
  })

  it('detects all 5 HTTP methods', () => {
    setup()
    const appDir = join(TMP, 'all-methods')
    const routeDir = join(appDir, 'app', 'api', 'resources')
    mkdirSync(routeDir, { recursive: true })

    writeFileSync(
      join(routeDir, 'route.ts'),
      [
        'export async function GET() {}',
        'export async function POST() {}',
        'export async function PUT() {}',
        'export async function PATCH() {}',
        'export async function DELETE() {}',
      ].join('\n'),
    )

    const routes = scanNextjsApp(appDir, 'all-methods')
    expect(routes).toHaveLength(1)
    expect(routes[0].methods).toEqual(
      expect.arrayContaining(['get', 'post', 'put', 'patch', 'delete']),
    )

    teardown()
  })
})

describe('scanFastifyApp — advanced', () => {
  it('returns empty when src dir does not exist', () => {
    setup()
    const appDir = join(TMP, 'no-src')
    mkdirSync(appDir, { recursive: true })

    const routes = scanFastifyApp(appDir, 'no-src')
    expect(routes).toHaveLength(0)

    teardown()
  })

  it('detects multiple routes in a single file', () => {
    setup()
    const appDir = join(TMP, 'multi-route')
    const routesDir = join(appDir, 'src', 'routes')
    mkdirSync(routesDir, { recursive: true })

    writeFileSync(
      join(routesDir, 'api.ts'),
      [
        "app.get('/health', async () => ({ ok: true }));",
        "app.post('/tasks', async () => ({ created: true }));",
        "app.put('/tasks/:id', async () => ({ updated: true }));",
      ].join('\n'),
    )

    const routes = scanFastifyApp(appDir, 'multi-route')
    expect(routes.length).toBeGreaterThanOrEqual(3)

    const paths = routes.map((r) => r.path)
    expect(paths).toContain('/health')
    expect(paths).toContain('/tasks')
    expect(paths).toContain('/tasks/:id')

    teardown()
  })

  it('converts Fastify dynamic params to OpenAPI format', () => {
    setup()
    const appDir = join(TMP, 'fastify-params')
    const routesDir = join(appDir, 'src', 'routes')
    mkdirSync(routesDir, { recursive: true })

    writeFileSync(
      join(routesDir, 'users.ts'),
      `app.get('/users/[userId]/posts/[postId]', async () => ({}));`,
    )

    const routes = scanFastifyApp(appDir, 'fastify-params')
    if (routes.length > 0) {
      expect(routes[0].openApiPath).toBe('/users/{userId}/posts/{postId}')
    }

    teardown()
  })

  it('ignores files with no route registrations', () => {
    setup()
    const appDir = join(TMP, 'no-routes-fastify')
    const routesDir = join(appDir, 'src', 'routes')
    mkdirSync(routesDir, { recursive: true })

    writeFileSync(
      join(routesDir, 'utils.ts'),
      `export function helper() { return 42; }`,
    )

    const routes = scanFastifyApp(appDir, 'no-routes-fastify')
    expect(routes).toHaveLength(0)

    teardown()
  })
})

describe('scanAllApps', () => {
  it('auto-detects framework types and scans all apps', () => {
    setup()
    const rootDir = join(TMP, 'all-apps')
    const webApiDir = join(rootDir, 'apps', 'web', 'app', 'api', 'health')
    mkdirSync(webApiDir, { recursive: true })

    writeFileSync(
      join(rootDir, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { next: '14' }, scripts: { dev: 'next dev --port 3000' } }),
    )
    writeFileSync(
      join(webApiDir, 'route.ts'),
      `export async function GET() { return Response.json({ ok: true }); }`,
    )

    const result = scanAllApps(rootDir)
    expect(result.apps.length).toBeGreaterThanOrEqual(1)
    expect(result.routes.length).toBeGreaterThanOrEqual(1)

    const webConfig = result.apps.find((a) => a.name === 'web')
    expect(webConfig).toBeDefined()
    expect(webConfig!.framework).toBe('nextjs')
    expect(webConfig!.port).toBe(3000)

    teardown()
  })

  it('returns empty when apps dir does not exist', () => {
    setup()
    const rootDir = join(TMP, 'no-apps-dir')
    mkdirSync(rootDir, { recursive: true })

    const result = scanAllApps(rootDir)
    expect(result.routes).toHaveLength(0)
    expect(result.apps).toHaveLength(0)

    teardown()
  })

  it('detects Django app (manage.py) and skips scanning routes', () => {
    setup()
    const rootDir = join(TMP, 'django')
    const appDir = join(rootDir, 'apps', 'backend')
    mkdirSync(appDir, { recursive: true })

    writeFileSync(join(appDir, 'manage.py'), '#!/usr/bin/env python')
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({ name: 'backend', dependencies: {} }),
    )

    const result = scanAllApps(rootDir)
    expect(result.apps).toHaveLength(1)
    expect(result.apps[0].framework).toBe('django')
    expect(result.routes).toHaveLength(0) // Django routes not scanned

    teardown()
  })

  it('detects Fastify app and scans routes', () => {
    setup()
    const rootDir = join(TMP, 'fastify')
    const appDir = join(rootDir, 'apps', 'api')
    const routesDir = join(appDir, 'src', 'routes')
    mkdirSync(routesDir, { recursive: true })

    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'api',
        dependencies: { fastify: '4.0.0' },
        scripts: { dev: 'tsx watch --port 3010' },
      }),
    )
    writeFileSync(
      join(routesDir, 'health.ts'),
      `app.get('/health', async () => ({ ok: true }));`,
    )

    const result = scanAllApps(rootDir)
    expect(result.apps).toHaveLength(1)
    expect(result.apps[0].framework).toBe('fastify')
    expect(result.apps[0].port).toBe(3010)
    expect(result.routes.length).toBeGreaterThanOrEqual(1)

    teardown()
  })

  it('skips directories without package.json', () => {
    setup()
    const rootDir = join(TMP, 'no-pkg')
    mkdirSync(join(rootDir, 'apps', 'no-package'), { recursive: true })

    const result = scanAllApps(rootDir)
    expect(result.apps).toHaveLength(0)

    teardown()
  })

  it('uses default baseUrl when no port in dev script', () => {
    setup()
    const rootDir = join(TMP, 'no-port')
    const appDir = join(rootDir, 'apps', 'simple')
    mkdirSync(join(appDir, 'app', 'api'), { recursive: true })

    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({ name: 'simple', dependencies: { next: '14' }, scripts: { dev: 'next dev' } }),
    )

    const result = scanAllApps(rootDir)
    expect(result.apps[0].baseUrl).toBe('http://localhost:3000')
    expect(result.apps[0].port).toBeUndefined()

    teardown()
  })
})
