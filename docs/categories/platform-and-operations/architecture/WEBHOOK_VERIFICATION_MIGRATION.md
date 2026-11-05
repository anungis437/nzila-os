# Webhook Verification Migration Guide

> Retired. The identity provider (Clerk) is gone, and so is the shared Clerk webhook verifier this guide migrated apps to.

## What changed

- `@nzila/platform-auth` no longer exports `verifyClerkWebhook`, `verifyWebhook`, `verifySvixSignature`, `isSvixTimestampValid`, `extractSvixHeaders`, the `SvixHeaders` type, `resolveIdentityFromClerk` or `mapClerkOrgRole`, and its `./adapter` and `./clerk-adapter` subpaths are removed. Nothing in the repository imported them.
- Identity in Union Eyes and in the shared package is Microsoft Entra ID (`@nzila/platform-auth/entra`).
- Union Eyes keeps one deprecated Django route, `webhooks/clerk/`, as an alias that answers 401 unless `AUTH_WEBHOOK_SECRET` verifies the call, until the last sender is confirmed gone (UE-CONV-A-007).
- Agrimo still serves its own `app/api/webhooks/clerk/route.ts`; it carries its own Svix HMAC and timestamp check, since there is no shared verifier to call.

## Contract Test Enforcement

`tooling/contract-tests/webhook-hygiene.test.ts` enforces:

- **WHK-001**: every Clerk-named webhook route verifies the Svix signature itself
- **WHK-002**: every Clerk-named webhook route validates the timestamp
- **WHK-003**: `api-guards.ts` files should import from `@nzila/platform-auth`

`packages/platform-auth/src/identity-provider-residuals.test.ts` proves the retired exports and subpaths stay gone and that every remaining mention of the provider is classified.

## Webhooks from other senders

A webhook from another sender (Stripe, QuickBooks) verifies its own signature with that sender's documented scheme; none of it is shared with the retired Clerk path.
