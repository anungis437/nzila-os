# IEBOK-QUAL-I.2: Institutional Architecture Qualification Record

| Field | Value |
| --- | --- |
| Document | IEBOK-I.2: Institutional Architecture |
| Edition and lifecycle | 1.0 (Working Draft); informative |
| Source baseline | `curl-link-hub (1).zip`, `src/docs/iebok/IEBOK-I-2-institutional-architecture.md` |
| Archive SHA-256 | `0CF60AE653C4664F7D26884DBF6F56A765F35598410C86A36E99D7584C66911E` |
| Manuscript SHA-256 | `23A07042C02CDDF5BB1EDA4478BCA4DFDA0099F15CBB7CF01387D4C1CF83EB5A` |
| Fidelity result | Byte-identical to recovered source |
| Review baseline | Source manuscript, IEBOK-0, IEBOK-I.1, Wave 2A review |
| Qualification state | Recovered source reviewed; no approved-canon decision |
| Disposition | `QUALIFIED_WITH_CORRECTIONS` |

## Review Findings

| Dimension | Finding | Result |
| --- | --- | --- |
| Editorial | Seven domains, viewpoints, patterns, and anti-patterns are presented coherently. Several future standards are referenced before their availability. | Correction required |
| Technical | The seven-domain completeness claim (§4), three-state rule (§6.2), and dual-carrier rule (§7.2) need stated scope, exception criteria, and empirical support. | Material evidence work required |
| Architectural | Operating model and durable/current separation form a coherent design frame. The “complete for engineering purposes” assertion needs a falsifiable completeness test. | Correction required |
| Evidence | The founding implementation proof and generalization in §6.2 are single-case claims at most; no evidence package is present. | External evidence required |
| Terminology | “Institutional operating model,” “authority register,” “decision record,” “reference architecture,” and “reference implementation” need authority records. | Correction required |
| Originality and prior art | Enterprise architecture, capability planning, governance, architecture viewpoints, patterns, and digital-twin precedent require comparative review. | External review required |
| Cross-reference | Citations to IEBOK-II.MECH and IE-STD-002/004/005/006/007/008/009 precede their availability; §7.3 calls a future standard normative inside an informative volume. | Material consistency defect |

## Required Corrections and Unresolved Matters

- `CORR-I2-001` (S1): bound and test the seven-domain completeness claim in §4.
- `CORR-I2-002` (S1): substantiate or relabel the proof/generalization statement for the three-state discipline in §6.2.
- `CORR-I2-003` (S2): distinguish advisory design rules from requirements in this informative working draft, especially §§6.2, 7.2, 9.2, and 11.2.
- `CORR-I2-004` (S2): remove or qualify unavailable standards as dependencies; do not describe their provisions as normative before qualification.
- `CORR-I2-005` (S1): establish external prior-art analysis for capability architecture, governance architecture, architecture viewpoints, pattern languages, and reference architectures.
- `UM-QUAL-I2-001`: establish the reference implementation evidence needed for any reference architecture qualification.

## Claims Requiring Evidence

The claim register records the seven-domain frame, durable/current separation, three-state gate, dual-carrier knowledge, reference architecture, and graph/twin dependencies. The volume supplies source assertions, not validation results.

## Prohibited Claims

Do not represent the seven domains as complete, three-state gates as universally proven, a design as a validated reference architecture, or any stated `IE-STD` content as an adopted or published standard.
