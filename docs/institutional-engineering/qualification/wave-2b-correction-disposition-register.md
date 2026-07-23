# Wave 2B Correction Disposition Register

## Decision Boundary

This register governs the Edition 1.1 editorial-candidate workspace only. Recovered Edition 1.0 manuscripts remain immutable qualification baselines. A disposition authorizes no Nzila adoption, publication, standard, implementation, or external-validation claim.

| Correction ID | Severity confirmed | Affected source | Change characterization | Disposition | Rationale and dependencies |
| --- | --- | --- | --- | --- | --- |
| CORR-000-001 | S2 | IEBOK-0 §4 | Editorial version-metadata clarification | `ACCEPT_FOR_1.1` | Candidate metadata can adopt `1.1.0 (Editorial Candidate)` and explicitly preserve the 1.0 baseline without changing corpus substance. |
| CORR-000-002 | S1 | IEBOK-0 §§4-7 | Governance and evidence authority | `DEFER_TO_EXTERNAL_REVIEW` | Requires authorized corpus steward, approval authority, and evidence-threshold decision; see UM-004 and UM-QUAL-005. |
| CORR-I1-001 | S1 | I.1 §5 | Claim classification and evidence posture | `DEFER_TO_EXTERNAL_REVIEW` | Claim classification is recorded externally; changing principles requires evidence and expert review. |
| CORR-I1-002 | S1 | I.1 §9 | Lifecycle scope and validation method | `DEFER_TO_EXTERNAL_REVIEW` | Requires measures, reliability evaluation, longitudinal data, and counterexample review. |
| CORR-I1-003 | S1 | I.1 §§12-13 | Narrowing predictive and rate claims | `DEFER_TO_EXTERNAL_REVIEW` | Requires evidence review before any substantive wording change. |
| CORR-I2-001 | S0 | I.2 §4 | Architecture completeness boundary | `DEFER_TO_EXTERNAL_REVIEW` | Requires formal boundary, coverage method, and independent architectural assessment. |
| CORR-I2-002 | S1 | I.2 §6.2 | Evidence-generalization claim | `DEFER_TO_EXTERNAL_REVIEW` | Requires founding-case evidence and replication review. |
| CORR-I2-003 | S2 | I.2 §§6-11 | Informative/normative language clarification | `ACCEPT_FOR_1.1` | An editorial candidate notice can clarify that modal language is informative guidance until separately authorized as normative material; original section wording remains traceable. |
| CORR-I3-001 | S0 | I.3 §10.2 | Graph completeness and managedness claim | `DEFER_TO_EXTERNAL_REVIEW` | Requires ontology, scope, falsification, and technical-review decisions. |
| CORR-I3-002 | S1 | I.3 §§10-11 | Graph/twin technical specification | `DEFER_TO_EXTERNAL_REVIEW` | Requires schema, uncertainty, versioning, governance, and specialist review. |
| CORR-I3-003 | S1 | I.3 §11.3 | Simulation-readiness dependency | `DEFER_TO_LATER_VOLUME` | Depends on unavailable Mechanics and standards manuscripts, then systems-modeling review. |
| CORR-I3-004 | S1 | I.3 §12 | Dynamics and composite indicators | `DEFER_TO_EXTERNAL_REVIEW` | Requires a formal method, evidence plan, and systems-dynamics review. |

## Application Rule

Only `ACCEPT_FOR_1.1` entries may alter candidate manuscript wording. Every deferred item remains visible in the candidate change log and external-review package. No candidate edit promotes a claim classification or resolves a source baseline defect by implication.
