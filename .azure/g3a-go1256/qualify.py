"""Offline extracted-toolchain build; strict app-before-cert compressor gates."""

import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "g3a-compressor"
ISOLATION = "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8"


def ensure(value, stage):
    if not value:
        raise RuntimeError(stage)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def run(name, args):
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none",
        "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--tmpfs", "/tmp:rw,exec,size=512m", "--tmpfs", "/usr/local/go:rw,noexec,size=1m",
        "--tmpfs", "/go:rw,noexec,size=1m", "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off",
        "--env", "GOSUMDB=off", "--env", "CGO_ENABLED=0", "--env", "GOOS=linux", "--env", "GOARCH=amd64",
        "--env", "GOCACHE=/tmp/cache", "--env", "GOPATH=/tmp/gopath", "--env", "PATH=/unavailable",
        "--env", "GOROOT=/evidence/toolchain/go",
        "--mount", "type=bind,source=" + str(HERE) + ",target=/evidence",
        "--mount", "type=bind,source=" + str(PRIOR / "fixtures") + ",target=/fixtures,readonly",
        "--workdir", "/evidence/harness", "--entrypoint", "/bin/sh", ISOLATION, "-c", args,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=180)
    with (HERE / (name + ".txt")).open("x", encoding="utf-8") as file:
        file.write(result.stdout + result.stderr)
    fresh(name + ".json", {"command": command, "exitCode": result.returncode,
                          "stdout": result.stdout, "stderr": result.stderr,
                          "dockerRole": "LOCAL_LINUX_ISOLATION_ONLY_NO_DOCKER_BUILD",
                          "qualificationCompiler": "EXTRACTED_OFFICIAL_GO1256_ONLY",
                          "network": "NONE", "cloudGuestExecution": False})
    return result


def compare(name, path, result):
    frozen = (PRIOR / "fixtures" / (name + ".frozen.gz")).read_bytes()
    raw = path.read_bytes()
    at = next((i for i, pair in enumerate(zip(raw, frozen)) if pair[0] != pair[1]), None)
    if at is None and len(raw) != len(frozen):
        at = min(len(raw), len(frozen))
    ensure(gzip.decompress(raw) == (PRIOR / "fixtures" / (name + ".tar")).read_bytes(),
           "CANDIDATE_UNCOMPRESSED_FIXTURE_NOT_EXACT")
    same = raw == frozen
    ensure((result.returncode == 0) == same, "HARNESS_EXIT_AND_RAW_EQUALITY_DISAGREE")
    return {"name": name, "candidateSha256": sha(raw), "candidateBytes": len(raw),
            "frozenSha256": sha(frozen), "frozenBytes": len(frozen),
            "bytesEqual": same, "firstDifferingByteZeroBased": at,
            "headerEqual": raw[:10] == frozen[:10], "trailerEqual": raw[-8:] == frozen[-8:],
            "decompressedEqual": True}


def main():
    version = run("GO1256_VERSION_CORRECTED", "/bin/chmod +x /evidence/toolchain/go/bin/go /evidence/toolchain/go/pkg/tool/linux_amd64/* && "
                  "/evidence/toolchain/go/bin/go version")
    ensure(version.returncode == 0 and version.stdout.strip() == "go version go1.25.6 linux/amd64",
           "EXACT_EXTRACTED_GO_VERSION_REQUIRED")
    build = run("HARNESS_BUILD", "/evidence/toolchain/go/bin/go test -v ./... && "
                "/evidence/toolchain/go/bin/go vet ./... && "
                '/evidence/toolchain/go/bin/go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" '
                "-o /evidence/compressor-go1256 .")
    ensure(build.returncode == 0 and build.stdout.count("--- PASS: Test") == 2 and
           "--- SKIP: TestOtherRuntimeCannotRunFrozenCandidate" in build.stdout,
           "HARNESS_EXTRACTED_GO_BUILD_OR_TEST_FAILURE")
    binary = (HERE / "compressor-go1256").read_bytes()
    ensure(binary[:6] == b"\x7fELF\x02\x01" and binary[18:20] == b"\x3e\x00", "COMPRESSOR_ELF_PLATFORM")
    offset = struct.unpack_from("<Q", binary, 32)[0]
    stride, count = struct.unpack_from("<HH", binary, 54)
    ensure(stride >= 56 and count > 0 and offset + stride * count <= len(binary) and
           all(struct.unpack_from("<I", binary, offset + n * stride)[0] != 3 for n in range(count)),
           "COMPRESSOR_ELF_INTERPRETER")
    fresh("HARNESS_BINARY_CONTRACT.json", {
        "version": "go1.25.6", "sha256": sha(binary), "bytes": len(binary),
        "platform": "linux/amd64", "format": "STATIC_ELF", "interpreter": "ABSENT",
        "daemonRequired": False, "rootRequired": False, "runtimeDependencies": "LINUX_KERNEL_ONLY",
        "scope": "CANDIDATE_PENDING_BOTH_LAYER_EXACT_TESTS",
    })
    fixtures = json.loads((PRIOR / "FROZEN_FIXTURES.json").read_text())["entries"]
    observations = []
    for number in (1, 2):
        workspace = HERE / ("compression-run" + str(number))
        workspace.mkdir()
        for fixture in fixtures:
            name = fixture["name"]
            command = "/evidence/compressor-go1256 /fixtures/" + name + ".tar " + fixture["tarSha256"] + \
                      " /evidence/" + workspace.name + "/" + name + ".gz " + fixture["gzipSha256"]
            result = run("RUN" + str(number) + "_" + name.upper(), command)
            ensure((workspace / (name + ".gz")).exists(), "HARNESS_NO_OUTPUT_STOP")
            observed = compare(name, workspace / (name + ".gz"), result)
            observed["run"] = number
            observations.append(observed)
            if not observed["bytesEqual"]:
                fresh("COMPRESSOR_RESULT.json", {
                    "status": "UNRESOLVED_EXACT_BYTES_MISMATCH_STOP",
                    "observations": observations, "APP_LAYER_EXACT": "NO" if name == "app" else "YES",
                    "CERT_LAYER_EXACT": "NOT_RUN" if name == "app" else "NO",
                    "G3A_COMPRESSOR_DETERMINISM": "NOT_RUN", "fullTransactions": 0,
                })
                print(json.dumps(observed, indent=2))
                return
    for name in ("app", "cert"):
        ensure((HERE / "compression-run1" / (name + ".gz")).read_bytes() ==
               (HERE / "compression-run2" / (name + ".gz")).read_bytes(), "DOUBLE_RUN_DIFFERENCE")
    fresh("COMPRESSOR_RESULT.json", {
        "status": "PROVEN_EXACT_BOTH_LAYERS_DOUBLE_RUN", "observations": observations,
        "APP_LAYER_EXACT": "YES", "CERT_LAYER_EXACT": "YES",
        "G3A_COMPRESSOR_DETERMINISM": "PASS", "fullTransactions": 0,
    })
    print("BOTH_LAYERS_EXACT_DOUBLE_COMPRESSOR_RUN_PASS")


if __name__ == "__main__":
    main()
