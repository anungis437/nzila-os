# Union Eyes Gate 0 — ICRA Stripe price parity (source-level evidence)

Defect: `DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED` (PARTIAL; **not CLOSED**).

## Scope and repair

The public ICRA report gate advertises CAD $1,200 for the Leadership Briefing Report and CAD $6,500 for the Institutional Continuity Diagnostic. Previously, when `STRIPE_PRICE_ICRA_BRIEF` or `STRIPE_PRICE_ICRA_DIAGNOSTIC` was configured, the checkout endpoint passed that Price ID straight to Stripe without checking the actual price, currency, active state, or recurring status. An administrator could therefore accidentally sell a different amount or recurring product while the buyer saw the fixed published price.

The endpoint now retrieves a configured Stripe Price **before** creating the checkout session and requires the exact Price ID, active state, CAD currency, exact published amount in cents, one-time type and no recurring configuration. An unavailable or mismatched Price refuses checkout with HTTP 503 and creates no payable session. A non-CAD `STRIPE_DEFAULT_CURRENCY` also refuses checkout. When no Stripe Price ID is configured, the inline `price_data` is created at the published CAD amount. The verified Price ID is the only configured ID permitted in the session line item.

## Source and regression evidence

- `apps/union-eyes/app/api/icra/checkout/route.ts`: configured Price retrieval and fail-closed parity gate; verified-ID binding.
- `apps/union-eyes/app/api/__tests__/icra-checkout.route.test.ts`: cases for mismatched amount, currency, active state, recurring price, wrong ID, unknown amount, provider retrieval failure, valid CAD 6,500 diagnostic, inline CAD 1,200 and non-CAD default currency.
- Source commits: `4ba6e535dcee10c5389ab0702d97f9ff22c92257`, `c52e28953b58df2d53b3b297736a07a86693be43`, `e8f351a3a33e0b44d198756102c203f801ffa481`.

## Qualification boundaries

The code and tests are committed, **not independently accepted**. At this evidence-writing point exact-HEAD full Vitest/contract, native PostgreSQL 15/16, HTTP/browser, and real Stripe Price/session acceptance had not completed. A mocked Stripe Price test cannot establish live provider configuration, tax handling, public copy parity across locales, payment webhook settlement, or the institutional pricing decision. Existing frozen 777-defect provenance and prior ICRA canonical-origin evidence remain unchanged. No new implementation credit, qualification credit, or CLOSED disposition is claimed. Institutional reviewer, owner-persona and release-authority approvals remain outstanding.
