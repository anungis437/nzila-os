# UE education session meeting URL access boundary — 2026-11-02

- Baseline HEAD: `45a8233dd322d925e3966aca8713aacc02e55d5a`; target: `agents/ue-cursor-final-closure`.
- Scope: `DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS` and the same route's meeting-URL disclosure surface.
- Finding: the generic course-session collection redacted `virtualMeetingAccessCode` for members but returned `virtualMeetingUrl` at the member floor. URLs can themselves embed meeting tokens, passwords, or invite secrets. Hiding only the access-code column is insufficient.
- Source correction: `virtualMeetingUrl` and `virtualMeetingAccessCode` are now staff-only projections, resolved using authenticated tenant role. Missing/unresolved role fails closed. `sessionBudget` and `actualCost` remain unconditionally omitted, including for staff, pending a separately issued financial disclosure mandate.
- Regression: the F07 route contract requires both access fields to be staff-only; CRUD response-projection tests verify token and code are absent for members and unresolved roles, staff retains meeting access, financial amounts remain absent for all callers, and persisted input remains untouched.
- Journey debt: this protects confidentiality but is **not** a complete member attendance journey. Implement a registration- and tenant-scoped join endpoint for enrolled members, with enrollment and timing checks and no broad catalogue disclosure. Do not fabricate a join link or mark the journey complete.
- Qualification: source-level changes and authored tests only. Exact-HEAD complete Vitest/contract, real PostgreSQL 15/16, disposable HTTP/browser, staging, independent reviewer, owner-persona and institutional decisions are **not** attested by this record.
- Credit: **0** new corrected/closed defect credit. The frozen 777-defect source register and 150-item release-debt index are unchanged. No independent ratification or production GO.
