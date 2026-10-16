"""Offline-only candidate preparation; no deployment API or registry command."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
WORKTREE = BASE.parent
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\caf53adc-fe74-4273-bd34-07372e54c0b7\Pasted text #1.txt")
ROOT_SHA = "96dced437ec2cddb1ec000db7e337ba02eb676caac667e106fc0104f8fbeeda8"
IMAGE = "sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce"
GO = Path(r"C:\Program Files\Go\bin\go.exe")


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def save(name, value):
    with (HERE / name).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def command(args, env=None, timeout=120):
    result = subprocess.run([str(arg) for arg in args], capture_output=True, text=True, env=env, timeout=timeout)
    return {"command": [str(arg) for arg in args], "exitCode": result.returncode,
            "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}


def baseline(name):
    values = []
    for path in (WORKTREE, Path(r"C:\APPS\nzila-os")):
        head = command(["git", "-C", path, "rev-parse", "HEAD"])
        status = command(["git", "-C", path, "--no-pager", "status", "--short"])
        require(head["exitCode"] == status["exitCode"] == 0, "CONCURRENCY_READ_FAILED")
        values.append({"path": str(path), "head": head["stdout"], "status": status["stdout"].splitlines()})
    require(values[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27", "ACTIVE_HEAD_CHANGED")
    require(set(values[0]["status"]) == {"?? .azure/", "?? infrastructure/landing-zone/g2-builder/"},
            "ACTIVE_WORKTREE_CONFLICT")
    save(name, {"utc": datetime.now(timezone.utc).isoformat(), "worktrees": values,
                "foreignDispositioned": False})
    return values


def preserved():
    root_path = BASE / "g3a-ca-live" / "CONTENT_PROOF_VERIFICATION.json"
    require(sha(root_path) == ROOT_SHA, "LATEST_PROOF_SEAL_CHANGED")
    root = load(root_path)
    count = 1
    for name, expected in root["fileHashes"].items():
        require(sha(root_path.parent / name) == expected, "SEALED_PROOF_CHANGED_" + name)
        count += 1
    for name, expected in root["closureFileHashes"].items():
        require(sha(Path(root["closurePath"]) / name) == expected, "PRIOR_CLOSURE_CHANGED_" + name)
        count += 1
    for name, expected in root["protectedFileHashes"].items():
        require(sha(name) == expected, "PROTECTED_COMPONENT_CHANGED_" + name)
        count += 1
    return count


def assemble():
    baseline("CONCURRENCY_ASSEMBLE.json")
    references = preserved()
    root = load(BASE / "g3a-ca-live" / "CONTENT_PROOF_VERIFICATION.json")
    binding = {}
    for name in ("sealed_reader.py", "registry.py", "controller.py"):
        path = BASE / "g3a-transaction" / name
        expected = root["protectedFileHashes"][str(path)]
        require(sha(path) == expected, "FROZEN_REGISTRY_SOURCE_CHANGED")
        binding[name] = {"relativePath": str(path.relative_to(BASE)), "sha256": expected}
    for name in ("guest_pipeline.py", "frozen.py"):
        binding[name] = {"relativePath": "g3a-ca-closure\\" + name,
                         "sha256": root["closureFileHashes"][name]}
    save("FROZEN_SOURCE_BINDING.json", binding)
    save("AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "authorityPath": str(AUTHORITY),
        "authoritySha256": sha(AUTHORITY), "mode": "LOCAL_OFFLINE_ONLY",
        "protectedProofRoot": ROOT_SHA, "protectedReferencesVerified": references,
        "AZURE_MUTATIONS": 0, "ENTRA_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
    })
    inspection = command(["docker", "image", "inspect", IMAGE])
    require(inspection["exitCode"] == 0, "CACHED_RUNTIME_MISSING")
    cached = json.loads(inspection["stdout"])[0]
    require(cached["Id"] == IMAGE and cached["Os"] == "linux" and cached["Architecture"] == "amd64",
            "CACHED_RUNTIME_IDENTITY_CHANGED")
    save("CACHED_PREPARATION_IMAGE.json", cached)
    result = command([
        "docker", "run", "--rm", "--pull", "never", "--network", "none", "--read-only",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
        "--mount", "type=bind,source=" + str(BASE) + ",target=/sealed,readonly",
        "--mount", "type=bind,source=" + str(HERE) + ",target=/output",
        "--entrypoint", "python3", IMAGE, "-B", "-S", "/output/assemble.py",
    ])
    save("ASSEMBLY_COMMAND.json", result)
    require(result["exitCode"] == 0, "CANDIDATE_ASSEMBLY_FAILED")
    print(result["stdout"])


def build():
    baseline("CONCURRENCY_BUILD.json")
    require(sha(GO) == "7d828191ba32519a9c9361789ab647486236ed45c660889196c7770a8ff1985c",
            "EXISTING_COMPILER_CHANGED")
    version = command([GO, "version"])
    require(version["stdout"] == "go version go1.27.0 windows/amd64", "COMPILER_VERSION_CHANGED")
    census = load(HERE / "RUNTIME_CENSUS.json")
    require(sha(HERE / "payload.tar") == census["archiveSha256"], "ASSEMBLED_PAYLOAD_CHANGED")
    output = HERE / "g3a-guest-candidate"
    require(not output.exists(), "CANDIDATE_ALREADY_BUILT")
    env = dict(os.environ, GOOS="linux", GOARCH="amd64", CGO_ENABLED="0", GOTOOLCHAIN="local",
               GO111MODULE="off", GOPROXY="off", GOSUMDB="off", GOWORK="off",
               GOCACHE=str(HERE / "build-cache"), GOPATH=str(HERE / "build-gopath"),
               GOROOT=str(GO.parent.parent))
    args = [GO, "build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w -buildid=",
            "-o", output, HERE / "launcher.go"]
    result = command(args, env, 300)
    save("BUILD_COMMAND.json", result)
    require(result["exitCode"] == 0, "CANDIDATE_BUILD_FAILED")
    raw = output.read_bytes()
    require(raw[:6] == b"\x7fELF\x02\x01" and struct.unpack_from("<H", raw, 18)[0] == 62, "CAPSULE_ELF_ARCH")
    offset = struct.unpack_from("<Q", raw, 32)[0]
    stride, count = struct.unpack_from("<HH", raw, 54)
    types = [struct.unpack_from("<I", raw, offset + index * stride)[0] for index in range(count)]
    require(3 not in types and 2 not in types, "LAUNCHER_NOT_STATIC")
    source_files = ("entry.py", "assemble.py", "launcher.go", "FROZEN_SOURCE_BINDING.json")
    source_hashes = {name: sha(HERE / name) for name in source_files}
    source_sha = hashlib.sha256(json.dumps(source_hashes, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    save("CANDIDATE_BINDING.json", {
        "status": "OFFLINE_RUNTIME_PACKAGING_CANDIDATE_NOT_PRODUCTION_CAPSULE",
        "sourceDefinition": "SHA256_OF_CANONICAL_SORTED_FILENAME_TO_SHA256_MAP",
        "sourceFileHashes": source_hashes, "sourceSha256": source_sha,
        "binarySha256": sha(output), "binaryBytes": len(raw),
        "arch": "linux/amd64", "outerELFStatic": True, "outerELFInterpreter": "NONE",
        "embeddedRuntimeStatic": False, "embeddedInterpreter": census["pythonELFInterpreter"],
        "runtimeDependencies": "RUNTIME_CENSUS.json",
        "runtimeCensusSha256": sha(HERE / "RUNTIME_CENSUS.json"),
        "payloadArchiveSha256": census["archiveSha256"],
        "toolchain": {"path": str(GO), "sha256": sha(GO), "version": version["stdout"]},
        "permittedEntryPoint": "--self-test <fresh-owned-directory>",
        "productionTransactionEntryPoint": "UNCONDITIONALLY_DISABLED",
        "guestQualification": "NOT_CLAIMED",
        "portableBuilderOrUploaderRebuiltOrRequalified": False,
    })
    print("CANDIDATE_STATIC_LAUNCHER_SHA256=" + sha(output))


if __name__ == "__main__":
    require(len(sys.argv) == 2 and sys.argv[1] in {"assemble", "build"}, "ACTION_REQUIRED")
    {"assemble": assemble, "build": build}[sys.argv[1]]()
