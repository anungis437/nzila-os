# 29 - Recording Package V1 Handoff Baseline

## Status

`LIUNA_RECORDING_PACKAGE = V1_HANDOFF_BASELINE`
`NOT_CLIENT_VALIDATED`
`NOT_FINAL_TAKE`

This file freezes the recording script and shot list at their current state as an internal handoff baseline. It is not a LiUNA-facing final take. It must not be published, shared externally, or characterized as "the LiUNA video" in any material.

## What Is Frozen

- `10-recording-script-and-shot-list.md` at commit `00eecd522` (branch `liuna/continuation-post-gate-13` off `perf/gha-phase-4-critical-path-analysis`).
- `09-pre-video-synthetic-scenario.md` at the same commit.
- `11-pre-video-claim-lock.md` at the same commit.
- The synthetic fixture set enumerated in `30-synthetic-fixtures-manifest.md` and instantiated in `31-synthetic-fixtures-v1.json`.

## What Freeze Means

- No content edits to the three source files above should be made in this branch except to correct an outright factual error or a claim-lock violation.
- Any language change requested by discovery, marketing, or partner review must be applied in a new file (`33-recording-package-vNEXT-diff.md`) and reconciled after the OCI workshop.
- The frozen script may be rehearsed and recorded internally as a proof-of-flow rehearsal only; the resulting take is `INTERNAL_REHEARSAL_ONLY` and must be labeled as such at file-name and metadata level.

## Explicit Disclaimers Required On Every Distributed Copy

- Union Eyes synthetic scenario. Not LIUNA production data.
- Does not imply LIUNA endorsement, procurement, deployment, or legal certification.
- Fixtures are synthetic and deterministic; see `30-synthetic-fixtures-manifest.md`.
- AI segments are advisory only, human-reviewed, and audit-referenced.
- Bilingual segments are safe framing only; not proof of full bilingual production UI readiness.
- Mobile segments cover a targeted route set only; not proof of full mobile product readiness.

## Rehearsal Preconditions

Before any internal rehearsal take is captured, the operator MUST verify:

1. Local Union Eyes runtime is seeded from `31-synthetic-fixtures-v1.json` only.
2. No production identity is signed in. Rehearsal identities are the synthetic-org identities listed in the fixtures manifest.
3. Screen recording metadata carries the `INTERNAL_REHEARSAL_ONLY` marker.
4. The current readiness ledger is open in a second window and cross-referenced by the operator during the rehearsal.
5. Every claim spoken in the take corresponds to a still-standing "Proven Behavior" row in a gate proof file. Any claim without a matching row is cut before the take is saved.

## Post-Workshop Reconciliation

After the OCI workshop:

1. Compare the workshop vocabulary delta to the language in `10-recording-script-and-shot-list.md`.
2. Every term the workshop reclassified from `SYNTHETIC_WORKING_TERM` to `CLIENT_VALIDATED` may be adopted; every term left provisional must remain flagged in the script margins as provisional.
3. Only then may a `vNEXT` script be prepared.
4. `V1_HANDOFF_BASELINE` is retained in the pack for provenance.

## Prohibited Post-Freeze Actions

- Publishing the V1 take outside the internal team.
- Renaming the V1 take to remove the `INTERNAL_REHEARSAL_ONLY` marker.
- Substituting non-synthetic assets (real logos, real names, real matters) for the fixtures.
- Editing the frozen files in-place after the freeze commit without a corresponding entry in the vNEXT diff file.
