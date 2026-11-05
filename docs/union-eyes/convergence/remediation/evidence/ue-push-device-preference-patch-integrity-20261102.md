# Union Eyes — push-device preference PATCH validation (2026-11-02)

**Disposition: SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED.** No defect closure, release decision or staging authorization is claimed.

## Baseline

Starting branch HEAD: `e580eb19b3a4cc522efea7b1ce95026c1f6ef490`. All six substantive GitHub Actions workflows plus governance attestation passed at that exact SHA: App Floor Check, full regression, security regression, native PostgreSQL acceptance, disposable HTTP/browser acceptance, and runtime governance. These results do not qualify the new source.

The push-device collection POST validated TIME, timezone, boolean and bounded metadata before insertion, but the owner's `PATCH /api/mobile/devices/[id]` route only applied a writable-fields allowlist. It did not validate preference values. Malformed TIME values could reach PostgreSQL, and invalid timezone or preference types could be persisted or fail as database errors, affecting notification quiet hours.

## Engineering correction

1. Extracted the existing create-side preference checks into `push-device-preferences.ts`, preserving validation on POST.
2. Wired the same strict validation into the owner-scoped item route's `beforeUpdate` hook. The CRUD factory still enforces tenant, owner, writable-fields, protected token and audited mutation boundaries.
3. Added adversarial regression cases for invalid hours/minutes, ambiguous or injected time values, unknown and oversized timezones, nonboolean/null enabled, overlong metadata and non-string metadata. Tests inspect the real item-route configuration and ensure malformed updates are refused before the write. Positive cases preserve valid preferences, nullable clears and input immutability.

## Proof boundary and remaining obligations

Source-level changes and tests are committed. Exact-HEAD whole Vitest/contract, native PostgreSQL 15/16, security and HTTP/browser acceptance are required; this evidence file does not claim those tests passed. The tests are mocked route-wiring and pure-validation checks, not native tenant or HTTP proof. Further device-table convergence, delivery provider integration and mobile end-to-end registration/disable/remove journeys remain open. All 777 frozen defects, the 150-item priority index, 111 capabilities and every persona journey remain in scope.

**Defect completion credit: 0. CLOSED credit: 0.** Gate 0C.4 independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding.
