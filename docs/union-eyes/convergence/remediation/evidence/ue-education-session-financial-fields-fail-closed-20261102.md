# Union Eyes Gate 0 — education financial fields fail closed (2026-11-02)

Baseline: `8fe69cff1bdafc45d6e48d1abd613ddaf30918ba`. Supersedes the financial-field access assumption in `ue-education-session-staff-projection-20261102.md`, without deleting that historical engineering evidence. Scope: `DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS`.

The generic CRUD role resolver identifies steward-or-higher staff, but this is **not** an issued financial-disclosure mandate. Exposing `sessionBudget` and `actualCost` on that basis would widen confidential financial access without institutional authority. The route therefore uses `staffOnlyResponseFields` only for `virtualMeetingAccessCode` and retains unconditional `omitFromResponse` for the two financial fields, on collection, item and mutation responses. The source contract enforces this conservative split. Finance-specific visibility remains a visible, unresolved workflow obligation; it must not be represented as completed.

Verification at this commit: source edits and regression assertions authored. Full Vitest/contract, native PostgreSQL 15/16, real HTTP/browser/staging and independent authority acceptance are not claimed. No changes to frozen 777-defect evidence and zero CLOSED credit.
