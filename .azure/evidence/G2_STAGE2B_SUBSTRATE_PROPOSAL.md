# Stage 2B runtime-only proof substrate — proposal, not authority

Mission: `NZ-20261008-INFRA-001`. No Stage 2B resource or workload execution.
Stage 2A failed before inventory; this comparison is preparatory only.

## Required isolation

Attach **only** the existing runtime UAMI to the selected proof compute.
Never attach it to the builder or swap builder identity. Preserve exact
`synthetic-health` Reader condition without new write roles. Keep Canadian
residency, private ACR/DNS, governed egress, no public origin/admin access,
token-free results and bounded cleanup. A denied request must be authenticated
as runtime identity and reach ACR; token acquisition failure alone is not
write-denial proof. No product workload or real data.

## Options

| Option | Identity/private-network boundary | Incremental capacity | Dependencies and limits |
|---|---|---|---|
| Dedicated ephemeral runtime-proof VM | Separate VM/NIC, runtime UAMI only; private subnet and ACR DNS; short first-boot proof with no builder privileges | Small burstable VM plus disk, purchased for proof duration only; explicit cleanup required | New VM/NIC/disk authority and exact retained/deletion semantics; no reused Stage 1 lifecycle. Pinned-image Python availability must be verified, not assumed. Use a source-bound first-boot payload rather than another open admin channel. |
| Intended future Container Apps runtime | Separate app/job identity and VNet-integrated environment, runtime UAMI only; validate ACR private routing and repository Reader behavior | Reuse only a genuinely existing approved environment; otherwise environment/observability/network foundation adds costs and scope | Container Apps is a platform direction, not a provisioned resource in this sixteen-resource estate. Do not create or deploy a product solely to claim Stage 2B. Repository ABAC support and token endpoint/identity semantics require exact validation. |
| Ephemeral manual Container Apps Job | One finite synthetic task in an approved private environment, only runtime UAMI, no ingress | Consumption execution can be cheaper than a standing VM when an approved environment already exists | Not immediately available in the proof estate. Creating an environment/subnet or delivering a probe image requires separate authority. Bootstrap-image pull is a dependency, not proof that the target digest can be read. Image-pull capability is not by itself proof of in-process runtime write denial. |

These are qualitative capacity comparisons, not SKU pricing estimates or live
availability claims. No expensive production profile is proposed.

## Recommendation

Prefer a dedicated short-lived runtime-proof VM for the smallest **currently
isolatable** proof surface, unless maintainers identify an already-approved,
private Container Apps environment suitable for a manual synthetic job. This
is a recommendation for adjudication, not a deployment plan or selected SKU.

Future packet must bind resource IDs, image/version, identity, DNS/egress,
payload/hash, exact what-if, single execution, evidence and removal semantics.
Wait for a proven Stage 2A digest before runtime read proof. Do not create an
environment now; do not grant registry-wide `AcrPull` in place of the existing
repository-scoped Reader role.

## Sources

- [Microsoft Container Apps jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs)
  documents finite-duration manual jobs and shared environment networking.
- [Managed-identity image pull](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull)
  documents user-assigned identities; its examples do not adjudicate this
  mission's exact ABAC/private-network constraints.
- [ACR repository RBAC and ABAC](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions)
  is the required repository-permission contract to verify separately.
