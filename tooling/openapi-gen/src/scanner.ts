/**
 * @nzila/openapi-gen — Route Scanner
 *
 * Discovers API routes across all Nzila apps using static analysis.
 * Supports Next.js App Router and Fastify patterns.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { DiscoveredRoute, HttpMethod, AppConfig } from './types.js';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

/** Convert Next.js dynamic segments to OpenAPI path params */
function toOpenApiPath(routePath: string): string {
  return routePath
    .replace(/\[\.\.\.(\w+)\]/g, '{$1}')    // catch-all [...slug] → {slug}
    .replace(/\[(\w+)\]/g, '{$1}');           // dynamic [id] → {id}
}

/** Recursively find route files in a directory */
function findRouteFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', '__tests__'].includes(entry.name)) continue;
      files.push(...findRouteFiles(full, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/** Detect exported HTTP methods from source */
function detectMethods(source: string): HttpMethod[] {
  const methods: HttpMethod[] = [];
  for (const method of HTTP_METHODS) {
    // Match: export async function GET, export function POST, export const GET
    const pattern = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const)\\s+${method.toUpperCase()}\\b`,
    );
    if (pattern.test(source)) {
      methods.push(method);
    }
  }
  // Also match Fastify patterns: app.get(, app.post(
  for (const method of HTTP_METHODS) {
    const pattern = new RegExp(`app\\.${method}\\s*\\(`);
    if (pattern.test(source)) {
      methods.push(method);
    }
  }
  return [...new Set(methods)];
}

/** Extract API path from file path relative to app dir */
function extractNextjsPath(filePath: string, appDir: string): string {
  const rel = relative(join(appDir, 'app'), filePath)
    .split(sep)
    .join('/');
  // Remove route.ts suffix
  const pathPart = rel.replace(/\/route\.ts$/, '');
  // Remove route groups: (dashboard)/ → /
  const cleaned = pathPart.replace(/\([^)]+\)\//g, '') // codeql[js/polynomial-redos] - input is a file path from the workspace, not attacker-controlled
  return '/' + cleaned;
}

// ── Public API ──────────────────────────────────────────

/** Scan a Next.js app for API routes */
export function scanNextjsApp(appDir: string, appName: string): DiscoveredRoute[] {
  const apiDir = join(appDir, 'app', 'api');
  if (!existsSync(apiDir)) return [];

  const routeFiles = findRouteFiles(apiDir, /^route\.ts$/);
  const routes: DiscoveredRoute[] = [];

  for (const filePath of routeFiles) {
    const source = readFileSync(filePath, 'utf-8');
    const methods = detectMethods(source);
    if (methods.length === 0) continue;

    const path = extractNextjsPath(filePath, appDir);
    routes.push({
      filePath,
      app: appName,
      path,
      openApiPath: toOpenApiPath(path),
      methods,
      hasZodSchemas: /z\.|zod|Schema/.test(source),
      hasWithApi: /withApi\s*\(/.test(source),
      source,
    });
  }

  return routes;
}

/** Scan a Fastify app for routes */
export function scanFastifyApp(appDir: string, appName: string): DiscoveredRoute[] {
  const srcDir = join(appDir, 'src');
  if (!existsSync(srcDir)) return [];

  const routeFiles = findRouteFiles(join(srcDir, 'routes'), /\.ts$/);
  const routes: DiscoveredRoute[] = [];

  for (const filePath of routeFiles) {
    const source = readFileSync(filePath, 'utf-8');
    const methods = detectMethods(source);
    if (methods.length === 0) continue;

    // Extract paths from app.get('/path', ...) calls
    const pathMatches = source.matchAll(/app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g);
    for (const match of pathMatches) {
      const path = match[1]!;
      routes.push({
        filePath,
        app: appName,
        path,
        openApiPath: toOpenApiPath(path),
        methods,
        hasZodSchemas: /z\.|zod|Schema/.test(source),
        hasWithApi: false,
        source,
      });
    }
  }

  return routes;
}

/** Auto-detect apps and scan all of them */
export function scanAllApps(rootDir: string): { routes: DiscoveredRoute[]; apps: AppConfig[] } {
  const appsDir = join(rootDir, 'apps');
  const apps: AppConfig[] = [];
  const routes: DiscoveredRoute[] = [];

  if (!existsSync(appsDir)) return { routes, apps };

  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const appDir = join(appsDir, entry.name);
    const pkgPath = join(appDir, 'package.json');
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    let framework: AppConfig['framework'] = 'nextjs';
    if (deps.fastify) framework = 'fastify';
    if (existsSync(join(appDir, 'manage.py'))) framework = 'django';

    const devScript: string = pkg.scripts?.dev ?? '';
    const portMatch = devScript.match(/--port\s+(\d+)/);
    const port = portMatch ? Number(portMatch[1]) : undefined;

    const appConfig: AppConfig = {
      name: entry.name,
      dir: appDir,
      framework,
      baseUrl: port ? `http://localhost:${port}` : 'http://localhost:3000',
      port,
    };
    apps.push(appConfig);

    switch (framework) {
      case 'nextjs':
        routes.push(...scanNextjsApp(appDir, entry.name));
        break;
      case 'fastify':
        routes.push(...scanFastifyApp(appDir, entry.name));
        break;
      case 'django':
        // Django routes need Python-based extraction; skip for now
        break;
    }
  }

  return { routes, apps };
}
