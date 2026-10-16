"""Exactly one new hard-bounded frozen core dispatch; fail without automatic expansion or retry."""

import subprocess

from prepare import BASE, CORE, HERE, fresh, prior, read, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def main():
    fresh("CONCURRENCY_REHEARSAL.json", prior.baseline())
    binding = read(HERE / "AUTHORITY_BINDING.json")
    for name, value in binding["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"], "FROZEN_INPUT_CHANGED")
    retained = HERE / "rehearsal"
    retained.mkdir()
    mounts = {
        CORE / "inputs": ("/sealed-inputs", True),
        BASE / "g3a-null-only/fixture.py": ("/prior-fixture.py", True),
        HERE: ("/hard-adapter", True),
        HERE / "AUTHORITY_BINDING.json": ("/hard-binding.json", True),
        retained: ("/retained", False),
    }
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-add", "SYS_ADMIN", "--security-opt", "seccomp=unconfined",
        "--tmpfs", "/null-only-root:rw,nosuid,nodev,size=256m",
    ]
    for path, (target, readonly) in mounts.items():
        command.extend(["--mount", "type=bind,source=" + str(path) + ",target=" + target +
                        (",readonly" if readonly else "")])
    command.extend([IMAGE, "python3", "-B", "-S", "/hard-adapter/fixture.py"])
    fresh("LOCAL_DISPATCH.json", {
        "command": command, "coreSha256": sha(CORE / "inputs/portable-assembler"),
        "adapterSha256": sha(HERE / "fixture.py"), "capacityPolicySha256": sha(HERE / "policy.py"),
        "singleNewLocalCoreAllowance": 1, "capacity": binding["governanceMaxima"],
        "deviceAllowlist": ["/dev/null"], "automaticExpansion": False,
        "cloudReads": 0, "cloudMutations": 0, "registryCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    fresh("LOCAL_COMMAND_RESULT.json", {"exitCode": result.returncode,
                                      "stdout": result.stdout, "stderr": result.stderr,
                                      "automaticRetry": False})
    require(result.returncode == 0, "HARD_BOUNDED_CONSTRUCTOR_OR_CLEANUP_FAILURE")
    report = read(retained / "GUEST_OFFLINE_RAW.json")
    require(len(report["records"]) == 2 and report["cleanup"]["status"] == "PASS",
            "HARD_BOUNDED_FIXTURE_OR_CLEANUP_FAILED")
    fixture, rehearsal = report["records"]
    limits = read(retained / "output/EFFECTIVE_LIMITS.json")
    fresh("EFFECTIVE_LIMITS.json", limits)
    fresh("NULL_ONLY_FIXTURE.json", fixture)
    fresh("REHEARSAL_RESULT.json", rehearsal)
    print("BUILD_LIMIT_EFFECTIVE=" + limits["BUILD_LIMIT_EFFECTIVE"])
    print("TMP_LIMIT_EFFECTIVE=" + limits["TMP_LIMIT_EFFECTIVE"])
    print("HARD_BOUNDED_FROZEN_CORE_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"])
    print("HARD_BOUNDED_REHEARSAL_CLEANUP=" + report["cleanup"]["status"])
    require(rehearsal["exitCode"] == 0, "STOP_FROZEN_CORE_FAILURE_NO_RETRY_OR_EXPANSION")


if __name__ == "__main__":
    main()
