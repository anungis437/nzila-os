# Architecture Shape — zonga

> Domain-core architecture status for the Zonga application.
> See: [APP_DOMAIN_CORE_STANDARD.md](../../../docs/architecture/APP_DOMAIN_CORE_STANDARD.md)

## Current Structure

- `lib/workflows/` — workflow definitions
- `lib/actions/` — server actions (18 modules)
- `lib/zonga-services.ts` — re-export façade wiring @nzila/zonga-core
- `lib/payout-machine.ts` — payout lifecycle state machine
- `lib/commerce-audit.ts` — audit integration
- `lib/governance.ts` — policy gates & guardrails
- `lib/guards/` — invariant enforcement (economic, rights, ticketing, governance)
- `lib/observability.ts` — event tracking facade
- `lib/evidence.ts` — governance evidence packs
- `lib/ai-client.ts` — AI integration
- `lib/ml-client.ts` — ML inference client
- `lib/offline.ts` — offline mode with USSD formatting
- `lib/plans.ts` — plan tiers & feature gates
- `lib/stripe.ts` — Stripe + Flutterwave payment integration
- `lib/platform-adapters/` — platform contract adapters
- `components/` — UI components
- `app/` — Next.js app router

## Package Architecture

Domain logic lives in dedicated packages under `packages/`:

| Package | Domain | Status |
|---------|--------|--------|
| `@nzila/zonga-core` | Types, schemas, enums, base services | **Complete** |
| `@nzila/zonga-economics` | Ledger, fees, splits, settlement | **Complete** |
| `@nzila/zonga-events` | Ticketing, capacity, check-in, event settlement | **Complete** |
| `@nzila/zonga-rights` | Agreements, royalties, disputes | **Complete** |
| `@nzila/zonga-payments` | Payment flow, wallet, payouts, provider adapters | **Complete** |
| `@nzila/zonga-growth` | Social graph, discovery, creator dashboard | **Complete** |
| `@nzila/zonga-intelligence` | Fraud, moderation, insights, recommendations | **Complete** |
| `@nzila/zonga-control-plane` | Workflow orchestrator, enforcers, invariants | **Complete** |

## Layer Status

| Layer | Status | Notes |
|-------|--------|-------|
| `domain/` | **In packages** | Types in @nzila/zonga-core, re-exported via zonga-services.ts |
| `services/` | **In packages** | Business logic in 8 domain packages |
| `workflows/` | **Present** | Workflow definitions + payout-machine.ts |
| `queries/` | **In actions** | Read logic in server actions |
| `events/` | **In packages** | Domain events in @nzila/zonga-control-plane |
| `ui/` | **Present** | components/ + app/ |

## Remaining Gaps

1. `platform-adapters/index.ts` needs real typed exports
2. Pricing tiers need launch-grade monetization model
3. Payout orchestrator needs single execution path
4. Event economics needs fee model variants
