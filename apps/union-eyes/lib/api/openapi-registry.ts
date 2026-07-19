/**
 * OpenAPI Auto-Registration for `withApi()` Routes
 *
 * Call `registerApiRoute()` at module scope to add routes defined via
 * `withApi()` into the OpenAPI specification automatically.
 *
 * The existing `registerRoute()` / `generateOpenAPISpec()` in `./openapi.ts`
 * continues to work — this module just provides a higher-level helper that
 * converts Zod schemas and `WithApiOptions` into OpenAPI metadata.
 *
 * @module lib/api/openapi-registry
 */

import { z } from 'zod';
import { registerRoute, zodToOpenAPI } from './openapi';
import type { WithApiOptions } from './with-api';

export interface RouteRegistration {
  /** Filesystem-style API path, e.g. '/api/dues/calculate' */
  path: string;
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** The same options object passed to `withApi()` */
  options: WithApiOptions<z.ZodTypeAny, z.ZodTypeAny>;
}

/**
 * Register a route in the OpenAPI spec from its `withApi()` options.
 *
 * Call at module scope alongside the route definition:
 *
 * ```ts
 * registerApiRoute('/api/dues/calculate', 'post', apiOptions);
 * export const POST = withApi(apiOptions, handler);
 * ```
 *
 * Alternatively, use `defineApi()` which calls this automatically.
 */
export function registerApiRoute(
  path: string,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  options: WithApiOptions<z.ZodTypeAny, z.ZodTypeAny>,
): void {
  if (!options.openapi) return; // Nothing to document

  const security = options.auth?.required === false
    ? [] // Public route
    : [{ bearerAuth: [] as string[] }];

  const requestBody = options.body
    ? {
        required: true,
        content: {
          'application/json': {
            schema: zodToOpenAPI(options.body),
          },
        },
      }
    : undefined;

  const parameters = options.query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? buildQueryParams(options.query) as any
    : undefined;

  registerRoute(path, method, {
    tags: options.openapi.tags ?? ['Uncategorized'],
    summary: options.openapi.summary ?? '',
    description: options.openapi.description,
    deprecated: options.openapi.deprecated,
    operationId: `${method}${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    requestBody,
    parameters,
    security,
    responses: {
      [String(options.successStatus ?? 200)]: {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [true] },
                data: { type: 'object', description: 'Response payload' },
                timestamp: { type: 'string', format: 'date-time' },
              },
              required: ['success', 'data', 'timestamp'],
            },
          },
        },
      },
      '400': { description: 'Validation error' },
      ...(options.auth?.required !== false ? { '401': { description: 'Authentication required' } } : {}),
      ...(options.auth?.minRole || options.auth?.roles ? { '403': { description: 'Insufficient permissions' } } : {}),
      ...(options.rateLimit ? { '429': { description: 'Rate limit exceeded' } } : {}),
      '500': { description: 'Internal server error' },
    },
  });
}

/**
 * Convert a Zod object schema into an array of OpenAPI query parameters.
 */
function buildQueryParams(schema: z.ZodTypeAny) {
  if (!(schema instanceof z.ZodObject)) return undefined;

  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  return Object.entries(shape).map(([key, zodField]) => {
    const isOptional = zodField instanceof z.ZodOptional || zodField instanceof z.ZodDefault;
    return {
      name: key,
      in: 'query' as const,
      required: !isOptional,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: zodToOpenAPI(zodField as z.ZodType<any>) as any,
    };
  });
}
