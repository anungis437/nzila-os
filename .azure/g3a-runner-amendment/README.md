# Production runner amendment: offline STOP

Mission: `NZ-20261008-INFRA-001`.

The existing isolation baseline remains QUALIFIED. No previous capsule,
assembler, compressor, registry primitive or sealed proof was modified.

## Evidence

- [Execution census](EXEC_PATH_CENSUS.json): exact frozen assembler,
  compressor, Go driver, compile/asm/link/vet and generated test execution.
- [Temporary-path census](TEMP_PATH_CENSUS.json): `/tmp/go-build<random>`
  executes the generated test ELF. `TEMP` and `TMP` are not passed;
  `TMPDIR=/tmp` is explicit. Required capacity is not qualified.
- [Mount fixture](LOCAL_MOUNT_RESULT.json): parent `/work`, `/output` and
  sibling paths reject execution; `/work/transaction/go` and the census-
  justified `/tmp` executable exception permit it. Disposable mount/network
  namespaces, chroot, no-new-privileges, numeric privilege drop, privilege
  regain denial and host/network negatives passed.
- [Actual frozen rehearsal](FROZEN_REHEARSAL_RESULT.json): FAIL before any
  compiler invocation: `mkdir /work/transaction: file exists`.

The frozen assembler calls `os.Mkdir(work,0700)` and its extractor calls
`os.Mkdir(work/go,0700)`. Both paths must initially be absent. Pre-mounting
the nested executable filesystem requires those directories to exist.
No broad executable `/work` fallback, assembler change, privileged
post-drop mount helper, asynchronous mount interception or retry was used.

This disproves the tested **pre-mounted** topology, not every conceivable
future compatible runner. A different lifecycle would require an explicit
reviewed contract; this packet stops at the observed rehearsal failure.

## Validation and authority

`python -B census.py`: PASS on the final invocation; earlier read-only
metadata/parser failures are preserved in distinct concurrency receipts.

`python -B run_local.py`: mount fixture PASS, actual core rehearsal FAIL.
The first fixture setup failed before mount acceptance or core invocation
because Docker had already created its tmpfs mount point. Correcting that
local fixture setup did not replay the assembler: it ran exactly once.

`python -B close.py` seals the offline disposition and preserved references.
`python -B verify.py <root-sha256>` independently checks the resulting seal,
raw execution denials, actual core failure, exact input hashes and no-live
markers. Neither command dispatches cloud work.

No amended production candidate was built. No Azure read or mutation,
Entra lifecycle, registry access or live guest attempt occurred.
The new single-live-attempt authority remains unconsumed. The production
runner and transaction remain BLOCKED. Conditional production closure
did not activate.
