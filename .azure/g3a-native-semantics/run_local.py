"""Offline witness build and exact staged runtime probes; no engine or host runtime in the chroot."""

import subprocess

from prepare import BASE, HERE, fresh, prior, read, require, sha

IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"


def main():
    fresh("CONCURRENCY_FIXTURE.json", prior.baseline())
    require(read(HERE / "PINNED_PLATFORM_BINDING.json")["PINNED_PLATFORM_BINDING"] == "PASS",
            "PINNED_PLATFORM_NOT_BOUND")
    outputs = HERE / "fixture-output"
    outputs.mkdir()
    build = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--tmpfs", "/tmp:rw,nosuid,nodev,size=1g",
        "--mount", "type=bind,source=" + str(BASE / "g3a-go1256/toolchain/go") + ",target=/go,readonly",
        "--mount", "type=bind,source=" + str(HERE / "fd_witness.go") + ",target=/witness.go,readonly",
        "--mount", "type=bind,source=" + str(outputs) + ",target=/retained",
        "-e", "GOCACHE=/tmp/cache", "-e", "CGO_ENABLED=0", "-e", "GO111MODULE=off",
        "-e", "GOTOOLCHAIN=local", "-e", "GOPROXY=off", "-e", "GOSUMDB=off",
        IMAGE, "/go/bin/go", "build", "-trimpath", "-buildvcs=false", "-ldflags=-buildid=",
        "-o", "/retained/fd-witness", "/witness.go",
    ]
    fresh("WITNESS_DISPATCH.json", {"command": build, "sourceSha256": sha(HERE / "fd_witness.go"),
                                  "notFrozenAssembler": True, "network": "NONE", "cloudCalls": 0})
    result = subprocess.run(build, capture_output=True, text=True, timeout=180)
    fresh("WITNESS_BUILD_RESULT.json", {"exitCode": result.returncode,
                                      "stdout": result.stdout, "stderr": result.stderr})
    require(result.returncode == 0, "LOCAL_FD_WITNESS_BUILD_FAILED")
    witness = outputs / "fd-witness"
    require(witness.read_bytes()[:4] == b"\x7fELF", "WITNESS_NOT_ELF")
    core = BASE / "g3a-controller-repair/inputs"
    ca = core / "ca-certificates.crt"
    require(sha(ca) == "028fca5150ee1915c4474489985d55c54fceaa680c754cc8d1301734f01b2232",
            "BOUND_CA_BYTES_CHANGED")
    inputs = {
        BASE / "g3a-capsule-offline/payload.tar": "/input/payload.tar",
        BASE / "g3a-device-census/BINARY_AND_RUNTIME_DEVICE_REFERENCES.json": "/input/device-reference.json",
        HERE / "probe.py": "/input/probe.py",
        witness: "/input/fd-witness",
        ca: "/input/bound-ca.pem",
    }
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-add", "SYS_ADMIN", "--security-opt", "seccomp=unconfined",
        "--tmpfs", "/semantic-root:rw,nosuid,nodev,size=256m",
    ]
    for source, target in inputs.items():
        command.extend(["--mount", "type=bind,source=" + str(source) + ",target=" + target + ",readonly"])
    command.extend([IMAGE, "python3", "-I", "-B", "-S", "-c", (HERE / "fixture.py").read_text()])
    fresh("SEMANTIC_FIXTURE_DISPATCH.json", {
        "command": command, "inputHashes": {str(path): sha(path) for path in inputs},
        "noRandomDevices": True, "noProc": True, "noNetwork": True,
        "devNullOnlyForDescriptorPhase": True, "frozenCoreInvocations": 0, "azureCalls": 0,
    })
    result = subprocess.run(command, capture_output=True, text=True, timeout=240)
    fresh("SEMANTIC_FIXTURE_COMMAND_RESULT.json", {"exitCode": result.returncode,
                "stdout": result.stdout, "stderr": result.stderr, "automaticRetry": False})
    require(result.returncode == 0, "SEMANTIC_FIXTURE_CONSTRUCTOR_OR_CLEANUP_FAILURE")
    import json
    report = json.loads(result.stdout)
    fresh("EXACT_RUNTIME_SEMANTIC_FIXTURE.json", report)
    require(report["cleanup"]["status"] == "PASS", "SEMANTIC_CLEANUP_NOT_PASS")
    print("NO_RANDOM_DEVICE_ENTROPY_FIXTURE=" + report["entropy"]["report"]["status"])
    print("NO_PROC_SUBPROCESS_FIXTURE=" + report["descriptor"]["report"]["status"])
    print("OPENSSL_BUILD_INFO=" + json.dumps(report["opensslBuildInfo"]))


if __name__ == "__main__":
    main()
