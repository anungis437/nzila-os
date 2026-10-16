"""One parent-issued V2-only local qualification; never runs outer pipeline."""

from pathlib import Path
import subprocess
import sys

from prepare import BASE, HERE, baseline, fresh, load, protected, require, sha


def main():
    fresh("CONCURRENCY_LOCAL_QUALIFICATION.json", baseline())
    protected()
    require(load(HERE / "PARENT_SOURCE_VERIFICATION.json")["status"] == "PASS",
            "SOURCE_GATES_NOT_VERIFIED")
    report = load(BASE / "g3a-runner-v2-source/PARENT_V2_SOURCE_REPORT.json")
    require(sha(BASE / "g3a-runner-v2-source/PARENT_V2_SOURCE_REPORT.json") ==
            "a89afc5fe68e08ad371934211b7b448a032f7f9447530f047adf01ab1c345c42",
            "QUALIFICATION_HANDOFF_CHANGED")
    harness = report["parentLocalHarness"]["sourceFile"]
    require(sha(harness["path"]) == harness["sha256"], "QUALIFICATION_HARNESS_CHANGED")
    candidate = report["identities"]["candidate"]
    require(sha(candidate["path"]) == candidate["sha256"], "V2_CANDIDATE_CHANGED")
    root = BASE / "g3a-runner-v2-local-qualification"
    require(not root.exists() and not (HERE / "LOCAL_QUALIFICATION_DISPATCH.json").exists(),
            "LOCAL_V2_QUALIFICATION_ALREADY_DISPATCHED")
    command = [sys.executable, "-B", harness["path"], "--mode", "local-test",
               "--run-root", str(root), "--transaction", "SYNTHETIC_LOCAL_TEST_V2_QUALIFICATION",
               "--parent-single-core-permit"]
    fresh("LOCAL_QUALIFICATION_DISPATCH.json", {
        "command": command, "scope": "V2_RUNNER_ONLY_NOT_OUTER_FULL_TRANSACTION",
        "automaticRetry": False, "candidateSHA256": candidate["sha256"],
        "candidateBytes": candidate["bytes"], "harnessSHA256": harness["sha256"],
        "LOCAL_FULL_TRANSACTION_ALLOWANCE_REMAINING": 1,
        "AzureReads": 0, "AzureMutations": 0, "registryMutations": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1500)
    fresh("LOCAL_QUALIFICATION_COMMAND_RESULT.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
        "automaticRetry": False, "outerFullTransactionRuns": 0,
    })
    print(result.stdout)
    print(result.stderr, file=sys.stderr)
    require(result.returncode == 0, "V2_LOCAL_QUALIFICATION_FAILED_STOP_NO_RETRY")
    print("V2_LOCAL_COMMAND=PASS_REQUIRED_ACCEPTANCE_PENDING")


if __name__ == "__main__":
    main()
