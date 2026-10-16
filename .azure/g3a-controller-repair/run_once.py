"""Exactly one full repaired transaction after every pre-execution gate."""

import hashlib
import tarfile

from common import HERE, IMAGE, PRIOR, baseline, boundary, ensure, fresh, load, run, sha


def main():
    fresh("CONCURRENCY_RUN.json", baseline())
    review = load(HERE / "CONTROLLER_PATCH_REVIEW.json")
    ensure(review["CONTROLLER_LOCAL_VALIDATION"] == review["MANIFEST_SINGLE_WRITE_REGRESSION"] == "PASS" and
           review["UNRELATED_SOURCE_CHANGES"] == 0, "CONTROLLER_VALIDATION_REQUIRED")
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    inputs = HERE / "inputs"
    ensure({path.name: {"sha256": sha(path), "bytes": path.stat().st_size} for path in inputs.iterdir()} ==
           census["entries"], "STAGED_INPUT_CENSUS_STOP")
    binding = load(inputs / "binding.json")
    for filename, expected in (("source.tar", binding["sourceMembers"]),
                               ("go-toolchain.tar", load(inputs / "toolchain-members.json"))):
        seen, files = set(), {}
        with tarfile.open(inputs / filename) as archive:
            for member in archive:
                key = member.name.rstrip("/")
                ensure(key and not key.startswith("/") and "\\" not in key and
                       all(part not in ("", ".", "..") for part in key.split("/")) and
                       key not in seen and member.mode & ~0o777 == 0 and
                       (member.isfile() or member.isdir()), "ARCHIVE_SAFE_CENSUS_STOP")
                seen.add(key)
                if member.isdir():
                    ensure(member.mode == 0o755 and any(name.startswith(key + "/") for name in expected),
                           "ARCHIVE_DIRECTORY_STOP")
                else:
                    raw = archive.extractfile(member).read()
                    files[key] = {"sha256": hashlib.sha256(raw).hexdigest(),
                                  "bytes": len(raw), "mode": member.mode}
                    ensure(key in expected and files[key] == expected[key], "ARCHIVE_MEMBER_STOP")
        ensure(files == expected, "ARCHIVE_EXACT_CENSUS_STOP")
    output = HERE / "clean-room" / "transaction"
    ensure(not any(output.iterdir()), "FRESH_EMPTY_TRANSACTION_REQUIRED")
    mounts = ["--mount", "type=bind,source=" + str(inputs) + ",target=/inputs,readonly"]
    command = boundary() + mounts + ["--entrypoint", "/bin/sh", IMAGE, "-c", """
set -eu
test -x /inputs/portable-assembler
test -x /inputs/compressor-go1256
for name in go docker buildx buildctl buildkitd apt apt-get apk yum dnf; do
  if command -v "$name" >/dev/null 2>&1; then exit 91; fi
done
for path in /usr/local/go/bin/go /var/run/docker.sock /run/docker.sock /etc/ssl/certs/ca-certificates.crt /frozen /var/lib/docker /var/lib/buildkit; do
  test ! -e "$path"
done
printf 'PRE_EXECUTION_INPUT_EXECUTABILITY_AND_ISOLATION_PASS\\n'
"""]
    precheck = run("IMMEDIATE_PRE_EXECUTION_ISOLATION", command, 90)
    ensure(precheck.returncode == 0, "IMMEDIATE_ISOLATION_STOP_BEFORE_APPLICATION")
    fresh("STAGED_INPUT_INTEGRITY.json", {
        "status": "PASS", "fileCensus": len(census["entries"]), "archivesRawMembersVerified": True,
        "immutablePayloadsUnchanged": True, "allowedRepairChanges": census["changes"],
        "compilerNotInvokedBeforeThisCheck": True,
    })
    command = boundary() + mounts + [
        "--mount", "type=bind,source=" + str(output) + ",target=/output",
        "--entrypoint", "/inputs/portable-assembler", IMAGE, "/inputs", "/work/transaction", "/output",
    ]
    fresh("FULL_RETRY_ISSUED.json", {
        "command": command, "fullRetryOrdinal": 1, "maximumFullRetries": 1,
        "retryOnFailure": False, "hostEngineRole": "ISOLATION_ONLY", "network": "NONE",
        "dockerSocketMounted": False, "hostCompilerHidden": True, "hostCertificatesHidden": True,
        "frozenImageMounted": False, "fullApplicationTransaction": True,
    })
    result = run("FULL_RETRY_RESULT", command, 900)
    consumed = (output / "compiler-diagnostic.txt").exists()
    fresh("AUTHORITY_CONSUMPTION.json", {
        "FULL_REHEARSAL_RETRY_AUTHORITY_CONSUMED": "YES" if consumed else "NO",
        "fullRetriesInvoked": 1, "applicationCompilerInvocationEvidence": consumed,
        "additionalFullRetries": 0, "noAutomaticRepairOrRetry": True,
    })
    print(result.stdout + result.stderr)
    ensure(result.returncode == 0, "FIRST_RETRY_FAILURE_STOP_NO_AUTOMATIC_REPAIR_OR_SECOND_RETRY")
    ensure(load(output / "result.json")["manifestDigest"] ==
           "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
           "FROZEN_MANIFEST_GATE_STOP")
    print("SINGLE_REPAIRED_FULL_TRANSACTION_PASS_STOP_NO_PUSH")


if __name__ == "__main__":
    main()
