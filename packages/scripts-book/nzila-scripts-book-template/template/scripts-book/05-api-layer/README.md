# Chapter 05 — API Layer

This chapter documents the API route patterns, middleware stack, and request
handling conventions used in **{{PRODUCT_NAME}}**.

## Route structure

API routes live under `{{PRIMARY_APP_PATH}}/app/api/`. The directory layout
follows Next.js App Router conventions:

```
app/api/
├── auth/           # Authentication callbacks
├── tenants/        # Tenant management
├── [resource]/     # Domain-specific CRUD endpoints
│   ├── route.ts    # GET / POST handlers
│   └── [id]/
│       └── route.ts  # GET / PUT / DELETE by id
└── health/
    └── route.ts    # Health-check endpoint
```

## Middleware stack

Requests pass through the following middleware (in order):

1. **Rate limiting** — Prevents abuse; configured per-route.
2. **Authentication** — Validates session / JWT via {{AUTH_PROVIDER}}.
3. **Tenant resolution** — Extracts `{{TENANT_KEY}}` from the session.
4. **Input validation** — Zod schemas validate request body and query params.
5. **Handler** — Business logic executes.
6. **Error boundary** — Catches unhandled errors, returns structured JSON.

## Response format

All API responses follow a consistent envelope:

```json
{
  "data": { ... },
  "error": null,
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

## Error codes

| HTTP Status | Meaning              |
| ----------- | -------------------- |
| 400         | Validation failure   |
| 401         | Unauthenticated      |
| 403         | Unauthorized         |
| 404         | Resource not found   |
| 429         | Rate limit exceeded  |
| 500         | Internal server error |

## Health check

`GET /api/health` returns `200 OK` with a JSON body containing service status.
This endpoint is used by load balancers and uptime monitors.
