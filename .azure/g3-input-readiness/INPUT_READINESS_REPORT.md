# G3 input-lane readiness closure

Mission: `NZ-20261008-INFRA-001`.

## Surviving blocker

**The complete portable private-guest transaction remains unqualified.**
The staged source and compiler reproduce the frozen runtime manifest twice, but
only using the workstation's pre-existing Docker, buildx and BuildKit. Those
engine/exporter utilities are not established by the staged inputs. The exact
Marketplace image is bound; its shell, Python, TLS trust store, archive tools and
agent bootstrap dependency inventory is not proven. No unbound package acquisition
or privileged nested-engine shortcut was substituted for that proof.

The app-witness probe is now a tested static Linux/amd64 component, not a complete
transient probe transaction. Its public-key/guest execution handshake, private
secret bootstrap and pull-UAMI repository test caller are not wired. Consequently
the complete G3A/G3B controllers and top-level Bicep packages remain incomplete;
the complete proof cost and its >=150% governance ceiling remain unresolved.
These are surviving dependencies, not reasons to reopen G2 or the selected lane.

## Evidence achieved, without execution

- [Frozen input contract](./OCI_INPUT_CONTRACT.json): source and compiler payload
  sizes, SHA-256, media types and separate immutable OCI manifests. The contract
  explicitly does not contain a complete builder-utility bundle.
- [Private reader](./private_reader.py): selected-UAMI IMDS request, private DNS,
  pinned peer, CA/SNI, Entra/ACR token exchange, digest-qualified manifest,
  repository/media binding, credential-free 307 data-endpoint request, streamed
  SHA/size and exact-member extraction. Eight protocol fixtures pass; tokens and
  opaque redirect credentials are not written to evidence.
- [Staging guard](./staging_contract.py): two repository-scoped Writer grants,
  one push attempt per repository, immutable readback, authority consumption,
  Writer revocation and private lockdown before build eligibility. Four fixtures
  pass. This is a local state guard, not an executing producer/controller.
- [Corrected component rehearsal](./OFFLINE_REHEARSAL_RESULT.json): two offline,
  no-cache builds reproduce
  `sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`.
  Complete guest rehearsal is nevertheless `FAIL`: host tooling is unstaged.
  The initial load-output failure and its exclusive partial directory remain.
- [Probe qualification](./PROBE_LOCAL_QUALIFICATION_V3.json): five Go tests,
  vet and static build pass. Both health and readiness require the frozen
  runtime's `{"status":"ok"}`. Positive witnesses bind tenant, principal, named
  challenge, TLS, authorization and a connected peer in the private DNS set.
  A bare `DENIED`, HTTP 400, unknown proof path, missing object and unverified TLS
  cannot count as the required negative proof.
  [First qualification](./PROBE_LOCAL_QUALIFICATION.json) and its
  [exact source/binary archive](./probe-qualification-v1-source.tar) are preserved;
  the intervening [failed test build](./PROBE_LOCAL_BUILD_LOG_V2.txt) is retained.
- [External observer](./public_observer.py): two fixtures pass. Requires exact
  target, internal-environment readback and private positive control. Definitive
  public NXDOMAIN/NODATA is endpoint-boundary denial, not RBAC. Temporary resolver
  failure, private answers and public addresses are inconclusive/failure.
  No actual Internet or private application probe was performed.

## Governance and identity

The accepted exception is `TRANSACTIONAL_G3_INPUT_STAGING_EXCEPTION`: one
authenticated, repository-conditioned staging transaction on the **new G3 input
registry only**, with registry admin and anonymous access disabled, no production
data, and a maximum public window of one hour. It is identity-scoped over a
temporary public endpoint, **not** `PRODUCER_ONLY_NETWORK_ACCESS`.

The selected producer is the future dedicated `g3-proof` executor. Existing
product staging credentials are excluded. Future staging and build authorities
are separate; the builder cannot begin before terminal staging PASS and readback
of public-disabled/PE-active/DNS-active state.

Both future application and SP owner candidates are the existing tenant Member
**Aubert Nungisa**, object `a88c6cf4-adc7-4287-a553-53b93cd1f002`.
Enabled user details and active tenant Global Administrator assignment are
corroborated by the repository's
[explicit owner-operated governance policy](../../docs/governance/owner-operated-review-model.md).
This binds an accountable **candidate**, not existing ownership or consent to
mutate Entra. Directory privileges do not establish Azure RBAC grant capability.
The two failed user lookups remain recorded and do not prove those principals
are absent or human users.

[Owner and executor contract](./OWNER_EXECUTOR_CONTRACT.json) and
[grant-operation plan](./GRANT_OPERATION_PLAN.json) describe the proposed
`MAINTAINER_CONTROLLED_ONE_TIME_GRANT_OPERATION`. Its authenticated Azure-capable
operator must be verified at the separate bootstrap gate; no currently observed
Owner/UAA principal is authorized by this packet. Exact assignment tuples and
UUIDv5 derivation use outputs of preceding gates, never fabricated principal or
resource IDs. This is a governance model, not a newly granted technical
delegation. No generic grant role, subscription Owner or subscription UAA is
proposed.

The eventual first mutation gate remains solely executor/OIDC/owners, G3 RG and
exact deployment/grant mechanism. This blocked packet does **not** issue
`G3_CONTROL_PLANE_BOOTSTRAP_AUTHORITY`, create the input registry or authorize
G3A/G3B.

## Bound durations and retained-state cost

[Cost dependency record](./INPUT_READINESS_COST.json) fixes maximum staging=1h,
builder=2h, G3B=4h and probe=4h. Input Premium ACR includes a conservative full-day
charge; no G2 firewall increment is selected. Complete utility bytes, guest
transport, provider-managed ACA quantities, secret-operation meter binding and
telemetry/traffic quantities remain unresolved. A partial component sum is not
reported as an all-in cost or ceiling.

`PROOF_ONLY_TEARDOWN` retains only the immutable final image and sealed local
evidence. The *incremental image-only billable monthly upper bound*, not total
registry spend, is **CAD 0.000468795606790**, using 3,309,418 blob bytes and the
preserved CAD 0.141655/GB-month storage meter. The input registry and transient
substrate are not retained.

## Scope, preservation and output

[Disposition](./INPUT_READINESS_DISPOSITION.json) contains every required output.
[Local validation](./INPUT_READINESS_LOCAL_VALIDATION.json) records exact checks;
[seal](./INPUT_READINESS_VERIFICATION.json) and
[separate direct-byte verifier](./INPUT_READINESS_INDEPENDENT_VERIFICATION.json)
are integrity proofs, **not** readiness PASS.

All writes are confined to this previously unsealed input-readiness lane.
Concurrency snapshots record both worktrees. Shared product/infrastructure work
is observed only; none is staged, reverted, committed or dispositioned.
Previous G2/G3 roots, file censuses, source and evidence bytes are rechecked.
A fresh read-only census confirms exactly 16 protected G2 resource IDs.
Current ledger has fourteen read-only invocations: twelve successes, two retained
NotFound failures. No Azure, Entra or registry mutations; no Azure guest execution.

No new Bicep top-level package was created or built. Earlier sealed module builds
are historical evidence only. Repository-wide PR checks were not run: no PR is
requested, no product source is changed, and only isolated Python/Go evidence
components are touched.

`G3_EXECUTION_READINESS = BLOCKED`.
`G3_TECHNICAL_EXECUTION_AUTHORIZED = NO`.
`UE_INFRA = INFRA_NO_GO`.
`CORA_INFRA = INFRA_NO_GO`.
