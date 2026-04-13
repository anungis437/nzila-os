/**
 * @nzila/openapi-gen — Spec Generator
 *
 * Takes discovered routes and generates OpenAPI 3.1 specs.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DiscoveredRoute, OpenApiSpec, GeneratorConfig, GenerationResult, AppConfig } from './types.js';
import { scanAllApps } from './scanner.js';

/** Build a minimal OpenAPI path item from a discovered route */
function buildPathItem(route: DiscoveredRoute): Record<string, unknown> {
  const pathItem: Record<string, unknown> = {};

  for (const method of route.methods) {
    const operation: Record<string, unknown> = {
      summary: `${method.toUpperCase()} ${route.path}`,
      operationId: `${route.app}_${method}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      tags: [route.app],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ok: { type: 'boolean' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
        '401': { description: 'Unauthorized' },
        '500': { description: 'Internal server error' },
      },
    };

    // Extract path parameters from OpenAPI path
    const paramMatches = route.openApiPath.matchAll(/\{(\w+)\}/g);
    const parameters: Array<Record<string, unknown>> = [];
    for (const match of paramMatches) {
      parameters.push({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Add request body for methods that typically have one
    if (['post', 'put', 'patch'].includes(method)) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: route.hasZodSchemas
              ? { type: 'object', description: 'See Zod schema in source for full type definition' }
              : { type: 'object' },
          },
        },
      };
    }

    // Annotate schema completeness
    if (route.hasZodSchemas) {
      (operation as Record<string, unknown>)['x-schema-source'] = 'zod';
    }
    if (route.hasWithApi) {
      (operation as Record<string, unknown>)['x-with-api'] = true;
    }

    pathItem[method] = operation;
  }

  return pathItem;
}

/** Generate an OpenAPI spec for a single app */
function generateAppSpec(
  appName: string,
  routes: DiscoveredRoute[],
  appConfig?: AppConfig,
): OpenApiSpec {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    paths[route.openApiPath] = buildPathItem(route);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: appConfig?.info?.title ?? `Nzila ${appName} API`,
      description: appConfig?.info?.description ?? `Auto-generated OpenAPI spec for @nzila/${appName}`,
      version: appConfig?.info?.version ?? '0.1.0',
      contact: { name: 'Nzila Platform Team' },
    },
    servers: [
      {
        url: appConfig?.baseUrl ?? 'http://localhost:3000',
        description: 'Development',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        platformAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nzila platform-auth session token (email/password or Entra SSO)',
        },
      },
    },
    tags: [{ name: appName, description: `@nzila/${appName} routes` }],
    security: [{ platformAuth: [] }],
  };
}

/** Generate a combined spec merging all apps */
function generateCombinedSpec(
  allRoutes: DiscoveredRoute[],
  apps: AppConfig[],
): OpenApiSpec {
  const paths: Record<string, Record<string, unknown>> = {};
  const tags: Array<{ name: string; description?: string }> = [];
  const servers: Array<{ url: string; description: string }> = [];

  const appNames = new Set<string>();
  for (const route of allRoutes) {
    // Prefix path with app name to avoid collisions
    const prefixedPath = `/${route.app}${route.openApiPath}`;
    paths[prefixedPath] = buildPathItem(route);
    appNames.add(route.app);
  }

  for (const name of appNames) {
    const appConfig = apps.find(a => a.name === name);
    tags.push({ name, description: `@nzila/${name} routes` });
    servers.push({
      url: appConfig?.baseUrl ?? 'http://localhost:3000',
      description: `${name} (dev)`,
    });
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Nzila OS — Combined API',
      description: 'Auto-generated combined OpenAPI spec for all Nzila OS services',
      version: '0.1.0',
      contact: { name: 'Nzila Platform Team' },
    },
    servers,
    paths,
    components: {
      securitySchemes: {
        platformAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nzila platform-auth session token (email/password or Entra SSO)',
        },
      },
    },
    tags,
    security: [{ platformAuth: [] }],
  };
}

// ── Public API ──────────────────────────────────────────

/** Run the full generation pipeline */
export function generate(config: GeneratorConfig): GenerationResult {
  const { rootDir, outputDir, format, combined } = config;

  // Ensure output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Scan all apps
  const { routes, apps } = scanAllApps(rootDir);

  // Filter to specific apps if requested
  const filteredRoutes = config.apps
    ? routes.filter(r => config.apps!.includes(r.app))
    : routes;

  // Group by app
  const byApp = new Map<string, DiscoveredRoute[]>();
  for (const route of filteredRoutes) {
    const existing = byApp.get(route.app) ?? [];
    existing.push(route);
    byApp.set(route.app, existing);
  }

  const result: GenerationResult = {
    apps: [],
    totalRoutes: filteredRoutes.length,
    routesWithSchemas: filteredRoutes.filter(r => r.hasZodSchemas).length,
  };

  // Generate per-app specs
  for (const [appName, appRoutes] of byApp) {
    const appConfig = apps.find(a => a.name === appName);
    const spec = generateAppSpec(appName, appRoutes, appConfig);
    const ext = format === 'yaml' ? 'yaml' : 'json';
    const specPath = join(outputDir, `${appName}.openapi.${ext}`);

    const content = format === 'yaml'
      ? toYaml(spec)
      : JSON.stringify(spec, null, 2);

    writeFileSync(specPath, content);

    result.apps.push({
      name: appName,
      routeCount: appRoutes.length,
      specPath,
      errors: [],
    });
  }

  // Generate combined spec
  if (combined && filteredRoutes.length > 0) {
    const combinedSpec = generateCombinedSpec(filteredRoutes, apps);
    const ext = format === 'yaml' ? 'yaml' : 'json';
    const combinedPath = join(outputDir, `nzila-combined.openapi.${ext}`);
    const content = format === 'yaml'
      ? toYaml(combinedSpec)
      : JSON.stringify(combinedSpec, null, 2);
    writeFileSync(combinedPath, content);
    result.combinedSpecPath = combinedPath;
  }

  return result;
}

/** Simple YAML serializer for OpenAPI specs (avoids heavy deps) */
function toYaml(obj: unknown, _indent = 0): string {
  // Lazy import yaml if available, otherwise JSON fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stringify } = require('yaml') as typeof import('yaml');
    return stringify(obj, { indent: 2 });
  } catch {
    return JSON.stringify(obj, null, 2);
  }
}
