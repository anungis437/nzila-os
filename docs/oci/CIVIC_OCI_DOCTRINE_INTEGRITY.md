# CIVIC / OCI Doctrine Integrity Control

**Status:** implemented governance control

**Scope:** repository doctrine and CIVIC runtime authorization
**Baseline:** `e4602d3d02c650c19ae95299d9221e0b5caaada2`

This control detects material, deterministic drift in the boundary between CIVIC, CLEAR,
OCI, and OCRA. It does not interpret arbitrary prose, change the OCI method, or authorize a
CIVIC runtime.

## Authority map

| Concern                             | Current authority                                                                                                     | Machine authority before this control                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OCI method identity and phase spine | `docs/oci/OCI_METHOD.md`; `apps/union-eyes/lib/oci/frameworks/index.ts`                                               | `OCI_METHOD` is executable code                                                |
| OCRA relationship to OCI            | `docs/oci/CANON.md`; `docs/oci/OCI_METHOD.md`                                                                         | None                                                                           |
| CIVIC and CLEAR relationship to OCI | `docs/CIVIC_OCI_ALIGNMENT.md`; `docs/public-service/civic-thesis.md`; `docs/public-service/clear-method-canonical.md` | None                                                                           |
| Human institutional authority       | `docs/oci/OCI_AI_BOUNDARY.md`; `docs/public-service/human-review-and-evidence-principles.md`                          | None specific to CIVIC / OCI                                                   |
| AI boundary                         | `docs/oci/OCI_AI_BOUNDARY.md`                                                                                         | General runtime AI controls exist, but no CIVIC / OCI doctrine-integrity check |
| Anti-surveillance boundary          | `docs/doctrine/ANTI_SURVEILLANCE_DOCTRINE.md`; `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`                           | General doctrine exists; no CIVIC / OCI non-regression check                   |
| CIVIC lifecycle and market posture  | `governance/portfolio/product-catalog.json`                                                                           | Portfolio schema, drift, and generated-artifact validators                     |
| CIVIC placeholder/runtime posture   | `apps/civic/README.md`; `packages/platform-contracts/src/registry.ts`                                                 | App-floor and control-manifest checks, but no runtime-introduction guard       |
| Historical scope                    | `docs/oci/SUPERSEDED.md`                                                                                              | Directory structure only                                                       |

`governance/portfolio/product-catalog.json` remains the only lifecycle and GTM authority. The
doctrine contract references that source; it does not copy its values.

## Gap audit

### Already deterministically enforced

- Portfolio catalog shape, app/catalog one-to-one mapping, generated portfolio surfaces, and
  platform-product drift.
- The executable five-phase OCI spine exposed as `OCI_METHOD`.
- General app control-manifest shape and repository architectural contract tests.

### Documented but not previously enforced

- CIVIC is a public-service front door to OCI, not an independent method or scoring system.
- CLEAR is the public-service articulation of OCI evidence discipline, not a competing method.
- OCRA is the Recognition-phase instrument inside OCI.
- Human review and institutional adoption remain authoritative.
- AI may assist but may not decide, issue authoritative findings, profile people, or turn
  unreviewed output into institutional output.
- Individual ranking, behavioural profiling, non-consensual inference, and ranked institutional
  comparison are prohibited; cross-institution aggregation is opt-in and privacy bounded.
- CIVIC runtime implementation is unauthorized while the explicit runtime authorization is false.

### Intentionally not machine-enforced

- Semantic interpretation of arbitrary prose.
- The full OCI methodology, facilitation practice, voice, pricing, or commercial design.
- Every numerical scoring weight or question-level contribution.
- Whether an institutional output is substantively correct, fair, or legally compliant.

The alignment document calls the scoring core frozen, but its detailed reference points into
`docs/oci/superseded/**`, while live scoring structures already exist in Union Eyes code. This
control therefore does not create another quantitative authority or modify Union Eyes. Existing
code and its own tests remain controlling for those structures.

## Enforcement model

The machine contract is `governance/foundations/civic-oci-doctrine.contract.json`. Every encoded
invariant carries an authority citation and a reason it must be machine-readable. The validator:

1. validates the contract and its fixed constitutional values;
2. verifies narrow, intentional anchors in current canonical documents;
3. reads CIVIC lifecycle posture directly from the portfolio catalog;
4. checks the declared first-touch surfaces only when that catalog describes CIVIC as pre-product;
5. rejects recognizable runtime capabilities under `apps/civic`, and runtime-bearing CIVIC aliases
   under any other `apps/**` path, while runtime authorization is false; and
6. ignores `docs/oci/superseded/**` and other undeclared material by construction.

The validator fails with invariant ID, artifact, authority, expected state, and observed state.
Run it locally with `pnpm exec tsx scripts/validate-civic-oci-doctrine.ts`. It is included in
`validate:doctrine` and exercised by the normal contract-test CI gate.

## Legitimate change process

A legitimate doctrine change updates the canonical doctrine first, then the contract and its
adversarial tests in the same reviewed change. A lifecycle change starts in the portfolio catalog.
Runtime authorization requires an explicit change to the contract plus the corresponding portfolio
and governance approvals; adding code to `apps/civic` does not authorize itself.

This control proves repository conformance to explicit invariants. It does not prove CIVIC product
readiness, deployment, operational fitness, market validation, or pilot authorization.
