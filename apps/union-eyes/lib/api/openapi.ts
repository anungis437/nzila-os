/**
 * OpenAPI/Swagger Documentation Generator
 * 
 * Auto-generates OpenAPI 3.0 specification from Next.js API routes
 * Serves as /api/docs endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// OpenAPI Types
interface OpenAPISpec {
  openapi: string;
  info: InfoObject;
  servers: ServerObject[];
  paths: PathsObject;
  components: ComponentsObject;
  security: SecurityRequirementObject[];
}

interface InfoObject {
  title: string;
  version: string;
  description: string;
  contact?: ContactObject;
  license?: LicenseObject;
}

interface ContactObject {
  name: string;
  email: string;
}

interface LicenseObject {
  name: string;
  url: string;
}

interface ServerObject {
  url: string;
  description?: string;
}

interface PathsObject {
  [path: string]: PathItemObject;
}

interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  parameters?: ParameterObject[];
}

interface OperationObject {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  requestBody?: RequestBodyObject;
  parameters?: ParameterObject[];
  responses: ResponsesObject;
  security?: SecurityRequirementObject[];
  deprecated?: boolean;
}

interface RequestBodyObject {
  required: boolean;
  content: ContentObject;
}

interface ContentObject {
  [mediaType: string]: MediaTypeObject;
}

interface MediaTypeObject {
  schema: SchemaObject;
  example?: unknown;
}

interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SchemaObject;
}

interface ResponsesObject {
  [statusCode: string]: ResponseObject;
}

interface ResponseObject {
  description: string;
  content?: ContentObject;
}

interface ComponentsObject {
  schemas: { [key: string]: SchemaObject };
  securitySchemes: { [key: string]: SecuritySchemeObject };
}

interface SecuritySchemeObject {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: unknown;
  in?: string;
  name?: string;
}

interface SecurityRequirementObject {
  [key: string]: string[];
}

interface SchemaObject {
  type: string;
  properties?: { [key: string]: SchemaObject };
  items?: SchemaObject;
  required?: string[];
  enum?: string[];
  format?: string;
  description?: string;
  $ref?: string;
  default?: unknown;
}

// Route metadata storage
function createRouteMetadataStore() {
  return new Map<string, PathItemObject>();
}
const routeMetadata = createRouteMetadataStore();

/**
 * Register API route for documentation
 */
export function registerRoute(
  path: string,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  operation: Partial<OperationObject>
) {
  if (!routeMetadata.has(path)) {
    routeMetadata.set(path, {});
  }
  
  const pathItem = routeMetadata.get(path)!;
  pathItem[method] = {
    tags: operation.tags || ['Uncategorized'],
    summary: operation.summary || '',
    description: operation.description,
    operationId: operation.operationId || `${method}${path}`,
    parameters: operation.parameters || [],
    responses: operation.responses || { '200': { description: 'Success' } },
    security: operation.security,
    deprecated: operation.deprecated,
    requestBody: operation.requestBody,
  };
}

/**
 * Convert Zod schema to OpenAPI schema
 */
export function zodToOpenAPI(schema: z.ZodType<unknown>): SchemaObject {
  if (schema instanceof z.ZodString) {
    return { type: 'string', format: 'string' };
  }
  
  if (schema instanceof z.ZodNumber) {
    return { type: 'number', format: 'number' };
  }
  
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToOpenAPI(schema.element),
    };
  }
  
  if (schema instanceof z.ZodObject) {
    const properties: { [key: string]: SchemaObject } = {};
    const required: string[] = [];
    
    const shape = schema.shape;
    for (const key in shape) {
      properties[key] = zodToOpenAPI(shape[key]);
      const def = shape[key];
      if (def instanceof z.ZodOptional) {
        // optional
      } else {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  
  if (schema instanceof z.ZodOptional) {
    return zodToOpenAPI(schema.unwrap());
  }
  
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options as string[],
    };
  }
  
  return { type: 'string' };
}

/**
 * Generate OpenAPI spec
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'UnionEyes API',
      version: '1.0.0',
      description: `
## Overview
UnionEyes is a comprehensive union management platform providing:

- Member management and tracking
- Claim processing and workflow
- Collective bargaining support
- Governance and compliance
- Financial tracking
- Mobile app support

## Authentication
Most endpoints require authentication via Clerk. Include the session token in the Authorization header:

\`Authorization: Bearer <your_token>\`

## Rate Limiting
- Standard: 100 requests/minute
- Authenticated: 1000 requests/minute
      `,
      contact: {
        name: 'UnionEyes Team',
        email: 'support@unioneyes.app',
      },
      license: {
        name: 'Proprietary',
        url: 'https://unioneyes.app/license',
      },
    },
    servers: [
      {
        url: 'https://unioneyes.app',
        description: 'Production server',
      },
      {
        url: 'https://staging.unioneyes.app',
        description: 'Staging server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: buildPaths(),
    components: {
      schemas: buildSchemas(),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: '__session',
        },
      },
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] },
    ],
  };
}

function buildPaths(): PathsObject {
  const paths: PathsObject = {};
  
  // Add registered routes
  for (const [path, methods] of routeMetadata) {
    paths[path] = methods;
  }
  
  // Add common paths
  paths['/api/health'] = {
    get: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check API health status',
      operationId: 'getHealth',
      responses: {
        '200': {
          description: 'Service is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
                  timestamp: { type: 'string', format: 'date-time' },
                  uptime: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  };
  
  return paths;
}

function buildSchemas(): { [key: string]: SchemaObject } {
  return {
    // Member schemas
    Member: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
      required: ['firstName', 'lastName', 'email'],
    },
    
    // Claim schemas
    Claim: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        memberId: { type: 'string', format: 'uuid' },
        status: { 
          type: 'string', 
          enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'closed'] 
        },
        claimType: { type: 'string' },
        amount: { type: 'number' },
        submittedAt: { type: 'string', format: 'date-time' },
      },
      required: ['memberId', 'claimType'],
    },
    
    // Employer schemas
    Employer: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { 
          type: 'string', 
          enum: ['active', 'archived', 'inactive', 'contract_expired'] 
        },
        employerType: { type: 'string' },
      },
      required: ['name'],
    },
    
    // Error response
    Error: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        code: { type: 'string' },
        details: { type: 'object' },
      },
      required: ['error', 'message'],
    },
    
    // Pagination
    PaginationParams: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20 },
        sortBy: { type: 'string' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    
    // Paginated response
    PaginatedResponse: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  };
}

/**
 * API Docs endpoint handler
 */
export async function GET(request: NextRequest) {
  const spec = generateOpenAPISpec();
  
  // Check for format query param
  const format = request.nextUrl.searchParams.get('format');
  
  if (format === 'html') {
    // Return Swagger UI HTML
    return new NextResponse(getSwaggerUIHTML(spec), {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  // Return JSON spec
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Generate Swagger UI HTML
 */
function getSwaggerUIHTML(spec: OpenAPISpec): string {
  const specJson = JSON.stringify(spec);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UnionEyes API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
    .topbar { display: none; }
    .swagger-ui .info .title { font-size: 2.5em; }
    .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    const spec = ${specJson};
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
  </script>
</body>
</html>`;
}

// Pre-register common API routes
export function initAPIDocumentation() {
  // Members API
  registerRoute('/api/members', 'get', {
    tags: ['Members'],
    summary: 'List members',
    description: 'Get a paginated list of union members',
    operationId: 'listMembers',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number' },
      { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Items per page' },
      { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by status' },
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search query' },
    ],
    responses: {
      '200': { description: 'Successful response' },
      '401': { description: 'Unauthorized' },
    },
  });
  
  registerRoute('/api/members', 'post', {
    tags: ['Members'],
    summary: 'Create member',
    description: 'Add a new union member',
    operationId: 'createMember',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Member', type: 'object' },
        },
      },
    },
    responses: {
      '201': { description: 'Member created' },
      '400': { description: 'Invalid request' },
    },
  });
  
  // Claims API
  registerRoute('/api/claims', 'get', {
    tags: ['Claims'],
    summary: 'List claims',
    description: 'Get a list of claims with optional filters',
    operationId: 'listClaims',
    parameters: [
      { name: 'status', in: 'query', schema: { type: 'string' } },
      { name: 'memberId', in: 'query', schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Successful response' },
    },
  });
  
  registerRoute('/api/claims', 'post', {
    tags: ['Claims'],
    summary: 'Submit claim',
    description: 'Submit a new claim',
    operationId: 'submitClaim',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Claim', type: 'object' },
        },
      },
    },
    responses: {
      '201': { description: 'Claim submitted' },
    },
  });
  
  // Employers API
  registerRoute('/api/employers', 'get', {
    tags: ['Employers'],
    summary: 'List employers',
    description: 'Get a list of employers',
    operationId: 'listEmployers',
    responses: {
      '200': { description: 'Successful response' },
    },
  });
  
  registerRoute('/api/employers', 'post', {
    tags: ['Employers'],
    summary: 'Create employer',
    description: 'Add a new employer',
    operationId: 'createEmployer',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Employer', type: 'object' },
        },
      },
    },
    responses: {
      '201': { description: 'Employer created' },
    },
  });
}

// Initialize on import
initAPIDocumentation();
