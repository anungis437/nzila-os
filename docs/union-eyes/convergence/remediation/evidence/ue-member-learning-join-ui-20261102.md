# Member education portal and governed virtual joining — source evidence (2026-11-02)

Branch: `agents/ue-cursor-final-closure`. Baseline: `cfe4d16e6adaec5f54a1a87af8b722a7446e6616`.

## Engineering correction

The registration-scoped audited join endpoint existed, but the member-facing My Courses portal had no invocation path. Its view model expected snake_case and joined course/session fields while the CRUD API returns camelCase registration rows. The existing UI displayed inert View Details, Cancel, Renew, Certificate and Catalogue buttons; some successful API responses could therefore look like an empty dashboard.

Added `components/education/MemberSessionJoin.tsx`: joining details are requested only after an explicit member action using same-origin credentials and no-store fetch. The component validates the success envelope, exact requested session identity and HTTPS URL before displaying a link with noreferrer/noopener and no referrer. It never persists credentials and clears them when the session changes. Rejections use a generic message without exposing URL tokens. The server remains the sole authority for tenant, owner, registration, approval, session dates and atomic disclosure audit.

The My Courses portal now normalizes camelCase registrations/completions, obtains course/session labels from the existing tenant-scoped catalogue, presents registrations without valid schedule metadata rather than silently hiding them, and connects active registrations to the governed joining component. Inert actions were replaced with available real links or explicit unavailability messaging. No payment, cancellation, certification or mandate is invented.

## Regression and limitations

Authored adversarial jsdom component tests at `apps/union-eyes/components/education/__tests__/MemberSessionJoin.test.tsx` for no premature disclosure, exact session binding, no-store request, unsafe URL refusal, failed responses, missing session identity and credential clearing.

This is source-level evidence only. Exact-HEAD unit/contract, native PostgreSQL 15/16, real HTTP/browser, and staging acceptance have not been independently established for these changes. The catalogue joins may be incomplete when paginated; the UI explicitly falls back to unavailable labels and must not assert full course enrichment. Cancellation, renewal and certificate authorization remain distinct journeys. Do not award defect completion or CLOSED credit. The frozen 777-defect provenance and Gate 0C.4 institutional approvals remain untouched.
