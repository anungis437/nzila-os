"""Resume only unconsumed local allowance after pre-mount adapter argument-type failure."""

import subprocess

from prepare import CORE, HERE, fresh, prior, read, require, sha


def main():
    fresh("CONCURRENCY_CONSTRUCTOR_RESUME.json", prior.baseline())
    result = read(HERE / "LOCAL_COMMAND_RESULT.json")
    require(result["exitCode"] == 1 and result["stdout"] == "" and
            "AttributeError: 'str' object has no attribute 'name'" in result["stderr"],
            "NOT_PRE_MOUNT_TYPE_ERROR")
    require(not list((HERE / "rehearsal").iterdir()), "PRE_CORE_EVIDENCE_NOT_EMPTY")
    for name, value in read(HERE / "AUTHORITY_BINDING.json")["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"], "FROZEN_INPUT_CHANGED")
    retained = HERE / "rehearsal-resume"
    retained.mkdir()
    original = read(HERE / "LOCAL_DISPATCH.json")
    command = list(original["command"])
    old = "type=bind,source=" + str(HERE / "rehearsal") + ",target=/retained"
    command[command.index(old)] = "type=bind,source=" + str(retained) + ",target=/retained"
    fresh("LOCAL_CONSTRUCTOR_RESUME_DISPATCH.json", {
        "command": command, "correctedAdapterSha256": sha(HERE / "fixture.py"),
        "priorResultSha256": sha(HERE / "LOCAL_COMMAND_RESULT.json"),
        "priorCoreInvocations": 0, "remainingLocalCoreAllowance": 1,
        "correction": "Normalize target str/Path to Path before matching exact bounded resources",
        "capacityUnchanged": True, "deviceAllowlistUnchanged": True, "cloudCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    fresh("LOCAL_CONSTRUCTOR_RESUME_RESULT.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
        "automaticRetry": False,
    })
    require(result.returncode == 0, "HARD_BOUNDED_CONSTRUCTOR_RESUME_FAILURE")
    report = read(retained / "GUEST_OFFLINE_RAW.json")
    require(len(report["records"]) == 2 and report["cleanup"]["status"] == "PASS",
            "HARD_BOUNDED_FIXTURE_OR_CLEANUP_FAILURE")
    limits = read(retained / "output/EFFECTIVE_LIMITS.json")
    fixture, rehearsal = report["records"]
    fresh("EFFECTIVE_LIMITS.json", limits)
    fresh("NULL_ONLY_FIXTURE.json", fixture)
    fresh("REHEARSAL_RESULT.json", rehearsal)
    print("BUILD_LIMIT_EFFECTIVE=" + limits["BUILD_LIMIT_EFFECTIVE"])
    print("TMP_LIMIT_EFFECTIVE=" + limits["TMP_LIMIT_EFFECTIVE"])
    print("HARD_BOUNDED_FROZEN_CORE_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"])
    print("HARD_BOUNDED_REHEARSAL_CLEANUP=PASS")
    require(rehearsal["exitCode"] == 0, "STOP_CORE_FAILURE_NO_EXPANSION_OR_RETRY")


if __name__ == "__main__":
    main()
