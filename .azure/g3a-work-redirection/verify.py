"""Independent exact seal/failure/isolation verifier; no runner or deployment imports."""

import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(name):
    return json.loads((HERE / name).read_text())


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    require(len(sys.argv) == 2, "SEALED_ROOT_ARGUMENT_REQUIRED")
    require(sha(HERE / "REDIRECTION_VERIFICATION.json") == sys.argv[1], "ROOT_CHANGED")
    seal = read("REDIRECTION_VERIFICATION.json")
    census = {str(path.relative_to(HERE)): sha(path) for path in HERE.rglob("*")
              if path.is_file() and path.name not in {"REDIRECTION_VERIFICATION.json", "INDEPENDENT_VERIFICATION.json"}}
    require(census == seal["fileHashes"], "LOCAL_EVIDENCE_CENSUS_CHANGED")
    for path, expected in seal["protectedFileHashes"].items():
        require(sha(path) == expected, "PROTECTED_HISTORY_CHANGED")
    fixture = read("REDIRECTED_FIXTURE.json")
    for path in ("/work/witness", "/work/sibling/witness", "/output/witness"):
        require(fixture["execution"][path] == {"execution": "DENIED", "errno": 13}, "NOEXEC_NOT_PROVEN")
    for path in ("/build/witness", "/tmp/witness"):
        require(fixture["execution"][path]["execution"] == "PERMITTED", "EXEC_NOT_PROVEN")
    require(fixture["frozenWorkChildAbsent"] and fixture["status"] == "PASS" and
            all(fixture["hostNegatives"].values()) and set(fixture["networkNegatives"].values()) == {101} and
            fixture["uidGid"] == 65532 and fixture["noNewPrivs"] == 1 and fixture["regain"] == "DENIED",
            "ISOLATION_NEGATIVE_NOT_PROVEN")
    raw = read("rehearsal\\GUEST_OFFLINE_RAW.json")
    result = read("REHEARSAL_RESULT.json")
    require(raw["records"] == [fixture, result] and raw["childExitCode"] == result["exitCode"] != 0 and
            result["stderr"] == "STAGED_COMPILER_EXECUTION: open /dev/null: no such file or directory\n",
            "RAW_FROZEN_FAILURE_CHANGED")
    require(raw["cleanup"]["status"] == "PASS" and raw["cleanup"]["executableContentsRemoved"] and
            raw["cleanup"]["executableMountsSurviving"] == 0 and
            {"/fixture-root/build", "/fixture-root/tmp"} <= set(raw["cleanup"]["unmounted"]), "CLEANUP_NOT_PASS")
    files = {str(path.relative_to(HERE / "rehearsal" / "output")): {
        "bytes": path.stat().st_size, "sha256": sha(path)}
        for path in (HERE / "rehearsal" / "output").rglob("*") if path.is_file()}
    require(files == raw["outputCensus"] and set(files) == {"compiler-diagnostic.txt"}, "OUTPUT_CENSUS")
    require((HERE / "rehearsal" / "output" / "compiler-diagnostic.txt").read_text() ==
            "STAGED_GO_INVOCATION [test -x ./...]\n", "GO_PROCESS_UNEXPECTEDLY_RAN")
    disposition = read("FINAL_DISPOSITION.json")
    require(disposition["PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED"] == "NO" and
            disposition["REDIRECTED_WORK_ROOT_FROZEN_REHEARSAL"] == "FAIL" and
            disposition["G3A_TRANSACTION_READINESS"] == "BLOCKED", "INVALID_AUTHORITY_OR_READINESS")
    for key in ("AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
                "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
                "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
                "AZURE_READS", "ENTRA_MUTATIONS", "REGISTRY_MUTATIONS", "RUN_COMMAND_DIAGNOSTIC_ACTIONS"):
        require(disposition[key] == 0, "UNAUTHORIZED_CLOUD_ACTIVITY")
    require(not (HERE / "AUTHORITY_CONSUMED.json").exists() and not list(HERE.glob("EVENT_*.json")),
            "UNEXPECTED_CLOUD_MARKER")
    output = {"status": "PASS_OFFLINE_FAILURE_AUTHORITY_UNCONSUMED", "rootSha256": sys.argv[1],
              "localFileReferences": len(census), "protectedReferences": len(seal["protectedFileHashes"]),
              "cloudCalls": 0, "deploymentModulesImported": False}
    with (HERE / "INDEPENDENT_VERIFICATION.json").open("x") as stream:
        json.dump(output, stream, indent=2)
        stream.write("\n")
    print("REDIRECTION_INDEPENDENT_VERIFICATION=PASS")


if __name__ == "__main__":
    main()
