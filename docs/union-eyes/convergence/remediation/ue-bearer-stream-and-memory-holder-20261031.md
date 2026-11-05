# Union Eyes Gate 0 — bearer-body and memory-holder hardening (2026-10-31)

Disposition: **SOURCE_PATCHED / QUALIFICATION_PENDING / NO_GO**.

Scope: the frozen defect `DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID-OF-AN-UNCLAIMED-WORKBOOK-WITH-NO-LIMIT-AND-NO-AUDIT`, plus a shared public-intake streaming safety correction. No frozen classification or ratification was changed.

## Committed engineering work

- `300b5fff83014ae924d35703bd294af17d428aeb`: `guardPublicIntake` reads bounded chunks from the request stream instead of buffering an unbounded body through `request.text()`. The declared length is still checked first; the streamed actual byte count is authoritative.
- `79013ddfef3c6788297cec45e338dc79368f98e4`: the memory-holder item PATCH and DELETE routes now invoke the shared capability limiter before authorization/database access. PATCH also enforces the shared byte cap and JSON parsing; DELETE never reads a body.
- `2028d1d0f68e7bdb43e7545518ee3598514097e0`: behavioral tests cover actual-size refusal without `Request.text()`, streamed oversize early refusal and split UTF-8 decoding.
- `15b0254b35d8d5ebb2e8f722998bab075c6f9769`: source contract requires guards on both item mutations. This supersedes a corrected assertion in `7a12127c58fbb1a621ea17890d4fef4e3bd3fde1`.

## Remaining and acceptance gates

The defect remains **PARTIAL**, not CLOSED. A per-workbook memory-holder count ceiling, appropriate audit of unclaimed-workbook reads, and stronger protection for bearer identifiers still require design, implementation and acceptance. The shared rate-limit configuration remains dependent on correctly trusted edge headers and a functioning Redis service; production fails closed when the limiter is unavailable.

The new behavioral and contract tests were **committed but have not been reported as executed** at the time this record was written. Verify on the exact final SHA using focused and complete Vitest/contract, native PostgreSQL 15/16 with RLS, disposable HTTP/browser and staging acceptance. Preserve the 777-defect provenance and obtain independent reviewer, owner-persona and institutional authority decisions separately. No synthetic success, CLOSED disposition or GO decision is asserted.
