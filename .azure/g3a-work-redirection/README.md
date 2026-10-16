# Redirected work-root amendment: offline STOP

Mission `NZ-20261008-INFRA-001`. Same unconsumed live authority; no Azure
reads, mutations, registry access or new runner build.

## Proven contracts

- [CLI contract](CLI_CONTRACT.json): exact frozen assembler takes inputs,
  work and output as three supported positional arguments. Work is
  exclusively created; output exists separately and is never executed.
- [Archive census](ARCHIVE_EXECUTABILITY.json): every archive member,
  mode, bytes and digest matched the frozen manifest. Source has no
  executable files. Toolchain binaries and maintenance scripts are
  individually hash-bound; scripts are not invoked. No symlinks, device
  nodes, FIFOs or traversal entries were present.
- [Execution contract](EXECUTION_CONTRACT.json): staged assembler and
  compressor; Go driver and compile/asm/link/vet beneath
  `/build/transaction/go`; derived test ELF beneath `/tmp/go-build...`.
- [Local fixture](REDIRECTED_FIXTURE.json): `/work` and `/output`
  execution denied, `/build` and `/tmp` execution permitted. Numeric
  privilege drop, no-new-privileges, regain denial, host negatives and
  disconnected network passed. `/build/transaction` was initially absent.

The failed nested pre-mount topology is retired, not relabeled or edited.
This fixture is not a production runner or live primitive requalification.

## Actual rehearsal failure

`python -B run_local.py` invoked the exact frozen assembler once with:

```text
/inputs/portable-assembler /inputs /build/transaction /output/transaction
```

It created the child and extracted the tooling/source successfully.
It then failed before starting the Go subprocess:

```text
STAGED_COMPILER_EXECUTION: open /dev/null: no such file or directory
```

The frozen assembler constructs `exec.Command` without setting `Stdin`.
Go's `os/exec.Cmd.childStdin` therefore opens `os.DevNull`. The isolated
fixture exposes no `/dev/null`. The compiler diagnostic contains only
the attempted `STAGED_GO_INVOCATION`, not evidence that the Go process
started. Neither changing the assembler nor adding a device contract and
retrying is performed after this explicit stop condition.

## Measurements and cleanup

[Raw evidence](rehearsal/GUEST_OFFLINE_RAW.json) retains actual independent
statvfs observations at requested 2ms intervals. Failed-run observed
high-water values:

| Filesystem | Allocated bytes | Allocated inodes |
| --- | ---: | ---: |
| `/build` | 288530432 | 17382 |
| `/tmp` | 2170880 | 2 |

These are sampled observations from a **failed**, incomplete rehearsal;
not certified successful-build peaks. Inodes include directories. Final
allocation before cleanup was 288530432 bytes/17382 inodes for `/build`
and 0 bytes/1 inode for `/tmp`. Required successful-build capacity and
150% capacity contracts remain unresolved.

The observer removed both executable filesystems' contents, unmounted all
fixture mounts, and checked mountinfo for zero surviving executable
mounts. Docker's disposable container also exited with `--rm`.

## Validation

- `python -B prepare.py`: PASS source/configurability/archive census and
  prior evidence preservation.
- `python -B run_local.py`: mount fixture PASS; frozen rehearsal FAIL.
  No automatic retry. All seven image exactness gates were not reached.
- `python -B close.py`: seals exact stop disposition and preserved inputs.
- `python -B verify.py <seal>`: independent raw/hash/isolation/failure
  checks; no deployment module imports or cloud calls.

Prior qualified baseline remains intact. Production-compatible runner,
dispatch, capacity and transaction closure remain BLOCKED. Section 31's
offline stop prevents live authority consumption and conditional closure.
