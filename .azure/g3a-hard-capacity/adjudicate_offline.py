"""Parent qualification uses exact build, effective kernel witness, bound source and real denies."""

import subprocess

from prepare import BASE, HERE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_OFFLINE_ADJUDICATION.json", prior.baseline())
    path = BASE / "g3a-hard-runner-source/FINAL_READONLY_INPUT_PARENT_INTEGRATION_REPORT.json"
    require(sha(path) == "72d6c2279765c1501fe261dc7ba6eaa16a94aa8b3aa4d8dca3ad04e8269f6985",
            "FINAL_SOURCE_INTEGRATION_REPORT_CHANGED")
    report = read(path)
    require(report["integration"] == report["sourceIntegration"] ==
            report["staticKernelConstructorWitness"] == "PASS" and
            report["qualifiedPrimitivesUnchanged"] == "YES", "FINAL_INTEGRATION_NOT_PASS")
    require(report["productionCapacityGate"].startswith("PASS_") and
            report["productionExecutionFailClosed"].startswith("PASS_"), "FINAL_DISPATCH_DENIALS_NOT_PASS")
    layout = report["inputLayout"]
    require(layout["inputChargeToBuildBytes"] == layout["memoryTmpfsInputStagingCopies"] == 0 and
            layout["frozenInputEntries"] == 15, "PRODUCTION_INPUT_LAYOUT_NOT_REHEARSED")
    source = path.parent / "revision-readonly-inputs"
    for name, expected in report["sourceHashes"].items():
        require(sha(source / name) == expected, "SOURCE_BINDING_CHANGED_" + name)
    test = report["tests"][0]
    result = subprocess.run(test["command"], cwd=source, capture_output=True, text=True, timeout=180)
    fresh("PARENT_PORTABLE_DISPATCH_TESTS.json", {
        "command": test["command"], "cwd": str(source), "exitCode": result.returncode,
        "stdout": result.stdout, "stderr": result.stderr, "coreInvocations": 0,
    })
    require(result.returncode == 0, "PARENT_DISPATCH_TESTS_FAILED")
    verified = False
    for receipt in report["allValidationCommands"]:
        command = receipt.get("command", []) if isinstance(receipt, dict) else receipt
        if "verify_primitives.go" not in command:
            continue
        result = subprocess.run(command, cwd=source, capture_output=True, text=True, timeout=180)
        fresh("PARENT_PRIMITIVE_VERIFICATION.json", {
            "command": command, "cwd": str(source), "exitCode": result.returncode,
            "stdout": result.stdout, "stderr": result.stderr,
        })
        require(result.returncode == 0, "PARENT_PRIMITIVE_VERIFICATION_FAILED")
        verified = True
        break
    require(verified, "NO_NORMALIZED_PRIMITIVE_COMMAND")
    acceptance = read(HERE / "HARD_BOUND_ACCEPTANCE.json")
    require(acceptance["HARD_BOUNDED_FROZEN_CORE_REHEARSAL"] == "PASS" and
            acceptance["BUILD_LIMIT_EFFECTIVE"] == acceptance["TMP_LIMIT_EFFECTIVE"] == "PASS" and
            len(acceptance["exactImageGates"]) == 7 and
            all(gate["status"] == "YES" for gate in acceptance["exactImageGates"].values()),
            "HARD_BOUND_CORE_GATE_NOT_PASS")
    require(acceptance["HARD_BOUNDED_REHEARSAL_CLEANUP"] == "PASS", "BOUNDED_CLEANUP_NOT_PASS")
    fresh("OFFLINE_QUALIFICATION.json", {
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION": "PASS",
        "CAPACITY_QUALIFICATION_MODEL": "ENFORCED_HARD_LIMIT",
        "BUILD_LIMIT_EFFECTIVE": "PASS", "TMP_LIMIT_EFFECTIVE": "PASS",
        "HARD_BOUNDED_FROZEN_CORE_REHEARSAL": "PASS", "allSevenExactImageGates": "YES",
        "PRODUCTION_TMP_CONTRACT": "QUALIFIED", "PRODUCTION_CAPACITY_GATE": "PASS",
        "PRODUCTION_EXECUTION_FAIL_CLOSED": "PASS", "QUALIFIED_PRIMITIVES_UNCHANGED": "YES",
        "HARD_BOUNDED_REHEARSAL_CLEANUP": "PASS",
        "sourceIntegrationReport": str(path), "sourceIntegrationReportSha256": sha(path),
        "hardBoundAcceptanceSha256": sha(HERE / "HARD_BOUND_ACCEPTANCE.json"),
        "sourceHashes": report["sourceHashes"], "sourceBindingPath": report["sourceBindingPath"],
        "kernelWitness": report["kernelWitness"],
        "qualificationScope": "Offline source integration plus actual constructor static witness plus one exact frozen workload under same input/device/capacity contract. Pinned guest and final candidate remain separately gated.",
        "candidateBuildPermitted": True, "candidateNotYetBuilt": True,
        "AzureMutationNotYetPermitted": "Fresh candidate/live safety/cost/deployment validation required",
        "liveAuthorityConsumed": False, "G3A_EXECUTION_AUTHORIZED": "NO",
        "cloudReads": 0, "cloudMutations": 0, "registryMutations": 0,
    })
    print("PRODUCTION_RUNNER_OFFLINE_QUALIFICATION=PASS")
    print("PRODUCTION_CANDIDATE_BUILD_PERMITTED=YES_NO_G3A_EXECUTION")


if __name__ == "__main__":
    main()
