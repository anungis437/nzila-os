# 2026 Evidence Gap Register

Purpose: track unresolved evidence weaknesses discovered during provenance hardening for A1 and A5.

Scope:
- Advancement A1 (Confidence-Aware Institutional Measurement)
- Advancement A5 (Institutional Knowledge Architecture)

| Gap ID | Advancement | Affected Evidence Item | Weakness | Mitigation | Priority | Owner | Status |
|---|---|---|---|---|---|---|---|
| GAP-A5-001 | A5 | apps/union-eyes/config/continuity-ontology-matrix.json (commit dc36ef6d7) | Provenance currently anchored to broad checkpoint introduction commit; no narrower origin found in local history. | Search remote PR metadata and pre-checkpoint branches/tags for precursor artifact lineage; if unavailable, retain with checkpoint notation and corroborate using adjacent narrow commits/tests. | High | Technical Lead | Open |
| GAP-A5-002 | A5 | apps/union-eyes/reports/ontology-antipattern-inventory.json (commit dc36ef6d7) | Generated artifact introduced in broad checkpoint commit; narrow generation commit not present locally. | Reconstruct generator-run provenance by correlating script history, report timestamps, and any CI artifacts; store corroboration in knowledge-architecture evidence index. | High | Technical Lead | Open |
| GAP-A1-001 | A1 | Multiple A1 evidence commits without explicit PR ids in commit metadata | PR linkage missing for most A1 rows, reducing review-trace convenience. | Add PR references from remote hosting metadata (if available); until then keep explicit note: not found in local metadata. | Medium | Technical Lead | Open |
| GAP-A5-003 | A5 | Multiple A5 evidence commits without explicit PR ids in commit metadata | PR linkage missing for most A5 rows. | Add PR references from remote hosting metadata (if available); maintain current provenance confidence notes. | Medium | Technical Lead | Open |

## Notes
- This register does not expand claim scope.
- Gaps are quality-of-proof gaps, not claim-theory gaps.
- Checkpoint provenance items remain usable with explicit notation and corroborating Tier 1/2 evidence, pending mitigation.
