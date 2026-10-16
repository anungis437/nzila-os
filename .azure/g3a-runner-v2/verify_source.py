"""Verify the sole source handoff and real denial/AST gates without rebuilding."""

import subprocess

from prepare import BASE, baseline, fresh, load, protected, require, sha


def main():
    fresh("CONCURRENCY_SOURCE_VERIFICATION.json", baseline())
    protected()
    lane = BASE / "g3a-runner-v2-source"
    path = lane / "PARENT_V2_SOURCE_REPORT.json"
    require(sha(path) == "a89afc5fe68e08ad371934211b7b448a032f7f9447530f047adf01ab1c345c42",
            "SOURCE_HANDOFF_CHANGED")
    report = load(path)
    for key in ("RUNNER_V2_RUNTIME_AUTHORITY_SOURCE", "RUNNER_V2_SINGLE_USE_SOURCE",
                "RUNNER_V2_CAPACITY_SOURCE", "RUNNER_V2_PRIMITIVE_EQUIVALENCE",
                "RUNNER_V2_STATIC_CANDIDATE_BUILD", "RUNNER_V2_REAL_CLI_DENIALS",
                "RUNNER_V2_EVIDENCE_TRANSPORT_UNIT_TESTS"):
        require(report["status"][key] == "PASS", "SOURCE_GATE_NOT_PASS_" + key)
    identities = report["identities"]
    for name, item in identities["fullSourceBinding"]["fullSources"].items():
        require(sha(lane / name) == item["sha256"] and
                (lane / name).stat().st_size == item["bytes"], "SOURCE_COMPONENT_CHANGED_" + name)
    for key in ("candidate", "policy"):
        item = identities[key]
        require(sha(item["path"]) == item["sha256"] and
                __import__("pathlib").Path(item["path"]).stat().st_size == item["bytes"],
                "BOUND_IDENTITY_CHANGED_" + key)
    accounting = report["executionAccounting"]
    require(accounting["sourceWorkerFrozenCoreInvocations"] ==
            accounting["sourceWorkerActualConstructorInvocations"] ==
            accounting["AzureReads"] == accounting["AzureMutations"] ==
            accounting["registryMutations"] == accounting["outerFullTransactions"] == 0 and
            accounting["fullTransactionAllowanceRemaining"] == 1,
            "SOURCE_PHASE_UNAUTHORIZED_EXECUTION")
    gate = report["sourceGates"]["allSourceGateCommandsAndResults"]["results"]
    results = []
    for index in (16, 17, 18, 20):
        command = gate[index]["command"]
        result = subprocess.run(command, cwd=lane, capture_output=True, text=True, timeout=180)
        results.append({"command": command, "exitCode": result.returncode,
                        "stdout": result.stdout, "stderr": result.stderr})
        require(result.returncode == 0, "PARENT_SOURCE_VERIFICATION_FAILED_" + str(index))
    fresh("PARENT_SOURCE_VERIFICATION.json", {
        "status": "PASS", "reportSHA256": sha(path), "identities": identities,
        "commandResults": results, "frozenCoreInvocations": 0,
        "constructorInvocations": 0, "candidateRebuilds": 0, "cloudCalls": 0,
        "V2_SOURCE_TEST_GATES": "PASS", "QUALIFIED_EXECUTION_PRIMITIVES_UNCHANGED": "YES",
        "localV2CoreQualificationPermitted": True, "outerAllowanceRemaining": 1,
    })
    print("PARENT_V2_SOURCE_VERIFICATION=PASS_NO_CORE_NO_REBUILD")


if __name__ == "__main__":
    main()
