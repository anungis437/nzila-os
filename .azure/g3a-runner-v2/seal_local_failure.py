"""Seal the observed pre-consumption local rejection; do not repair or retry."""

import json
from pathlib import Path
import subprocess

from prepare import BASE, HERE, baseline, fresh, load, protected, require, sha


def main():
    fresh("CONCURRENCY_FAILURE_CLOSURE_FINAL.json", baseline())
    historical = protected()
    lane = BASE / "g3a-runner-v2-source"
    report_path = lane / "PARENT_V2_SOURCE_REPORT.json"
    require(sha(report_path) == "a89afc5fe68e08ad371934211b7b448a032f7f9447530f047adf01ab1c345c42",
            "SOURCE_HANDOFF_CHANGED")
    report = load(report_path)
    run = BASE / "g3a-runner-v2-local-qualification"
    result = load(run / "results/HARNESS_RESULT.json")
    require(result == {
        "runnerExitCode": 1, "stdout": "",
        "stderr": "FROZEN_INPUT_MANIFEST_BINDING_MISMATCH\n",
        "parentMountinfoUnchanged": True, "automaticRetry": False,
    }, "FAILURE_EVIDENCE_CHANGED")
    require(not (run / "results/transaction.consumed.json").exists() and
            not list((run / "results").glob(".g3a-isolation-proof-*")),
            "UNEXPECTED_CONSUMPTION_OR_CONSTRUCTOR_EVIDENCE")
    docker = subprocess.run([
        "docker", "ps", "-a", "--filter",
        "ancestor=sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce",
        "--format", "{{.ID}} {{.Names}} {{.Status}}",
    ], capture_output=True, text=True, timeout=30)
    require(docker.returncode == 0 and not docker.stdout.strip(), "LOCAL_CONTAINER_SURVIVOR")
    candidate = report["identities"]["candidate"]
    require(sha(candidate["path"]) == candidate["sha256"], "V2_CANDIDATE_CHANGED")
    verdict = {
        "G3_EXECUTION_READINESS": "BLOCKED", "RUNNER_V1_UNCHANGED": "YES",
        "RUNNER_V1_ROLE": "QUALIFIED_EXECUTION_CORE_PROOF_ARTIFACT",
        "RUNNER_V1_PRODUCTION_INVOCABLE": "NO",
        "COMPILE_TIME_TRANSACTION_AUTHORITY_MODEL": "RETIRED",
        "G3A_EXECUTION_AUTHORITY_POLICY_SHA256": report["identities"]["policy"]["sha256"],
        "RUNNER_AUTHORIZATION_ROLE": "TRANSACTION_ENVELOPE_VALIDATOR",
        "RUNNER_V2_DELTA": "AUTHORITY_BOUNDARY_ONLY",
        "RUNNER_AUTHORITY_SINGLE_USE": "PASS",
        "RUNNER_AUTHORITY_CONSUMPTION_BOUNDARY":
            "AFTER_COMPLETE_VALIDATION_IMMEDIATELY_BEFORE_LAUNCH_SETUP",
        "QUALIFIED_EXECUTION_PRIMITIVES_UNCHANGED": "YES",
        "V2_AUTHORITY_GATE": "FAIL", "V2_SINGLE_USE_GATE": "PASS",
        "V2_CAPACITY_GATE": "PASS", "V2_PRIMITIVE_EQUIVALENCE": "PASS",
        "V2_FROZEN_CORE_EXACT": "NOT_RUN", "V2_CLEANUP": "PASS",
        "gateEvidenceScope": {
            "authority": "POSITIVE_LOCAL_BOUND_ENVELOPE_REJECTED_BEFORE_CONSUMPTION",
            "singleUse": "SOURCE_TESTS_PASS_ACTUAL_QUALIFICATION_REPLAY_NOT_RUN",
            "capacity": "SOURCE_TESTS_AND_UNCHANGED_PRIMITIVES_PASS_V2_KERNEL_WITNESS_NOT_RUN",
            "cleanup": "LOCAL_CONTAINER_ABSENT_PARENT_MOUNTINFO_UNCHANGED_NO_CONSTRUCTOR",
        },
        "RUNNER_V2_SOURCE_SHA256": report["identities"]["sourceSha256"],
        "RUNNER_V2_SHA256": candidate["sha256"], "RUNNER_V2_BYTES": candidate["bytes"],
        "RUNNER_V2_POLICY_SHA256": report["identities"]["policy"]["sha256"],
        "RUNNER_V2_OFFLINE_QUALIFICATION": "FAIL",
        "RUNNER_V2_PROOF_AUTHORITY_CONSUMED": "NO",
        "RUNNER_V2_PROOF_EXPECTED_COST_CAD": "UNRESOLVED",
        "RUNNER_V2_PROOF_COST_CEILING_CAD": "3.00",
        "RUNNER_V2_PINNED_GUEST_QUALIFICATION": "NOT_RUN",
        "RUNNER_V2_PROOF_RESIDUAL_STATE": "NOT_RUN",
        "G3A_PRODUCTION_COMPATIBLE_RUNNER": "BLOCKED",
        "LOCAL_FULL_TRANSACTION_ALLOWANCE_REMAINING": 1,
        "G3A_LOCAL_FULL_TRANSACTION": "NOT_RUN", "G3A_TRANSACTION_READINESS": "BLOCKED",
        "G3_CONTROL_PLANE_BOOTSTRAP_AUTHORIZED": "NO", "G3A_EXECUTION_AUTHORIZED": "NO",
        "G3B_EXECUTION_AUTHORIZED": "NO", "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "REGISTRY_MUTATIONS": 0, "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        "localV2QualificationDispatches": 1, "localV2FrozenCoreInvocations": 0,
        "localV2ConstructorInvocations": 0, "localV2OneShotReceiptCreated": False,
        "localV2QualificationRetry": False, "sourceRepairAfterFailure": False,
        "failure": "FROZEN_INPUT_MANIFEST_BINDING_MISMATCH",
        "retainedFailedEvidence": str(run), "containerAbsenceCheck": {
            "exitCode": docker.returncode, "stdout": docker.stdout, "stderr": docker.stderr},
        "AZURE_READS": 0, "AZURE_MUTATING_DISPATCHES": 0,
        "AZURE_SUCCESSFUL_MUTATING_DISPATCHES": 0, "AZURE_REJECTED_MUTATING_DISPATCHES": 0,
        "AZURE_DELETE_DISPATCHES": 0, "ROLE_ASSIGNMENT_CREATES": 0,
        "ROLE_ASSIGNMENT_DELETES": 0, "UAMI_CREATES": 0, "UAMI_DELETES": 0,
        "stopRule": "OFFLINE_FAILURE_BLOCKS_LIVE_AND_OUTER_TRANSACTION_NO_RERUN",
    }
    fresh("FINAL_DISPOSITION.json", verdict)
    files = [p for p in HERE.glob("*") if p.is_file()]
    files += [p for p in run.rglob("*") if p.is_file()]
    files += [report_path, Path(candidate["path"]), Path(report["identities"]["policy"]["path"])]
    references = {str(p): sha(p) for p in files}
    for name, item in report["identities"]["fullSourceBinding"]["fullSources"].items():
        require(sha(lane / name) == item["sha256"], "V2_SOURCE_CHANGED_" + name)
        references[str(lane / name)] = item["sha256"]
    fresh("FINAL_VERIFICATION.json", {
        "status": "VERIFIED_BLOCKED_NOT_QUALIFIED", "fileHashes": references,
        "protectedFileHashes": historical, "reason": verdict["failure"],
        "localFullTransactionAllowanceRemaining": 1, "cloudAuthorityConsumed": False,
    })
    sealed = load(HERE / "FINAL_VERIFICATION.json")
    for key in ("fileHashes", "protectedFileHashes"):
        for path, expected in sealed[key].items():
            require(sha(path) == expected, "SEALED_REFERENCE_CHANGED_" + path)
    print(json.dumps({
        "VERIFIED_BLOCKED": verdict["failure"], "verificationRoot": sha(HERE / "FINAL_VERIFICATION.json"),
        "referencesVerified": sum(len(sealed[k]) for k in ("fileHashes", "protectedFileHashes")),
        "AzureMutations": 0, "coreInvocations": 0, "outerAllowanceRemaining": 1,
    }))


if __name__ == "__main__":
    main()
