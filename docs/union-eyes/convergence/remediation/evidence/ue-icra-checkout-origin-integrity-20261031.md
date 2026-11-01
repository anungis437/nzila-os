# ICRA checkout return-origin integrity — 2026-10-31

Frozen defect: `DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED` (PARTIAL). This work addresses the return-origin portion only; authoritative displayed-price parity with Stripe Price IDs remains unproven.

The checkout route now uses the same canonical-origin validator as ICRA capability-email links. Production requires an explicit HTTPS origin, without credentials, path, query or fragment. Unsafe configuration returns 503 before creating a Stripe checkout session. Local loopback fallback is development-only. Adversarial tests cover unsafe production origins and both Stripe return URLs.

Files:
- `apps/union-eyes/app/api/icra/checkout/route.ts`
- `apps/union-eyes/app/api/__tests__/icra-checkout.route.test.ts`
- `apps/union-eyes/lib/icra/email-results-origin.ts`

Source changes and regression tests have been committed, but exact-HEAD executable tests, real PG15/16, HTTP/browser, Stripe sandbox acceptance, actual price/entitlement parity and independent institutional qualification remain outstanding. Do not change the frozen register or mark the defect CLOSED.
