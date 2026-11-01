# UE location-policy packaged catalog parity — engineering evidence, not qualification

Date: 2026-11-01. Branch: `agents/ue-cursor-final-closure`.

## Existing defect and provenance

Continuation of `UE-LOCATION-CONFIG-READ-ONLY-PRIVILEGE-20261101` in `docs/union-eyes/convergence/remediation/elimination-batches.json`. Frozen Gate 0 source classifications (0b1–0b12, 0c1), the 777-defect population, and institutional decision records are unchanged. This correction does not create a new defect or count an existing defect as CLOSED.

## Root cause and source correction

`db/rls-storage-authority/reference-latent.ts` already restricts the global singleton `location_tracking_config` to runtime SELECT only. However, the separately packaged, digest-bound admission contract `lib/operations/catalog-authority-contract.json` still declared runtime SELECT and INSERT. That mismatch caused the whole-application contract test to fail and left a stale write-capable grant declaration in the packaged contract. The packaged payload now declares SELECT only, and its SHA-256 digest was recalculated from the exact serialized payload. No INSERT grant was added. A focused regression assertion in `lib/operations/catalog-authority-contract.test.ts` now requires the canonical and packaged declarations to agree on read-only runtime and no system privileges.

Source commits: `3b58b0592d5a2c78b7f25041647b5098a2c13a9d` (contract and digest), `a2292cb681419079542cf691fff6831c8c4151ac` (adversarial regression).

## Verification boundaries

Source: contract parsed, previous digest independently recomputed and matched, replacement digest computed over the updated payload, source file and regression test committed. Unit: not yet qualified at exact HEAD. Native PG15/16: not qualified. HTTP/browser/staging: not qualified. Institutional reviewer, owner-persona and tracking-policy authority: outstanding.

The previous CI baseline `bb1b76633612a85714ecce4f20ea901e2ba75a2b` failed full application regression with a catalog-authority contract mismatch. It also failed native PG15/16 and HTTP/browser bootstrap because migration 0048 and 0049 SECURITY DEFINER functions were executable by runtime principals. This change does **not** fix or bypass that preflight. The catalog safety rejection must remain active until a separately reviewed least-privilege SQL architecture is implemented and natively proven.

Credit: engineering source change only; defect implementation credit 0, qualification credit 0, CLOSED credit 0. No release promotion or institutional ratification.
