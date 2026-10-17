# Cora Evidence Foundation

**Status:** foundation contracts and schema drafted; not wired to the Cora
application and not deployed.

## Scope

**V3 qualification:** this foundation's consent port and reference/hash-only
tables are a bounded implementation contract, not universal consent or
attestations-only doctrine. The [binding ADR alignment](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md)
permits lawfully carrying minimized certificates/documents without Cora
becoming their issuer. Actual authority paths are case-specific. Existing
service checks and payload restrictions remain in force until separately
authorized implementation changes; none is made by this doctrine sync.

This phase establishes a Cora-owned persistence seam for evidence metadata
and conclusions without implementing a product workflow. It does not authorize
the Cora application to write data, change the current read-only contract, or
transfer ownership of Agrimo records.

Ownership follows [ADR-AGRI-002](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md)
and the [Cora domain ownership matrix](CORA_DOMAIN_OWNERSHIP_MATRIX.md), with
the current implementation baseline recorded in the
[seam audit](CORA_IMPLEMENTATION_SEAM_AUDIT.md).

The foundation is intentionally limited to:

- Portable evidence and conclusion draft contracts, including source
  references, purpose and consent references, temporal scope, confidence,
  data-quality dimensions, provenance references, and content hashes.
- A service boundary that derives organization and actor scope from the
  canonical `OrgContext`, requires the explicit
  `cora:evidence:write` permission, checks consent for the requested purpose
  and Cora recipient, and requires passing audited policy evaluations before
  persistence.
- Cora-owned tables for evidence metadata, conclusions, and conclusion-to-
  evidence references. Composite tenant-scoped foreign keys bind conclusion
  references to the evidence payload hash, and methodology references identify
  the exact shared version and definition hash.
- A forward-only migration artifact at
  `packages/db/drizzle/0039_cora_evidence_foundation.sql`. It has **not** been
  applied; it is picked up by the numbered platform migration runner only
  when that runner is explicitly invoked under its migration governance.

Source payloads are not copied into the Cora tables. Evidence records retain
source references and hashes, and may refer to a sealed evidence-pack
artifact. Provenance remains a reference to the shared provenance authority.

## Ownership and shared methodology

Cora owns only its evidence metadata, conclusions, and their associations.
NzilaOS/shared owns the generic immutable methodology-version registry in
`platform_methodology_versions`. A methodology authority publishes a new
version rather than mutating an existing one; Cora records reference the
authority, methodology, version, registry ID, and definition hash.

The legacy tables `agri_forecasts`, `agri_price_signals`, and
`agri_risk_scores` remain ownership-unresolved. This foundation does not
reclassify or write those tables. Agrimo operational records remain
Agrimo-owned.

## Not wired / limitations

- No Cora route, UI, job, or application permission grants
  `cora:evidence:write`; the application remains read-only.
- No concrete persistence adapter is implemented. The service persistence
  port requires the adapter to atomically persist the record and its canonical
  audit event; an adapter must not use a success-shaped fallback if auditing
  fails.
- Consent and policy integrations are required ports, not deployed adapters.
  Consent must resolve current purpose/recipient authorization and revocation
  through the canonical authority. Policy evaluation must be canonical,
  audited, and match the requested actor, organization, action, resource, and
  environment.
- The shared methodology registry schema is a data contract, not a publisher
  workflow or a grant of authority to Cora to create or change methodology.
- The migration has not been applied, and no claim is made about deployed
  database grants, RLS, or production readiness.

Do not wire product behavior or apply the migration as part of this foundation
alone. Before enabling a workflow, separately authorize the application
permission and adapter, verify the migration process and deployed database
grants/RLS, and test the tenant, audit, consent, and policy boundaries.
