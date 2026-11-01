# Gate 0 B100 — truthful onboarding lookups and benchmark availability

Defect: `DEF-0B9-ASM-ONBOARDING-LOOKUP-LIBRARY-SWALLOWS-EVERY-FAILURE-INTO-AN-EMPTY-SUCCESS-RESPONSE`.

Source: `apps/union-eyes/lib/utils/smart-onboarding.ts`. Unit coverage: `apps/union-eyes/lib/__tests__/smart-onboarding.test.ts`.

The federation, clause, peer and benchmark lookup helpers no longer catch database failures and return an indistinguishable empty successful result. Missing organizations throw, while legitimate empty result sets remain empty. The orchestration layer already propagates errors. The national benchmark adapter no longer supplies invented static values or substitutes a local peer average for a national average. An unavailable CLC measurement is `null`; a peer set with no positive measured member counts produces no percentile or average.

Engineering status: IMPLEMENTED_PENDING_QUALIFICATION. No executable Vitest/contract, PostgreSQL 15/16, HTTP/browser or staging proof is claimed by this document. Existing source-level clause suggestion authorization and provenance concerns are separate defects and remain open; this batch does not resolve them.

Follow-up: cached values must be finite non-negative numbers; CLC integration requires an explicitly configured HTTPS endpoint and key, not a guessed hostname; missing peer counts do not produce NaN. Unit cases were added. Completion and qualification counts are unchanged.
