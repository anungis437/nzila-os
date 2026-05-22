# The OCI Method™

**ARTIFACT TYPE:** Doctrine
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical

The OCI Method™ is the methodological spine of Operational Continuity
Intelligence. It names the five phases an institution moves through when it
takes its continuity seriously, and it binds each phase to a product layer.
The Method is the IP that survives any single product, any single feature,
and any single engagement.

## The five phases

| Phase | Name | What happens | OCI product layer |
|---|---|---|---|
| 1 | **Recognition** | The institution sees the shape of its continuity for the first time. Continuity becomes visible, named, and discussable. | P1 — OCRA |
| 2 | **Mapping** | The institution maps its continuity terrain — its memory holders, its governance lineage, its breakpoints, its modernization alignment. | P2 — Governance Entropy Workbook™ |
| 3 | **Stabilization** | The institution reduces continuity burden where it is most fragile. Stewardship density is broadened. Lineage is recorded. | P3 — OCI Diagnostic |
| 4 | **Infrastructure** | Continuity becomes embedded in the institution's operational systems. It is no longer a project; it is the platform. | P4 — OCI Runtime Infrastructure |
| 5 | **Intelligence** | The institution joins a network of institutions whose anonymized continuity intelligence informs sector practice, governance norms, and longitudinal benchmarking. | P5 — OCI Intelligence Network |

## Why the Method matters

The Method is not a brochure. It is the structural commitment that:

- gives the product ladder narrative coherence,
- gives training, certification, and workshop curricula a canonical shape,
- gives procurement officers a category to buy against,
- gives consulting engagements a defensible methodology,
- gives the doctrine defensibility against imitation.

Any future training, facilitation certification, workshop series, public
education campaign, or sector partnership must trace itself back to one of
these five phases.

## How the Method appears in code

The Method is exported from `apps/union-eyes/lib/oci/frameworks/index.ts` as
`OCI_METHOD`, a typed constant. Any product surface, PDF export, or
educational artifact that references a phase must consume this constant —
never re-state the phases inline. This guarantees that if the doctrine
evolves, the propagation is automatic.

## Phase posture (institutional voice)

Each phase has a voice that surfaces and copy must respect:

- **Recognition** — calm, awakening, non-coercive. *"Begin to see what your
  institution is carrying."*
- **Mapping** — fieldwork, editorial, dignified. *"Map the people, the
  lineage, and the breakpoints."*
- **Stabilization** — facilitative, collegial, reductive. *"Reduce
  continuity burden where it is most fragile."*
- **Infrastructure** — embedded, structural, durable. *"Continuity becomes
  how the institution operates."*
- **Intelligence** — longitudinal, anonymized, sector-aware. *"Learn from
  continuity at the level of the field."*

Never use productivity, urgency, alert, dashboard, or compliance language to
describe any phase.

## Cross-references

- [OCI Product Ladder](./oci-product-ladder.md)
- [`apps/union-eyes/lib/oci/frameworks/index.ts`](../../apps/union-eyes/lib/oci/frameworks/index.ts) — `OCI_METHOD` constant
