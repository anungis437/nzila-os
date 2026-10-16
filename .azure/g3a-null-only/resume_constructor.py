"""Resume unconsumed local core allowance after an evidenced pre-dispatch constructor failure."""

import subprocess

from prepare import CORE, HERE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_CONSTRUCTOR_RESUME.json", prior.baseline())
    previous = read(HERE / "rehearsal/GUEST_OFFLINE_RAW.json")
    require(previous["cleanup"]["status"] == "PASS" and previous["outputCensus"] == {} and
            len(previous["records"]) == 1 and
            previous["records"][0]["type"] == "CHILD_EXPLICIT_FAILURE" and
            "Read-only file system" in previous["records"][0]["error"],
            "NOT_PROVEN_PRE_CORE_CONSTRUCTOR_FAILURE")
    require(not (HERE / "rehearsal/output/LOCAL_CORE_DISPATCH.json").exists(),
            "LOCAL_CORE_AUTHORITY_ALREADY_CONSUMED")
    for name, value in read(HERE / "AUTHORITY_BINDING.json")["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"], "FROZEN_INPUT_CHANGED")
    retained = HERE / "rehearsal-resume"
    retained.mkdir()
    original = read(HERE / "LOCAL_DISPATCH.json")
    command = list(original["command"])
    command[command.index("type=bind,source=" + str(HERE / "rehearsal") + ",target=/retained")] = \
        "type=bind,source=" + str(retained) + ",target=/retained"
    command[-1] = (HERE / "fixture.py").read_text()
    fresh("LOCAL_CONSTRUCTOR_RESUME_DISPATCH.json", {
        "command": command, "constructorSha256": sha(HERE / "fixture.py"),
        "previousResultSha256": sha(HERE / "rehearsal/GUEST_OFFLINE_RAW.json"),
        "priorCoreInvocations": 0, "maximumRemainingCoreInvocations": 1,
        "correction": "Read-only root established before child mounts, not on top of them",
        "candidateDeviceAllowlist": ["/dev/null"], "cloudCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    fresh("LOCAL_CONSTRUCTOR_RESUME_RESULT.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
        "automaticRetry": False,
    })
    require(result.returncode == 0, "RESUME_CONSTRUCTOR_OR_CLEANUP_FAILURE")
    report = read(retained / "GUEST_OFFLINE_RAW.json")
    require(report["cleanup"]["status"] == "PASS" and len(report["records"]) == 2,
            "RESUME_FIXTURE_OR_CLEANUP_FAILURE")
    fixture, rehearsal = report["records"]
    fresh("NULL_ONLY_FIXTURE.json", fixture)
    fresh("REHEARSAL_RESULT.json", rehearsal)
    print("ISOLATED_DEV_NULL=" + fixture["ISOLATED_DEV_NULL"])
    print("UNAUTHORIZED_DEVICE_NEGATIVES=" + fixture["UNAUTHORIZED_DEVICE_NEGATIVES"])
    print("NULL_ONLY_FROZEN_CORE_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"])
    print("DEVICE_AND_EXEC_MOUNT_CLEANUP=" + report["cleanup"]["status"])
    require(rehearsal["exitCode"] == 0, "STOP_CORE_FAILURE_NO_RETRY")


if __name__ == "__main__":
    main()
