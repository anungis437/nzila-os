# Frozen DEFLATE compressor qualification: blocked on exact toolchain

Mission `NZ-20261008-INFRA-001`. This packet is compression-only.

## Exact surviving dependency

**Go 1.25.6 is not present in the known local/governed toolchain inputs.**
The current integrated BuildKit engine was compiled with that exact version.
This authority prohibits acquiring or installing the missing toolchain.
Therefore no frozen application-layer compression candidate was executed;
the certificate gate and double compressor rehearsal were not reached.

[Proposed immutable input](./PROPOSED_GO_1_25_6_INPUT.json), from official release
metadata (archive **not downloaded**):

- `go1.25.6.linux-amd64.tar.gz`
- 59,768,880 bytes
- SHA-256 `f022b6aad78e362bcba9b0b94d09ad58c5a70c6ba3b7582905fababf5fe0181a`

The next authority should authorize only acquisition, verification and freezing
of that exact compiler input, followed by bounded compressor-only testing of the
application tar, then certificate tar only on application byte equality.
No full image build retry authority is prepared here.

## Strongest recovered engine provenance

[Read-only Docker version](./DOCKER_VERSION.json),
[buildx version](./BUILDX_VERSION.json),
[builder inspection](./BUILDX_INSPECT.json), and
[exact daemon build information](./DAEMON_GO_BUILD_INFO.json):

| Component | Observed value |
|---|---|
| Docker Engine | 29.2.0, server commit `9c62384` |
| Docker Desktop | 4.60.1 (218372) |
| buildx | v0.31.1-desktop.1, commit `3d153e82f8d99923062781d390607dabe1679613` |
| Builder | `desktop-linux`, `docker` driver |
| BuildKit module | v0.27.0 embedded in Docker's daemon |
| Daemon compiler | **go1.25.6** |
| Exact recovered executable | `/usr/bin/dockerd`, 101,480,136 bytes |
| Executable SHA-256 | `0cec334e931d4ffe8b7373ff564150bafc7ee1f2dcb2ef9c970673f796bd964d` |

[Exact executable export record](./EXACT_DAEMON_BINARY.json) was captured by
reading the running daemon's `/proc/.../exe` through local Docker Desktop WSL.
No daemon start/stop, privileged container, socket mutation or engine update was
performed. `go version -m` inspected that exact exported executable offline.
This is **EXACT_BINARY provenance of the currently running integrated engine**,
not a separately recovered `buildkitd` executable/image.

The sealed original build log identifies the same `desktop-linux` docker driver,
and prior evidence identifies the same engine/BuildKit versions. However no
contemporaneous daemon hash was captured during the frozen image build.
Historical exact-byte association therefore remains **VERSION_ONLY**, not an
unsupported claim that nobody changed the machine between packets.

The BuildKit-specific commit is **UNPROVEN**: embedded module version is
v0.27.0, but Docker's commit is not BuildKit's commit. Public release source is
version-scoped supporting evidence, not proof of an unrecorded exact installed
BuildKit patch set.

## Compression call-path evidence

[Source provenance](./PUBLIC_SOURCE_PROVENANCE.json) records bounded public source
snapshots. No workspace code or credentials were sent to a third party.

- [BuildKit gzip](./BUILDKIT_GZIP.txt): `gzip.NewWriterLevel`; default level is
  `gzip.DefaultCompression` unless `comp.Level` is supplied.
- [Timestamp converter](./BUILDKIT_CONVERTER.txt):
  `NewWithRewriteTimestamp` selects conversion when the timestamp annotation does
  not match; creates or resets a **128 KiB output** `bufio.Writer`; constructs a
  fresh compressor; wraps close in a once-only wrapper; calls
  `io.Copy(zw, io.TeeReader(rdr, diffID.Hash()))`; closes gzip, then flushes the
  output buffer. Deferred close does not produce a second gzip Close.
- [Tar pipe](./BUILDKIT_TAR_PIPE.txt): a goroutine streams header rewriting and
  archive data through `io.Pipe`. This can yield short reads; a 32 KiB consumer
  buffer does **not** prove every gzip Write is exactly 32 KiB.
- [Go 1.25.6 io](./GO_1_25_6_IO_SOURCE.txt): TeeReader lacks WriterTo;
  `io.Copy`'s generic loop allocates a 32 KiB buffer when neither optimized
  interface applies. It writes the actual bytes returned by each read.
- [Go 1.25.6 gzip](./GO_1_25_6_GZIP_SOURCE.txt): fresh header OS=255, no explicit
  timestamp/name/comment/extra in the shown constructor path; compressor uses
  stdlib flate. This fits the observed zero-mtime OS=255 frozen headers.

The pooled object is the **output buffer**, not an evidenced gzip compressor
pool. No parallel compression is shown in this per-layer path. There is no
explicit gzip Flush in the converter; only Close then buffered-output Flush.

`BUILDKIT_COMPRESSION_CALL_CONTRACT = PARTIAL`.
The frozen layer timestamp annotations bind the relevant conversion behavior.
The source establishes default-level behavior, but the exact installed
exporter's optional `comp.Level`, patch set, and actual pipe short-read sequence
have not been observed. **FROZEN_COMPRESSION_LEVEL remains UNPROVEN**; the source
default `gzip.DefaultCompression (-1)` is not promoted to a proven runtime
configuration. No arbitrary levels or chunk-size brute force were tested.

## Bounded candidate disposition

[Candidate matrix](./CANDIDATE_MATRIX.json) contains exactly A/B/C:

1. **A: stdlib harness compiled with recovered Go 1.25.6.**
   Blocked before testing: exact compiler is not an available governed input.
2. **B: minimal extracted/reused original compression path.**
   The source trace shows its compressor is Go stdlib; extracting the small
   wrapper does not supply the embedded Go 1.25.6 flate implementation.
   No alternate-version substitute was tested as an exact candidate.
3. **C: original component as compressor.**
   The recovered component is a 101 MB integrated `dockerd`, not a standalone
   library/compressor executable. No daemon-free layer-compression entry point
   is proven. It is evidence only, not silently staged as a minimal compressor.
   No original daemon operation was invoked to produce bytes.

The prepared [harness source](./harness/main.go) hard-rejects execution unless
`runtime.Version()` is exactly `go1.25.6`, verifies the input fixture SHA, creates
output exclusively, surfaces copy/close/flush errors and reports exact output
SHA/size. Its nominal TeeReader/io.Copy and 128 KiB output-buffer implementation
is a **candidate contract**, not proof of the original pipe's short-read
schedule. Exact app output would still have to be compared byte-for-byte,
followed by the cert and fresh double runs.

[Three synthetic unit tests, vet and development build](./HARNESS_DEVELOPMENT_CHECK.json)
pass with already governed Go 1.27.2. Tests cover round trip/header, error
propagation and refusal under a non-target runtime. **No frozen candidate
compression** was run by those checks; the generated development binary is not
the qualified compressor input. Existing Windows Go 1.27.0 and cached Go 1.26.9
were recorded, not mistaken for Go 1.25.6 or used as speculative candidates.
This was a bounded availability check, not a whole-machine absence claim.

## Frozen fixture preservation

[Fixture inventory](./FROZEN_FIXTURES.json) exports the exact tar/gzip streams
from the sealed frozen OCI archive and checks the uncompressed streams against
the already-proven clean-room tar bytes. No application compile, tar generation,
config construction or complete G3A transaction was performed.

The prior failed Go 1.27.2 stdlib candidate remains
`FAILED_EXACT_BYTES`: gzip headers/trailers equal, first DEFLATE divergence at
zero-based byte 11. Its exact mismatch, descriptor-size history and all prior
roots are unchanged. This packet has **no new candidate mismatch** because the
exact runtime prerequisite is unavailable.

## Required disposition and preservation

[Machine disposition](./COMPRESSOR_DISPOSITION.json) contains every required
field. `FROZEN_COMPRESSOR_CONTRACT = UNRESOLVED`.
`G3A_PORTABLE_PRIVATE_BUILDER = BLOCKED`.
`G3_EXECUTION_READINESS = BLOCKED`.

No winning compressor OCI contract is invented. The proposed compiler archive's
official metadata SHA/size is **not** a locally verified payload or OCI manifest
digest. `G3A_COMPRESSOR_INPUT = UNRESOLVED`.

[Seal](./COMPRESSOR_VERIFICATION.json) and
[separate direct-byte verification](./COMPRESSOR_INDEPENDENT_VERIFICATION.json)
check current/historic bytes and exact prior file censuses, not readiness.
Both worktree HEAD/status baselines are recorded before writes and at sealing;
foreign product and infrastructure work is not edited or dispositioned.

Two initial WSL quoting attempts and a CRLF stdin attempt failed while locating
the daemon; an LF byte script resolved the read. Two guessed public source paths
returned 404; the version-scoped GitHub tree identified the correct converter
paths. Neither failure caused a cloud mutation, installation or fallback proof.

This packet has **zero Azure/Entra reads and zero Azure/Entra/registry
mutations**. No Azure guest execution, uploader work, registry test, G3B work,
image rebuild or frozen digest replacement. G2's last 16-resource live census is
historical and was not refreshed in this packet.

`FULL_BUILD_RETRY_AUTHORITY_REQUIRED = YES` for any future full image build.
No such authority is prepared while compression remains unqualified.
UE and Cora remain `INFRA_NO_GO`.
