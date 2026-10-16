# Stage 2A minimal ORAS preflight

Mission: `NZ-20261008-INFRA-001`  
Slice: `G2_STAGE2A_ORAS_ARTIFACT_PROOF`

**`ORAS_DELIVERY_BLOCKED_BY_EGRESS_POLICY`**  
Stage 2A disposition: `STAGE2A_BUILDER_ARTIFACT_PARTIAL`  
Overall G2: `FAIL`

## Toolchain decision

`SELECTED_STAGE2A_TOOL = ORAS`.

[Microsoft ACR documentation](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-manage-artifact)
supports generic OCI artifact publication with ORAS; Docker is optional.
This gate does not require a runnable image or container engine. Its walkthrough
uses Azure CLI/personal credentials; those examples do not authorize installing
Azure CLI or changing the mission's builder-UAMI authentication contract.

## Official release verification

`ORAS_RELEASE_METADATA_VERIFIED = YES`.

| Field | Verified official value |
|---|---|
| Tag | `v1.3.4` |
| Release commit | `db9e29505c3059f2b8fde34ae8cae266c5c765e9` |
| Published | `2026-08-27T20:37:08Z` |
| Archive | `oras_1.3.4_linux_amd64.tar.gz` |
| Archive expected SHA-256 | `f27adb935022d94df8dc77719c322dda592c78a0d57a6f7dcdd8d900b248c454` |
| Checksums-file SHA-256 | `19d479e497fb5e30c7de3c621e3ed337e3857de0d96542021a73e2d8016dbe5a` |
| Detached checksum-signature SHA-256 | `a26dd27f65d9f44b5ca24ff40b960e2de150c61541cafb20b78fb84d60e9293f` |

The official GitHub asset digest matches the user-supplied archive digest,
and the separately fetched official checksum file contains the same exact
filename/digest. The checksum and detached-signature bytes were fetched on
the operator side and verified against official release asset digests.
**The archive itself was not downloaded**, on either builder or operator.
Archive-content verification before extraction is therefore not claimed.

The annotated tag resolves to the commit above; GitHub reports its SSH
signature verified/valid. The checksum detached signature is captured but
**not independently cryptographically verified against a trusted signer key**.
Tag-signature verification is not checksum-signature verification.
The release reports `immutable=false`; future execution must still enforce
the exact pre-authorized archive-content hash.

Sources: [official release](https://github.com/oras-project/oras/releases/tag/v1.3.4),
[release verification](G2_STAGE2A_ORAS_RELEASE_VERIFICATION.json),
[raw release](G2_STAGE2A_ORAS_OFFICIAL_RELEASE_RAW.json),
[raw tag](G2_STAGE2A_ORAS_OFFICIAL_TAG_RAW.json).

## Existing-egress adjudication

Current raw Azure Firewall GET:

- No application rule collections.
- No network rule collections.
- No attached firewall policy.
- Default builder route `0.0.0.0/0` -> virtual appliance `10.90.0.4`.
- Protected NSG/routes/firewall state remains equal to Stage 1 baseline.

The exact initial archive host is `github.com`. The governed firewall has
no allow rule for that upstream HTTPS path. Thus it is **not admissible** under
current egress policy. NSG allowance does not override Azure Firewall default
deny. Platform-agent fabric delivery is not arbitrary Internet-download
permission.

No archive request or guest reachability test was used to bypass that policy.
Potential GitHub release-asset redirects would also need exact adjudication;
they were not exercised for the archive. Operator-side metadata/checksum access
is not evidence of builder-side network permission.

The optional firewall CLI command required an absent CLI extension and failed
without installing it. Raw REST GET resolved the inspection without new tools.
One operator metadata decode failed under Windows default encoding; explicit
UTF-8 corrected it. These are inspection-tool failures, not guest executions.

See [egress evidence](G2_STAGE2A_ORAS_EGRESS_ADJUDICATION.json).

## Stop boundary

No ORAS execution payload/authority, synthetic source, auth-flow review,
push command, provider validation, what-if or deployment was created/run
after the egress stop. None is represented as passing by omission.

No guest command/download/extraction, package install, system ORAS install,
temporary workspace, token acquisition, artifact push or negative probe.
No extension was created; no retirement Delete was needed. ORAS execution
authority was not consumed. Stage 2B was not executed.

## Final protected state

Branch `g2/synthetic-health-source` and HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27` unchanged. Existing untracked
infrastructure/evidence trees observed; no tracked foreign work changed
or dispositioned. No application or infrastructure source changes.

Exact sixteen-resource inventory/raw state and ACR assignment contracts
match final Stage 1, excluding only `etag` and `systemData`. Extension list
empty. All Stage 1, failed Stage 2A and corrected inventory evidence/source
hash chains verified unchanged. `git diff --check` passed.

`STAGE1_DISCOVERY_PROVEN` and `STAGE2A_PHASE1_INVENTORY_PROVEN` remain intact.
Private ACR runtime proof was not rerun; protected configuration equivalence
is not represented as a fresh runtime connection test.

See [read-only baseline](G2_STAGE2A_ORAS_READ_ONLY_BASELINE.json),
[final disposition](G2_STAGE2A_ORAS_FINAL_DISPOSITION.json),
[verification](G2_STAGE2A_ORAS_PREFLIGHT_VERIFICATION.json), and
[delivery proposal](G2_STAGE2A_ORAS_DELIVERY_PROPOSAL.md).
