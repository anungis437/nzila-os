# Cora Continuity Fidelity Contract

**Status:** Internal engineering metric for evidence completeness; not a public
score, provider ranking, assurance statement, or legal conclusion.

## Purpose

Continuity fidelity records whether explicit evidence exists for distinct
dimensions needed to interpret and carry an authorized source assertion.
Unknown or missing evidence does not count as complete.

## Dimensions

| Dimension                     | Meaning                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `semanticCompleteness`        | Evidence that the relevant source meaning is represented and mapping loss is visible.  |
| `provenanceCompleteness`      | Evidence linking source, source authority, acquisition route, and mapping.             |
| `identityCompleteness`        | Evidence supporting identity binding without silently resolving ambiguity.             |
| `relationshipCompleteness`    | Evidence for required parent/child or other domain relationships.                      |
| `temporalCompleteness`        | Evidence clarifying timestamp role, timezone, and relevant time scope.                 |
| `permissionCompleteness`      | Evidence that required actions are independently permitted for the data and recipient. |
| `sourceFreshnessCompleteness` | Evidence for freshness/currentness under the source's documented semantics.            |
| `rehydrationCompleteness`     | Evidence that the permitted package can be read and interpreted offline.               |

Each input dimension has an explicit state (`ESTABLISHED`, `PARTIAL`,
`UNRESOLVED`, or `NOT_PRESENT`), evidence references, and reasons. `ESTABLISHED`
requires at least one evidence reference. Unspecified dimensions are populated
as `UNRESOLVED`. The aggregate is `COMPLETE` only when every dimension is
established; otherwise it is `UNRESOLVED` if any dimension remains unresolved,
or `PARTIAL`.

## Limitations

- This is a completeness checklist, not a weighted numerical score.
- Evidence existence does not prove the evidence is legally sufficient, true,
  current, or accepted by an institution.
- A freshness-completeness state does not itself make source data current.
- Permission completeness is action-, purpose-, recipient-, and time-specific.
- Results from synthetic fixtures are synthetic proof only and are not provider
  runtime proof.
- Do not compare vendors or publish rankings from this metric.
