# ICRA capability-email origin integrity — 2026-10-31

## Scope
Related frozen defect: `DEF-0B8-ICRA-EMAIL-RESULTS-SENDS-THE-BEARER-CAPABILITY-TO-ANY-TYPED-ADDRESS`. This is supplemental hardening of an existing engineering-implemented item, **not** a new defect-closure claim. The original opt-in sharing semantics and capability checks remain unchanged.

## Source correction
`apps/union-eyes/lib/icra/email-results-origin.ts` requires a configured canonical HTTPS origin for production links. Missing, non-HTTPS, credential-bearing, path-bearing, query-bearing or fragment-bearing configuration is refused. The request Host header is never a production fallback. Development fallback is restricted to loopback origins. `apps/union-eyes/app/api/icra/email-results/route.ts` returns HTTP 503 without sending email if the origin cannot be trusted.

## Regression evidence authored
- `apps/union-eyes/lib/icra/__tests__/email-results-origin.test.ts`: production configuration requirement, Host poisoning, unsafe URL variants, loopback-only development fallback.
- `apps/union-eyes/app/api/__tests__/icra-email-results.route.test.ts`: production refusal without configuration and canonical HTTPS link construction independent of request Host.

## Qualification boundary
Source changes and tests are committed; executable test results, exact-HEAD full Vitest/contract, native PG15/16, real HTTP/browser and staging verification must be established separately. Do not mark this defect CLOSED, credit independent review, or alter frozen Gate 0 artifacts. Configure `NEXT_PUBLIC_APP_URL` to the institution-approved HTTPS origin before deployment. Institutional approval of sharing disclosure and recipient policy remains outstanding.
