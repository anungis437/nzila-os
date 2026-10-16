"""Exactly one local topology rehearsal; no candidate build, Azure or registry access."""

import json
import subprocess

from census import BASE, CORE, HERE, fresh, prior, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def main():
    prior.ca.refresh.HERE = HERE
    prior.ca.refresh.fresh("CONCURRENCY_LOCAL_REHEARSAL.json", prior.baseline())
    for previous in HERE.glob("LOCAL_REHEARSAL_RAW*.json"):
        require(not any(item["type"] in {"MOUNT_FIXTURE", "FROZEN_CORE_REHEARSAL"}
                        for item in json.loads(previous.read_text())["records"]),
                "CORE_OR_MOUNT_REHEARSAL_ALREADY_RAN_STOP")
    require(json.loads((HERE / "EXEC_PATH_CENSUS.json").read_text())["status"] == "COMPLETE",
            "EXEC_PATH_CENSUS_REQUIRED")
    require((HERE / "TEMP_PATH_CENSUS.json").exists(), "TEMP_PATH_CENSUS_REQUIRED")
    require(sha(CORE / "inputs" / "portable-assembler") ==
            "3b444e003474b5717ff549c5cafaf9cb761835eea3b4844e1344aa9e61581da4", "FROZEN_CORE_CHANGED")
    command = [
        "docker", "run", "--rm", "--pull", "never", "-i", "--network", "none",
        "--read-only", "--cap-add", "SYS_ADMIN", "--security-opt", "seccomp=unconfined",
        "--tmpfs", "/fixture-root:rw,nosuid,nodev,size=1g",
        "--mount", "type=bind,source=" + str(CORE / "inputs") + ",target=/sealed-inputs,readonly",
        IMAGE, "python3", "-I", "-B", "-S", "-c", (HERE / "mount_fixture.py").read_text(),
    ]
    prior.ca.refresh.fresh("LOCAL_REHEARSAL_DISPATCH.json", {
        "command": command, "maximumCoreInvocations": 1, "offlineOnly": True,
        "candidateBuilt": False, "runnerProductionSourceChanged": False,
        "network": "NONE", "inputMount": "READ_ONLY", "DockerRole": "DISPOSABLE_ISOLATION_FIXTURE_ONLY",
        "imageBuild": False, "cloudMutation": False,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    records = []
    for line in result.stdout.splitlines():
        records.append(json.loads(line))
    prior.ca.refresh.fresh("LOCAL_REHEARSAL_RAW.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr, "records": records,
        "retry": False, "cloudReads": 0, "AzureMutations": 0,
    })
    require(result.returncode == 0 and len(records) == 2, "LOCAL_FIXTURE_EXPLICIT_FAILURE")
    fixture, rehearsal = records
    require(fixture["type"] == "MOUNT_FIXTURE" and fixture["status"] == "PASS", "MOUNT_FIXTURE_NOT_PASS")
    fresh("LOCAL_MOUNT_RESULT.json", fixture)
    fresh("FROZEN_REHEARSAL_RESULT.json", {
        **rehearsal, "status": "PASS" if rehearsal["exitCode"] == 0 else "FAIL",
        "frozenCoreUnchanged": True, "liveAuthorityConsumed": False,
        "exactImageGates": "NOT_REACHED" if rehearsal["exitCode"] != 0 else "REQUIRES_EXACT_COMPARISON",
    })
    print("LOCAL_PRODUCTION_MOUNT_FIXTURE=PASS")
    print("PRODUCTION_RUNNER_FROZEN_CORE_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"].strip())
    require(rehearsal["exitCode"] != 0 and "mkdir /work/transaction: file exists" in rehearsal["stderr"],
            "UNEXPECTED_REHEARSAL_OUTCOME_REQUIRES_RECONCILIATION")
    print("STOP_UNCONSUMED_LIVE_AUTHORITY_EXCLUSIVE_WORK_MKDIR_VS_PREMOUNTED_EXEC_CHILD")


if __name__ == "__main__":
    main()
