# Nzila OS — Research Whitepapers Registry

<!--
  ARTIFACT TYPE: Whitepaper Index / Registry
  DOCTRINE_VERSION: 1.0.0
  CHANGE CLASS: Standard — registry additions only.
  CANONICAL SOURCE: This file is self-governing.
  PURPOSE: Single citable registry of foundational research whitepapers ingested
           into Nzila OS doctrine. Downstream systems (narrative engines,
           marketing copy, OCRA report builder, grounded AI retrieval) should
           cite whitepapers via this registry, not via ad-hoc paths.
-->

This file lists every research whitepaper that has been ingested into Nzila OS as canonical doctrine. Each entry pairs the binary master (the originally authored PDF, preserved unchanged) with the canonized Markdown edition (the citable, indexable source of truth).

---

## Active Whitepapers

| ID | Title | Edition | Canonical Markdown | Binary Master | Ingested |
|---|---|---|---|---|---|
| `wp.continuity-gap.v3` | The Continuity Gap — Master Whitepaper | Evidence-Enhanced Canadian Edition v3.0 | [CONTINUITY_GAP_MASTER_WHITEPAPER.md](./CONTINUITY_GAP_MASTER_WHITEPAPER.md) | [apps/union-eyes/public/whitepapers/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf](../../../apps/union-eyes/public/whitepapers/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf) | 2026-05-22 |

---

## Registry Conventions

- **ID format**: `wp.<slug>.<version>` — stable across editions; bump version only when the canonical text materially changes.
- **Binary master is immutable**: never re-OCR or re-extract over the original PDF. Republish under a new version if the source is updated.
- **Canonical Markdown is the citable surface**: all downstream systems (narrative engine, marketing, OCRA reports, AI retrieval) cite the Markdown edition, not the PDF.
- **Registration**: machine-readable mirror lives at [whitepapers.registry.json](./whitepapers.registry.json) and is the source consumed by the platform-knowledge-registry seed loader and the docs index.

## Validation

- `pnpm exec tsx scripts/docs/build-docs-index.ts` auto-discovers entries under this folder.
- `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts` enforces link integrity (registry → MD → binary).
- Substantive changes to a canonized whitepaper follow the change process in [DOCTRINE_GOVERNANCE.md](../DOCTRINE_GOVERNANCE.md).
