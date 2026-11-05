# Union Eyes Gate 0 — Social OAuth callback ambiguity and publishing identity

Date: 2026-11-01. Branch: `agents/ue-cursor-final-closure`.

Original defect lineage: `DEF-0B11-SOC-OAUTH-CALLBACK-IS-A-GET-THAT-INSERTS-THE-CREDENTIAL-CLEARS-ITS-COOKIES-BEFORE-VALIDATION-AND-AUDITS-AFTER-COMMIT-TO-A-LOG-LINE` and `DEF-0B11-SOC-STEWARD-CONNECTS-THE-ORGANIZATION-PUBLISHING-IDENTITY-WITH-ADMIN-LEVEL-SCOPES-AND-PICKS-THE-FIRST-PAGE-AUTOMATICALLY`.

## Source correction

The OAuth callback rejects repeated `state`, `code` or `error` parameters and contradictory `code` + `error` results before consuming any pending OAuth cookies or contacting a provider. A forged callback cannot cancel a legitimate pending connection by exploiting different parameter interpretations.

LinkedIn publishing identity connection no longer chooses the first administered organization returned by the provider. Exactly one organization must be returned; zero and multiple organizations refuse the connection without storing credentials. Multiple-page selection requires a separately authorized user journey rather than a silent default. The existing Facebook multi-page refusal and single-page flows are preserved.

## Authored regression evidence

- `apps/union-eyes/lib/social-media/__tests__/oauth-callback-safety.test.ts` tests duplicate authority parameters, contradictory provider results, legitimate redirects, zero/one/multiple LinkedIn pages and source wiring.
- `apps/union-eyes/app/api/social-media/accounts/callback/route.ts` invokes both guards before any credential persistence.

## Qualification limits

Source correction and tests authored; exact-HEAD focused Vitest, whole application/contract regression, native PG15/16, production-build HTTP/browser, real provider callback and staging acceptance have **not** been established for this change. No completion credit or independent CLOSED status is claimed. The LinkedIn multi-page selection journey remains unavailable until an approved explicit-selection flow exists. The 777 original defect records and frozen qualification artifacts are unchanged. Independent reviewer, owner-persona and institutional release decisions remain outstanding.
