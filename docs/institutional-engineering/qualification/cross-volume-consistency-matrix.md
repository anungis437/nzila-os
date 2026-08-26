# Foundations Cross-Volume Consistency Matrix

| ID | Check | Source locations | Finding | Severity | Required action |
| --- | --- | --- | --- | --- | --- |
| XVC-001 | Definition continuity | I.1 §3; I.2 §§3, 5-11; I.3 §§3, 6, 8, 10-11 | Foundation definitions are generally reused consistently; I.3 adds unregistered terms including service, carrier, dependency, and observatory. | S2 | Register terms and define scope. |
| XVC-002 | Pre-definition usage | I.1 §4; I.2 §§5, 7; I.3 §§5-6, 9, 12 | Mechanics quantities `rho`, `H`, `kappa`, and `omega` are used before IEBOK-II.MECH is available. | S1 | Keep as proposals or defer use until Mechanics is qualified. |
| XVC-003 | Informative versus normative language | I.1 §§14; I.2 §§6.2, 7.2, 9.2, 11.2; I.3 §11.3 | Informative drafts use `shall`, `must`, and “normatively” without a qualified standard boundary. | S2 | State advisory status or publish separately authorized requirements. |
| XVC-004 | Completeness claims | I.2 §4; I.3 §10.2 | Seven domains and graph are both claimed complete for engineering purposes; neither provides a boundary or coverage test. | S0 | Define model boundary, counterexamples, and independent assessment. |
| XVC-005 | Reference implementation | IEBOK-0 §7; I.1 §1.3; I.2 §11; I.3 §9.3 | Founding implementation is invoked as proof/canonical treatment without a scoped evidence package. | S1 | Create qualified reference-case evidence or downgrade assertions. |
| XVC-006 | Standards dependency | I.1 Cross References; I.2 §§7.3, 9.3, 13.2; I.3 front matter and Cross References | Unavailable `IE-STD` series is cited as normative expression and source of specifications. | S1 | Preserve as dependencies; do not imply availability or normativity. |
| XVC-007 | Architecture-system relation | I.2 §9.3; I.3 §§10-11 | I.2 depends on graph/twin constructs that I.3 has not technically qualified. | S1 | Treat graph/twin as candidate constructs pending external review. |
| XVC-008 | Lifecycle claims | IEBOK-0 §4; I.1 §9 | Document lifecycle and institutional lifecycle use related but separate concepts without an explicit disambiguation. | S3 | Add terminology distinction in future editorial revision. |
| XVC-009 | Evidence and unknown handling | I.1 P7-P8; I.2 §6.2; I.3 §8 | Consistent candidate three-state rule, but its scope varies from gates to all evidence consumers. | S2 | Define domain-specific limits and exception handling. |
| XVC-010 | Canonical language | IEBOK-0; I.2 §9.3; I.3 §§10-11 | “Canonical” is used for source corpus, graph, and treatment with different authority meanings. | S2 | Define “canonical” by lifecycle and object type. |

## Outcome

The volumes form a coherent candidate foundation package, but the unresolved standards, mechanics, reference-case evidence, completeness claims, and normative-language mismatch prevent an approved-canon or implementation conclusion.
