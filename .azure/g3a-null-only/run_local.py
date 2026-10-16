"""One exclusive local dispatch of the null-only frozen-core transaction."""

import subprocess

from prepare import CORE, HERE, fresh, prior, read, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def main():
    fresh("CONCURRENCY_REHEARSAL.json", prior.baseline())
    require(read(HERE / "PRODUCTION_IMPORT_GRAPH.json")["PRODUCTION_SECRETS_DEPENDENCY"] == "NO",
            "PRODUCTION_REQUIRES_SECRETS_STOP")
    binding = read(HERE / "AUTHORITY_BINDING.json")
    for name, value in binding["inputs"].items():
        require(sha(CORE / "inputs" / name) == value["sha256"], "FROZEN_INPUT_CHANGED")
    retained = HERE / "rehearsal"
    retained.mkdir()
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-add", "SYS_ADMIN", "--security-opt", "seccomp=unconfined",
        "--tmpfs", "/null-only-root:rw,nosuid,nodev,size=256m",
        "--mount", "type=bind,source=" + str(CORE / "inputs") + ",target=/sealed-inputs,readonly",
        "--mount", "type=bind,source=" + str(retained) + ",target=/retained",
        IMAGE, "python3", "-I", "-B", "-S", "-c", (HERE / "fixture.py").read_text(),
    ]
    fresh("LOCAL_DISPATCH.json", {
        "command": command, "offlineOnly": True,
        "coreSha256": sha(CORE / "inputs/portable-assembler"),
        "constructorSha256": sha(HERE / "fixture.py"),
        "singleUse": True, "candidateDeviceAllowlist": ["/dev/null"],
        "frozenWorkChildPrecreated": False, "workPath": "/build/transaction",
        "cloudReads": 0, "cloudMutations": 0, "registryCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    fresh("LOCAL_COMMAND_RESULT.json", {"exitCode": result.returncode, "stdout": result.stdout,
                                      "stderr": result.stderr, "automaticRetry": False})
    require(result.returncode == 0, "LOCAL_CONSTRUCTOR_OR_CLEANUP_FAILURE")
    report = read(retained / "GUEST_OFFLINE_RAW.json")
    require(report["cleanup"]["status"] == "PASS", "DEVICE_EXEC_CLEANUP_NOT_PASS")
    require(len(report["records"]) == 2, "FIXTURE_OR_REHEARSAL_FAILURE")
    fixture, rehearsal = report["records"]
    fresh("NULL_ONLY_FIXTURE.json", fixture)
    fresh("REHEARSAL_RESULT.json", rehearsal)
    print("ISOLATED_DEV_NULL=" + fixture["ISOLATED_DEV_NULL"])
    print("UNAUTHORIZED_DEVICE_NEGATIVES=" + fixture["UNAUTHORIZED_DEVICE_NEGATIVES"])
    print("NULL_ONLY_FROZEN_CORE_REHEARSAL=" + ("PASS" if rehearsal["exitCode"] == 0 else "FAIL"))
    print("CORE_STDERR=" + rehearsal["stderr"])
    print("DEVICE_AND_EXEC_MOUNT_CLEANUP=PASS")
    require(rehearsal["exitCode"] == 0, "STOP_NULL_ONLY_FROZEN_CORE_FAILURE_NO_RETRY")


if __name__ == "__main__":
    main()
