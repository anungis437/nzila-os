# Runtime Attestation Visibility System

> **Status:** Canonical governance operations · **Layer:** Attestation surface · **Inherits:** [live-runtime-attestation-generation.md](../nzila-runtime-integration/live-runtime-attestation-generation.md)

## 1. Objective

Expose runtime attestations as first-class governance artifacts that operators, executives, auditors, and procurement observers can read directly.

## 2. Required surfaces

| Surface | What it shows |
|---|---|
| Release attestation viewer | Release identity + verdict + cited evidence |
| Deployment legitimacy attestation viewer | Environment + release + isolation invariants |
| Environment attestation viewer | Environment class + manifest hash + topology verdict |
| Pilot legitimacy attestation viewer | Pilot scope + isolation invariants |
| Doctrine compliance attestation viewer | Cited doctrine documents + policy versions |
| AI governance attestation viewer | Capability registry state + categorical refusals applied |

## 3. Required panels

- **Attestation viewer** — single attestation, calm layout, content hash + cited evidence reachable in one click.
- **Release lineage explorer** — chronological list of attestations for a release.
- **Evidence linkage view** — cross-references from one attestation to its cited evidence records.
- **Attestation validity panel** — verdict (`verified` / `partial` / `rejected`) with one-sentence interpretation.
- **Environment integrity summary** — environment identity vs. manifest, banded.

## 4. Posture

Attestations MUST feel:

- **Governance-grade**, not technical-debug artifacts.
- **Citable** — every viewer can be linked to externally for review.
- **Append-only** — supersession history is visible; mutation is impossible.
- **Calm** — no urgency framing for routine attestations.

## 5. Access

Viewers honor the access classes set at write time (`platform-only` / `governance-forum` / `product-team` / `external-attestation`). The viewer itself never relaxes access; relaxation requires a supersession.

## 6. Discipline

Attestations exist so the institution can **prove** governance, not perform it. A viewer that buries the verdict, decorates with effects, or surfaces engineering jargon defeats the purpose. The attestation surface is procurement-grade or it is failure.
