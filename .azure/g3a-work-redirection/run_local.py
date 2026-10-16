"""Single redirected-root rehearsal with immutable sealed input bind and explicit outcomes."""

import json
import subprocess

from prepare import CORE, HERE, fresh, prior, read, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def main():
    fresh("CONCURRENCY_REHEARSAL.json", prior.baseline())
    require(read(HERE / "CLI_CONTRACT.json")["FROZEN_ASSEMBLER_WORK_PATH_CONFIGURABLE"] == "YES",
            "WORK_PATH_NOT_CONFIGURABLE")
    archive = read(HERE / "ARCHIVE_EXECUTABILITY.json")
    require(archive["STAGED_EXECUTABILITY_CENSUS"] == archive["EXEC_BUILD_ARCHIVE_SAFETY"] == "PASS",
            "ARCHIVE_CENSUS_NOT_PASS")
    retained = HERE / "rehearsal"
    retained.mkdir()
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-add", "SYS_ADMIN", "--security-opt", "seccomp=unconfined",
        "--tmpfs", "/fixture-root:rw,nosuid,nodev,size=2g",
        "--mount", "type=bind,source=" + str(CORE / "inputs") + ",target=/sealed-inputs,readonly",
        "--mount", "type=bind,source=" + str(retained) + ",target=/retained",
        IMAGE, "python3", "-I", "-B", "-S", "-c", (HERE / "fixture.py").read_text(),
    ]
    fresh("LOCAL_DISPATCH.json", {
        "command": command, "offlineOnly": True, "coreSha256": sha(CORE / "inputs" / "portable-assembler"),
        "noCandidateBuild": True, "noRegistryCalls": True, "cloudCalls": 0,
        "expectedWork": "/build/transaction", "workChildPrecreated": False,
        "expectedOutput": "/output/transaction", "network": "NONE",
        "hostDockerRole": "Disposable outer isolation only; no engine inside transaction",
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    fresh("LOCAL_COMMAND_RESULT.json", {"exitCode": result.returncode, "stdout": result.stdout,
                                      "stderr": result.stderr, "automaticRetry": False})
    require(result.returncode == 0, "LOCAL_REHEARSAL_TOOL_OR_FIXTURE_FAILURE")
    report = read(retained / "GUEST_OFFLINE_RAW.json")
    require(len(report["records"]) == 2, "STRUCTURED_FIXTURE_REHEARSAL_CENSUS")
    fixture, rehearsal = report["records"]
    require(fixture["status"] == "PASS", "REDIRECTED_FIXTURE_FAILED")
    fresh("REDIRECTED_FIXTURE.json", fixture)
    fresh("REHEARSAL_RESULT.json", rehearsal)
    print("REDIRECTED_WORK_ROOT_FIXTURE=PASS")
    print("REDIRECTED_WORK_ROOT_FROZEN_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"].strip())
    print("EXEC_BUILD_CLEANUP=" + report["cleanup"]["status"])
    require(rehearsal["exitCode"] == 0, "OFFLINE_STOP_UNCHANGED_FROZEN_CORE_REHEARSAL_FAILURE")


if __name__ == "__main__":
    main()
