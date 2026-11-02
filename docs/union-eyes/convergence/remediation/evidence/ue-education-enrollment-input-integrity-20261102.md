# Union Eyes — education enrollment input-integrity correction (2026-11-02)

**Source commit:** `25d1c653616548edbcdfcc6dfc5726d55b505868` on `agents/ue-cursor-final-closure` (starting baseline `869599f5f820bcfe5bf0a0e33862f7fa0645cda9`).

## Root cause and correction
The course-registration create hook previously discarded unauthorized client-supplied payment, waiver, completion, status and member assertions while returning a successful registration. Optional logistical fields were coerced to false and long notes silently truncated. That could mislead members about payment or waiver status and mask malformed requests. The generic factory was not configured with an enrollment-specific writable-field allowlist.

The registration route now permits only `courseId`, `sessionId`, `travelRequired`, `travelSubsidyRequested`, `accommodationRequired`, and `notes`. The factory rejects other client fields before the create hook. The hook independently refuses unexpected fields and mismatched organization/creator values, strictly validates supplied boolean preferences, and rejects non-text or overlong notes rather than truncating them. The server still determines member identity, fee snapshot, registration status, completion and financial fields, and verifies organization/course/session/capacity.

## Regression evidence authored
`apps/union-eyes/app/api/education/registrations/__tests__/route.test.ts` asserts the exact writable-field allowlist; rejects attempts to supply member, payment, waiver, completion, certification, approval, fee and unknown fields before database access; refuses mismatched tenant/creator assertions and malformed optional fields; and retains a positive paid-course enrollment with legitimate logistical preferences.

## Qualification boundary
Source and tests are committed, but authored tests are **not** independent execution evidence. Exact-HEAD full Vitest/contract, security, PostgreSQL 15/16, disposable HTTP/browser and staging results must be read separately. Existing CI success on the prior HEAD does not qualify this correction. This is a source-level engineering entry, not a defect closure, financial mandate, institutional sign-off, or complete end-to-end member journey. The original 777-defect register and frozen Gate 0 artifacts remain untouched.
