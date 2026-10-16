# Go 1.25.6 compressor qualification

Mission `NZ-20261008-INFRA-001`.

**FROZEN_COMPRESSOR_CONTRACT = PROVEN** for the two frozen G3 gzip layers.
**G3A_PORTABLE_PRIVATE_BUILDER =
COMPRESSION_QUALIFIED_PENDING_FULL_REHEARSAL**.
Overall **G3_EXECUTION_READINESS = BLOCKED**.

## Official acquisition and extraction

[Official metadata](./OFFICIAL_GO1256_METADATA.json) was recorded before the one
authorized archive download. [Download evidence](./GO1256_DOWNLOAD.json) records
the exact go.dev origin and its single official redirect to dl.google.com.
No mirror, other version, image-only compiler or package-manager installation
was substituted.

- `go1.25.6.linux-amd64.tar.gz`: **59,768,880 bytes**
- SHA-256:
  `f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a`
- Archive integrity: **PASS before extraction**
- Safe extraction: **PASS**, root `go/`; every member validated before writes;
  absolute/traversal/backslash paths, links, devices, duplicates and unsafe modes
  rejected. No generic extractall.
- Extracted payload: **206,018,426 bytes, 14,501 regular files**.

[Complete inventory](./GO1256_TOOLCHAIN_INVENTORY.json) binds every file's SHA,
size and archive mode, including go/compiler/link/asm/vet and gzip/flate source.
Extraction is confined to this new transaction-owned local lane; no system
installation or machine environment/PATH change.

## Exact extracted compiler and offline harness

[Runtime self-identification](./GO1256_VERSION_CORRECTED.json):
`go version go1.25.6 linux/amd64`.

[Build](./HARNESS_BUILD.json) uses that extracted executable with
GOTOOLCHAIN=local, GOPROXY=off, GOSUMDB=off, CGO=0, Linux/amd64,
no VCS/build ID, and no network. The container's compiler and `/go` are hidden;
PATH is `/unavailable`. Docker is Linux isolation only, never Docker build or
compiler input. No Docker socket or privileged container is used.
The test-process shell and explicit chmod are isolation launch utilities, not
the qualified compression implementation.

The preserved harness source is [hash-bound](./HARNESS_SOURCE_BINDING.json);
the only changed compression variable is compiler/runtime **Go 1.25.6**, not
level, constructor, metadata or nominal stream. Its two applicable synthetic
tests pass, runtime-refusal test skips under the now-exact runtime, vet and static
build pass. The initial chmod lookup failure is [retained](./INITIAL_LAUNCH_FAILURE.json);
using explicit `/bin/chmod` fixed the isolation precondition without a new
download or candidate change.

## Exact app-first and certificate gates, twice

[Raw-byte comparison result](./COMPRESSOR_RESULT.json):

| Layer | Bytes in each run | Exact frozen SHA-256 | Byte equality |
|---|---:|---|---|
| Application | 3,201,563 | `e384c980a44e96f09d36cc4e6ffb44b4d7e03af6a75af1bd283c8cd9543aace7` | YES, run 1 and run 2 |
| Certificate | 105,884 | `af22bfbdda5d1f2c63684516b52acd617cd5913c758d117c044121992d67bb2d` | YES, run 1 and run 2 |

Each run starts in a fresh exclusive output workspace and a new networkless
container. Application byte equality gates certificate execution. The second
pair begins only after both first-run layers match. All four outputs equal the
frozen bytes; headers, CRC/ISIZE, complete DEFLATE and decompressed tar streams
are identical. **G3A_COMPRESSOR_DETERMINISM = PASS**.

No application binary was compiled, no tar stream regenerated and no image
manifest/index generated during qualification.

## Bound implementation, not overclaimed forensics

The winning harness uses Go 1.25.6 stdlib gzip/flate,
`gzip.NewWriterLevel(..., gzip.DefaultCompression)`, fresh default header
(mtime=0, OS=255), TeeReader/io.Copy with nominal 32 KiB input reads,
128 KiB buffered output, gzip Close then buffer Flush, no explicit gzip Flush.
There is no compressor daemon/root dependency.

This **measured portable equivalent** reproduces both frozen fixtures. It does
not retroactively prove the original BuildKit pipe's exact short-read sequence,
optional runtime level, installed patch set or historical binary hash.
Those historical forensic limits remain unchanged; the prior Go 1.27.2
byte-11 mismatch and descriptor bug evidence are preserved.

## Minimal staged input

[Static binary contract](./G3A_COMPRESSOR_INPUT.json):

- Type: `STATIC_COMPRESSOR_BINARY`
- Compiler/runtime: `go1.25.6`, stdlib only
- **2,166,932 bytes**
- SHA-256:
  `378bacae9bd14e6d2c428fb52ea537ae06bedae01392849293ba9863eb62f95c`
- Linux/amd64 ELF, **no interpreter**, Linux kernel only
- Root required: **NO**; daemon required: **NO**
- Repository: `g3-build-tooling`
- Artifact/media and immutable OCI manifest digest: explicitly frozen in the
  contract and [local envelope](./oci/compressor-manifest.json)
- **No push or OCI staging occurred**.

The archive and complete extracted toolchain are retained as provenance.
The static binary saves 203,851,494 payload bytes versus the extracted full tree,
and is the binary that actually passed all four fixture tests; selecting it is
therefore behaviorally justified, not a convenience assumption.
The official full-toolchain candidate contract also remains recorded.

## Prepared only, not executed

[Prepared assembler source](./prepared-assembler/main.go) replaces in-process
Go 1.27.2 gzip with the [staged-compressor adapter](./prepared-assembler/compressor.go).
It verifies compressor SHA and exact generated tar SHA, invokes the external
static compressor with exclusive outputs, and verifies resulting gzip SHA.
The original descriptor-size correction is retained. Generated intermediate
tar/gzip files belong to the new transaction workspace, not prior evidence.

[Proposed build binding](./PROPOSED_UPDATED_BUILD_BINDING.json) adds the proven
compressor. Preparation is syntax-formatted with extracted Go 1.25.6; **the new
assembler has not been compiled, tested or executed as a full transaction**.
Those checks belong to the separately proposed
[G3A_PORTABLE_FULL_REHEARSAL_RETRY_AUTHORITY](./G3A_PORTABLE_FULL_REHEARSAL_RETRY_AUTHORITY.md).
The proposal is **not issued authority** and does not claim private
reader/bootstrap/uploader/controller completion.

Frozen runtime manifest remains
`sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`.
No replacement image or new full image build was produced.

## Preservation and limits

[Required disposition](./GO1256_DISPOSITION.json) contains every output.
[Seal](./GO1256_VERIFICATION.json) and
[separate direct-byte verification](./GO1256_INDEPENDENT_VERIFICATION.json)
verify this packet, downloaded archive/extracted files, static runtime build
information, raw output equality and previous sealed roots/censuses. Integrity
PASS is not overall readiness PASS.

All writes are confined to the new isolated lane. Both worktree baselines are
recorded; no foreign product/infrastructure work is staged, reverted, committed
or dispositioned. G2's prior 16-resource estate evidence is historical, not a
new live census: this packet performs **zero Azure/Entra reads**.

**Azure/Entra/registry mutations = 0**. No Azure guest execution, registry test,
uploader, G3B work, package install, global PATH change or full image rebuild.
UE and Cora remain **INFRA_NO_GO**.

**STOP: FULL_BUILD_RETRY_AUTHORITY_REQUIRED = YES.**
