# Union Eyes Gate 0 — pension trustee meeting calendar integrity

Date: 2026-11-02. Branch: `agents/ue-cursor-final-closure`.
Source baseline: `1609a8edeb0ffab86bab10e958bbf1d415869efc`.
Source commits: `add5300730c541d2a0a2f98a8a8c9446638981ca`, `9e6ea9e176003dcef8b03d46a23ffb2aa5aa9c34`.
Regression commit: `ec9a4a37c4b4abee3ccc96d77f731413b8cd78a9`.

## Defect and correction

The confidential trustee-meeting scheduling endpoint used `z.coerce.date()` on a caller-supplied value. That coercion accepted numeric and boolean representations and could normalize impossible calendar dates instead of refusing them, while timestamps without an explicit timezone depended on parsing assumptions. A meeting could therefore be scheduled at an instant the caller did not authorize. The prior role floor, authenticated tenant context, atomic audit and prohibition on unsupported minutes amendments remain in place.

The endpoint now accepts an actual ISO calendar date (interpreted at UTC midnight) or a timezone-qualified ISO timestamp with seconds. It rejects impossible dates, invalid time fields, out-of-range UTC offsets, timezone-free timestamps, non-string values and trailing input. Its successful database write continues to occur inside the authenticated tenant transaction with the mandatory audit.

## Adversarial regression

`apps/union-eyes/app/api/__tests__/pension-trustee-meeting-confidentiality.route.test.ts` now covers February 29 in a non-leap year, February 30, April 31, month 13, invalid 24-hour time, ambiguous local timestamp, offsets beyond UTC+14, extra text, numeric/boolean/null input, and absence of database or audit access after invalid input. Positive tests cover a leap day and an explicit -05:00 offset preserving the intended UTC instant.

## Qualification and provenance

At the source baseline `1609a8edeb0ffab86bab10e958bbf1d415869efc`, seven substantive GitHub Actions workflows were observed successful: App Floor Check, governance attestation, security regression, native PostgreSQL acceptance, full regression, and disposable HTTP/browser acceptance (six named workflows; Dependabot was skipped). Those results are **not** attributed to this correction.

Exact-new-HEAD focused Vitest, complete Vitest/contract, native PG15/16, disposable HTTP/browser, deployed staging and stakeholder acceptance remain to be established by workflow results. No independently verified runtime outcome or institutional trustee mandate is asserted.

This is additional source-level integrity evidence associated with the pension trustee meeting journey and the frozen `DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER` family. It does not claim to close that original confidentiality defect or to resolve trustee appointment, reader policy, minutes attestation or the independent Gate 0C.4 decisions. Defect-completion credit: **0**. CLOSED credit: **0**. Overall GO: **NO**.
