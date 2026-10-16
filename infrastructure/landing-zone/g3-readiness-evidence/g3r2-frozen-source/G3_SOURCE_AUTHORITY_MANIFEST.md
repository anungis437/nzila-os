# Prospective G3 source authority V1

Lineage: **PROSPECTIVE_G3R2**. New local source, not recovered historical authority. Eight modules: network, identities, observability, vault, environment, internal-dns, workload, bindings. Root scope is subscription; all modules are resource-group scoped. Internal DNS is separated because its name depends on returned environment defaultDomain; identities and observability have independent lifecycles.

[Manifest](./G3_SOURCE_AUTHORITY_MANIFEST.json) binds source/contract hashes, module ownership, image review, BOM and exact build commands. [Parameter contract](./parameters.schema.json) distinguishes governed, human and post-create values; [example](./parameters.example.json) is local-only and contains no secret values. All provisioning/activation/RBAC flags are locked to false even at direct module entrypoints; future mutation needs a separately reviewed source/authority amendment.

G2-side peering, firewall, ACR DNS and registry bindings are [external dependencies](./EXTERNAL_G2_MUTATION_DEPENDENCIES.json), not hidden resources. G3-side peering is prospective source only.

The committed Go health source is copied byte-for-byte into [image-candidate](./image-candidate) as a **prospective review candidate**, not historical recovery. It is **BLOCKED**: no secret challenge observation and no pinned binary-production recipe for Docker's required health-server. No existing synthetic-health source was modified. A new source digest must bind a new future immutable manifest; the historical image digest is not recycled.

[Proof specifications](./proof/G3_PROOF_MANIFEST.json), [negative probes](./proof/G3_NEGATIVE_PROBES.json), [rollback DAG](./proof/G3_ROLLBACK_PLAN.json) and [reconciliation](./proof/G3_RECONCILIATION_PLAN.json) are local plans, never executed. The secret observer portion is explicitly incomplete, so ROOT-1 is not closed.

Generated [build artifacts](./build) prove local syntax/module closure only; they are not source authority or deployment permission. No image build, controller CLI execution, cloud validation or deployment occurred.
