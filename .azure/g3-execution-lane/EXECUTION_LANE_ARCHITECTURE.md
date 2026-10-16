# G3 execution lane architecture closure

Mission `NZ-20261008-INFRA-001`. Design/read-only/local scope only.

`G3_EXECUTION_READINESS = BLOCKED`.

## Private delivery comparison first

Ratings are qualitative architectural judgments, not measured runtime proofs.
`Good` means favorable **if the explicitly stated dependency is closed**.
Cost ranks compare added service classes, not fabricated all-in prices.

| Criterion | 1: private Blob input store | 2: OCI input transport, separate G3 ACR | 3: Azure-native ACR Tasks | 4: bounded builder public egress |
|---|---|---|---|---|
| Security boundary clarity | Good; private endpoint is not a producer connection | Good after lock; temporary producer ingress needs explicit approval | Medium; preview pool and broader platform dependencies | Weak until an enforceable FQDN egress path exists |
| G2 independence | Good if all transfer resources are new | Good for inputs; final image still targets existing ACR by private data plane | Separate registry possible; no silent trusted-service bypass on G2 | Good only with new egress resources |
| Private delivery completeness | Not closed: no connected producer | Closest: public producer-only staging, lock, then private immutable reads | VNet pool addresses registry reachability, not all source acquisition | Not closed: no implicit default outbound, NAT alone is not FQDN filtering |
| Persistent state | Storage + PE + DNS + producer connectivity | Premium registry + PE; all transient under full teardown | Premium registry + pool allocation + tasks | NAT/IP plus filter/proxy or firewall |
| Transaction complexity | High; first writer/private network bootstrap | High but phase-explicit; separate input/read and final push identities | High; source, pool, cache and build provenance | High; egress policy, pinned downloads and standing network resources |
| Reproducibility | Good with hashed immutable payloads | Good with exact OCI digests; portable build engine still requires qualification | Unproven relative to frozen local exporter/toolchain | Good only after exact toolchain/hash verification |
| Least privilege | Container-scoped Blob writer/reader | Exact repository-conditioned producer writer/input reader; final writer separate | Task/pool ARM + identities; verify data-plane repository constraints | Guest downloads add no ARM privilege, but filter administration adds authority |
| Teardown simplicity | Exact blob/container/store/PE cleanup plus connectivity | Delete new input registry/PE; retain only final immutable target image | Pool zero is not deletion; allocated pool lifecycle must be counted | Delete NAT/IP/filter resources; not just the VM |
| Incremental CAD | Storage operations/bytes + private producer channel unpriced | Premium ACR meter CAD 2.360822/day + PE; no native build-agent fee | Paid allocation; retail task duration is not proof of agent-pool all-in price | NAT/IP/filter/processing must be explicit; not zero |
| Reuse beyond proof | Private generic artifact distribution | Immutable institutional build-input transport | Managed build capability if later justified | Egress reuse, with extra operational/security burden |
| Rank / disposition | 2 / rejected for this transaction: producer path open | **1 / selected design, delivery still BLOCKED** | 3 / rejected for proof: no evidence it is cheaper/simpler; contradicts required new VM if substituted | 4 / rejected: no approved FQDN-controlled outbound substrate |

Sources and exact fetched bytes:
[PUBLIC_SOURCES.json](./PUBLIC_SOURCES.json).
Current primary CAD observations:
[PUBLIC_CAD_PRICING.json](./PUBLIC_CAD_PRICING.json).

### Selection

`G3_PRIVATE_INPUT_DELIVERY_MODEL =
ACR_OCI_INPUTS_SEPARATE_G3_REGISTRY_GOVERNED_STAGING`.

This selects **Option 2**, not a second option or permission to execute. It does
not select a registry import into G2, trusted-service bypass or an ACR Task.
The existing target's public-disabled/bypass-None state stays untouched.

The separate G3 input registry has two explicit future states:

1. `PRODUCER_STAGING`: Premium, Canada Central, ABAC, no admin account/anonymous
   pull, bypass `None`, default deny, a single observed public IPv4 `/32` for the
   dedicated `g3-proof` GitHub/OIDC producer job. Producer access is authenticated
   HTTPS and limited to `g3-build-inputs`. This is a **temporary public producer
   ingress exception on a new G3-only resource**, not private end-to-end upload.
   It must be explicitly accepted and bounded by the subsequent authority.
   An unconstrained standard hosted-runner address list is not substituted.
2. `PRIVATE_LOCKED`: public network disabled, zero producer IP rules, bypass
   `None`; revoke the producer writer by exact assignment ID. The builder cannot
   execute until ARM readback proves the lock and private DNS/TLS/immutable
   content readback succeeds. Only the new G3 input PE is used.

The future producer job must bind its observed egress `/32`, an approved
non-secret IP-observation mechanism, window duration and signed input manifest.
No registry staging, IP discovery or external upload was performed here.
If this temporary ingress model is not accepted, **the selection cannot be
executed**; Option 1 still needs an independently established private producer.

The [low-level registry phase module](./bicep/input-registry-phase.bicep) and
[offline phase guards](./lane_contract.py) implement selected boundary semantics.
They are not complete G3A/G3B top-level packages. The raw Bicep module must only
be invoked through the approved controller/parameter validator; it does not
enforce name, `/32`, authority or sequential readback policy by itself.

## Dedicated executor, ownership and grant mechanism

* Display name: `nzila-g3-proof-executor`.
* Model: `DEDICATED_GITHUB_OIDC_SERVICE_PRINCIPAL`.
* `APP_ID = FUTURE`, application object ID and service-principal object ID
  `FUTURE`; no fabricated GUIDs.
* Issuer `https://token.actions.githubusercontent.com`; audience exactly
  `api://AzureADTokenExchange`; subject exactly
  `repo:anungis437/nzila-os:environment:g3-proof`.
* No password/client secret/certificate credential. GitHub environment is
  dedicated, approval protected, non-product and must not be `staging` or
  `production`. The existing staging principal is not reused or modified.
* Application and service-principal owners must both be real, named tenant
  object IDs with explicit lifecycle accountability and consent. The issuing
  mission maintainer/risk owner is governance-bound; that is **not evidence of
  an Entra object ID or ownership assignment**. No owner identity is inferred
  from a filesystem username, Git commit identity, existing Owner role or
  current CLI login. `G3_EXECUTOR_OWNER_CONTRACT = BLOCKED`.

Grant mechanism selected: `MAINTAINER_CONTROLLED_ONE_TIME_EXACT_GRANT_LEDGER`.
No standing grant privilege is added to the deployment executor. Before its
operation is authorized, name the actual grant operator, validate its existing
permission at each exact scope, bind reviewed assignment IDs/principal IDs,
and require create/readback/revoke evidence. It cannot self-approve a broader
assignment or infer permission from mission governance.

This is a governed mechanism design, **not a claim of a currently bound capable
grant operator**. Azure delegation conditions can constrain roles/principals
for roleAssignments write/delete (Request/Resource respectively); they do not
automatically enforce the downstream repository-condition text or authorize
private-endpoint approval. Do not describe a role-list constraint as enforcement
of the exact `g3-synthetic-runtime` data-plane condition.

### Future permissions and principal separation

| Principal / slice | Future permission and exact scope | End state |
|---|---|---|
| Dedicated executor / G3A | Contributor `b24988ac-6180-42a0-ab88-20f7382dd24c` at new G3 RG for new VM/NIC/disk/UAMI/network/extension/registry resources; no subscription Contributor/Owner | Revoke transaction delegation or retain only separately accepted control-plane bootstrap |
| Dedicated executor / G3B | Same new G3 RG scope for private networking/ACA/vault/DNS/logs; no product resource scope | Exact teardown; no secret-write grant |
| OIDC input producer job | Repository Writer `2a1e307c-b015-4ebd-883e-5b7698a07328` at **new input ACR**, exact `g3-build-inputs` condition | Revoke immediately after immutable input staging |
| Input-read UAMI | Repository Reader `b93aa761-3e63-49ed-ac28-beffa264f7ac` at new input ACR, exact `g3-build-inputs` | Delete after builder/probe input retrieval |
| Build/push UAMI | Repository Writer at **existing target ACR**, exact `g3-synthetic-runtime`; no input-repository permission and no ARM role | Revoke exact temporary grant, delete UAMI |
| App pull UAMI | Repository Reader at existing target ACR, exact `g3-synthetic-runtime`; app lifecycle `None` | Delete after app teardown |
| Runtime UAMI | Secrets User `4633458b-17de-408a-b874-0445c86b69e6`, named `substrate-proof` secret only; app lifecycle `Main`; no ACR rights | Delete after app teardown |
| Separate bootstrap/probe UAMI | Temporary Secrets Officer `b86a8fe4-44ce-4948-aee5-eccb2c155cd7`, new G3 vault only; no runtime/product credentials | Revoke exact ID after one versioned write; delete after proof |
| Maintainer grant operator | One-time reviewed exact assignments and required target PE approval only, via separately verified capability | No standing delegation added; reconcile every assignment/connection ID |

All ACR data-plane grants use condition version `2.0`, exact
`@Request[Microsoft.ContainerRegistry/registries/repositories:name] StringEqualsIgnoreCase`
with the named repository. Input read and final push are separate principals,
even if temporarily attached to the same builder. The input reader can also
provide only probe-tooling retrieval; the bootstrap/probe identity never becomes
the application's runtime identity. Five UAMIs are proposed: input reader,
build/push, app pull, runtime, bootstrap/probe. This changes planned identity
counts, not the frozen `PASS_DOCUMENTED_LIMIT` disposition.

G3 RG creation and executor ownership/federation remain a later explicit
control-plane bootstrap gate. Nothing here grants subscription rights to get
around an absent RG.

## Builder and first-byte/toolchain boundary

`G3A_BUILDER_MODEL = NEW_TRANSIENT_PRIVATE_VM`.
Lifecycle: absent, create, execute once, delete. No public IP, no SSH, no apt,
no arbitrary Internet download, no G2 VM/tooling authority reuse.

Transport is new G3 OCI input registry -> G3 PE/DNS -> private builder.
Metadata names every blob, digest, exact size and destination. The build/push
identity does not receive input-repository access.

The cached compiler has been exported locally, with exact hash/size and an
internally verified OCI manifest matching the frozen compiler digest:
[INPUT_INVENTORY.json](./INPUT_INVENTORY.json).
This archive includes the compiler image, **not** a complete portable Docker/
BuildKit/buildx/registry-transfer/probe toolchain.

The first byte remains an explicit implementation dependency: a small guest
bootstrap reader must be delivered through a supported VM-agent channel, use
only an interpreter proven in the pinned VM image, obtain an input-reader token
from IMDS, retrieve the immutable OCI manifest and blobs through verified private
DNS/TLS and safe bounded data redirects, verify size/SHA, and unpack safely.
CSE's native `managedIdentity` blob download option is not an ACR OAuth client.
No generic ORAS binary is assumed to exist before it is delivered.

The CSE inline ceiling is 256 KiB for the encoded script setting, not a channel
for the 75,258,880-byte compiler archive or 3,317,248-byte final OCI archive.
A compact reader can theoretically fit; that does not prove the chosen guest
image, dependencies, token flow or exporter.

The frozen qualification used Docker 29.2.0 and buildx
`v0.31.1-desktop.1`. A portable Linux build-tooling bundle with exact digests,
sizes/provenance and local **frozen-manifest equivalence** has not been produced.
Do not substitute an upstream version and claim deterministic equivalence,
promote a different runtime digest or transfer the finished runtime instead of
performing the required new private build.

Therefore `G3A_INPUT_DELIVERY = BLOCKED`. The selected topology eliminates the
abstract unreachable-store problem but does not certify the guest bootstrap/
portable build implementation.

## Secret bootstrap and private/public observers

Selected caller model: one new transient private probe VM in
`10.91.5.0/28`, no public IP/SSH, input-reader plus a distinct bootstrap/probe
UAMI, not the runtime UAMI. The same supported guest-agent channel must deliver
its fixed scripts. This is a **design**, not an executable caller.

Generate one random challenge in guest memory, write one version over the new
vault's verified private TLS path using the temporary bootstrap identity, emit
only the challenge ID and SHA-256, discard the clear value, revoke the exact
Secrets Officer assignment before app proof. No clear challenge in command
arguments, CSE public settings, repository, workflow logs or local persistent
files. Abort and revoke on any write/readback failure.

Generate the Ed25519 proof key in the private caller; only its public key enters
the app configuration. Private signing key and app/runtime tokens never leave
the caller. Signed GETs target the actual returned internal FQDN; no raw proof
diagnostics are exposed publicly.

Pull-identity negative repository tests require a separately controlled,
temporary pull-UAMI caller context on the probe, **never** a runtime token.
Remove that temporary identity attachment and verify its residual state.
The app's pull lifecycle stays `None`.

Public observer model: separate unprivileged GitHub-hosted observer job outside
the G3 VNet, no proof key or Azure data-plane token. Bind the returned exact
app FQDN and authoritative internal-environment readback; require a passing
private positive control in the same transaction. Public DNS absence plus this
bound internal topology proves **public-ingress boundary denial**, not RBAC.
Unexpected public address/HTTP response fails the chosen DNS-absent test; HTTP
401 by itself does not prove public ingress is absent. A failed DNS query for
an unbound hostname is inconclusive. This fixture is mechanically tested, but
the independent job and private caller remain unwired.

## Ownership and teardown boundary

Every new G3 resource is `TRANSACTION_CREATED` only after preflight absence,
successful create and exact transaction-ID/ARM-ID ledger correlation. Existing
G2 target registry, G2 roles/identities/network/firewall, subscription, GitHub
repository and Entra tenant are `PREEXISTING_REFERENCED`, never deletion owners.

Proposed new resources: G3 input ACR, its PE/zone group and DNS records; G3 VNet,
four subnet NSGs, builder/probe NICs/VMs/OS disks/guest command resources; five
UAMIs; G3 vault/PE; target ACR G3 PE; private DNS zones/links; LAW/diagnostics;
ACA environment, provider-managed RG/infrastructure and app.

The existing ACR is not made `TRANSACTION_CREATED` because a new connection is
approved there. Newly created scoped G3 role assignments and connection records
are reconciled by **their exact new IDs in separate ledgers**; original G2 IDs
are exclusion entries. Never delete the target registry or all its grants.
Provider-managed resources are reconciled from the environment response and
resource census, not guessed IDs or unrestricted resource-group deletion.

Successful proof policy: full teardown of transaction-created G3 substrate,
including input registry/tooling, VMs/disks/identities, vault (90-day soft-delete
tombstone, no purge), PEs/DNS/logs/ACA. Retain only local sealed evidence and the
one proven final immutable target image; any retained control-plane executor/RG
is separately governed bootstrap state, not live app capacity. Do not describe
the proposed teardown as measured poststate.

## Costs and implementation ruling

[OPTION_COST_OBSERVATIONS.json](./OPTION_COST_OBSERVATIONS.json) binds current
primary CAD registry/task meters, exact known artifact bytes and the prior
component scenario without passing it off as the all-in total.

A Premium input registry costs CAD 2.360822/day by the observed meter.
An eight-hour illustration is CAD 0.7869406667 if prorated; conservatively budget
one full day CAD 2.360822 until billing/transaction duration is contract-bound.
This is additional G3 input infrastructure, not the existing target's sunk fee.
Private endpoint/DNS/transfer bytes and bootstrap/probe/runtime costs are still
part of the total. Native task vCPU duration is CAD 0.000142/second at the paid
tier; it is not an agent-pool allocation price. Preview agent pools can scale
to zero: they are **not inherently permanently paid**. Rejection is based on the
required VM model, added allocation/platform dependencies and unqualified source/
exporter path, not a false assertion that pools cannot be transient.

No complete toolchain/controller/probe artifact or transaction resource/traffic
contract exists yet. Controller and proof-script sizes are explicitly
`NOT_PRODUCED`, not zero or arbitrary maximums.
Thus both controllers and both top-level Bicep packages are **INCOMPLETE**.
No placeholder top-level package or passing deployment adapter is generated.
No all-in proof cost/ceiling is claimed; the image-only idle upper bound remains
explicitly a proposed teardown scenario, not observed Azure spend.

## Surviving blockers

1. **Named ownership/grant operator:** real application/SP owner object IDs and
   accountable capable one-time grant operator are not explicitly bound.
   Dedicated executor model/federation are fixed; no staging principal reuse.
2. **Qualified delivery implementation:** approve/bind the new input registry's
   temporary producer-only staging contract; produce and locally qualify the
   guest first-byte loader, pinned guest/tooling bundle and authenticated private
   probe. The complete G3A/G3B controllers/top-level packages and exact remaining
   input sizes depend on this implementation.
3. **All-in CAD cost/ceiling:** cannot close honestly while those artifacts,
   guest/platform dependencies and exact transaction/traffic bounds are open.

No control-plane bootstrap authority is presented as approved. Even after a
future readiness PASS, the next authorized mutation must be the limited executor/
ownership/G3-RG/grant-mechanism bootstrap, **not G3A execution**.

Exact output and local integrity evidence:
[EXECUTION_LANE_DISPOSITION.json](./EXECUTION_LANE_DISPOSITION.json),
[EXECUTION_LANE_VERIFICATION.json](./EXECUTION_LANE_VERIFICATION.json),
[EXECUTION_LANE_INDEPENDENT_VERIFICATION.json](./EXECUTION_LANE_INDEPENDENT_VERIFICATION.json).
