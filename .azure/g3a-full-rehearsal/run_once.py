"""One exclusive full transaction. No retry, uploader, registry or cloud calls."""

import json
import subprocess

from prepare import HERE, IMAGE, baseline, boundary, ensure, fresh, load, sha, write


def main():
    fresh("CONCURRENCY_RUN.json", baseline())
    ensure(load(HERE / "ASSEMBLER_BUILD.json")["exitCode"] == 0, "CONTROLLER_BUILD_REQUIRED")
    census = load(HERE / "STAGED_INPUT_CENSUS.json")
    inputs = HERE / "inputs"
    ensure({path.name: {"sha256": sha(path), "bytes": path.stat().st_size}
            for path in inputs.iterdir()} == census["entries"], "STAGED_INPUT_CENSUS_CHANGED_STOP")
    output = HERE / "clean-room" / "transaction"
    ensure(not any(output.iterdir()), "EXCLUSIVE_EMPTY_FULL_TRANSACTION_REQUIRED")
    command = boundary() + [
        "--mount", "type=bind,source=" + str(inputs) + ",target=/inputs,readonly",
        "--mount", "type=bind,source=" + str(output) + ",target=/output",
        "--entrypoint", "/inputs/portable-assembler", IMAGE,
        "/inputs", "/work/transaction", "/output",
    ]
    fresh("FULL_TRANSACTION_ISSUED.json", {
        "command": command, "fullTransactionOrdinal": 1, "maximumAuthorizedFullTransactions": 1,
        "entrypoint": "STAGED_INPUT", "network": "NONE", "hostCompilerHidden": True,
        "hostCertificatesHidden": True, "frozenImageMounted": False, "dockerSocketMounted": False,
        "hostEngineRole": "OUTER_ISOLATION_ONLY", "retryAllowed": False,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=900)
    write(HERE / "FULL_TRANSACTION_LOG.txt", (result.stdout + result.stderr).encode())
    fresh("FULL_TRANSACTION_RESULT.json", {
        "exitCode": result.returncode, "fullTransactions": 1,
        "stdout": result.stdout, "stderr": result.stderr,
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "cloudReads": 0, "registryCalls": 0, "guestExecution": False,
    })
    print(result.stdout + result.stderr)
    if result.returncode != 0:
        raise RuntimeError("FIRST_EXACT_GATE_FAILURE_STOP_NO_SECOND_TRANSACTION")
    ensure(load(output / "result.json")["manifestDigest"] ==
           "sha256:82b24793125bceae37828bb3c1adea26882a33cff5ca557fa49d370853db93b7",
           "EXACT_MANIFEST_STOP")
    print("SINGLE_FULL_REHEARSAL_EXACT_FROZEN_MANIFEST_PASS_STOP")


if __name__ == "__main__":
    main()
