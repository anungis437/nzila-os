/**
 * OpenAPI / Swagger Configuration
 * 
 * Customer-facing API documentation for UnionEyes Platform
 * Accessible at /api/docs
 */

export const openApiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'UnionEyes API',
    version: '1.0.0',
    description: `
# UnionEyes Platform API

The UnionEyes API provides programmatic access to union management features including:

- **Claims Management** - Create and manage grievances
- **Member Management** - Access member profiles and data
- **Voting & Elections** - Run union elections and ballots
- **Document Management** - Store and retrieve union documents
- **Analytics** - Fetch union metrics and reports
- **Notifications** - Send messages to members

## Authentication

All API requests require authentication using an API key:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.unioneyes.com/v1/claims
\`\`\`

Get your API key from the [Admin Dashboard](/admin/api-keys).

## Rate Limits

- **Free Plan**: 100 requests/hour
- **Pro Plan**: 1,000 requests/hour
- **Enterprise**: Unlimited

## Support

- Documentation: https://docs.unioneyes.com
- Email: api@unioneyes.com
- Status Page: https://status.unioneyes.com
    `.trim(),
    contact: {
      name: 'UnionEyes API Support',
      email: 'api@unioneyes.com',
      url: 'https://unioneyes.com/support',
    },
    license: {
      name: 'Proprietary',
      url: 'https://unioneyes.com/terms',
    },
  },
  servers: [
    {
      url: 'https://api.unioneyes.com/v1',
      description: 'Production',
    },
    {
      url: 'https://staging-api.unioneyes.com/v1',
      description: 'Staging',
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Local Development',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'API key authentication',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          code: {
            type: 'string',
            description: 'Error code',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
        },
        required: ['error'],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          total: {
            type: 'integer',
            description: 'Total number of items',
          },
          totalPages: {
            type: 'integer',
            description: 'Total number of pages',
          },
        },
      },
      Claim: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique claim identifier',
          },
          title: {
            type: 'string',
            description: 'Claim title',
          },
          description: {
            type: 'string',
            description: 'Detailed claim description',
          },
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            description: 'Current claim status',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Claim priority level',
          },
          claimantId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the member who filed the claim',
          },
          assignedTo: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the staff member assigned to the claim',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the claim was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the claim was last updated',
          },
          resolvedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the claim was resolved',
          },
        },
        required: ['id', 'title', 'status', 'createdAt'],
      },
      Member: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          firstName: {
            type: 'string',
          },
          lastName: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          phone: {
            type: 'string',
          },
          membershipNumber: {
            type: 'string',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'suspended'],
          },
          joinedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        required: ['id', 'firstName', 'lastName', 'email', 'status'],
      },
      Vote: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          startDate: {
            type: 'string',
            format: 'date-time',
          },
          endDate: {
            type: 'string',
            format: 'date-time',
          },
          status: {
            type: 'string',
            enum: ['draft', 'active', 'closed', 'cancelled'],
          },
          eligibleVoters: {
            type: 'integer',
          },
          totalVotes: {
            type: 'integer',
          },
        },
        required: ['id', 'title', 'status'],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Claims',
      description: 'Grievance and claims management',
    },
    {
      name: 'Members',
      description: 'Member management and profiles',
    },
    {
      name: 'Voting',
      description: 'Elections and voting',
    },
    {
      name: 'Documents',
      description: 'Document management',
    },
    {
      name: 'Analytics',
      description: 'Reporting and analytics',
    },
    {
      name: 'Notifications',
      description: 'Member notifications',
    },
  ],
  paths: {},
};

/**
 * Claims API Paths
 */
export const claimsApiPaths = {
  '/claims': {
    get: {
      tags: ['Claims'],
      summary: 'List all claims',
      description: 'Retrieve a paginated list of claims',
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', default: 1 },
          description: 'Page number',
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 20 },
          description: 'Items per page',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          description: 'Filter by status',
        },
        {
          name: 'priority',
          in: 'query',
          schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          description: 'Filter by priority',
        },
      ],
      responses: {
        '200': {
          description: 'List of claims',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Claim' },
                  },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Claims'],
      summary: 'Create a new claim',
      description: 'File a new grievance or claim',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'urgent'],
                },
                claimantId: { type: 'string', format: 'uuid' },
              },
              required: ['title', 'description', 'claimantId'],
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Claim created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Claim' },
            },
          },
        },
        '400': {
          description: 'Invalid request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
  },
  '/claims/{id}': {
    get: {
      tags: ['Claims'],
      summary: 'Get claim by ID',
      description: 'Retrieve a single claim by its ID',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Claim ID',
        },
      ],
      responses: {
        '200': {
          description: 'Claim details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Claim' },
            },
          },
        },
        '404': {
          description: 'Claim not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    patch: {
      tags: ['Claims'],
      summary: 'Update a claim',
      description: 'Update claim details',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                priority: { type: 'string' },
                assignedTo: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Claim updated',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Claim' },
            },
          },
        },
      },
    },
  },
};

// Combine all paths
openApiConfig.paths = {
  ...claimsApiPaths,
  // Add more endpoint documentation as needed
};

