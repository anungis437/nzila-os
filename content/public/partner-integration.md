---
title: Partner Integration Guide
description: How technology and distribution partners connect with the Nzila platform ecosystem through APIs, white-label deployments, and onboarding workflows.
category: Integrations
order: 1
date: 2026-02-01
---

## Integration Models

Nzila offers three levels of partner integration depending on your use case:

| Tier | Best for | What you get |
|------|----------|-------------|
| **API Partner** | SaaS products, data providers | REST API access, webhook subscriptions, org-scoped credentials |
| **White-Label Partner** | Resellers, enterprise deployers | Branded deployment of a Nzila vertical app on your own domain |
| **Platform Integrator** | Systems integrators, consultancies | Access to the full SDK + development support |

All partners must complete our onboarding review before receiving production credentials. Sandbox credentials are available immediately after signing up at [our partner portal](/partners).

---

## API Integration

### Base URL

```
https://api.nzilaventures.com/v1
```

All endpoints are versioned. Breaking changes will only be introduced in new major versions, with a minimum 12-month deprecation window for old versions.

### Authentication

Partners authenticate using the **OAuth 2.0 client credentials** flow:

```bash
# Exchange client credentials for a token
curl -X POST https://api.nzilaventures.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=events:read members:read"
```

Tokens expire after **1 hour**. Implement token refresh in your integration — do not cache tokens across sessions.

### Listing org events

```http
GET /v1/orgs/{orgId}/events
Authorization: Bearer <token>
Accept: application/json
```

**Response:**

```json
{
  "data": [
    {
      "id": "evt_01J9XV...",
      "orgId": "org_01J9XX...",
      "action": "member.invite",
      "userId": "usr_01J9XY...",
      "createdAt": "2026-01-15T10:23:00Z",
      "hash": "sha256:abc123..."
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Im...",
    "hasMore": true
  }
}
```

Use cursor-based pagination for all list endpoints. Page-based pagination is not supported.

### Webhooks

Subscribe to real-time events by registering a webhook endpoint in the partner portal:

```json
{
  "url": "https://your-app.com/webhooks/nzila",
  "events": ["member.invited", "audit.emitted", "evidence.sealed"],
  "signingSecret": "whsec_..."
}
```

Verify the `X-Nzila-Signature` header on every incoming request:

```typescript
import crypto from 'crypto';

function verifyWebhook(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature),
  );
}
```

---

## White-Label Deployment

White-label partners receive a managed deployment of a Nzila vertical on their own domain. The deployment is fully isolated at the Org and infrastructure level.

### What partners can customise

- Logo, brand colours, and typography (via a brand configuration file)
- Custom domain with automatic TLS provisioning
- Feature flags (enable/disable specific modules)
- Email templates and notification copy

### What partners cannot change

- Core security controls (authentication, RLS, audit)
- Data residency region (established at onboarding, requires migration to change)
- Evidence integrity pipeline

### Onboarding steps

1. Complete the partner application at `/partners`
2. Sign the Nzila Partner Agreement
3. Provide your brand assets and domain configuration
4. We provision your dedicated environment (typically 3 business days)
5. Complete integration testing in sandbox
6. Go live

---

## Data Residency & Compliance

All partner data is stored in the region selected during onboarding:

| Region | Location | Certifications |
|--------|----------|---------------|
| `us-east` | Virginia, USA | SOC 2 Type II, ISO 27001 |
| `eu-west` | Dublin, Ireland | SOC 2 Type II, ISO 27001, GDPR |
| `au-east` | Sydney, Australia | SOC 2 Type II, Privacy Act 1988 |

Cross-region data transfer is **not permitted** — your org's data stays in its home region.

---

## Rate Limits

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| API Partner (sandbox) | 60 | 120 |
| API Partner (production) | 600 | 1,200 |
| Platform Integrator | Custom | Custom |

Rate limit headers are included on every response:

```http
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 547
X-RateLimit-Reset: 1737968400
```

---

## Support

| Channel | Response time | Scope |
|---------|--------------|-------|
| Partner portal ticket | 1 business day | All issues |
| Emergency hotline | 2 hours | Production outages |
| Monthly partner call | Scheduled | Roadmap, feedback |

For technical questions during integration, include your `X-Request-Id` header value in all support tickets to allow us to trace the request immediately.
