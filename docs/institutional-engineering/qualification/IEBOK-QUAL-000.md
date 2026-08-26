# IEBOK-QUAL-000: Series Charter Qualification Record

| Field | Value |
| --- | --- |
| Document | IEBOK-0: Series Charter and Editorial Conventions |
| Edition and lifecycle | 1.0 (Working Draft); informative |
| Source baseline | `curl-link-hub (1).zip`, `src/docs/iebok/IEBOK-SERIES-CHARTER.md` |
| Archive SHA-256 | `0CF60AE653C4664F7D26884DBF6F56A765F35598410C86A36E99D7584C66911E` |
| Manuscript SHA-256 | `63FB2DC716B831546FB5B36EC021B4DE1AD24D49496825D8B7D45010F9A6ADFA` |
| Fidelity result | Byte-identical to recovered source |
| Review baseline | Source manuscript, Wave 1 provenance, Wave 2A review |
| Qualification state | Recovered source reviewed; no approved-canon decision |
| Disposition | `QUALIFIED_WITH_CORRECTIONS` |

## Review Findings

| Dimension | Finding | Result |
| --- | --- | --- |
| Editorial | Clear series purpose, level taxonomy, citation scheme, and lifecycle intent. Edition notation (`1.0`) does not yet satisfy the stated MAJOR.MINOR.PATCH convention. | Correction required |
| Technical | The Charter properly distinguishes informative and normative material, but it does not define a testable route from a working draft to a standard. | Correction required |
| Architectural | The six-level corpus taxonomy is coherent. Level II “Institutional Sciences” is corpus taxonomy, not the NzilaOS delivery roadmap. | Pass with clarification retained externally |
| Evidence | The Seed Corpus and first reference implementation are historical assertions requiring indexed evidence before use beyond source attribution. | External evidence required |
| Terminology | “Seed Corpus,” “reference implementation,” “published,” and “approved” require registered definitions and lifecycle boundaries. | Correction required |
| Originality and prior art | The Charter makes no comparative literature map for its editorial model, standards lifecycle, or reference-implementation concept. | External review required |
| Cross-reference | `IEBOK-II.MECH` and `IE-STD-004` are cited although their source manuscripts are not part of Wave 2A. | Dependency recorded |

## Required Corrections and Unresolved Matters

- `CORR-000-001` (S2): reconcile the edition label with the semantic-versioning rule or state an explicit transition rule.
- `CORR-000-002` (S1): define evidence thresholds and decision authority for lifecycle advancement; the existing lifecycle names alone do not qualify a document.
- `CORR-000-003` (S2): qualify or replace references to unavailable Level II and Level V artifacts before treating the cross-reference scheme as complete.
- `UM-QUAL-000-001`: establish an authorized corpus steward and approval body.
- `UM-QUAL-000-002`: record the Seed Corpus document set and its evidence relationship to the Charter's historical statements.

## Claims Requiring Evidence

The historical origin in a national sport federation, the accountability of literature to working implementations, and the usability of the reference-implementation model require evidence beyond this Charter. They are recorded in the Foundations claim register and must not be represented as validated by this qualification record.

## Prohibited Claims

Do not call IEBOK-0 an approved canon, standard, externally reviewed publication, or governing Nzila doctrine. Do not infer that a Level II item is ready for ingestion or that a Level V identifier is a published standard.
