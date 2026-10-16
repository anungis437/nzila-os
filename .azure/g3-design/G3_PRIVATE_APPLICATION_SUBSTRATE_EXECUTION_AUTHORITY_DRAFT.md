# G3_PRIVATE_APPLICATION_SUBSTRATE_EXECUTION_AUTHORITY

**DRAFT / NOT APPROVED / NOT EXECUTABLE**.
Mission `NZ-20261008-INFRA-001`.
Maintainer authority currently permits design only.

## Selected purpose

Prove [the selected private synthetic application substrate](G3_PRIVATE_APPLICATION_SUBSTRATE_DESIGN.md):
new internal ACA workload-profiles environment / Consumption, dedicated app
identity, runnable digest-bound synthetic image, governed config and private
synthetic Key Vault secret, health/negative proofs, bounded owned teardown.
No product workload, production data/secret, database, external AI, customer
traffic, DNS cutover, full operations, DR or production readiness.

## Preconditions that must be populated before approval

| Binding | Present state |
|---|---|
| Governance decision | [G3 design selected](G3_GOVERNANCE_DECISION.md); technical execution NO |
| G2 dependency | Terminal PASS; five roots and terminal seal preserved; fresh future baseline required |
| Source/worktree/commit/hash map | Inventory recorded; G3 executable sources NOT IMPLEMENTED |
| Bicep/API/parameter hashes | NOT IMPLEMENTED / NOT VALIDATED |
| Artifact manifest/config/executable/layer digests | NOT BUILT / NOT RESOLVED |
| New runtime/build/probe UAMI contracts | Proposed exact names; actual IDs and grants NOT PROVISIONED |
| Operator/approver principal/custom action/role GUID map | NOT RESOLVED; no default staging/production principal |
| Private guest input delivery/toolchain/bootstrap | NOT PROVEN; no package/internet fallback |
| New ACR connection/role delta | Design enumerated; NOT APPROVED |
| Region/quota/collision/dependency/schema checks | NOT EXECUTED |
| Full retail cost and spending ceiling | Partial priced subtotal only; UNPRICED ITEMS BLOCK APPROVAL |
| Egress service-tag breadth acceptance | REQUIRED; no inferred risk acceptance |
| Provider/raw what-if and official preparation/validation | NOT RUN; design is not deploy validation |
| External observer and exact safe request contract | NOT SELECTED |
| Teardown/revocation recovery bounds | Design documented; final controller/ownership assertions unproven |
| Exact transaction deployment names and resolved child manifest | MUST BE BOUND by approved phased packet |
| Maintainer approval identity/date/authority checksum | ABSENT |

## Proposed execution limits (not authorization)

- One named transaction; no automatic retry or second artifact attempt.
- Two local network-isolated reproducibility runs before any remote write.
- At most one new G3 image push and one final manifest commit after strict
  validation; no import, target public bypass or product workflow dispatch.
- At most one creation of each enumerated resource and one CSE execution on
  each new build/probe VM. App create/configure/verify phases must be separately
  bounded; restart/recovery is not implicitly unlimited.
- One app, one healthy active revision, 0.25 vCPU / 0.5GiB, max one replica.
  No production-size profile or extra region.
- Explicit revocation of only the new app secret-reader assignment; authorize
  either one exact restoration or teardown, not adaptive role repair.
- Controller aborts on digest mismatch, privilege/network drift, foreign
  collision, public fallback, unapproved what-if, timeout or cost overrun.
- Failure cleanup may remove only proven transaction-created resources and
  newly authorized roles/connections. No G2 artifact/source/evidence cleanup.
- Image/metadata evidence retained; KV soft-delete/tombstone disclosed, no purge.

## Allowed-delta review to be signed

New G3 resources in `nzila-shared-test-g3-001-rg` plus only the named additive
G3 ACR connection, three repository-conditioned assignments and
`g3-synthetic-app` image in the existing private registry.

No original G2 identity/RBAC/network/DNS/VM/resource overwrite, no change to
ACR public access Disabled/bypass None/admin disabled, no G2 authority replay.
Original protected 16-resource invariant is reconciled against the explicit
temporary new connection metadata, then restored on teardown. Do not pretend
an added ACR connection leaves its full ARM body byte-identical.

## Evidence and adjudication

Produce every runtime acceptance field from design section 10, exact DNS/
TLS/SNI/HTTP traces without credential-bearing URLs/headers, scoped direct/
inherited authorization censuses, resource manifests, sanitized telemetry,
secret revocation evidence, owned teardown ledger and residual register.

Runtime inability is FAIL, not a reason to weaken roles/public networking.
G3 PASS is possible only after measurable runtime proof under a **new signed
authority**. It does not grant product rollout even if every proof passes.

```text
STAGE3_DESIGN_AUTHORIZED = YES
STAGE3_TECHNICAL_EXECUTION_AUTHORIZED = NO
APPLICATION_ROLLOUT_AUTHORIZED = NO
PRODUCTION_DATA_AUTHORIZED = NO
G3_PRIVATE_APPLICATION_SUBSTRATE = NOT_EXECUTED
UE_INFRA = INFRA_NO_GO
CORA_INFRA = INFRA_NO_GO
```
