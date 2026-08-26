# IEBOK-QUAL-I.1: Institutional Engineering Qualification Record

| Field | Value |
| --- | --- |
| Document | IEBOK-I.1: Institutional Engineering |
| Edition and lifecycle | 1.0 (Working Draft); informative |
| Source baseline | `curl-link-hub (1).zip`, `src/docs/iebok/IEBOK-I-1-institutional-engineering.md` |
| Archive SHA-256 | `0CF60AE653C4664F7D26884DBF6F56A765F35598410C86A36E99D7584C66911E` |
| Manuscript SHA-256 | `BE892D93BA21CB14E9DC14D23713C87DD9ADB64753F7628C9F903FB3FF930A3D` |
| Fidelity result | Byte-identical to recovered source |
| Review baseline | Source manuscript, IEBOK-0, Wave 2A review |
| Qualification state | Recovered source reviewed; no approved-canon decision |
| Disposition | `QUALIFIED_WITH_CORRECTIONS` |

## Review Findings

| Dimension | Finding | Result |
| --- | --- | --- |
| Editorial | Purpose, scope, definitions, principles, lifecycle, and ethics are well organized. Multiple Part-level H1 headings are a source-formatting diagnostic, retained for fidelity. | Minor correction backlog |
| Technical | Definitions in §3 provide a usable baseline. Principles P1-P12 and lifecycle §9 are asserted without a stated validation method or bounds of applicability. | Material evidence work required |
| Architectural | The separation of durable institutional structure from replaceable components aligns with Volume II. The modernization method needs a fuller dependency mapping to Volume II and future applied guides. | Correction required |
| Evidence | Claims about observability before public failure (§12.1), lifecycle classification (§9.2), and modernization failure rates (§13.1) are not yet supported by a registered evidence base. | External evidence required |
| Terminology | Definitions are strong candidates for authority, but the glossary still contains provisional wording and does not yet cover all §3 terms. | Correction required |
| Originality and prior art | §1.2 names adjacent disciplines but provides no source map, inherited/adapted analysis, or prior-art review. | External review required |
| Cross-reference | References to IEBOK-II.MECH, IE-STD-001 through IE-STD-010, and Level VI are unresolved downstream dependencies. | Dependency recorded |

## Required Corrections and Unresolved Matters

- `CORR-I1-001` (S1): classify P1-P12 as principles, candidate propositions, or hypotheses with explicit evidence expectations.
- `CORR-I1-002` (S1): add a validation protocol and scope limits for the six-stage lifecycle model in §9.
- `CORR-I1-003` (S1): support or narrow the advance-observability claim in §12.1 and modernization-failure assertion in §13.1.
- `CORR-I1-004` (S2): replace downstream standards/science references with qualified references or explicitly mark them unavailable until ingested.
- `CORR-I1-005` (S3): resolve the source-formatting multiple-H1 diagnostic only through a separately authorized source edition.
- `UM-QUAL-I1-001`: establish external literature review for institutional theory, systems engineering, organizational memory, legitimacy, and modernization.

## Claims Requiring Evidence

The Foundations claim register classifies the discipline identity, P1-P12, lifecycle, conservation constraint, advance-observability, and reference-implementation claims. No principle in this document is empirically validated merely because it is declared.

## Prohibited Claims

Do not claim a validated lifecycle model, measured institutional mechanics, a complete discipline, a qualified reference implementation, or Nzila adoption from IEBOK-I.1.
