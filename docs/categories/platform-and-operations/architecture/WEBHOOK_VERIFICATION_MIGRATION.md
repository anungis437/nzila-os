# Webhook Verification Migration Guide

> Migrate from inline Svix HMAC verification to `@nzila/platform-auth`.

## Problem

Multiple apps hand-roll Svix HMAC-SHA256 verification for Clerk webhooks.
This creates security-critical code duplication and inconsistent timestamp
validation across the codebase.

## Solution

`@nzila/platform-auth` now exports a canonical webhook verification pipeline:

```ts
import { verifyClerkWebhook } from '@nzila/platform-auth'
```

## Migration Steps

### Before (inline)

```ts
import { createHmac } from 'crypto'

export async function POST(req: Request) {
  const body = await req.text()
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  // Hand-rolled HMAC verification...
  const secret = process.env.CLERK_WEBHOOK_SECRET!
  const sigBase = Buffer.from(secret.replace('whsec_', ''), 'base64')
  const content = `${svixId}.${svixTimestamp}.${body}`
  const expected = createHmac('sha256', sigBase).update(content).digest('base64')
  // ... timestamp checks, signature comparison, etc.
}
```

### After (shared utility)

```ts
import { verifyClerkWebhook } from '@nzila/platform-auth'

export async function POST(req: Request) {
  const body = await req.text()
  const result = verifyClerkWebhook(
    body,
    Object.fromEntries(req.headers.entries()),
    process.env.CLERK_WEBHOOK_SECRET!,
  )

  if (!result.verified) {
    return new Response(result.reason, { status: 401 })
  }

  const event = JSON.parse(body)
  // Handle event...
}
```

## What the Shared Utility Does

1. **Extracts Svix headers** (`svix-id`, `svix-timestamp`, `svix-signature`)
2. **Validates timestamp** (rejects requests older than 5 minutes — replay protection)
3. **Verifies HMAC-SHA256** against all signatures in the `svix-signature` header
4. **Returns typed result** — `{ verified: true }` or `{ verified: false, reason: string }`

## Contract Test Enforcement

`tooling/contract-tests/webhook-hygiene.test.ts` enforces:

- **WHK-001**: No inline `createHmac('sha256'` in webhook routes (migration warning)
- **WHK-002**: Clerk webhook handlers must validate timestamps
- **WHK-003**: `api-guards.ts` files should import from `@nzila/platform-auth`

## Apps to Migrate

| App | Webhook Route | Status |
|-----|--------------|--------|
| Zonga | `app/api/webhooks/clerk/route.ts` | Needs migration |
| Agrimo | `app/api/webhooks/clerk/route.ts` | Needs migration |
| Other apps | Various | Use `@nzila/platform-auth` for new webhook routes |
