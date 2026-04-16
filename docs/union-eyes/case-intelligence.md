# Case Intelligence

## Architecture

Union Eyes case intelligence is an authorization-first pipeline layered onto the existing grievance and governed-document systems.

Flow:

1. Resolve case access and document access grants.
2. Filter unauthorized cases and documents before feature extraction.
3. Extract deterministic features.
4. Compute deterministic base score.
5. Apply optional ML reranking only to already-authorized candidates.
6. Build similar-case and precedent outputs with human-readable reasons.
7. Build an authorization-safe knowledge graph from the same authorized result set.

## Ranking Model

Deterministic weights:

- `sameCase`: 50
- `sameMember`: 30
- `sameAgreement`: 25
- `sameEmployer`: 20
- `sharedTags`: 15
- `sameType`: 10
- `recentAccess`: 10

ML reranking is optional and only adjusts already-authorized candidates:

- `finalScore = baseScore * 0.7 + mlScore * 0.3`
- if ML is unavailable or disabled, `finalScore = baseScore`

## Privacy Guarantees

- Unauthorized documents are filtered before ranking, feature extraction, ML, graph generation, or precedent matching.
- Unauthorized cases are filtered before similar-case detection returns any result.
- No vector database or external retrieval store is used.
- The same governance policy remains authoritative: document labels, explicit grants, and case access rules are enforced first.

## Explainability Rules

Every result returned by the intelligence API includes reasons.

Examples:

- `Directly linked to this case`
- `Same member`
- `Same agreement`
- `Used in similar case`
- `ML unavailable; deterministic fallback applied`

## Feature Flag

Primary feature flag:

- `case_intelligence_v1`

Operational behavior:

- deterministic ranking remains available as fallback
- ML reranking can be toggled independently with `FEATURE_CASE_INTELLIGENCE_V1_ML`
- pattern detection can be toggled independently with `FEATURE_CASE_INTELLIGENCE_V1_PATTERNS`

## Observability

Each ranked result logs:

- `caseId`
- candidate counts
- authorized counts
- `baseScore`
- `mlScore`
- `finalScore`
- reasons

Sensitive access to the intelligence endpoint is audited through the standard audit layer.

## Principle

Intelligence must never outrun governance.
