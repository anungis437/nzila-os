# Nzila OS Documentation

This directory is the documentation entry point. Start here, then follow the audience path.

- **Curated index of current documentation:** [INDEX.md](INDEX.md)
- **Generated, exhaustive file listing:** [documentation-index.md](documentation-index.md)
  (`pnpm docs:index` — generated, do not hand-edit)
- **Historical / completed-programme material:**
  [categories/historical-archive/](categories/historical-archive/)
- **Which documents are current, historical, generated or validator-pinned:**
  [DOCUMENT_DISPOSITION.md](DOCUMENT_DISPOSITION.md)

## Reading order

1. [../README.md](../README.md) — what NzilaOS is, what it is not, commercial spine.
2. [../ARCHITECTURE.md](../ARCHITECTURE.md) — authority boundaries, capability ownership,
   machine-readable authorities.
3. Product truth — [union-eyes/README.md](union-eyes/README.md) (Union Eyes),
   [CIVIC_OCI_ALIGNMENT.md](CIVIC_OCI_ALIGNMENT.md) and [oci/README.md](oci/README.md) (CIVIC/OCI).
4. Builder docs — [categories/stakeholders/builders/](categories/stakeholders/builders/).
5. Operator docs — [categories/platform-and-operations/ops/](categories/platform-and-operations/ops/).
6. Security and governance — [../SECURITY.md](../SECURITY.md),
   [categories/platform-and-operations/governance/](categories/platform-and-operations/governance/).
7. Evidence and release — [proof-center/portfolio-proof-index.md](proof-center/portfolio-proof-index.md).
8. History — [categories/historical-archive/](categories/historical-archive/).

## High-level categories

- [Documentation Categories](categories/README.md)
- [Stakeholders](categories/stakeholders/README.md)
- [Platform and Operations](categories/platform-and-operations/README.md)
- [Products and Market](categories/products-and-market/README.md)
- [Historical Archive](categories/historical-archive/README.md)

## Frequently needed

- Platform overview: [What Is Nzila](categories/platform-and-operations/platform/what-is-nzila.md)
- Golden path for developers: [Golden Path Developer Guide](categories/stakeholders/how-to/GOLDEN_PATH_DEVELOPER_GUIDE.md)
- Runbooks: [../ops/runbooks/README.md](../ops/runbooks/README.md)
- Ownership registry: [ops/ownership-registry.md](ops/ownership-registry.md)
- Status authority model: [Status Authority Model](categories/platform-and-operations/platform/STATUS_AUTHORITY_MODEL.md)
- Procurement pack: [Procurement Pack](categories/platform-and-operations/governance/procurement-pack.md)
- Portfolio matrix (generated from `governance/portfolio/product-catalog.json`):
  [platform/portfolio-matrix.md](platform/portfolio-matrix.md)

## How to read status claims

- Portfolio tier, GTM posture and revenue status come from
  [../governance/portfolio/product-catalog.json](../governance/portfolio/product-catalog.json).
  Everything else portfolio-shaped is generated from it.
- A product having documentation, code, or a buyer pack does **not** make it a current
  commercial priority. Only Union Eyes and CIVIC are the active commercial spine.
- Readiness language (`DESIGN`, `IMPLEMENTED`, `TESTED`, `DEPLOYED`, `RUNTIME-VERIFIED`,
  `OPERATIONALLY PROVEN`) is load-bearing. Do not flatten it.
- Documents describing a finished programme or a past state carry a status banner and are not
  current authority.
