# V2 bounded runner source integration

This lane is append-only source-integration evidence, not runtime qualification.
V1, frozen execution primitives, protected verification history, and the foreign
worktree remain untouched. The parent owns the single frozen-core permit and all
subsequent live/bootstrap decisions. No Azure or registry operation is performed
by these tools.

## Identity and policy

`SOURCE_GATE_PASS_5.json` selects the final source binding. The canonical source
identity is SHA-256 of the compact, sorted filename-to-SHA256 JSON map. Only the
generated `boundRunnerSourceSHA256` literal in `authority_binding.go` is replaced
with 64 zeroes for this calculation. Every other source/asset byte is exact.
`fullSources` separately records actual source hashes and lengths. The stable
policy has its own raw-byte digest. This avoids a source-hash fixed point without
normalizing policy, inputs, constructors, or executable identity.

The final candidate is `production-runner-v2`, a static Linux amd64 ELF. Source
tests, 30-row baseline AST, static AST, 67 extended whole-function AST identities,
and 40 actual CLI denials passed before candidate handoff. None invoked the real
constructor or frozen core.

## Runtime authority

The public argument order is fixed:

```
runner --production --execution-authority ABSOLUTE_PATH --execution-authority-sha256 RAW_BYTE_SHA256
runner --production-dispatch-proof --execution-authority ABSOLUTE_PATH --execution-authority-sha256 RAW_BYTE_SHA256
```

The complete field list and fixed values are in `authority-policy.json`.
Authority lives at `.g3a-transaction-TRANSACTION/execution-authority.json`, alongside
`inputs` and private `receipts`. It is canonical, absolute, regular, non-symlink,
euid-owned, readonly, and no more than 16384 bytes. Its explicit raw-byte digest,
actual running ELF, source, policy, exact input census/root, payload, manifest,
target, time window (at most four hours), exact capacities, and strict mode are
validated. Full input bytes are checked before consumption.

The original exclusive, file-and-directory-fsynced `transaction.consumed.json`
is written after validation and immediately before setup/launch. It is never
rolled back. Another digest cannot reuse that transaction. Parent and child bind
the same runtime digest and parent PID; neither contains a compiled transaction
authority pin. No issuer signature, cryptographic authentication, or secret is
claimed; issuance and governance remain control-plane responsibilities.

## Synthetic fixture generator

`generate_authority.make_authority(mode, transaction, linux_boundary,
candidate=None, now=None)` permits only `local-test` and `dispatch-proof`.
Transactions must use `SYNTHETIC_LOCAL_TEST_` or `SYNTHETIC_DISPATCH_PROOF_`.
The CLI exclusively creates its output and prints its raw digest:

```
python generate_authority.py --mode local-test --transaction SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --linux-boundary /proof/.g3a-transaction-SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --output FRESH_AUTHORITY.json
```

Copy the exact bytes into the private Linux transaction, chmod 0400, and use the
printed digest. Existing fixtures expire; regenerate instead of changing their
history. The generator cannot issue a production authority.

## Parent-only harness

From PowerShell, the exact parent command is:

```powershell
$lane = 'C:\APPS\worktrees\nzila-g2-provenance\.azure\g3a-runner-v2-source'
python -B "$lane\parent_local_harness.py" --mode local-test --run-root 'C:\APPS\worktrees\nzila-g2-provenance\.azure\g3a-runner-v2-local-qualification' --transaction SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION --parent-single-core-permit
```

This command was **not executed** by the source worker. It consumes the parent's
one core permit. It uses the exact cached image, no network/pull, an external
readonly 15-file input bind (265077049 bytes; excludes `binding.json`), private
Linux tmpfs receipts rather than permissive Windows bind permissions, and the
original capability allowlist. The outer memory cap is 3 GiB; actual `/build`
and `/tmp` retain exactly 1 GiB/32768 inodes and 256 MiB/4096 inodes. The actual
assembler command remains `/inputs/portable-assembler /inputs /build/transaction
/output/transaction`. Seven exact output digests remain frozen.

For parent static qualification, replace mode with `dispatch-proof`, transaction
with `SYNTHETIC_DISPATCH_PROOF_V2_QUALIFICATION`, and choose a distinct fresh
run root. That path uses the same validator, consumption, actual constructor,
and dispatch boundary, with static witness only and zero assembler invocations.
Neither qualification is retryable. Saved evidence survives the Docker container.
The harness checks actual replay denial, root cleanup, mount-state preservation,
and complete evidence; it must not be represented as qualified before running.

## Receipt, archive, and full evidence API

Receipts are `receipts/transaction.consumed.json` and one
`receipts/.g3a-isolation-proof-*/` containing `baseline.json`,
`production-result.json`, and `outputs.tar`. `production-result.json` preserves
actual child stdout/stderr, errors, transaction/digest, and archive SHA/length.
Archive payload is at most 64 MiB; transport allowance is 65 MiB. No output is
returned outside the governed archive channel. The raw child deliberately keeps
`checks.baseline=NOT_RUN`; the parent's complete baseline file is transported
separately, never rewritten into invented child PASS evidence.

`runtime_evidence_transport.collect(receipts, authority_path, mode, candidate_sha,
candidate_bytes, source_sha, policy_sha)` reads and validates all original bytes.
Require a separately recorded runner exit code 0 before treating it as execution
success. `encode(envelope, dictionary)` / `decode(diagnostic, dictionary)` are
lossless zlib/Base64 transport; dictionary is nonempty and at most 32000 bytes,
one diagnostic line is at most 3800 characters, total diagnostic at most 16384.
Oversized evidence fails closed: no truncation or summary substitute.
`reader_code(...)` emits a self-contained readonly collector for the static proof
only and binds the supplied dictionary digest. Production archives are preserved
locally in full; they are not claimed to fit a cloud diagnostic.

Transport tests use expressly fabricated unit fixtures, not live proof.
Actual live transport feasibility, pinned guest, exact frozen outputs, runtime
cleanup, and production-compatible runner status remain NOT_RUN/BLOCKED.

The sole parent readsurface is `PARENT_V2_SOURCE_REPORT.json`. Its `reportHash`
is SHA-256 of compact sorted JSON excluding that field; its raw file digest is
reported separately. Do not overwrite the report or prior attempts.
