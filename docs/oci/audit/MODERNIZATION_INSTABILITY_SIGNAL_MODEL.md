# Modernization Instability Signal Model

**Status**: v1.2.0-foundation
**Authority**: Canonical signal model for modernization-fragility extraction. Initial confidence-marker shipped in v1.2.0; structural complements scheduled for v1.3.0 per `QUESTION_POOL_v2_0_ROADMAP.md`.

---

## Doctrine

Modernization is *not* synonymous with maturation. Many institutions modernize platforms and processes in ways that *erode* institutional continuity — silent workflow replacement, shadow operational systems, undocumented platform migrations. The v1.x question pool did not separate "modernization happened" from "modernization preserved continuity".

This model encodes the signals that distinguish *continuity-preserving* modernization from *continuity-eroding* modernization.

---

## Signal Themes

| Theme | Description | Detected Through |
| --- | --- | --- |
| **Ownership ambiguity** | Modernized platforms lack a clear, durable institutional owner. | `evidence_strength` on platform ownership (v1.3.0) |
| **Platform migration dependency** | Continuity practice depends on a vendor or platform contract that may not survive. | `dependency_mapping` from operational nodes to platform nodes (v1.3.0) |
| **Undocumented workflow replacement** | A workflow has been replaced by a modernized version without documentation of what changed. | `contradiction_pair` between "modernized" and "documented change" (v1.3.0) |
| **Shadow operational systems** | Modernization is bypassed in practice via informal spreadsheets, scripts, or side channels. | `confidence_marker` on modernization adherence (v1.3.0) |
| **Digital continuity fragmentation** | Continuity records exist across systems that don't reconcile. | `topology_mapping` over digital-system continuity centrality (v1.3.0) |
| **Modernization onboarding burden** | New leaders must learn an unstable modernization layer alongside institutional context. | `contradiction_pair` between "modernized" and "onboarding survivability" (v1.3.0) |
| **Continuity debt accumulation** | Modernization debt grows faster than it is paid down. | `stability_marker` over modernization cycles (v1.3.0) |
| **Modernization trust erosion** | Stakeholders report eroding trust in modernized operations. | `confidence_marker` (`v2_cm_modernization_uncertainty`, **shipped v1.2.0**) |

---

## v1.2.0-Foundation Coverage

Only the **modernization trust erosion** theme is directly covered in v1.2.0 by `v2_cm_modernization_uncertainty` and the `modernization_fragility_path` adaptive route. The remaining seven themes are scheduled additions in v1.3.0; the routing path is already defined so they will activate automatically once the questions land.

This staging ensures the foundation lands without partially-extracting modernization signals that would otherwise mislead reviewers.

---

## Anti-Claims

- No theme infers vendor reliability, individual decision quality, or political alignment.
- All signals operate over institutional *practice* — not over staff intent or capability.
- Modernization-fragility extraction is **never** used to recommend specific vendors or platforms.
