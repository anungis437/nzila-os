/**
 * @nzila/openapi-gen — Generator comprehensive tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'

const TMP = join(import.meta.dirname ?? __dirname, '..', '..', '__test-gen-fixtures__')

function setup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
  mkdirSync(TMP, { recursive: true })
}

function teardown() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true })
}

// Create a realistic mock monorepo structure
function createMockMonorepo(rootDir: string) {
  // Next.js app
  const webApiDir = join(rootDir, 'apps', 'web', 'app', 'api')
  mkdirSync(join(webApiDir, 'users', '[id]'), { recursive: true })
  mkdirSync(join(webApiDir, 'health'), { recursive: true })
  mkdirSync(join(webApiDir, '(dashboard)', 'settings'), { recursive: true })

  writeFileSync(
    join(rootDir, 'apps', 'web', 'package.json'),
    JSON.stringify({
      name: '@nzila/web',
      dependencies: { next: '14.0.0' },
      scripts: { dev: 'next dev --port 3000' },
    }),
  )

  writeFileSync(
    join(webApiDir, 'users', 'route.ts'),
    `import { z } from 'zod';\nconst Schema = z.object({});\nexport async function GET() { return Response.json({}); }\nexport async function POST() { return Response.json({}); }`,
  )

  writeFileSync(
    join(webApiDir, 'users', '[id]', 'route.ts'),
    `export async function GET() { return Response.json({}); }\nexport async function PUT() { return Response.json({}); }\nexport async function DELETE() { return Response.json({}); }`,
  )

  writeFileSync(
    join(webApiDir, 'health', 'route.ts'),
    `export async function GET() { return Response.json({ ok: true }); }`,
  )

  writeFileSync(
    join(webApiDir, '(dashboard)', 'settings', 'route.ts'),
    `export async function GET() { return Response.json({}); }\nexport async function PATCH() { return Response.json({}); }`,
  )

  // Fastify app
  const orchestratorDir = join(rootDir, 'apps', 'orchestrator', 'src', 'routes')
  mkdirSync(orchestratorDir, { recursive: true })

  writeFileSync(
    join(rootDir, 'apps', 'orchestrator', 'package.json'),
    JSON.stringify({
      name: '@nzila/orchestrator',
      dependencies: { fastify: '4.0.0' },
      scripts: { dev: 'tsx watch src/index.ts --port 3010' },
    }),
  )

  writeFileSync(
    join(orchestratorDir, 'tasks.ts'),
    `export default async function (app) {\n  app.get('/tasks', async () => ({ tasks: [] }));\n  app.post('/tasks', async () => ({ ok: true }));\n}`,
  )

  // Django app (should be skipped)
  const djangoDir = join(rootDir, 'apps', 'union-eyes')
  mkdirSync(djangoDir, { recursive: true })
  writeFileSync(join(djangoDir, 'manage.py'), '#!/usr/bin/env python')
  writeFileSync(
    join(djangoDir, 'package.json'),
    JSON.stringify({ name: '@nzila/union-eyes', dependencies: {} }),
  )

  // App with no package.json (should be skipped)
  mkdirSync(join(rootDir, 'apps', 'empty-app'), { recursive: true })

  // Non-directory entry (should be skipped) — create a file in apps/
  writeFileSync(join(rootDir, 'apps', '.gitkeep'), '')
}

describe('generator — generate', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('generates per-app JSON specs', async () => {
    const rootDir = join(TMP, 'monorepo')
    const outputDir = join(TMP, 'output')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({
      rootDir,
      outputDir,
      format: 'json',
      combined: false,
    })

    expect(result.totalRoutes).toBeGreaterThan(0)
    expect(result.apps.length).toBeGreaterThanOrEqual(1)

    // Check web app spec was written
    const webApp = result.apps.find((a) => a.name === 'web')
    expect(webApp).toBeDefined()
    expect(webApp!.routeCount).toBeGreaterThan(0)
    expect(webApp!.specPath).toBeDefined()

    // Verify spec file exists and is valid JSON
    const specContent = readFileSync(webApp!.specPath!, 'utf-8')
    const spec = JSON.parse(specContent)
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toContain('web')
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0)
  })

  it('generates a combined spec when combined=true', async () => {
    const rootDir = join(TMP, 'combined')
    const outputDir = join(TMP, 'combined-output')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({
      rootDir,
      outputDir,
      format: 'json',
      combined: true,
    })

    expect(result.combinedSpecPath).toBeDefined()
    const content = readFileSync(result.combinedSpecPath!, 'utf-8')
    const spec = JSON.parse(content)
    expect(spec.info.title).toContain('Combined')
    expect(spec.tags.length).toBeGreaterThan(0)
    expect(spec.servers.length).toBeGreaterThan(0)
  })

  it('filters to specific apps', async () => {
    const rootDir = join(TMP, 'filter')
    const outputDir = join(TMP, 'filter-output')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({
      rootDir,
      outputDir,
      format: 'json',
      combined: false,
      apps: ['web'],
    })

    expect(result.apps).toHaveLength(1)
    expect(result.apps[0].name).toBe('web')
  })

  it('handles yaml format (with fallback)', async () => {
    const rootDir = join(TMP, 'yaml')
    const outputDir = join(TMP, 'yaml-output')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({
      rootDir,
      outputDir,
      format: 'yaml',
      combined: true,
    })

    // Whether or not 'yaml' package is available, a spec should be written
    expect(result.apps.length).toBeGreaterThan(0)
    for (const app of result.apps) {
      expect(app.specPath).toContain('.yaml')
      expect(existsSync(app.specPath!)).toBe(true)
    }

    if (result.combinedSpecPath) {
      expect(result.combinedSpecPath).toContain('.yaml')
    }
  })

  it('creates output directory if it does not exist', async () => {
    const rootDir = join(TMP, 'mkdir-test')
    const outputDir = join(TMP, 'new-dir', 'nested', 'output')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    generate({ rootDir, outputDir, format: 'json', combined: false })
    expect(existsSync(outputDir)).toBe(true)
  }, 15000)

  it('returns 0 routes for empty monorepo', async () => {
    const rootDir = join(TMP, 'empty')
    const outputDir = join(TMP, 'empty-out')
    mkdirSync(join(rootDir, 'apps'), { recursive: true })

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    expect(result.totalRoutes).toBe(0)
    expect(result.apps).toHaveLength(0)
  })

  it('does not generate combined spec when no routes', async () => {
    const rootDir = join(TMP, 'no-routes')
    const outputDir = join(TMP, 'no-routes-out')
    mkdirSync(join(rootDir, 'apps'), { recursive: true })

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: true })
    expect(result.combinedSpecPath).toBeUndefined()
  })
})

describe('generator — spec content', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('includes path parameters for dynamic segments', async () => {
    const rootDir = join(TMP, 'params')
    const outputDir = join(TMP, 'params-out')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    const webApp = result.apps.find((a) => a.name === 'web')
    const content = readFileSync(webApp!.specPath!, 'utf-8')
    const spec = JSON.parse(content)

    // Should have /api/users/{id} path with parameter definitions
    const pathItem = spec.paths['/api/users/{id}']
    expect(pathItem).toBeDefined()

    // GET on this path should have parameters
    expect(pathItem.get.parameters).toBeDefined()
    expect(pathItem.get.parameters).toContainEqual(
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
    )
  })

  it('includes requestBody for POST/PUT/PATCH', async () => {
    const rootDir = join(TMP, 'body')
    const outputDir = join(TMP, 'body-out')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    const webApp = result.apps.find((a) => a.name === 'web')
    const content = readFileSync(webApp!.specPath!, 'utf-8')
    const spec = JSON.parse(content)

    // POST /api/users should have requestBody
    const usersPath = spec.paths['/api/users']
    expect(usersPath.post.requestBody).toBeDefined()
    expect(usersPath.post.requestBody.required).toBe(true)
  })

  it('marks x-schema-source for routes with Zod', async () => {
    const rootDir = join(TMP, 'zod')
    const outputDir = join(TMP, 'zod-out')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    const webApp = result.apps.find((a) => a.name === 'web')
    const content = readFileSync(webApp!.specPath!, 'utf-8')
    const spec = JSON.parse(content)

    // /api/users has Zod schemas
    const usersPath = spec.paths['/api/users']
    // At least one method should have x-schema-source
    const methods = Object.values(usersPath) as Array<Record<string, unknown>>
    expect(methods.some((m) => m['x-schema-source'] === 'zod')).toBe(true)
  })

  it('counts routesWithSchemas correctly', async () => {
    const rootDir = join(TMP, 'schemas')
    const outputDir = join(TMP, 'schemas-out')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    // Only /api/users has Zod schemas in our mock
    expect(result.routesWithSchemas).toBeGreaterThanOrEqual(1)
  })

  it('includes security schemes in generated specs', async () => {
    const rootDir = join(TMP, 'security')
    const outputDir = join(TMP, 'security-out')
    mkdirSync(rootDir, { recursive: true })
    createMockMonorepo(rootDir)

    const { generate } = await import('../generator')

    const result = generate({ rootDir, outputDir, format: 'json', combined: false })
    const webApp = result.apps.find((a) => a.name === 'web')
    const content = readFileSync(webApp!.specPath!, 'utf-8')
    const spec = JSON.parse(content)

    expect(spec.components.securitySchemes.platformAuth).toBeDefined()
    expect(spec.security).toEqual([{ platformAuth: [] }])
  })
})
