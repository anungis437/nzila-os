# UNION EYES FINAL READINESS MATRIX

Date: 2026-04-23
Scope: Union Eyes pilot-to-production gate
Method: Repo + Azure runtime + live URL validation

## Executive Verdict

- Pilot readiness: PASS WITH CONDITIONS
- Production readiness: FAIL

Critical reason for production FAIL:

- Staging hostnames are live but currently resolve to a production-configured runtime (`/api/version` returns `environment: production` on staging domains).

## Dimension Scoring

| Dimension | Score | Evidence | Blocking issue | Remediation |
|---|---|---|---|---|
| 1. Core functionality | PASS WITH CONDITIONS | Large route and API surface under `apps/union-eyes/app` and `apps/union-eyes/app/api`; health and version endpoints live | Very broad surface area is not fully end-to-end proven in this pass | Keep pilot scope constrained to validated workflows; add route-level smoke suite for critical paths |
| 2. Auth & access | PASS WITH CONDITIONS | `@nzila/platform-auth` routes for policy, invite, magic-link, MFA; org auth middleware and RBAC checks present | Not all auth policy combinations were runtime-tested in this pass | Add policy matrix tests for local/magic-link/SSO combinations |
| 3. Data & DB | PASS WITH CONDITIONS | Consolidated domain schema exports (`apps/union-eyes/db/schema/index.ts`), Drizzle migrator wrapper, Django migrations in backend | No direct production DB introspection in this audit | Execute DB parity SQL checks in staging/prod and attach evidence artifact |
| 4. Infrastructure | PASS WITH CONDITIONS | Azure ARG shows `nzila-os-union-eyes` running in Canada Central; ingress and custom domains configured | Only one Union Eyes app currently visible (no separate staging app) | Deploy/verify dedicated staging app and keep separate runtime metadata |
| 5. Domains / TLS | PASS WITH CONDITIONS | All required domains return HTTP 200 and have SNI bindings | Staging and production hostnames currently hit production-configured surface | Rebind staging domains to staging app hostname and enforce env checks in deploy gate |
| 6. Third-party integrations | PASS WITH CONDITIONS | Integrations in code and config for Resend, Entra, Azure OpenAI/Whisper, Stripe, Twilio, HubSpot, Sentry, Redis/Upstash | Many integrations are configurable but not fully proven live end-to-end | Maintain explicit integration register with owner, status, fallback, and live proof links |
| 7. AI / GPT | PASS WITH CONDITIONS | Central AI client (`@nzila/ai-sdk`), advisory output contract in AI routes, voice transcription via Azure OpenAI Whisper | AI feature guard exists but not universally enforced by all AI endpoints | Apply mandatory AI guard wrapper to all AI-exposed routes |
| 8. Mobile UX | PASS WITH CONDITIONS | Dedicated mobile layout and pages (`/[locale]/mobile`, `/[locale]/mobile/claims`) respond 200 in live runtime | No full authenticated mobile UX walkthrough executed in this audit | Add mobile Playwright suite for login, claims list/detail, core dashboard tasks |
| 9. Security / audit | PASS WITH CONDITIONS | Audit/auth structures present; health endpoints and role-protected routes implemented | Audit integrity guarantees differ by flow; no single compliance proof pack generated here | Publish a security evidence pack per release (auth events, audit events, backup checks) |
| 10. Marketing accuracy | PASS WITH CONDITIONS | Trust and AI marketing copy updated to remove hard unsupported absolutes | Slogan was not consistently embedded previously | Enforce copy lint/checklist and include approved slogan lines in commercial assets |
| 11. Pilot readiness | PASS WITH CONDITIONS | Core routes/auth/health are live; pilot-facing flows available | Topology ambiguity (staging/prod) and incomplete integration proofs remain | Run pilot with strict scope and preflight checklist completion |
| 12. Production readiness | FAIL | Runtime topology drift and incomplete proof artifacts | Staging/prod boundary not cleanly verifiable today | Complete topology split + proof checks + production gate signoff |

## Proven Runtime Facts (This Audit)

- Domains checked: `unioneyes.app`, `www.unioneyes.app`, `app.unioneyes.app`, `staging.unioneyes.app`, `staging-app.unioneyes.app`.
- All above returned HTTP 200.
- `/api/health` returned HTTP 200 on production and staging hostnames.
- `/api/version` returned `environment: production` on both production and staging hostnames at audit time.

## Readiness Decision

- Safe to pilot: Yes, with explicit conditions and constrained blast radius.
- Safe to production: No, until topology and proof gaps below are resolved.

## Required Before Production

1. Dedicated staging app/runtime confirmed and separated from production hostnames.
2. Deploy gate asserts staging hostnames return `surfaceEnvironment=staging` and production hostnames return `surfaceEnvironment=production`.
3. DB parity and migration-state evidence captured for target production database.
4. Integration live-proof checklist completed for all pilot-critical dependencies.
5. Mobile critical flow test pack green.
