# G3A single full rehearsal: mandatory stop

Mission: `NZ-20261008-INFRA-001`.

Exactly one local/offline full transaction was executed. It failed on an
assistant-introduced controller control-flow bug, not compression or image drift:
the exclusive manifest write and exact gate were incorrectly placed inside the
two-layer descriptor loop. The first write preserved the byte-exact frozen
manifest; the second write failed with:

```text
open /output/manifest.json: file exists
```

The sole remaining dependency is moving that write/gate outside the loop and
obtaining new authority for validation and another full transaction. The attempted
source and binary remain unchanged. No correction or second build was performed.

## Measured results

- Host-engine isolation was proven before any staged compiler invocation.
- Controller tests: five passed; vet and static build passed using staged Go
  1.27.2, with no host compiler or network.
- Application binary, both uncompressed tar streams, both gzip blobs, config and
  preserved manifest match the frozen output bytes exactly.
- Preserved manifest:
  `sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7`.
- OCI index/layout and full-transaction success were **not reached**.
- `G3A_PORTABLE_PRIVATE_BUILDER = BLOCKED`.
- `G3A_PORTABLE_IMAGE_REPRODUCTION = FAIL` for the incomplete full transaction.
- `G3_EXECUTION_READINESS = BLOCKED`.

## Self-containment and input size

The full transaction used a static staged controller, staged Go compiler/tools,
a transaction-generated test ELF and the proven staged Go 1.25.6 compressor.
The Go execution trace identifies the actual compiler/tool and test invocations.
Outer `/bin/sh` and `/bin/chmod` were preparation/boundary utilities only; neither
was used inside the full build transaction.

The exact staged build-input directory totals **265,084,641 bytes**. This includes
one compiler archive, source archive, CA, serialization templates, manifests and
member census, proven compressor, controller binary/source/tests, reader source
and final binding. It does not double-count the extracted preparation compiler.
Guest reader runtime, bootstrap/delivery channel and uploader/controller closure
remain unqualified and require their separate authority.

The first closeout incorrectly conflated a nonzero transaction exit with
self-containment failure. Both original closeout files are retained. The
[final disposition](./FULL_REHEARSAL_DISPOSITION_FINAL.json) and
[final executable census](./EXECUTABLE_CENSUS_FINAL.json) supersede those fields
without changing the failed full-transaction disposition.

## Evidence and boundaries

- [Raw output comparisons](./EXACT_BYTE_COMPARISON.json)
- [Input census](./STAGED_INPUT_CENSUS.json)
- [Issued isolation command](./FULL_TRANSACTION_ISSUED.json)
- [Transaction exit and diagnostics](./FULL_TRANSACTION_RESULT.json)
- [Preserved outputs](./clean-room/transaction/)
- [Seal](./FULL_REHEARSAL_VERIFICATION.json)
- [Independent verification](./FULL_REHEARSAL_INDEPENDENT_VERIFICATION.json)

No Azure/Entra/registry reads or mutations, guest execution, uploader work,
package installation or global PATH changes occurred. The G2 terminal root and
prior sealed packets remain protected. Foreign product work was not edited,
staged, reverted or dispositioned. UE and Cora remain `INFRA_NO_GO`.

Commands:

- `python -B prepare.py`: PASS isolation and verified input preparation.
- `python -B compile.py`: PASS five tests, vet and controller build.
- `python -B run_once.py`: FAIL; the single authorized transaction stopped on
  duplicate exclusive manifest write.
- `python -B closeout.py`: PASS direct output comparisons and initial stop record.
- `python -B seal.py`: see the persisted seal for evidence-integrity outcome.
- `python -B independent_verify.py <root>`: see the persisted independent result.
