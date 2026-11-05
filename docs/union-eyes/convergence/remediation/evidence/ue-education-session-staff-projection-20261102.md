# Union Eyes Gate 0 — education session staff-only response projection (2026-11-02)

Baseline: `9f0118c06e289a0b6d5d368e5c451fb831357fd8`. Scope: `DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS`, one previously PARTIAL obligation in the frozen 777-defect corpus. No frozen artifact edited.

## Source correction

Generic CRUD previously applied one unconditional omit list to all roles. The education-session route therefore hid meeting access codes, session budgets and actual costs from members **and** authorized tenant staff, leaving the staff workflow unable to inspect those values. The new `staffOnlyResponseFields` option uses the existing organization-scoped role resolver. It hides these fields for members and on absent or failed role resolution, while allowing steward-or-higher members of the active organization to inspect them. All existing unconditional redactions (including analytics metadata) remain effective. The projection is applied consistently to collection reads, item reads, create responses, update responses and deletion/archive responses. Collection role resolution occurs once per page, not once per record. The stored database row is not mutated.

## Evidence and limitations

Authored adversarial unit tests exercise member redaction, unresolved-role redaction, authorized staff projection, unconditional-redaction precedence, analytics metadata and immutability. The F07 source contract now requires the staff-only projection rather than unconditional suppression. These are authored tests, not a claimed exact-HEAD pass. Full Vitest/contract, native PostgreSQL 15/16, HTTP/browser with real identities, staging and independent institutional authorization remain unqualified. This does not resolve all education-session defects, approve a financial mandate or award independent CLOSED credit.
