# UE billing-cycle period boundary integrity — 2026-11-01

Status: SOURCE_CHANGED; exact-HEAD unit, native PG15/16, HTTP/browser and staging qualification pending. No independent closure or institutional financial mandate inferred.

## Finding
Both administrator billing-cycle execution and preview accepted arbitrary strings as period boundaries, normalized impossible calendar dates with JavaScript Date, silently discarded a single supplied boundary, and permitted reversed periods. Malformed JSON fell into the generic internal-error handler. This could generate charges for an unintended interval or misrepresent a preview.

## Source correction
A shared boundary parser accepts ISO calendar dates or complete timezone-qualified timestamps, rejects impossible dates, invalid offsets, ambiguous local timestamps, partial pairs and reversed periods. Both routes refuse invalid input with a validation error before generating charges, recording billing intent or producing a preview. Existing financial mandate checks and transactional billing controls remain unchanged. Malformed JSON is explicitly a validation error.

## Regression
Both route suites now cover impossible dates, reversed dates, partial pairs, ambiguous timestamps, invalid timezone offsets, leap-day success and malformed JSON. The tests use route mocks, not deployed database or HTTP/browser qualification.

## Gate impact
Cross-cutting data-integrity evidence for billing and financial journeys, without assigning a specific frozen defect ID or modifying frozen provenance. This evidence carries **zero defect-completion credit** and **zero CLOSED credit**. Native PostgreSQL, real application acceptance, exactly-once settlement, atomic audit, provider reconciliation and institutional approvals remain separate obligations.
