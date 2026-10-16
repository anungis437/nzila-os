# G3A portable private builder: exact-gate stop

Mission `NZ-20261008-INFRA-001`.

## Exact surviving dependency

**A governed portable compressor that reproduces the frozen layer DEFLATE
bitstreams remains unbound.** The installed frozen build engine's compression
implementation/runtime version and stream-writing contract have not been
qualified as staged inputs. This is not proof that portable reproduction is
impossible, nor evidence justifying a replacement runtime digest.

Section 16 of the current authority requires STOP when the first complete
clean-room build's manifest differs. That gate failed. No second full rehearsal,
uploader, negative registry test, cloud deployment, Bicep package or cost closure
was executed after the stop. The next authority should address only this exact
compression dependency.

## Measured result

[Exact comparison](./EXACT_IMAGE_COMPARISON.json):

| Contract | Frozen versus clean-room |
|---|---|
| Application binary | Exact: 7,454,844 bytes; SHA-256 `5a1ab8fdd71a8db76220de0d8867eea6c5a1fedd2889cfe9092f3e6f98d9f7b0` |
| Config JSON | Exact: `sha256:905dccbd2a9da110a68dcbfb17704b205eb10dfb326e51ace2a7db9bc5d3801e` |
| Uncompressed application layer | Exact: `sha256:000cdf8c38857aab9b5a16244b98eb8f6017bf251f064c124622633c8850fc38` |
| Uncompressed certificate layer | Exact: `sha256:622d4366d78c36ca5ca6086e93b66d93305e0e11b95941375c1c4ff1f51cdfa1` |
| First gzip layer | **Different:** 3,201,563 frozen bytes versus 3,267,804 candidate bytes |
| Second gzip layer | **Different:** 105,884 frozen bytes versus 106,452 candidate bytes |

Both gzip headers and CRC/ISIZE trailers are byte-identical. Both first
differences occur at **zero-based byte 11**, inside DEFLATE; decompression produces
identical complete tar streams, including file modes, UID/GID, timestamps and CA
content. The binary is freshly compiled, not copied from the frozen image.

Frozen manifest remains:

`sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`

The retained failed transaction produced:

`sha256:32eee2bf9f9b441b30c90d134020643853355c32af4c5a5e7e0aaf9caa1417dc`

That candidate also had invalid descriptor sizes: its compact-only size
replacement did not match the pretty frozen manifest template. This coupled
implementation bug is explicitly retained, corrected in source and covered by
a regression test. **It is not the compression failure.** A pure byte comparison
with corrected descriptors still produces a different manifest:

`sha256:5d6c229427d2f9bb13e10bf64cfe1d72836ac5c1f0566b1b7d46554642f48280`

The [corrected comparison document](./CORRECTED_CANDIDATE_MANIFEST_COMPARISON_ONLY.json)
is not a new transaction, authorized image, or replacement frozen artifact.

## Exactly two strategy classes

[Decision matrix](./PORTABLE_STRATEGY_MATRIX.json) scores ten required criteria.
Scores are 0-5 (higher is preferable); architectural projections are explicitly
not measured engine qualification.

1. **A: staged portable build engine.** Not staged or tested here. Matching the
   original exporter is plausible, but its executable/runtime/compression,
   daemon and possible rootless-helper dependencies need binding. No claim of
   exact reproduction, required root, permanent daemon, or technical impossibility
   is made.
2. **B: deterministic OCI assembler.** Selected as the lower-state candidate:
   one static controller, static compiler subtree, stdlib tar/gzip, no daemon or
   root-specific build operation. Tar/config/application bytes reproduce exactly;
   compressed bytes do not. It remains a **failed exact-gate candidate**, not the
   qualified winning strategy.

[Public BuildKit source](./PUBLIC_BUILDKIT_GZIP_V0_27_0.txt) and its
[provenance](./PUBLIC_COMPRESSOR_PROVENANCE.json) show stdlib `compress/gzip` with
default compression at upstream v0.27.0. They do not bind the installed engine's
Go runtime/version or prove why its DEFLATE differs. No host-path, timestamp,
annotation or build-provenance metadata difference was demonstrated.

## Governed inputs and scratch runtime

[Inventory](./PORTABLE_INPUT_INVENTORY.json) freezes all **candidate build**
payloads with SHA-256/bytes/repository/media/OCI manifest contracts. It is not
the complete guest input contract. Measured total candidate payload bytes:
**263,005,255**, excluding OCI envelope/config bytes and retained historical
controller versions. The original source envelope remains unchanged.

The pinned compiler archive is verified against its prior SHA and internal OCI
manifest; all contributing layers are hash/size checked. Only the explicit
`usr/local/go` subtree is normalized into a toolchain tar. Member names, modes,
sizes and hashes are frozen; symlinks, hardlinks, devices, duplicate members and
path escapes are rejected. Its static Go/compiler/link executables have no ELF
interpreter. Other compiler tools derive from the same complete hash-bound tree.

The final runtime is scratch-based **but not input-free**:
`G3_FINAL_RUNTIME_BASE_DEPENDENCY = STAGED_IMMUTABLE_INPUT`.
The exact 181,724-byte CA file is derived from the pinned compiler layers,
SHA-256 `028fca5150ee1915c4474489985d55c54fceaa680c754cc8d1301734f01b2232`.
It is not read from the workstation or clean-room OS trust store.

The JSON templates govern serialization metadata only. No prebuilt runtime
binary, final layer archive, host image-store content or frozen final OCI archive
is mounted into the build. Runtime source is verified and compiled in the room.
The source manifest is fetched as a digest-bound local fixture and its artifact,
media, empty config and payload descriptor checked; Go extraction additionally
binds the exact source member census, SHA/size and modes.

The preserved Python private reader is frozen as an input source, but the
clean-room transport is a Go local-fixture validator, **not the same executing
private reader**. It does not claim redirect/TLS/token/private path integration.
No guest reader qualification is promoted by this build.

## Clean-room evidence and executable provenance

[Isolation command](./clean-room-run1-qualified/ISOLATION_COMMAND.json) starts
the staged controller directly, with network `none`, read-only container root,
all capabilities dropped, no-new-privileges, restricted scratch and no socket.
Docker's only role is isolation outside the transaction. The container's Go
installation and `/go` are hidden; PATH is `/unavailable`. The controller rejects
visible Docker/buildx/buildctl/buildkitd/go commands, Docker socket and
container compiler path before building.

| Executed component | Provenance |
|---|---|
| Portable controller | `STAGED_INPUT`, hash-bound static Go binary |
| `go` | `STAGED_INPUT`, normalized pinned compiler tree |
| compiler/assembler/link/vet tools selected by Go | `STAGED_INPUT`, exact complete member inventory |
| Runtime test binary | Generated from `STAGED_INPUT` source using staged compiler |
| OCI tar/gzip operations | In-process stdlib in `STAGED_INPUT` controller; no external utility |
| Workstation Docker | Outside isolation only; not exposed or executed by transaction |

`GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, CGO disabled, Linux/amd64,
trimpath, no VCS/build ID, and frozen epoch are enforced. Tests, vet and compile
ran using the staged compiler. There is no `HOST_ONLY` transaction executable.
**Build-component self-containment passes; complete private transaction
self-containment remains FAIL** because the mandatory exact image gate and
reader/bootstrap/uploader integration have not qualified.

The initial room used Docker's implicit noexec `/tmp`; the generated test ELF
could not execute. The [failures](./INITIAL_REHEARSAL_FAILURES.json) and both
exclusive output directories remain. A new room with explicit executable
temporary scratch completed the build and failed only the exact digest gate.
Original controller source/binary snapshots remain in
[version 1](./assembler-v1.tar) and [version 2](./assembler-v2.tar).

After STOP, only source regression checks were performed:
[four tests, vet and static build](./ASSEMBLER_LOCAL_CHECK_V3.json) pass.
No compression algorithm, frozen source/image or full transaction was retried.

## Future VM/bootstrap boundaries

[Baseline contract](./VM_BASELINE_CONTRACT.json) reuses the already observed exact
active Canada Central image:
`Canonical:ubuntu-24_04-lts:server:24.04.202609040`, x64, Linux, GenV2.
No tenant or cloud discovery was repeated.

Image metadata proves architecture/OS/version, not exact shell, Python, curl,
tar, gzip, CA or VM-agent software versions. None is falsely classified
`VM_BASELINE`. The candidate build needs no shell/Python/curl/tar/gzip executable;
those operations are in the staged controller/compiler. Future CSE/agent and
first-byte private reader delivery remain unbound, not fabricated.

Bootstrap inline/settings/protected-settings byte counts and extension contract
are **NOT_PREPARED_AFTER_EXACT_GATE_STOP**. No large compiler/image inline
payload, public fileUri or interactive SSH is proposed. No complete G3A
controller/top-level Bicep was created or built; no uploader/mock negatives were
represented as qualified. G3B secret bootstrap remains deferred to G3B.

## Disposition, ownership and integrity

[Required output](./PORTABLE_BUILDER_DISPOSITION.json) reports the failed gates.
The candidate owner evidence remains `BOUND`; no ownership mutation occurred.
The authenticated capable grant operator remains unproven, so this packet
explicitly reports `G3_GRANT_EXECUTOR_MODEL = BLOCKED`, not the prior proposed
one-time-operation model as executable delegation.

G3A/all-G3 cost and ceiling remain unresolved: no completed exact transaction
resource/transport contract exists to price. No partial sum or optimistic
duration is substituted.

[Seal](./PORTABLE_BUILDER_VERIFICATION.json) and
[separate direct-byte verification](./PORTABLE_BUILDER_INDEPENDENT_VERIFICATION.json)
preserve all earlier sealed roots and censuses, including the last input packet.
G2's last read-only 16-resource estate is retained as historical evidence; this
packet performs **zero new Azure/Entra reads**, so it does not claim a fresh live
estate census. Both worktree HEAD/status baselines are recorded; foreign product
and infrastructure work is neither edited nor dispositioned.

`G3A_PORTABLE_PRIVATE_BUILDER = BLOCKED`.
`G3_EXECUTION_READINESS = BLOCKED`.
`G3_TECHNICAL_EXECUTION_AUTHORIZED = NO`.
`AZURE_MUTATIONS = 0`.
`ENTRA_MUTATIONS = 0`.
`REGISTRY_MUTATIONS = 0`.
`UE_INFRA = INFRA_NO_GO`.
`CORA_INFRA = INFRA_NO_GO`.
