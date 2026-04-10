# Vodacom M-Pesa Integration — Technical Reference

## Overview

First-class Vodacom M-Pesa payment support via OpenAPI gateway.
Replaces the previous Flutterwave fallback routing for M-Pesa rails.

**Scope (v1):** C2B collection, transaction status query, reversal.
**Not in scope:** B2C payouts (requires separate Vodacom business agreement).

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌───────────────────┐
│  Zonga App       │    │ @nzila/zonga-payments │    │ OpenAPI Gateway   │
│                  │    │                      │    │ (Vodacom)         │
│ vodacom-mpesa.ts │───▸│ vodacom-mpesa.adapter│───▸│ /ipg/v2/...       │
│ (feature gate)   │    │ vodacom-mpesa.client │    │                   │
│                  │    │ vodacom-mpesa.types  │    │ RSA auth          │
└─────────────────┘    └──────────────────────┘    └───────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `packages/zonga-payments/src/adapters/vodacom-mpesa.types.ts` | Config, request/response types, error model, response codes |
| `packages/zonga-payments/src/adapters/vodacom-mpesa.client.ts` | RSA bearer token generation, HTTP client with AbortController |
| `packages/zonga-payments/src/adapters/vodacom-mpesa.adapter.ts` | `PaymentProviderAdapter` implementation |
| `packages/zonga-payments/src/adapters/vodacom-mpesa.test.ts` | 25 unit tests (auth, adapter lifecycle, error handling) |
| `apps/zonga/lib/vodacom-mpesa.ts` | Feature-gated adapter initialization |
| `apps/zonga/app/api/webhooks/mpesa/route.ts` | Callback route scaffold |

## Authentication

OpenAPI M-Pesa uses RSA public key encryption for auth:

1. Vodacom provides a **public key** (PEM or raw base64)
2. The **API key** is encrypted with RSA PKCS1 v1.5 padding
3. The ciphertext is base64-encoded and sent as `Bearer <token>`
4. The token is computed once at client creation (no expiry/refresh)

## Environment Variables

```bash
# Feature gate — must be "true" to enable
ZONGA_ENABLE_VODACOM_MPESA=true

# Required credentials
VODACOM_MPESA_API_KEY=your_api_key
VODACOM_MPESA_PUBLIC_KEY=your_rsa_public_key_pem
VODACOM_MPESA_SP_CODE=000000

# Optional
VODACOM_MPESA_MARKET=TZ          # TZ | MZ | LS | CD (default: TZ)
VODACOM_MPESA_BASE_URL=           # Defaults: sandbox in dev, production in prod
VODACOM_MPESA_CALLBACK_URL=       # For async notification delivery
```

## Markets & Currencies

| Market | Currency | Country |
|--------|----------|---------|
| TZ | TZS | Tanzania |
| MZ | MZN | Mozambique |
| LS | LSL | Lesotho |
| CD | CDF | DRC |

## Error Model

All M-Pesa errors throw `VodacomMpesaError` with:
- `responseCode` — OpenAPI error code (e.g. `INS-5`)
- `responseDesc` — Human-readable description
- `conversationId` — Correlation ID if available
- `isRetryable` — Whether the error is transient

Retryable codes: `INS-1` (internal), `INS-15` (timeout), `INS-996` (unavailable), `INS-997` (throttled).

## Payout Limitation

`createPayout()` throws `VodacomMpesaError` with code `UNSUPPORTED_OPERATION`.
B2C payouts require a separate business agreement with Vodacom and will be
implemented in a future version. In the meantime, use an alternative provider
(MTN MoMo, Airtel, or Stripe Connect) for payout routing.

## Webhook / Callback

The callback endpoint at `/api/webhooks/mpesa` accepts POST requests from the
OpenAPI gateway. Currently scaffolded — full persistence wiring will be
added when the payment intent repository is connected.

Callbacks include `output_ThirdPartyConversationID` as the correlation key
(matches the `idempotencyKey` from `createIntent`).
