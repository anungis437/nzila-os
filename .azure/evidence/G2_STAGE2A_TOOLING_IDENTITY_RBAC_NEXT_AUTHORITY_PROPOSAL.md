# Proposal: establish the private supply-chain ingestion boundary

Status: proposal only; no identity, network, runner or data-plane execution.

`TOOLING_PRIVATE_STAGING_SUBSTRATE_REQUIRED`

An existing suitable secretless build identity is available for planning:
`nzila-os-build`, principal `bfa4a851-696a-4d3f-927b-5fb1526f79f2`.
The current packet stops because no approved private ingestion execution path
was established. Creating two RBAC assignments alone would not solve it.

## Substrate comparison

| Option | Identity | State/cost drivers | Boundary implications | Assessment |
|---|---|---|---|---|
| Existing GitHub-hosted build context with separately approved Azure private networking | Existing build OIDC | Runner entitlement and network integration/subnet costs; no self-hosted agent maintenance | Requires verified platform support, subscription/region/plan eligibility, exact delegated-network/DNS design and governed upstream download path | First investigate read-only; potentially least operator-maintained state, not proven available |
| Existing private agent managed elsewhere, if maintainers identify one | Existing build OIDC or separately governed agent identity | Potentially no new compute; exact existing runner ownership, routing/DNS and access still needed | Must prove independent ingestion trust domain and private hostname/TLS path; no arbitrary workstation adoption | Lowest additive state if one truly exists; none found in current visible inventory |
| Dedicated short-lived ingestion VM/runner | Existing build OIDC where supported, otherwise new dedicated UAMI | VM/disk/NIC lifecycle, agent bootstrap, approved subnet and controlled egress | Separate from builder/runtime; no public IP, no SSH/Run Command shortcut; execution/retirement must be planned | Explicit new-substrate authority required; greater lifecycle burden but bounded duration |
| Dedicated manual consumption job in a private Container Apps environment | Existing OIDC where supported, otherwise dedicated UAMI | Environment/network integration and job runtime; existing environment reuse cannot be assumed | Needs trusted immutable bootstrap artifact before it can stage tooling, and proof of upstream/private ACR routing | Evaluate only if an admissible existing private environment is identified; bootstrap dependency must not be concealed |

No numeric pricing or asserted cheapest SKU is supplied without verified
region/service eligibility and usage assumptions. Prefer proven reuse over new
capacity; do not duplicate production profiles or modify product workloads.

The staging boundary must reach both the approved upstream archive and the
private registry without turning the protected builder into a general Internet
client. Any new upstream egress rule belongs to a separately authorized staging
design, not a change to the builder firewall under this packet.

## Identity alternatives

| Option | Advantages | Limitations |
|---|---|---|
| Reuse existing `nzila-os-build` OIDC | No new principal, no long-lived credential; repository/environment subject already exists | Needs independent private execution path and explicit operational owner/lifecycle registration; preserve existing other-registry rights |
| New dedicated federated tooling application/SP | Clean tooling-only ownership and subject/lifecycle boundary | New app/SP/federation authority required; identity creation does not provide networking |
| New dedicated UAMI on a separately approved private ingestion substrate | No stored secret, strong substrate attachment boundary | New identity/attachment/substrate authority required; upstream bootstrap and egress still must be proven |

No new identity is required merely to replace a suitable existing build
principal. A dedicated identity may be chosen later for stronger separation,
but must not be silently created.

## Suggested next bounded authority

1. Read-only verification of GitHub private-network capability/entitlement or a
   maintainer-identified existing independent private runner. Bind exact context,
   owner and lifecycle; do not launch write-capable workflows.
2. If reuse is unavailable, approve a concrete minimal ingestion topology and
   exact new resource/network/identity deltas in a separate infrastructure slice.
3. From that context, prove ACR hostname resolution to the approved private path
   and HTTPS certificate/SNI reachability without write authentication.
4. Only then resume exact RBAC authority: bind deterministic assignment IDs,
   exact role definitions/conditions/scope, expected before/after sets and
   provider/read-before-write gate. Maximum two authorized assignment Creates;
   preserve sixteen protected resources and existing roles.
5. Stop after RBAC readback. A subsequent data-plane packet must independently
   authorize archive download/hash verification, exactly one `g2-tooling`
   staging upload, immutable digest capture, builder fetch/checksum, synthetic
   artifact proof, negative probes, cleanup and retention.

No ORAS upload, builder pull, synthetic push, Stage 2B or Stage 3 is authorized
by this proposal. Existing ORAS execution authority remains unconsumed.
