"""Independent read-only verification of earned scope, exact evidence and seals."""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def main():
    root = load(HERE / "FINAL_VERIFICATION.json")
    count = 0
    for group in ("fileHashes", "protectedFileHashes"):
        for path, expected in root[group].items():
            require(digest(path) == expected, "SEALED_BYTES_CHANGED_" + path)
            count += 1
    final = load(HERE / "FINAL_DISPOSITION.json")
    require(digest(HERE / "FINAL_DISPOSITION.json") == root["finalDispositionSHA256"],
            "FINAL_DISPOSITION_NOT_BOUND")
    require(final["G3A_PRODUCTION_COMPATIBLE_RUNNER"] == "QUALIFIED" and
            final["PRODUCTION_RUNNER_PROOF_RESIDUAL_STATE"] == "ZERO" and
            final["G3A_TRANSACTION_READINESS"] == "BLOCKED" and
            final["G3A_CONTROLLER"] == final["G3A_BICEP_PACKAGE"] == "INCOMPLETE",
            "QUALIFICATION_SCOPE_OVERCLAIM")
    require(all(final[name] == "NO" for name in (
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED", "G3A_EXECUTION_AUTHORIZED",
        "G3B_EXECUTION_AUTHORIZED", "G3_TECHNICAL_EXECUTION_AUTHORIZED")),
        "UNISSUED_TECHNICAL_AUTHORITY_CHANGED")
    require(final["UE_INFRA"] == final["CORA_INFRA"] == "INFRA_NO_GO", "PRODUCT_NO_GO_CHANGED")
    counters = final["mutationCounters"]
    require([counters[name] for name in (
        "AZURE_MUTATING_DISPATCHES", "AZURE_SUCCESSFUL_MUTATING_DISPATCHES",
        "AZURE_REJECTED_MUTATING_DISPATCHES", "AZURE_DELETE_DISPATCHES",
        "ROLE_ASSIGNMENT_CREATES", "ROLE_ASSIGNMENT_DELETES", "UAMI_CREATES", "UAMI_DELETES",
        "RUN_COMMAND_DIAGNOSTIC_ACTIONS", "REGISTRY_MUTATIONS")] ==
        [11, 11, 0, 4, 2, 2, 1, 1, 1, 0], "EXACT_MUTATION_COUNTERS_CHANGED")
    require(load(HERE / "FINAL_LOCAL_CHECKS.json")["status"] == "PASS", "FINAL_TESTS_NOT_PASS")
    report = {
        "status": "PASS", "verifiedHashReferences": count,
        "rootSHA256": digest(HERE / "FINAL_VERIFICATION.json"),
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "QUALIFIED", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "cloudOperations": 0, "coreInvocations": 0, "evidenceModified": False,
    }
    with (HERE / "INDEPENDENT_FINAL_VERIFICATION.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
