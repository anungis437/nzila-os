# Governed two-object final-runner delivery

This lane is local-only. No candidate rebuild, frozen-core invocation, Azure
operation, registry operation, production execution authority, or live authority
consumption occurred. The pinned-guest proof and CAD 3.00 gate remain the parent's
responsibility.

## Published artifacts

Use `ARTIFACT_BINDING.json`, not the initial compiler-only shim receipt.
The published `g3a-handoff` object is the local file
`g3a-handoff-bound-reader`: a static Go ELF followed by a hash-bound, compressed,
read-only reader footer. Its compiled ELF prefix is unchanged. The footer contains
the exact sealed candidate reader and dictionary; it is not execution authority.
The second object, `g3a-proof-capsule`, is a deterministic USTAR containing
the unchanged candidate and fifteen exact inputs, not a candidate executable.

The shim accepts only `--deliver-bound-static-proof <compiled bundle digest>`
or the read-only `--verify-bound-bundle <same digest>`. It rejects alternative
arguments, roots, commands, capacities, and payloads. Whole-bundle and individual
member validation precede staging; the second streaming pass revalidates bytes.
Inputs are staged only on exclusive outer disk, separately readonly-bound at
`/inputs` by the unchanged candidate. No input-memory tmpfs or `/build` charge.
The unchanged candidate invokes only its governed harmless static proof boundary.
The shim removes only recorded, transaction-owned inode identities and retains
the candidate, bundle, and exact evidence for diagnosis.

## Parent APIs and retention

Load `result_parser.py` with this lane on `sys.path`, then call `parse(message)`.
The compact handoff marker is not success: it requires the complete diagnostic.
`evidence_transport.diagnostic_script()` and `reader_script()` take **no arguments**.
They return the fixed 1156-byte read-only shell invocation; no selectable root,
proof file, dictionary, or execution configuration. `decode(message)` returns all
four unchanged strings: baseline, proof, runtime, and handoff JSON.

The full diagnostic line is limited to 3800 characters. Oversize, malformed,
duplicate, truncated, substituted, and trailing data fail closed, with no fallback.
The actual local line was 1620 characters. The full parser additionally requires
the pinned Azure kernel, root/security baseline, exact twenty checks, hard limits,
network/privilege negatives, readonly input layout, and complete cleanup.
Extension success and later cloud resource cleanup must be checked separately.
Preserve the four raw strings before removing any live proof-owned resources.

## Local verification

`FINAL_HANDOFF_VALIDATION.json` records actual published-shim execution of the
unchanged candidate. `DIAGNOSTIC_VALIDATION_FINAL.json` records exact diagnostic
execution, six filesystem/identity denials, and byte-for-byte restoration.
The existing local image lacks Ubuntu's `/usr/bin/python3`; tests supplied only
interpreter path aliases plus an owned shell fixture. No production source or
candidate evidence was substituted. Local kernel evidence is deliberately rejected
by the pinned parser. Synthetic pinned positive parser fixtures are test data only.

Initial failed attempts are preserved: the Go test writer's USTAR device fields
needed canonicalization, and the local image's interpreter layout required a
fixture. Neither changed the compiled Go shim prefix or the sealed candidate.

Portable repeatable checks:

```powershell
Set-Location C:\APPS\worktrees\nzila-g2-provenance\.azure\g3a-hard-runner-delivery
python -B -m unittest test_delivery_evidence -v
python -B -c "from verify_delivery import verify; print(verify())"
```

Build/actual-handoff producers are exclusive one-shot commands; do not rerun them
into existing receipts or recreate removed validation resources. Their exact
commands, results, local cleanup, and source census are retained in the parent report.
Section 24 separates exact raw input classes, tar overhead, two-object bytes,
and private control invocation bytes. The historical 100 MB gate is inapplicable.
