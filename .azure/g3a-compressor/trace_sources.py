"""Public source/metadata evidence only; never downloads or installs a toolchain."""

import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

HERE = Path(__file__).resolve().parent


def fresh(path, raw):
    with path.open("xb") as file:
        file.write(raw)


def record(name, value):
    fresh(HERE / name, (json.dumps(value, indent=2) + "\n").encode())


def main():
    base = "https://raw.githubusercontent.com/moby/buildkit/v0.27.0/"
    targets = [
        ("BUILDKIT_GZIP.txt", base + "util/compression/gzip.go"),
        ("BUILDKIT_CONVERTER.txt", base + "util/converter/converter.go"),
        ("BUILDKIT_TAR_PIPE.txt", base + "util/converter/tarconverter/tarconverter.go"),
        ("GO_1_25_6_IO_SOURCE.txt", "https://raw.githubusercontent.com/golang/go/go1.25.6/src/io/io.go"),
        ("GO_1_25_6_GZIP_SOURCE.txt", "https://raw.githubusercontent.com/golang/go/go1.25.6/src/compress/gzip/gzip.go"),
    ]
    provenance = []
    for name, url in targets:
        with urllib.request.urlopen(url, timeout=30) as response:
            raw = response.read(200001)
        if len(raw) > 200000:
            raise RuntimeError("PUBLIC_SOURCE_OVERSIZE")
        fresh(HERE / name, raw)
        provenance.append({"name": name, "url": url, "bytes": len(raw),
                           "sha256": hashlib.sha256(raw).hexdigest(), "toolchainDownloaded": False})
    record("PUBLIC_SOURCE_PROVENANCE.json", provenance)
    url = "https://go.dev/dl/?mode=json&include=all"
    with urllib.request.urlopen(url, timeout=40) as response:
        raw = response.read(5000000)
    releases = json.loads(raw)
    release = next(item for item in releases if item["version"] == "go1.25.6")
    files = [item for item in release["files"] if item["os"] == "linux" and item["arch"] == "amd64"
             and item["kind"] == "archive"]
    if len(files) != 1 or len(files[0]["sha256"]) != 64:
        raise RuntimeError("EXACT_RELEASE_METADATA_NOT_BOUND")
    record("PROPOSED_GO_1_25_6_INPUT.json", {
        "status": "PROPOSED_NOT_ACQUIRED_NOT_LOCAL_GOVERNED_INPUT",
        "metadataURL": url, "metadataResponseSha256": hashlib.sha256(raw).hexdigest(),
        "version": release["version"], "file": files[0],
        "archiveURL": "https://go.dev/dl/" + files[0]["filename"],
        "requiredBeforeCandidateA": "SEPARATE_AUTHORITY_TO_ACQUIRE_VERIFY_AND_FREEZE_EXACT_TOOLCHAIN",
        "toolchainDownloaded": False, "toolchainInstalled": False,
    })
    commands = [
        ("WINDOWS_GO_VERSION", [r"C:\Program Files\Go\bin\go.exe", "version"]),
        ("CACHED_GO_1_26_9", ["docker", "image", "inspect",
                            "golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff",
                            "--format", "{{json .Config.Env}}"]),
        ("CACHED_GO_1_27_2", ["docker", "image", "inspect",
                            "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8",
                            "--format", "{{json .Config.Env}}"]),
    ]
    availability = []
    for name, command in commands:
        result = subprocess.run(command, capture_output=True, text=True, timeout=40)
        availability.append({"name": name, "command": command, "exitCode": result.returncode,
                             "stdout": result.stdout, "stderr": result.stderr})
        if result.returncode:
            raise RuntimeError("LOCAL_TOOLCHAIN_AVAILABILITY_READ_FAILED")
    record("LOCAL_TOOLCHAIN_AVAILABILITY.json", {
        "scope": "KNOWN_CACHED_GOVERNED_COMPILERS_AND_STANDARD_WINDOWS_GO_LOCATION_NOT_WHOLE_MACHINE_SEARCH",
        "observations": availability, "exactGo1_25_6AvailableInKnownInputs": False,
        "noGoToolchainOnPATHClaimMade": False, "toolchainAcquisitions": 0,
    })
    command = [
        "docker", "run", "--rm", "--pull", "never", "--network", "none",
        "--mount", "type=bind,source=" + str(HERE / "harness") + ",target=/src", "--workdir", "/src",
        "--env", "GOTOOLCHAIN=local", "--env", "GOPROXY=off", "--env", "GOSUMDB=off", "--env", "CGO_ENABLED=0",
        "golang@sha256:3b15ba438c60ab8fabe5fee3b11025c0049e358b31feff384648f11fc8e335f8",
        "sh", "-c", 'gofmt -w main.go main_test.go && go test -v ./... && go vet ./... && '
        'go build -trimpath -buildvcs=false -ldflags="-buildid= -s -w" -o harness-development-only .',
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    fresh(HERE / "HARNESS_DEVELOPMENT_CHECK_LOG.txt", (result.stdout + result.stderr).encode())
    if result.returncode or result.stdout.count("--- PASS: Test") != 3:
        raise RuntimeError("HARNESS_DEVELOPMENT_CHECK_FAILED")
    binary = HERE / "harness" / "harness-development-only"
    record("HARNESS_DEVELOPMENT_CHECK.json", {
        "command": command, "tests": 3, "result": "PASS_TEST_VET_BUILD",
        "compiler": "go1.27.2", "scope": "SYNTHETIC_FIXTURE_AND_RUNTIME_GUARD_ONLY_NOT_FROZEN_CANDIDATE",
        "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(), "binaryBytes": binary.stat().st_size,
        "sourceHashes": {name: hashlib.sha256((HERE / "harness" / name).read_bytes()).hexdigest()
                         for name in ("go.mod", "main.go", "main_test.go")},
        "frozenAppCompressionRun": False, "frozenCertCompressionRun": False, "applicationBuild": False,
    })
    print("SOURCE_TRACE_TOOLCHAIN_PROPOSAL_AND_HARNESS_UNIT_CHECKS_RECORDED")


if __name__ == "__main__":
    main()
